-- Coachvy – planbiblioteket, del 2: tävlingsfart, volym, avstämning och varv.
--
-- Fem saker:
--
--   basis 5K och MP          passens mål i procent av 5 km-fart och
--                            maratonfart, utöver CS, LT2, FTP …
--   plan_template_week_volumes
--                            veckans volym per nivå – nivåerna skiljer sig i
--                            volym, inte nödvändigtvis i passen
--   plan_template_weeks.checkpoint
--                            avstämning: i slutet av veckan uppdateras
--                            formuppskattningen
--   plan_instances.rounds    en plan kan gå i flera varv, till exempel 2 × 12
--                            veckor när det är 24 veckor kvar till målet
--   fitness_estimates        formuppskattningen en löpare anger själv – en
--                            5 km-tid eller en maratontid – bredvid testerna
--
-- Procenten i planen ligger fast. Det är tempona som följer
-- formuppskattningen: ett nytt test eller en ny tid ger nya tempon, samma
-- relation till 5 km-farten och maratonfarten.

-- ---------------------------------------------------------------------------
-- Fartbaserna
-- ---------------------------------------------------------------------------

alter table public.plan_template_session_variants
  drop constraint if exists plan_template_session_variants_basis_check;
alter table public.plan_template_session_variants
  add constraint plan_template_session_variants_basis_check
  check (basis is null or basis in ('FTP', 'CP', 'CS', 'CSS', 'LT2', '5K', 'MP'));

-- ---------------------------------------------------------------------------
-- Volym per nivå och vecka
-- ---------------------------------------------------------------------------

alter table public.plan_template_versions
  add column if not exists volume_unit text not null default 'km'
    check (volume_unit in ('km', 'h'));

create table if not exists public.plan_template_week_volumes (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.plan_template_versions (id) on delete cascade,
  week_id uuid not null references public.plan_template_weeks (id) on delete cascade,
  level_id uuid not null references public.plan_template_levels (id) on delete cascade,
  /** Ett tal, eller ett spann: 55–65 km. */
  volume_min numeric not null check (volume_min >= 0),
  volume_max numeric check (volume_max is null or volume_max >= volume_min),
  unique (week_id, level_id)
);

create index if not exists plan_template_week_volumes_version
  on public.plan_template_week_volumes (version_id);

-- ---------------------------------------------------------------------------
-- Avstämning och varv
-- ---------------------------------------------------------------------------

alter table public.plan_template_weeks
  add column if not exists checkpoint boolean not null default false;

alter table public.plan_instances
  add column if not exists rounds jsonb
    check (rounds is null or jsonb_typeof(rounds) = 'array');

comment on column public.plan_instances.rounds is
  'Varvens längd i veckor, i ordning: [12, 12]. Null: ett varv.';

-- Varven ska gå jämnt upp med planens längd.
create or replace function public.guard_plan_rounds()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_sum int;
  v_bad int;
begin
  if new.rounds is null then
    return new;
  end if;
  select coalesce(sum((e)::int), 0),
         count(*) filter (where (e)::int < 1 or (e)::int > 104)
    into v_sum, v_bad
  from jsonb_array_elements_text(new.rounds) e;
  if v_bad > 0 or v_sum <> new.weeks then
    raise exception 'Varven går inte jämnt upp med planens % veckor.', new.weeks
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace trigger plan_instances_rounds
  before insert or update on public.plan_instances
  for each row execute function public.guard_plan_rounds();

revoke all on function public.guard_plan_rounds() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Formuppskattning
-- ---------------------------------------------------------------------------

create table if not exists public.fitness_estimates (
  id uuid primary key default gen_random_uuid(),
  adept_id uuid not null references public.adepts (id) on delete cascade,
  sport text not null default 'löpning' check (sport in ('löpning')),
  /** En 5 km-tid i sekunder, uppskattad eller ur ett lopp. */
  five_k_seconds numeric check (five_k_seconds is null or five_k_seconds > 0),
  /** En maratontid i sekunder. Saknas den räknas den fram ur 5 km-tiden. */
  marathon_seconds numeric check (marathon_seconds is null or marathon_seconds > 0),
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (five_k_seconds is not null or marathon_seconds is not null)
);

create index if not exists fitness_estimates_adept
  on public.fitness_estimates (adept_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Länkar och lås för volymerna, och kopieringen
-- ---------------------------------------------------------------------------

create or replace function public.guard_plan_version_links()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name = 'plan_template_weeks' then
    if not exists (
      select 1 from public.plan_template_phases
      where id = new.phase_id and version_id = new.version_id
    ) then
      raise exception 'Fasen hör till en annan version.' using errcode = '23514';
    end if;
  elsif tg_table_name = 'plan_template_sessions' then
    if not exists (
      select 1 from public.plan_template_weeks
      where id = new.week_id and version_id = new.version_id
    ) then
      raise exception 'Veckan hör till en annan version.' using errcode = '23514';
    end if;
  elsif tg_table_name = 'plan_template_session_variants' then
    if not exists (
      select 1 from public.plan_template_sessions
      where id = new.session_id and version_id = new.version_id
    ) or not exists (
      select 1 from public.plan_template_levels
      where id = new.level_id and version_id = new.version_id
    ) then
      raise exception 'Passet eller nivån hör till en annan version.' using errcode = '23514';
    end if;
  elsif tg_table_name = 'plan_template_week_volumes' then
    if not exists (
      select 1 from public.plan_template_weeks
      where id = new.week_id and version_id = new.version_id
    ) or not exists (
      select 1 from public.plan_template_levels
      where id = new.level_id and version_id = new.version_id
    ) then
      raise exception 'Veckan eller nivån hör till en annan version.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create or replace trigger plan_template_week_volumes_guard
  before insert or update or delete on public.plan_template_week_volumes
  for each row execute function public.guard_plan_version_content();

create or replace trigger plan_template_week_volumes_links
  before insert or update on public.plan_template_week_volumes
  for each row execute function public.guard_plan_version_links();

-- Ett nytt utkast tar med volymer, avstämningar och volymenhet.
create or replace function public.new_plan_draft(template uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src public.plan_template_versions%rowtype;
  v_new uuid;
  -- Gammalt id → nytt id för nivåer, faser, veckor och pass.
  v_map jsonb;
begin
  if not public.is_admin() then
    raise exception 'Bara en admin redigerar planer.' using errcode = '42501';
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

  select coalesce(jsonb_object_agg(id::text, gen_random_uuid()), '{}'::jsonb)
    into v_map
  from (
    select id from public.plan_template_levels where version_id = v_src.id
    union all
    select id from public.plan_template_phases where version_id = v_src.id
    union all
    select id from public.plan_template_weeks where version_id = v_src.id
    union all
    select id from public.plan_template_sessions where version_id = v_src.id
  ) ids;

  insert into public.plan_template_levels (
    id, version_id, rank, key, name, description, hours_min, hours_max,
    sessions_min, sessions_max, intensity
  )
  select (v_map ->> l.id::text)::uuid, v_new, l.rank, l.key, l.name, l.description,
    l.hours_min, l.hours_max, l.sessions_min, l.sessions_max, l.intensity
  from public.plan_template_levels l
  where l.version_id = v_src.id;

  insert into public.plan_template_phases (
    id, version_id, position, name, season_phase, purpose, focus, specificity,
    intensity, min_weeks, trim_order
  )
  select (v_map ->> p.id::text)::uuid, v_new, p.position, p.name, p.season_phase,
    p.purpose, p.focus, p.specificity, p.intensity, p.min_weeks, p.trim_order
  from public.plan_template_phases p
  where p.version_id = v_src.id;

  insert into public.plan_template_weeks (
    id, version_id, phase_id, position, kind, title, note, checkpoint
  )
  select (v_map ->> w.id::text)::uuid, v_new,
    (v_map ->> w.phase_id::text)::uuid, w.position, w.kind, w.title, w.note, w.checkpoint
  from public.plan_template_weeks w
  where w.version_id = v_src.id;

  insert into public.plan_template_sessions (
    id, version_id, week_id, day, position, discipline, type, title, description
  )
  select (v_map ->> s.id::text)::uuid, v_new,
    (v_map ->> s.week_id::text)::uuid, s.day, s.position, s.discipline, s.type,
    s.title, s.description
  from public.plan_template_sessions s
  where s.version_id = v_src.id;

  insert into public.plan_template_session_variants (
    version_id, session_id, level_id, description, duration_s, distance_m, zone, basis, blocks
  )
  select v_new, (v_map ->> x.session_id::text)::uuid,
    (v_map ->> x.level_id::text)::uuid, x.description, x.duration_s, x.distance_m,
    x.zone, x.basis, x.blocks
  from public.plan_template_session_variants x
  where x.version_id = v_src.id;

  insert into public.plan_template_week_volumes (
    version_id, week_id, level_id, volume_min, volume_max
  )
  select v_new, (v_map ->> v.week_id::text)::uuid, (v_map ->> v.level_id::text)::uuid,
    v.volume_min, v.volume_max
  from public.plan_template_week_volumes v
  where v.version_id = v_src.id;

  return v_new;
end;
$$;

-- En kopierad vecka tar med volymerna och avstämningen.
create or replace function public.copy_plan_week(week uuid)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  w public.plan_template_weeks%rowtype;
  v_new uuid;
  -- Gammalt id → nytt id för veckans pass.
  v_map jsonb;
begin
  select * into w from public.plan_template_weeks where id = week;
  if not found then
    raise exception 'Ingen vecka med det id:t.' using errcode = 'P0002';
  end if;
  update public.plan_template_weeks set position = position + 100000
    where version_id = w.version_id and position > w.position;
  insert into public.plan_template_weeks (
    version_id, phase_id, position, kind, title, note, checkpoint
  )
    values (w.version_id, w.phase_id, w.position + 1, w.kind, w.title, w.note, w.checkpoint)
    returning id into v_new;

  select coalesce(jsonb_object_agg(id::text, gen_random_uuid()), '{}'::jsonb)
    into v_map
  from public.plan_template_sessions where week_id = week;
  insert into public.plan_template_sessions (
    id, version_id, week_id, day, position, discipline, type, title, description
  )
  select (v_map ->> s.id::text)::uuid, s.version_id, v_new, s.day, s.position, s.discipline,
    s.type, s.title, s.description
  from public.plan_template_sessions s where s.week_id = week;
  insert into public.plan_template_session_variants (
    version_id, session_id, level_id, description, duration_s, distance_m, zone, basis, blocks
  )
  select x.version_id, (v_map ->> x.session_id::text)::uuid, x.level_id, x.description,
    x.duration_s, x.distance_m, x.zone, x.basis, x.blocks
  from public.plan_template_session_variants x
  join public.plan_template_sessions s on s.id = x.session_id
  where s.week_id = week;
  insert into public.plan_template_week_volumes (
    version_id, week_id, level_id, volume_min, volume_max
  )
  select v.version_id, v_new, v.level_id, v.volume_min, v.volume_max
  from public.plan_template_week_volumes v where v.week_id = week;

  perform public.reorder_plan_weeks(w.version_id);
  return v_new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.plan_template_week_volumes enable row level security;
alter table public.fitness_estimates enable row level security;

create policy "Läs versionens innehåll"
  on public.plan_template_week_volumes for select
  to authenticated
  using (public.can_read_plan_version(version_id));

create policy "Admin skriver innehåll"
  on public.plan_template_week_volumes for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Formuppskattningen: adepten och coachen läser och lägger till; den som
-- skrev en uppskattning kan ta bort den.
create policy "Läs formuppskattningar"
  on public.fitness_estimates for select
  to authenticated
  using (public.can_view_adept(adept_id));

create policy "Adept eller coach anger en formuppskattning"
  on public.fitness_estimates for insert
  to authenticated
  with check (public.can_view_adept(adept_id) and created_by = auth.uid());

create policy "Ta bort en egen formuppskattning"
  on public.fitness_estimates for delete
  to authenticated
  using (public.can_view_adept(adept_id) and created_by = auth.uid());

grant select, insert, update, delete on public.plan_template_week_volumes to authenticated;
grant select, insert, delete on public.fitness_estimates to authenticated;
