-- Coachvy – spår per gren: en triathlet kan följa en tröskelplan i löpning
-- och en VO2max-plan på cykeln samtidigt.
--
-- Varje startad plan hör till ett spår: grenen dess pass räknas i
-- (cykling, löpning, simning), styrka för en plan med bara pass utan
-- struktur, och alla för en plan med pass i flera grenar. Spåret räknas ur
-- planens version när planen startas och ligger sedan fast.
--
-- En plan i taget per spår är aktiv, och faserna köas per spår. En plan i
-- spåret alla krockar med alla spår, så en triathlonplan går som förut.

alter table public.plan_instances
  add column if not exists track text not null default 'alla'
    check (track in ('cykling', 'löpning', 'simning', 'styrka', 'alla'));

-- Spåret för en version: grenen om alla pass med struktur är i samma gren,
-- styrka om inget pass har struktur, annars alla.
create or replace function public.plan_version_track(p_version uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when count(distinct d.structure_sport) = 1 then min(d.structure_sport)
    when count(distinct d.structure_sport) = 0 then 'styrka'
    else 'alla'
  end
  from public.plan_template_sessions s
  join public.disciplines d on d.key = s.discipline
  where s.version_id = p_version;
$$;

revoke all on function public.plan_version_track(uuid) from public, anon;
grant execute on function public.plan_version_track(uuid) to authenticated;

-- Spåren för flera versioner på en gång, för planbiblioteket och väljaren.
create or replace function public.plan_version_tracks(p_versions uuid[])
returns table (version_id uuid, track text)
language sql
stable
security definer
set search_path = public
as $$
  select v, public.plan_version_track(v) from unnest(p_versions) as v;
$$;

revoke all on function public.plan_version_tracks(uuid[]) from public, anon;
grant execute on function public.plan_version_tracks(uuid[]) to authenticated;

-- Planerna som redan finns får sina spår, innan låset nedan håller dem fasta.
update public.plan_instances
  set track = public.plan_version_track(version_id)
  where track is distinct from public.plan_version_track(version_id);

create index if not exists plan_instances_track_idx
  on public.plan_instances (adept_id, track, status);

-- Krockar två spår? Samma spår, eller något av dem är alla.
create or replace function public.plan_tracks_meet(a text, b text)
returns boolean
language sql
immutable
as $$
  select a = b or a = 'alla' or b = 'alla';
$$;

-- ---------------------------------------------------------------------------
-- Planens lås: en aktiv och en kö per spår
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
    -- Spåret följer versionen, som ligger fast.
    new.track := old.track;
  else
    new.track := public.plan_version_track(new.version_id);
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

  -- En aktiv plan per spår.
  if new.status = 'aktiv' and (tg_op = 'INSERT' or old.status <> 'aktiv') then
    select max_active_plans into v_max from public.plan_library_settings limit 1;
    select count(*) into v_active from public.plan_instances
      where adept_id = new.adept_id and status = 'aktiv' and id <> new.id
        and public.plan_tracks_meet(track, new.track);
    if v_active >= coalesce(v_max, 1) then
      raise exception 'Det finns redan en aktiv plan i samma gren. Avsluta den först.' using errcode = '23505';
    end if;
  end if;

  -- En fas i kö får inte krocka med en annan fas i samma spår.
  if new.status = 'kommande' and exists (
    select 1 from public.plan_instances o
    where o.adept_id = new.adept_id
      and o.id <> new.id
      and o.status in ('aktiv', 'kommande')
      and public.plan_tracks_meet(o.track, new.track)
      and daterange(o.start_date, o.start_date + o.weeks * 7)
          && daterange(new.start_date, new.start_date + new.weeks * 7)
  ) then
    raise exception 'Fasen krockar med en annan fas i samma gren.' using errcode = '23514';
  end if;

  if new.status in ('avslutad', 'avbruten') and new.ended_at is null then
    new.ended_at := now();
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Nästa fas tar vid, spår för spår
-- ---------------------------------------------------------------------------

-- Startar de kommande faser vars första dag har kommit, och avslutar den
-- aktiva planen i samma spår. Ett annat spår rörs inte. Körs när planen
-- visas, av adepten eller coachen.
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

  for v_next in
    select * from public.plan_instances
    where adept_id = p_adept and status = 'kommande' and start_date <= v_today
    order by start_date
  loop
    update public.plan_instances
      set status = 'avslutad'
      where adept_id = p_adept and status = 'aktiv' and id <> v_next.id
        and public.plan_tracks_meet(track, v_next.track);
    update public.plan_instances
      set status = 'aktiv'
      where id = v_next.id and status = 'kommande';
  end loop;
end;
$$;

revoke all on function public.advance_plan_queue(uuid) from public, anon;
grant execute on function public.advance_plan_queue(uuid) to authenticated;
