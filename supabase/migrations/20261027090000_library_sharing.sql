-- Coachvy – delning av planer och pass.
--
-- Ett pass i passbiblioteket och en plan i planbiblioteket har en ägare, och
-- ägaren väljer vem som ser dem. Varje mottagare är en rad i library_shares:
--
--   adepter     alla ägarens adepter
--   adept       en utvald adept, som ska vara ägarens
--   medlemmar   alla medlemmar i Coachvy; admin granskar först, om ägaren
--               inte själv är admin
--   coacher     alla coacher
--   coach       en utvald coach
--
-- Utan rader är det privat. Bara ägaren ändrar originalet; mottagarna
-- använder det och kopierar det till sitt eget bibliotek.
--
-- Grupper ("Ironman Kalmar 2027") läggs till senare som en mottagare till:
-- ett värde i audience, en kolumn group_id och ett villkor i
-- share_reaches_me. Resten av modellen, policyerna och appen läser bara
-- funktionerna och behöver inte ändras.
--
-- Tre regler till, som Alexander beslutat:
--
--   - Planer bygger coacher med medlemskap och admin (can_build_plans).
--   - En coachs egna adepter behöver inget medlemskap för det coachen delat
--     med dem. En plan de startar så har åtkomsten 'coach' och pausas inte
--     när ett medlemskap upphör.
--   - Det som delas med alla medlemmar granskas av admin. En ny version av
--     planen, eller en ändring i passet, skickar det till granskning igen.

-- ---------------------------------------------------------------------------
-- Planerna får en ägare
-- ---------------------------------------------------------------------------

alter table public.plan_templates
  add column if not exists owner_id uuid references public.profiles (id) on delete set null;

-- Alla planer hittills är skrivna av admin.
update public.plan_templates
set owner_id = coalesce(
  created_by,
  (select profile_id from public.admins order by created_at limit 1)
)
where owner_id is null;

alter table public.plan_templates alter column owner_id set default auth.uid();

comment on column public.plan_templates.owner_id is
  'Coachen eller admin som äger planen. Null: ägaren finns inte längre, och admin förvaltar planen.';

create index if not exists plan_templates_owner_idx on public.plan_templates (owner_id);

-- ---------------------------------------------------------------------------
-- Mottagarna
-- ---------------------------------------------------------------------------

create table if not exists public.library_shares (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.session_library (id) on delete cascade,
  template_id uuid references public.plan_templates (id) on delete cascade,
  audience text not null
    check (audience in ('adepter', 'adept', 'medlemmar', 'coacher', 'coach')),
  adept_id uuid references public.adepts (id) on delete cascade,
  coach_id uuid references public.coaches (id) on delete cascade,
  -- aktiv: syns för mottagarna. granskas och avslagen gäller bara medlemmar.
  status text not null default 'aktiv'
    check (status in ('aktiv', 'granskas', 'avslagen')),
  review_note text check (review_note is null or char_length(review_note) <= 500),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_by uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint library_shares_one_item check (num_nonnulls(session_id, template_id) = 1),
  constraint library_shares_adept check ((audience = 'adept') = (adept_id is not null)),
  constraint library_shares_coach check ((audience = 'coach') = (coach_id is not null)),
  constraint library_shares_review check (status = 'aktiv' or audience = 'medlemmar')
);

comment on table public.library_shares is
  'Vem som ser ett pass eller en plan. Utan rader är det bara ägarens.';

create unique index if not exists library_shares_unique
  on public.library_shares (
    coalesce(session_id, template_id),
    audience,
    coalesce(adept_id, coach_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
create index if not exists library_shares_session_idx
  on public.library_shares (session_id) where session_id is not null;
create index if not exists library_shares_template_idx
  on public.library_shares (template_id) where template_id is not null;
create index if not exists library_shares_review_idx
  on public.library_shares (created_at) where status = 'granskas';

-- ---------------------------------------------------------------------------
-- Vem når en delning?
-- ---------------------------------------------------------------------------

-- Når delningen den inloggade? Ägaren behövs för "alla mina adepter".
-- Grupper blir ett villkor till här.
create or replace function public.share_reaches_me(
  p_audience text, p_status text, p_adept uuid, p_coach uuid, p_owner uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_status = 'aktiv' and case p_audience
    when 'medlemmar' then exists (
      select 1 from public.adepts a
      where a.profile_id = auth.uid() and a.plan = 'medlem'
    )
    when 'coacher' then exists (select 1 from public.coaches c where c.id = auth.uid())
    when 'coach' then p_coach = auth.uid()
    when 'adepter' then exists (
      select 1 from public.adepts a
      where a.profile_id = auth.uid() and a.coach_id = p_owner
    )
    when 'adept' then exists (
      select 1 from public.adepts a
      where a.id = p_adept and a.profile_id = auth.uid() and a.coach_id = p_owner
    )
    else false
  end;
$$;

create or replace function public.session_shared_with_me(p_session uuid, p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.library_shares s
    where s.session_id = p_session
      and public.share_reaches_me(s.audience, s.status, s.adept_id, s.coach_id, p_owner)
  );
$$;

create or replace function public.template_shared_with_me(p_template uuid, p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.library_shares s
    where s.template_id = p_template
      and public.share_reaches_me(s.audience, s.status, s.adept_id, s.coach_id, p_owner)
  );
$$;

-- Äger den inloggade passet eller planen som en delning gäller?
create or replace function public.owns_library_item(p_session uuid, p_template uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
      select 1 from public.session_library l
      where l.id = p_session and l.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.plan_templates t
      where t.id = p_template and t.owner_id = auth.uid()
    );
$$;

-- Får den inloggade bygga planer? Coacher med medlemskap och admin.
create or replace function public.can_build_plans()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1 from public.coaches c
      where c.id = auth.uid() and c.plan = 'medlem'
    );
$$;

-- Får den inloggade ändra planen? Ägaren, så länge hen får bygga planer,
-- och admin.
create or replace function public.can_write_plan_template(p_template uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1 from public.plan_templates t
      where t.id = p_template
        and t.owner_id = auth.uid()
        and public.can_build_plans()
    );
$$;

create or replace function public.can_write_plan_version(p_version uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.plan_template_versions v
    where v.id = p_version and public.can_write_plan_template(v.template_id)
  );
$$;

-- Är passet eller planen delad med alla medlemmar? Då granskar och ser
-- admin det; andra coachers privata pass och planer ser admin inte.
create or replace function public.library_in_review(p_session uuid, p_template uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.library_shares s
    where s.audience = 'medlemmar'
      and (s.session_id = p_session or s.template_id = p_template)
  );
$$;

revoke all on function public.library_in_review(uuid, uuid) from public, anon;
grant execute on function public.library_in_review(uuid, uuid) to authenticated;
revoke all on function public.share_reaches_me(text, text, uuid, uuid, uuid) from public, anon;
revoke all on function public.session_shared_with_me(uuid, uuid) from public, anon;
revoke all on function public.template_shared_with_me(uuid, uuid) from public, anon;
revoke all on function public.owns_library_item(uuid, uuid) from public, anon;
revoke all on function public.can_build_plans() from public, anon;
revoke all on function public.can_write_plan_template(uuid) from public, anon;
revoke all on function public.can_write_plan_version(uuid) from public, anon;
grant execute on function public.share_reaches_me(text, text, uuid, uuid, uuid) to authenticated;
grant execute on function public.session_shared_with_me(uuid, uuid) to authenticated;
grant execute on function public.template_shared_with_me(uuid, uuid) to authenticated;
grant execute on function public.owns_library_item(uuid, uuid) to authenticated;
grant execute on function public.can_build_plans() to authenticated;
grant execute on function public.can_write_plan_template(uuid) to authenticated;
grant execute on function public.can_write_plan_version(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Delningens regler: rätt mottagare, och granskning av medlemsdelning
-- ---------------------------------------------------------------------------

create or replace function public.guard_library_share()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if new.session_id is not null then
    select owner_id into v_owner from public.session_library where id = new.session_id;
  else
    select owner_id into v_owner from public.plan_templates where id = new.template_id;
  end if;

  if new.audience = 'adept' and not exists (
    select 1 from public.adepts a where a.id = new.adept_id and a.coach_id = v_owner
  ) then
    raise exception 'Adepten är inte din.' using errcode = '23514';
  end if;

  if new.audience = 'coach' and new.coach_id = v_owner then
    raise exception 'Du ser redan det du själv äger.' using errcode = '23514';
  end if;

  -- Granskningen sätts här och av review_library_share, aldrig av ägaren.
  if new.audience = 'medlemmar' then
    new.status := case
      when exists (select 1 from public.admins where profile_id = v_owner) then 'aktiv'
      else 'granskas'
    end;
  else
    new.status := 'aktiv';
  end if;
  new.review_note := null;
  new.reviewed_at := null;
  new.reviewed_by := null;
  return new;
end;
$$;

drop trigger if exists library_shares_guard on public.library_shares;
create trigger library_shares_guard
  before insert on public.library_shares
  for each row execute function public.guard_library_share();

-- Admin godkänner eller avslår en delning med alla medlemmar.
create or replace function public.review_library_share(
  p_share uuid, p_approve boolean, p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Bara admin granskar.' using errcode = '42501';
  end if;
  update public.library_shares
  set status = case when p_approve then 'aktiv' else 'avslagen' end,
      review_note = nullif(trim(coalesce(p_note, '')), ''),
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = p_share and audience = 'medlemmar';
  if not found then
    raise exception 'Det finns ingen delning med medlemmar att granska.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.review_library_share(uuid, boolean, text) from public, anon;
grant execute on function public.review_library_share(uuid, boolean, text) to authenticated;

-- Tillbaka till granskning: en coachs pass som ändras, eller en plan som får
-- en ny version, ska granskas igen innan medlemmarna ser det nya.
create or replace function public.resubmit_library_shares(p_session uuid, p_template uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.library_shares
  set status = 'granskas', reviewed_at = null, reviewed_by = null
  where audience = 'medlemmar'
    and status <> 'granskas'
    and (session_id = p_session or template_id = p_template);
$$;

revoke all on function public.resubmit_library_shares(uuid, uuid) from public, anon, authenticated;

create or replace function public.session_library_resubmit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (to_jsonb(new) - 'updated_at') is distinct from (to_jsonb(old) - 'updated_at')
     and not exists (select 1 from public.admins where profile_id = new.owner_id) then
    perform public.resubmit_library_shares(new.id, null);
  end if;
  return new;
end;
$$;

drop trigger if exists session_library_resubmit on public.session_library;
create trigger session_library_resubmit
  after update on public.session_library
  for each row execute function public.session_library_resubmit();

revoke all on function public.guard_library_share() from public, anon, authenticated;
revoke all on function public.session_library_resubmit() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS: mottagarna
-- ---------------------------------------------------------------------------

alter table public.library_shares enable row level security;

-- Ägaren ser vem passet eller planen är delad med. Mottagarna behöver inte
-- läsa raderna; vad de ser avgör funktionerna ovan.
drop policy if exists "Ägaren läser sina delningar" on public.library_shares;
create policy "Ägaren läser sina delningar"
  on public.library_shares for select
  to authenticated
  using (public.is_admin() or public.owns_library_item(session_id, template_id));

-- Ägaren delar. En plan delas av den som får bygga planer.
drop policy if exists "Ägaren delar" on public.library_shares;
create policy "Ägaren delar"
  on public.library_shares for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and public.owns_library_item(session_id, template_id)
    and (template_id is null or public.can_build_plans())
  );

-- Ägaren slutar dela; admin kan ta bort en delning. Ändras gör de inte –
-- granskningen går via review_library_share.
drop policy if exists "Ägaren slutar dela" on public.library_shares;
create policy "Ägaren slutar dela"
  on public.library_shares for delete
  to authenticated
  using (public.is_admin() or public.owns_library_item(session_id, template_id));

grant select, insert, delete on public.library_shares to authenticated;

-- ---------------------------------------------------------------------------
-- Passbiblioteket: delningen flyttar från kolumnen shared till mottagarna
-- ---------------------------------------------------------------------------

-- Det som var delat med alla coacher förblir det.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'session_library' and column_name = 'shared'
  ) then
    insert into public.library_shares (session_id, audience, created_by)
    select l.id, 'coacher', l.owner_id
    from public.session_library l
    where l.shared
    on conflict do nothing;
  end if;
end;
$$;

drop policy if exists "Läs egna och delade pass" on public.session_library;
drop policy if exists "Läs egna pass och det som delats" on public.session_library;
create policy "Läs egna pass och det som delats"
  on public.session_library for select
  to authenticated
  using (
    owner_id = auth.uid()
    or public.session_shared_with_me(id, owner_id)
    or (public.is_admin() and public.library_in_review(id, null))
  );

drop policy if exists "Coach lägger till pass" on public.session_library;
create policy "Coach lägger till pass"
  on public.session_library for insert
  to authenticated
  with check (owner_id = auth.uid() and (public.is_coach() or public.is_admin()));

drop policy if exists "Ägaren ändrar sina pass" on public.session_library;
create policy "Ägaren ändrar sina pass"
  on public.session_library for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop index if exists public.session_library_shared_idx;
alter table public.session_library drop column if exists shared;

-- ---------------------------------------------------------------------------
-- Planbiblioteket: läsa
-- ---------------------------------------------------------------------------

-- Planerna som fanns ser medlemmarna och coacherna som förut.
insert into public.library_shares (template_id, audience, created_by)
select t.id, a.audience, t.owner_id
from public.plan_templates t
cross join (values ('medlemmar'), ('coacher')) as a (audience)
where t.owner_id is not null
on conflict do nothing;

-- Versionen: ägaren alla, mottagarna den publicerade, admin det som delats
-- med medlemmar, och den version en plan man ser bygger på – också när den
-- arkiverats eller delningen tagits bort.
create or replace function public.can_read_plan_version(plan_version uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
      select 1
      from public.plan_template_versions v
      join public.plan_templates t on t.id = v.template_id
      where v.id = plan_version
        and (
          t.owner_id = auth.uid()
          or (t.owner_id is null and public.is_admin())
          or (v.status = 'publicerad' and public.template_shared_with_me(t.id, t.owner_id))
          or (public.is_admin() and public.library_in_review(null, t.id))
        )
    )
    or exists (
      select 1 from public.plan_instances i
      where i.version_id = plan_version
        and public.can_view_adept(i.adept_id)
    );
$$;

drop policy if exists "Läs mallar" on public.plan_templates;
create policy "Läs mallar"
  on public.plan_templates for select
  to authenticated
  using (
    owner_id = auth.uid()
    or (owner_id is null and public.is_admin())
    or (public.is_admin() and public.library_in_review(null, id))
    or (archived_at is null and public.template_shared_with_me(id, owner_id))
    or exists (
      select 1 from public.plan_instances i
      where i.template_id = plan_templates.id and public.can_view_adept(i.adept_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Planbiblioteket: skriva – från admin till ägaren
-- ---------------------------------------------------------------------------

drop policy if exists "Admin skriver mallar" on public.plan_templates;
drop policy if exists "Ägaren lägger till mallar" on public.plan_templates;
create policy "Ägaren lägger till mallar"
  on public.plan_templates for insert
  to authenticated
  with check ((owner_id = auth.uid() and public.can_build_plans()) or public.is_admin());

drop policy if exists "Ägaren ändrar mallar" on public.plan_templates;
create policy "Ägaren ändrar mallar"
  on public.plan_templates for update
  to authenticated
  using (public.can_write_plan_template(id))
  with check ((owner_id = auth.uid() and public.can_build_plans()) or public.is_admin());

drop policy if exists "Ägaren tar bort mallar" on public.plan_templates;
create policy "Ägaren tar bort mallar"
  on public.plan_templates for delete
  to authenticated
  using (public.can_write_plan_template(id));

drop policy if exists "Admin skriver versioner" on public.plan_template_versions;
drop policy if exists "Ägaren skriver versioner" on public.plan_template_versions;
create policy "Ägaren skriver versioner"
  on public.plan_template_versions for all
  to authenticated
  using (public.can_write_plan_template(template_id))
  with check (public.can_write_plan_template(template_id));

do $$
declare t text;
begin
  foreach t in array array[
    'plan_template_levels', 'plan_template_phases', 'plan_template_weeks',
    'plan_template_sessions', 'plan_template_session_variants',
    'plan_template_week_volumes'
  ] loop
    execute format('drop policy if exists "Admin skriver innehåll" on public.%I', t);
    execute format('drop policy if exists "Ägaren skriver innehåll" on public.%I', t);
    execute format(
      'create policy "Ägaren skriver innehåll" on public.%I for all to authenticated
         using (public.can_write_plan_version(version_id))
         with check (public.can_write_plan_version(version_id))', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Innehållet kopieras på ett ställe: nytt utkast och kopia av en plan
-- ---------------------------------------------------------------------------

-- Kopierar nivåer, faser, veckor, pass, varianter och volymer från en
-- version till ett tomt utkast.
create or replace function public.copy_plan_version_content(p_src uuid, p_dst uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Gammalt id → nytt id för nivåer, faser, veckor och pass.
  v_map jsonb;
begin
  select coalesce(jsonb_object_agg(id::text, gen_random_uuid()), '{}'::jsonb)
    into v_map
  from (
    select id from public.plan_template_levels where version_id = p_src
    union all
    select id from public.plan_template_phases where version_id = p_src
    union all
    select id from public.plan_template_weeks where version_id = p_src
    union all
    select id from public.plan_template_sessions where version_id = p_src
  ) ids;

  insert into public.plan_template_levels (
    id, version_id, rank, key, name, description, hours_min, hours_max,
    sessions_min, sessions_max, intensity
  )
  select (v_map ->> l.id::text)::uuid, p_dst, l.rank, l.key, l.name, l.description,
    l.hours_min, l.hours_max, l.sessions_min, l.sessions_max, l.intensity
  from public.plan_template_levels l
  where l.version_id = p_src;

  insert into public.plan_template_phases (
    id, version_id, position, name, season_phase, purpose, focus, specificity,
    intensity, min_weeks, trim_order
  )
  select (v_map ->> p.id::text)::uuid, p_dst, p.position, p.name, p.season_phase,
    p.purpose, p.focus, p.specificity, p.intensity, p.min_weeks, p.trim_order
  from public.plan_template_phases p
  where p.version_id = p_src;

  insert into public.plan_template_weeks (
    id, version_id, phase_id, position, kind, title, note, checkpoint
  )
  select (v_map ->> w.id::text)::uuid, p_dst,
    (v_map ->> w.phase_id::text)::uuid, w.position, w.kind, w.title, w.note, w.checkpoint
  from public.plan_template_weeks w
  where w.version_id = p_src;

  insert into public.plan_template_sessions (
    id, version_id, week_id, day, position, discipline, type, title, description
  )
  select (v_map ->> s.id::text)::uuid, p_dst,
    (v_map ->> s.week_id::text)::uuid, s.day, s.position, s.discipline, s.type,
    s.title, s.description
  from public.plan_template_sessions s
  where s.version_id = p_src;

  insert into public.plan_template_session_variants (
    version_id, session_id, level_id, description, duration_s, distance_m, zone, basis, blocks
  )
  select p_dst, (v_map ->> x.session_id::text)::uuid,
    (v_map ->> x.level_id::text)::uuid, x.description, x.duration_s, x.distance_m,
    x.zone, x.basis, x.blocks
  from public.plan_template_session_variants x
  where x.version_id = p_src;

  insert into public.plan_template_week_volumes (
    version_id, week_id, level_id, volume_min, volume_max
  )
  select p_dst, (v_map ->> v.week_id::text)::uuid, (v_map ->> v.level_id::text)::uuid,
    v.volume_min, v.volume_max
  from public.plan_template_week_volumes v
  where v.version_id = p_src;
end;
$$;

revoke all on function public.copy_plan_version_content(uuid, uuid) from public, anon, authenticated;

-- Ett nytt utkast som kopia av mallens senaste version. Finns redan ett
-- utkast blir det svaret. Ägaren och admin.
create or replace function public.new_plan_draft(template uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src public.plan_template_versions%rowtype;
  v_new uuid;
begin
  if not public.can_write_plan_template(template) then
    raise exception 'Bara planens ägare ändrar den.' using errcode = '42501';
  end if;
  select id into v_new from public.plan_template_versions
    where template_id = template and status = 'utkast';
  if found then return v_new; end if;

  select * into v_src from public.plan_template_versions
    where template_id = template order by version desc limit 1;
  if not found then
    raise exception 'Mallen har ingen version att utgå från.' using errcode = 'P0002';
  end if;

  insert into public.plan_template_versions (
    template_id, version, status, title, summary, goal, description,
    prerequisites, min_weeks, max_weeks, volume_unit, created_by
  ) values (
    template, v_src.version + 1, 'utkast', v_src.title, v_src.summary, v_src.goal,
    v_src.description, v_src.prerequisites, v_src.min_weeks, v_src.max_weeks,
    v_src.volume_unit, auth.uid()
  ) returning id into v_new;

  perform public.copy_plan_version_content(v_src.id, v_new);
  return v_new;
end;
$$;

-- En kopia av en plan i det egna planbiblioteket, som utkast. Av en egen
-- plan kopieras den senaste versionen, av någon annans den publicerade.
create or replace function public.copy_plan_template(p_template uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.plan_templates%rowtype;
  v_src public.plan_template_versions%rowtype;
  v_own boolean;
  v_base text;
  v_slug text;
  v_n int := 2;
  v_template uuid;
  v_version uuid;
begin
  if not public.can_build_plans() then
    raise exception 'Att bygga planer ingår i medlemskapet för coacher.' using errcode = '42501';
  end if;
  select * into t from public.plan_templates where id = p_template;
  if not found then
    raise exception 'Planen finns inte.' using errcode = 'P0002';
  end if;
  v_own := coalesce(t.owner_id = auth.uid(), false) or public.is_admin();
  if not v_own and not (t.archived_at is null and public.template_shared_with_me(t.id, t.owner_id)) then
    raise exception 'Planen är inte delad med dig.' using errcode = '42501';
  end if;

  select * into v_src from public.plan_template_versions
    where template_id = p_template
      and (v_own or status = 'publicerad')
    order by version desc limit 1;
  if not found then
    raise exception 'Planen har ingen version att kopiera.' using errcode = 'P0002';
  end if;

  v_base := left(regexp_replace(t.slug, '-kopia(-[0-9]+)?$', ''), 52) || '-kopia';
  v_slug := v_base;
  while exists (select 1 from public.plan_templates where slug = v_slug) loop
    v_slug := v_base || '-' || v_n;
    v_n := v_n + 1;
  end loop;

  insert into public.plan_templates (slug, category_id, race_distance_m, created_by, owner_id)
  values (v_slug, t.category_id, t.race_distance_m, auth.uid(), auth.uid())
  returning id into v_template;

  insert into public.plan_template_versions (
    template_id, version, status, title, summary, goal, description,
    prerequisites, min_weeks, max_weeks, volume_unit, created_by
  ) values (
    v_template, 1, 'utkast',
    left(case when t.owner_id = auth.uid() then v_src.title || ' (kopia)' else v_src.title end, 120),
    v_src.summary, v_src.goal, v_src.description, v_src.prerequisites,
    v_src.min_weeks, v_src.max_weeks, v_src.volume_unit, auth.uid()
  ) returning id into v_version;

  perform public.copy_plan_version_content(v_src.id, v_version);
  return v_template;
end;
$$;

revoke all on function public.new_plan_draft(uuid) from public, anon;
revoke all on function public.copy_plan_template(uuid) from public, anon;
grant execute on function public.new_plan_draft(uuid) to authenticated;
grant execute on function public.copy_plan_template(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Publicera: ägaren och admin, och en ny version granskas igen
-- ---------------------------------------------------------------------------

create or replace function public.publish_plan_version(draft uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.plan_template_versions%rowtype;
  v_weeks int;
  v_min_sum int;
  v_problem text;
begin
  select * into v from public.plan_template_versions where id = draft for update;
  if not found then
    raise exception 'Ingen version med det id:t.' using errcode = 'P0002';
  end if;
  if not public.can_write_plan_template(v.template_id) then
    raise exception 'Bara planens ägare publicerar den.' using errcode = '42501';
  end if;
  if v.status <> 'utkast' then
    raise exception 'Versionen är redan publicerad.' using errcode = '22023';
  end if;

  select count(*) into v_weeks from public.plan_template_weeks where version_id = draft;
  select coalesce(sum(least(p.min_weeks, (
      select count(*) from public.plan_template_weeks w where w.phase_id = p.id
    ))), 0)
    into v_min_sum
  from public.plan_template_phases p where p.version_id = draft;

  v_problem := case
    when not exists (select 1 from public.plan_template_levels where version_id = draft)
      then 'Planen har inga nivåer.'
    when not exists (select 1 from public.plan_template_phases where version_id = draft)
      then 'Planen har inga faser.'
    when exists (
      select 1 from public.plan_template_phases p
      where p.version_id = draft
        and not exists (select 1 from public.plan_template_weeks w where w.phase_id = p.id)
    ) then 'En fas saknar veckor.'
    when v_weeks <> v.max_weeks
      then format('Planen har %s veckor men längst %s.', v_weeks, v.max_weeks)
    when v_min_sum > v.min_weeks
      then format('Faserna kan inte kortas till %s veckor, kortast %s.', v.min_weeks, v_min_sum)
    else null
  end;
  -- Veckorna ska ligga i fasernas ordning.
  if v_problem is null and exists (
    select 1
    from public.plan_template_weeks a
    join public.plan_template_phases pa on pa.id = a.phase_id
    join public.plan_template_weeks b on b.version_id = a.version_id and b.position > a.position
    join public.plan_template_phases pb on pb.id = b.phase_id
    where a.version_id = draft and pb.position < pa.position
  ) then
    v_problem := 'Veckorna ligger inte i fasernas ordning.';
  end if;
  if v_problem is not null then
    raise exception '%', v_problem using errcode = '23514';
  end if;

  perform set_config('coachvy.publishing', 'on', true);
  update public.plan_template_versions
    set status = 'arkiverad'
    where template_id = v.template_id and status = 'publicerad';
  update public.plan_template_versions
    set status = 'publicerad', published_at = now(), published_by = auth.uid()
    where id = draft;
  perform set_config('coachvy.publishing', 'off', true);

  -- Medlemmarna ser den nya versionen först när den granskats, om ägaren
  -- inte är admin.
  if not exists (
    select 1 from public.admins a
    join public.plan_templates t on t.owner_id = a.profile_id
    where t.id = v.template_id
  ) then
    perform public.resubmit_library_shares(null, v.template_id);
  end if;
  return draft;
end;
$$;

revoke all on function public.publish_plan_version(uuid) from public, anon;
grant execute on function public.publish_plan_version(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Startade planer: åtkomst via coachen eller via medlemskapet
-- ---------------------------------------------------------------------------

alter table public.plan_instances
  add column if not exists access text not null default 'medlem'
    check (access in ('medlem', 'coach'));

comment on column public.plan_instances.access is
  'coach: adeptens coach delade planen med adepten, inget medlemskap krävs. medlem: planen ingår i medlemskapet.';

-- Hur adepten når planen: via sin coach, via medlemskapet, eller inte alls.
create or replace function public.plan_access_for(p_adept uuid, p_template uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1
      from public.adepts a
      join public.plan_templates t on t.id = p_template and t.owner_id = a.coach_id
      join public.library_shares s on s.template_id = t.id
      where a.id = p_adept
        and t.archived_at is null
        and s.status = 'aktiv'
        and (s.audience = 'adepter' or (s.audience = 'adept' and s.adept_id = a.id))
    ) then 'coach'
    when exists (
      select 1 from public.adepts a where a.id = p_adept and a.plan = 'medlem'
    ) and exists (
      select 1
      from public.plan_templates t
      join public.library_shares s on s.template_id = t.id
      where t.id = p_template
        and t.archived_at is null
        and s.status = 'aktiv'
        and s.audience = 'medlemmar'
    ) then 'medlem'
    else null
  end;
$$;

revoke all on function public.plan_access_for(uuid, uuid) from public, anon;
grant execute on function public.plan_access_for(uuid, uuid) to authenticated;

-- Åtkomsten sätts när planen startas och ligger sedan fast.
create or replace function public.guard_plan_instance_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.access := public.plan_access_for(new.adept_id, new.template_id);
    if new.access is null then
      raise exception 'Planen är inte tillgänglig för adepten.' using errcode = '42501';
    end if;
  elsif new.access is distinct from old.access then
    raise exception 'Planens åtkomst ligger fast.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists plan_instances_access on public.plan_instances;
create trigger plan_instances_access
  before insert or update on public.plan_instances
  for each row execute function public.guard_plan_instance_access();

revoke all on function public.guard_plan_instance_access() from public, anon, authenticated;

-- Får den inloggade ändra den startade planen? Adepten och adeptens coach,
-- när planen kom från coachen eller adepten är medlem.
create or replace function public.can_edit_plan_instance(p_instance uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.plan_instances i
    join public.adepts a on a.id = i.adept_id
    where i.id = p_instance
      and (a.profile_id = auth.uid() or a.coach_id = auth.uid())
      and (i.access = 'coach' or a.plan = 'medlem')
  );
$$;

revoke all on function public.can_edit_plan_instance(uuid) from public, anon;
grant execute on function public.can_edit_plan_instance(uuid) to authenticated;

drop policy if exists "Medlem eller coach startar en plan" on public.plan_instances;
create policy "Medlem eller coach startar en plan"
  on public.plan_instances for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and public.can_view_adept(adept_id)
    and public.plan_access_for(adept_id, template_id) is not null
  );

drop policy if exists "Medlem eller coach ändrar en plan" on public.plan_instances;
create policy "Medlem eller coach ändrar en plan"
  on public.plan_instances for update
  to authenticated
  using (public.can_edit_plan_instance(id))
  with check (public.can_edit_plan_instance(id));

drop policy if exists "Medlem eller coach byter nivå" on public.plan_level_changes;
create policy "Medlem eller coach byter nivå"
  on public.plan_level_changes for insert
  to authenticated
  with check (
    public.can_edit_plan_instance(instance_id)
    and created_by = auth.uid()
    and (
      source = 'ai'
      or (source = 'coach') = public.is_adept_coach(adept_id)
    )
  );

drop policy if exists "Medlem eller coach återkallar ett framtida byte" on public.plan_level_changes;
create policy "Medlem eller coach återkallar ett framtida byte"
  on public.plan_level_changes for update
  to authenticated
  using (public.can_edit_plan_instance(instance_id))
  with check (public.can_edit_plan_instance(instance_id) and revoked_by = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['plan_session_overrides', 'plan_session_logs'] loop
    execute format('drop policy if exists "Medlem eller coach skriver" on public.%I', t);
    execute format(
      'create policy "Medlem eller coach skriver" on public.%I for insert to authenticated
         with check (public.can_edit_plan_instance(instance_id))', t);
    execute format('drop policy if exists "Medlem eller coach ändrar" on public.%I', t);
    execute format(
      'create policy "Medlem eller coach ändrar" on public.%I for update to authenticated
         using (public.can_edit_plan_instance(instance_id))
         with check (public.can_edit_plan_instance(instance_id))', t);
    execute format('drop policy if exists "Medlem eller coach tar bort" on public.%I', t);
    execute format(
      'create policy "Medlem eller coach tar bort" on public.%I for delete to authenticated
         using (public.can_edit_plan_instance(instance_id))', t);
  end loop;
end;
$$;

drop policy if exists "Skriv förslag" on public.plan_ai_suggestions;
create policy "Skriv förslag"
  on public.plan_ai_suggestions for insert
  to authenticated
  with check (
    public.can_edit_plan_instance(instance_id)
    and status = 'föreslagen'
    and created_by = auth.uid()
  );

drop policy if exists "Besluta om förslag" on public.plan_ai_suggestions;
create policy "Besluta om förslag"
  on public.plan_ai_suggestions for update
  to authenticated
  using (public.can_edit_plan_instance(instance_id) and status = 'föreslagen')
  with check (public.can_edit_plan_instance(instance_id) and decided_by = auth.uid());

-- Medlemskapet pausar bara planer som ingår i det.
create or replace function public.log_plan_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.plan is distinct from old.plan then
    insert into public.plan_instance_events (instance_id, adept_id, kind)
    select i.id, i.adept_id,
      case when new.plan = 'medlem' then 'återupptagen' else 'pausad' end
    from public.plan_instances i
    where i.adept_id = new.id and i.status = 'aktiv' and i.access = 'medlem';
  end if;
  return new;
end;
$$;

revoke all on function public.log_plan_membership() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Namnen bakom ett pass eller en plan, och vem det är delat med
-- ---------------------------------------------------------------------------

-- Namn på ägarna till det den inloggade ser: den egna coachen, Coachvy
-- (admin) och coacher som delat något. Inga andra namn lämnas ut.
create or replace function public.library_authors(p_owners uuid[])
returns table (id uuid, name text, company text, coachvy boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, c.company_name,
    exists (select 1 from public.admins ad where ad.profile_id = p.id)
  from public.profiles p
  left join public.coaches c on c.id = p.id
  where p.id = any (p_owners)
    and (
      p.id = auth.uid()
      or public.is_admin()
      or exists (select 1 from public.adepts a where a.profile_id = auth.uid() and a.coach_id = p.id)
      or exists (
        select 1 from public.session_library l
        where l.owner_id = p.id and public.session_shared_with_me(l.id, l.owner_id)
      )
      or exists (
        select 1 from public.plan_templates t
        where t.owner_id = p.id and public.template_shared_with_me(t.id, t.owner_id)
      )
    );
$$;

-- Mottagarna för ägaren, med namn på utvalda adepter och coacher. Tar
-- flera pass eller planer på en gång, för listorna.
drop function if exists public.library_share_list(uuid, uuid);
create or replace function public.library_share_list(p_sessions uuid[], p_templates uuid[])
returns table (
  id uuid, item_id uuid, audience text, status text, review_note text,
  reviewed_at timestamptz, adept_id uuid, adept_name text, coach_id uuid, coach_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, coalesce(s.session_id, s.template_id), s.audience, s.status,
    s.review_note, s.reviewed_at, s.adept_id, a.full_name, s.coach_id,
    coalesce(p.full_name, c.company_name)
  from public.library_shares s
  left join public.adepts a on a.id = s.adept_id
  left join public.coaches c on c.id = s.coach_id
  left join public.profiles p on p.id = s.coach_id
  where (
      s.session_id = any (coalesce(p_sessions, '{}'))
      or s.template_id = any (coalesce(p_templates, '{}'))
    )
    and (public.is_admin() or public.owns_library_item(s.session_id, s.template_id))
  order by s.created_at;
$$;

-- En coach att dela med, hittad på e-post. Bara för coacher och admin, och
-- bara en träff på exakt adress.
create or replace function public.find_coach_by_email(p_email text)
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, coalesce(p.full_name, c.company_name, p.email)
  from public.coaches c
  join public.profiles p on p.id = c.id
  where (public.is_coach() or public.is_admin())
    and c.id <> auth.uid()
    and lower(p.email) = lower(trim(p_email))
  limit 1;
$$;

-- Granskningskön: det coacher delat med alla medlemmar.
create or replace function public.library_review_queue()
returns table (
  id uuid, kind text, item_id uuid, title text, slug text, owner_name text,
  status text, review_note text, created_at timestamptz, reviewed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id,
    case when s.session_id is not null then 'pass' else 'plan' end,
    coalesce(s.session_id, s.template_id),
    coalesce(l.title, (
      select v.title from public.plan_template_versions v
      where v.template_id = t.id
      order by (v.status = 'publicerad') desc, v.version desc
      limit 1
    )),
    t.slug,
    coalesce(p.full_name, c.company_name),
    s.status, s.review_note, s.created_at, s.reviewed_at
  from public.library_shares s
  left join public.session_library l on l.id = s.session_id
  left join public.plan_templates t on t.id = s.template_id
  left join public.profiles p on p.id = coalesce(l.owner_id, t.owner_id)
  left join public.coaches c on c.id = coalesce(l.owner_id, t.owner_id)
  where public.is_admin()
    and s.audience = 'medlemmar'
    and not exists (
      select 1 from public.admins ad where ad.profile_id = coalesce(l.owner_id, t.owner_id)
    )
  order by (s.status = 'granskas') desc, s.created_at desc;
$$;

revoke all on function public.library_authors(uuid[]) from public, anon;
revoke all on function public.library_share_list(uuid[], uuid[]) from public, anon;
revoke all on function public.find_coach_by_email(text) from public, anon;
revoke all on function public.library_review_queue() from public, anon;
grant execute on function public.library_authors(uuid[]) to authenticated;
grant execute on function public.library_share_list(uuid[], uuid[]) to authenticated;
grant execute on function public.find_coach_by_email(text) to authenticated;
grant execute on function public.library_review_queue() to authenticated;
