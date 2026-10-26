-- Coachvy – faser i kö: grund, uppbyggnad, specifik och toppning som var
-- sin plan, efter varandra på en adept.
--
-- En plan i kö är en vanlig startad plan med status 'kommande' och sina
-- datum. Bara en plan är aktiv åt gången, som förut. När den aktiva planens
-- sista vecka är slut avslutas den och nästa kommande tar vid
-- (advance_plan_queue, som appen kör när planen visas).
--
-- Coachen lägger planer på sina egna adepter: en plan coachen äger eller
-- som delats med coachen. Den får åtkomsten 'coach' och kräver inget
-- medlemskap, som det coachen delat med adepten (library_sharing).

alter table public.plan_instances drop constraint if exists plan_instances_status_check;
alter table public.plan_instances
  add constraint plan_instances_status_check
    check (status in ('aktiv', 'kommande', 'avslutad', 'avbruten'));

create index if not exists plan_instances_queue_idx
  on public.plan_instances (adept_id, start_date) where status = 'kommande';

alter table public.plan_instance_events drop constraint if exists plan_instance_events_kind_check;
alter table public.plan_instance_events
  add constraint plan_instance_events_kind_check
    check (kind in ('startad', 'köad', 'pausad', 'återupptagen', 'flyttad', 'avslutad', 'avbruten'));

-- ---------------------------------------------------------------------------
-- Coachen lägger en plan på sin adept
-- ---------------------------------------------------------------------------

-- Får den inloggade coachen lägga planen på adepten? Adepten är coachens,
-- och planen är coachens egen eller delad med coachen.
create or replace function public.coach_can_assign_plan(p_adept uuid, p_template uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.adepts a
    join public.plan_templates t on t.id = p_template
    where a.id = p_adept
      and a.coach_id = auth.uid()
      and t.archived_at is null
      and (t.owner_id = auth.uid() or public.template_shared_with_me(t.id, t.owner_id))
  );
$$;

revoke all on function public.coach_can_assign_plan(uuid, uuid) from public, anon;
grant execute on function public.coach_can_assign_plan(uuid, uuid) to authenticated;

-- Åtkomsten sätts när planen läggs på och ligger sedan fast. Coachens egen
-- tilldelning går före medlemskapet.
create or replace function public.guard_plan_instance_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.access := case
      when public.coach_can_assign_plan(new.adept_id, new.template_id) then 'coach'
      else public.plan_access_for(new.adept_id, new.template_id)
    end;
    if new.access is null then
      raise exception 'Planen är inte tillgänglig för adepten.' using errcode = '42501';
    end if;
  elsif new.access is distinct from old.access then
    raise exception 'Planens åtkomst ligger fast.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_plan_instance_access() from public, anon, authenticated;

drop policy if exists "Medlem eller coach startar en plan" on public.plan_instances;
create policy "Medlem eller coach startar en plan"
  on public.plan_instances for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and public.can_view_adept(adept_id)
    and (
      public.plan_access_for(adept_id, template_id) is not null
      or public.coach_can_assign_plan(adept_id, template_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Planens lås: 'kommande' blir 'aktiv' när det är dags
-- ---------------------------------------------------------------------------

create or replace function public.guard_plan_instance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
  v_active int;
  v_bad int;
begin
  if tg_op = 'UPDATE' then
    if new.adept_id <> old.adept_id or new.template_id <> old.template_id
       or new.version_id <> old.version_id or new.start_level_id <> old.start_level_id
       or new.created_by is distinct from old.created_by then
      raise exception 'Planens version, adept och startnivå ligger fast.' using errcode = '42501';
    end if;
    if old.status in ('avslutad', 'avbruten') and new.status in ('aktiv', 'kommande') then
      raise exception 'En avslutad plan startas inte om. Starta en ny.' using errcode = '42501';
    end if;
    if old.status = 'aktiv' and new.status = 'kommande' then
      raise exception 'En aktiv plan läggs inte tillbaka i kön.' using errcode = '42501';
    end if;
  end if;

  -- Bara en publicerad version kan startas.
  if tg_op = 'INSERT' and not exists (
    select 1 from public.plan_template_versions
    where id = new.version_id and template_id = new.template_id and status = 'publicerad'
  ) then
    raise exception 'Planen är inte publicerad.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.plan_template_levels
    where id = new.start_level_id and version_id = new.version_id
  ) then
    raise exception 'Nivån hör inte till planen.' using errcode = '23514';
  end if;

  -- Veckokartan pekar bara på veckor i versionen.
  select count(*) into v_bad
  from jsonb_array_elements_text(new.week_map) e(id)
  where not exists (
    select 1 from public.plan_template_weeks w
    where w.id::text = e.id and w.version_id = new.version_id
  );
  if v_bad > 0 then
    raise exception 'Veckokartan pekar utanför planen.' using errcode = '23514';
  end if;

  if new.race_id is not null and not exists (
    select 1 from public.adept_races where id = new.race_id and adept_id = new.adept_id
  ) then
    raise exception 'Loppet hör till en annan adept.' using errcode = '23514';
  end if;

  if new.status = 'aktiv' and (tg_op = 'INSERT' or old.status <> 'aktiv') then
    select max_active_plans into v_max from public.plan_library_settings limit 1;
    select count(*) into v_active from public.plan_instances
      where adept_id = new.adept_id and status = 'aktiv' and id <> new.id;
    if v_active >= coalesce(v_max, 1) then
      raise exception 'Det finns redan en aktiv plan. Avsluta den först.' using errcode = '23505';
    end if;
  end if;

  -- En fas i kö får inte krocka med en annan fas i kö eller med den aktiva.
  if new.status = 'kommande' and exists (
    select 1 from public.plan_instances o
    where o.adept_id = new.adept_id
      and o.id <> new.id
      and o.status in ('aktiv', 'kommande')
      and daterange(o.start_date, o.start_date + o.weeks * 7)
          && daterange(new.start_date, new.start_date + new.weeks * 7)
  ) then
    raise exception 'Fasen krockar med en annan fas i kön.' using errcode = '23514';
  end if;

  if new.status in ('avslutad', 'avbruten') and new.ended_at is null then
    new.ended_at := now();
  end if;
  return new;
end;
$$;

-- En fas i kö loggas som köad, och som startad när den tar vid.
create or replace function public.log_plan_instance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.plan_instance_events (instance_id, adept_id, kind, detail, created_by)
    values (new.id, new.adept_id,
      case when new.status = 'kommande' then 'köad' else 'startad' end,
      jsonb_build_object('start_date', new.start_date, 'weeks', new.weeks), auth.uid());
  elsif new.status <> old.status then
    insert into public.plan_instance_events (instance_id, adept_id, kind, created_by)
    values (new.id, new.adept_id,
      case when new.status = 'aktiv' then 'startad' else new.status end, auth.uid());
  elsif new.start_date <> old.start_date or new.week_map <> old.week_map then
    insert into public.plan_instance_events (instance_id, adept_id, kind, detail, created_by)
    values (new.id, new.adept_id, 'flyttad',
      jsonb_build_object('from', old.start_date, 'to', new.start_date, 'weeks', new.weeks),
      auth.uid());
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Nästa fas tar vid
-- ---------------------------------------------------------------------------

-- Avslutar den aktiva planen när dess sista vecka är slut och en fas väntar
-- i kön, och startar den kommande fas vars första dag har kommit. Körs när
-- planen visas, av adepten eller coachen. Utan kö händer ingenting.
create or replace function public.advance_plan_queue(p_adept uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Stockholm')::date;
  v_next public.plan_instances%rowtype;
begin
  if not public.can_view_adept(p_adept) then
    return;
  end if;

  select * into v_next from public.plan_instances
    where adept_id = p_adept and status = 'kommande' and start_date <= v_today
    order by start_date
    limit 1;
  if not found then
    return;
  end if;

  update public.plan_instances
    set status = 'avslutad'
    where adept_id = p_adept and status = 'aktiv';

  update public.plan_instances
    set status = 'aktiv'
    where id = v_next.id;
end;
$$;

revoke all on function public.advance_plan_queue(uuid) from public, anon;
grant execute on function public.advance_plan_queue(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Löpplanerna per fas: grund, tröskel, VO2max, toppning och övergång leder
-- inte mot ett bestämt lopp och samlas under Löpning.
-- ---------------------------------------------------------------------------

insert into public.plan_categories (key, name, sort) values ('lopning', 'Löpning', 45)
on conflict (key) do nothing;
