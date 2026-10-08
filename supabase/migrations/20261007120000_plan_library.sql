-- Coachvy – planbiblioteket.
--
-- Standardiserade träningsplaner som ingår i medlemskapet. En medlem väljer
-- en plan för ett mål, väljer längd och nivå, och följer den som den är.
-- Planen är ett statiskt dokument: ingenting här ändrar den utifrån data.
-- Medlemmen (eller coachen) byter nivå och flyttar pass själv.
--
-- Två halvor:
--
--   MALLAR – skrivs av admin, läses av medlemmar, coacher och admin
--     plan_categories                 målen: Ironman, maraton, 10 km …
--     disciplines                     löpning, cykling, simning, styrka …
--     plan_templates                  mallens identitet
--     plan_template_versions          en version: utkast, publicerad, arkiverad
--     plan_template_levels            nivåerna, rank: högre är mer (A högst)
--     plan_template_phases            faserna med syfte och specificitet
--     plan_template_weeks             veckorna, i ordning, i en fas
--     plan_template_sessions          passen, på en dag i en vecka
--     plan_template_session_variants  passet på en nivå
--
--   INSTANS – medlemmens plan
--     plan_instances                  vilken version, start, längd, veckokarta
--     plan_level_changes              nivåhistoriken, bara tillägg
--     plan_session_overrides          flyttade, ersatta och strukna pass
--     plan_session_logs               genomfört, delvis, hoppat över
--     plan_ai_suggestions             förslag som medlemmen godkänner eller avvisar
--     plan_instance_events            start, paus, återupptagen, avslut
--
-- En publicerad version ändras aldrig: en trigger stoppar det. Att redigera
-- en publicerad mall ger ett nytt utkast, och en medlem som startat en plan
-- pekar på sin version. Mallen kan alltså uppdateras utan att en startad plan
-- ändras i efterhand.
--
-- Schemat för en medlem lagras inte pass för pass. Det räknas fram ur
-- versionen, veckokartan, nivåhistoriken och avvikelserna (se
-- src/lib/plan-library/schedule.ts). Ett nivåbyte skriver en rad i historiken
-- och skriver aldrig om några pass; originalet och medlemmens ändringar hålls
-- isär av konstruktionen.

-- ---------------------------------------------------------------------------
-- Inställningar – hur många aktiva planer en medlem får ha
-- ---------------------------------------------------------------------------

create table if not exists public.plan_library_settings (
  id boolean primary key default true check (id),
  max_active_plans int not null default 1 check (max_active_plans >= 1),
  updated_at timestamptz not null default now()
);

insert into public.plan_library_settings (id) values (true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Uppslag – målen och disciplinerna, så att inget är hårdkodat
-- ---------------------------------------------------------------------------

create table if not exists public.plan_categories (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9-]+$'),
  name text not null check (length(btrim(name)) > 0),
  sort int not null default 0,
  created_at timestamptz not null default now()
);

insert into public.plan_categories (key, name, sort) values
  ('ironman', 'Ironman', 10),
  ('70-3', 'Ironman 70.3', 20),
  ('olympisk-triathlon', 'Olympisk triathlon', 30),
  ('xterra', 'Xterra', 40),
  ('maraton', 'Maraton', 50),
  ('halvmaraton', 'Halvmaraton', 60),
  ('10-km', '10 km', 70),
  ('trail-ultra', 'Trail och ultra', 80),
  ('cykel', 'Cykel', 90),
  ('simning', 'Simning', 100)
on conflict (key) do nothing;

create table if not exists public.disciplines (
  key text primary key check (key ~ '^[a-zåäö0-9-]+$'),
  name text not null check (length(btrim(name)) > 0),
  -- Grenen passets struktur räknas i, för zonfärger och export. Null: passet
  -- har ingen struktur med mål (styrka, rörlighet).
  structure_sport text check (
    structure_sport is null
    or structure_sport in ('cykling', 'löpning', 'simning')
  ),
  sort int not null default 0
);

insert into public.disciplines (key, name, structure_sport, sort) values
  ('simning', 'Simning', 'simning', 10),
  ('cykling', 'Cykling', 'cykling', 20),
  ('löpning', 'Löpning', 'löpning', 30),
  ('styrka', 'Styrka', null, 40),
  ('rörlighet', 'Rörlighet', null, 50),
  ('annat', 'Annat', null, 60)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Mallar
-- ---------------------------------------------------------------------------

create table if not exists public.plan_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  category_id uuid references public.plan_categories (id) on delete set null,
  -- Exempeldata, så att den går att känna igen och arkivera.
  is_example boolean not null default false,
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plan_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.plan_templates (id) on delete restrict,
  version int not null check (version >= 1),
  status text not null default 'utkast'
    check (status in ('utkast', 'publicerad', 'arkiverad')),

  title text not null check (length(btrim(title)) > 0),
  /** En mening i katalogen. */
  summary text,
  /** Målet planen bygger mot, i ord. */
  goal text,
  description text,
  prerequisites text,

  -- Längden en medlem kan välja. Mallen beskriver max veckor; en kortare plan
  -- kortas enligt fasernas ordning (se plan_template_phases.trim_order).
  min_weeks int not null check (min_weeks between 1 and 104),
  max_weeks int not null check (max_weeks between 1 and 104),

  published_at timestamptz,
  published_by uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (template_id, version),
  check (min_weeks <= max_weeks)
);

-- En publicerad version per mall åt gången.
create unique index if not exists plan_template_versions_one_published
  on public.plan_template_versions (template_id)
  where status = 'publicerad';

-- Ett utkast per mall åt gången.
create unique index if not exists plan_template_versions_one_draft
  on public.plan_template_versions (template_id)
  where status = 'utkast';

create table if not exists public.plan_template_levels (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.plan_template_versions (id) on delete cascade,
  /** Högre rank är mer: A har högst rank. */
  rank int not null check (rank >= 1),
  key text not null check (length(btrim(key)) between 1 and 12),
  name text not null check (length(btrim(name)) > 0),
  description text,
  -- Riktvärden, för valet av nivå. Inga krav, inget räknas automatiskt.
  hours_min numeric check (hours_min is null or hours_min >= 0),
  hours_max numeric check (hours_max is null or hours_max >= 0),
  sessions_min int check (sessions_min is null or sessions_min >= 0),
  sessions_max int check (sessions_max is null or sessions_max >= 0),
  /** Intensitetsprofil i procent av tiden: { "låg": 80, "medel": 10, "hög": 10 }. */
  intensity jsonb,
  unique (version_id, rank),
  unique (version_id, key)
);

create table if not exists public.plan_template_phases (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.plan_template_versions (id) on delete cascade,
  position int not null check (position >= 1),
  name text not null check (length(btrim(name)) > 0),
  /** Säsongsplanens fas, så att kalendern och översikten färgar rätt. */
  season_phase text check (
    season_phase is null
    or season_phase in ('grund', 'uppbyggnad', 'specifik', 'topp', 'vila')
  ),
  purpose text,
  focus text,
  /** Från ospecifikt (1) till tävlingsspecifikt (5). */
  specificity smallint check (specificity is null or specificity between 1 and 5),
  /** Intensitetsfördelningen i fasen, som nivåernas. */
  intensity jsonb,
  /** Så här kort får fasen bli när planen kortas. */
  min_weeks int not null default 1 check (min_weeks >= 0),
  -- I vilken ordning faserna kortas: lägst först. Null: fasen kortas aldrig
  -- (typiskt den specifika fasen och taper).
  trim_order int check (trim_order is null or trim_order >= 1),
  unique (version_id, position)
);

create table if not exists public.plan_template_weeks (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.plan_template_versions (id) on delete cascade,
  phase_id uuid not null references public.plan_template_phases (id) on delete cascade,
  /** Ordningen i hela planen, 1 är första veckan i en plan av maxlängd. */
  position int not null check (position >= 1),
  kind text not null default 'normal'
    check (kind in ('normal', 'avlastning', 'test', 'tävling')),
  title text,
  note text,
  unique (version_id, position)
);

create table if not exists public.plan_template_sessions (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.plan_template_versions (id) on delete cascade,
  week_id uuid not null references public.plan_template_weeks (id) on delete cascade,
  /** Dag i veckan, 0 är veckans första dag. Null: valfri dag. */
  day smallint check (day is null or day between 0 and 6),
  position int not null default 1,
  discipline text not null references public.disciplines (key) on update cascade,
  /** Fritt: distans, intervaller, tröskel, långpass, teknik … */
  type text,
  title text not null check (length(btrim(title)) > 0),
  description text
);

create index if not exists plan_template_sessions_week
  on public.plan_template_sessions (week_id);

create table if not exists public.plan_template_session_variants (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.plan_template_versions (id) on delete cascade,
  session_id uuid not null references public.plan_template_sessions (id) on delete cascade,
  level_id uuid not null references public.plan_template_levels (id) on delete cascade,
  description text,
  duration_s int check (duration_s is null or duration_s > 0),
  distance_m int check (distance_m is null or distance_m > 0),
  /** Zonen eller intensiteten i ord: "Z2", "tröskel". */
  zone text,
  -- Strukturen i samma format som workouts.blocks, med målen som andel av
  -- basen. Null: passet beskrivs bara i ord.
  basis text check (basis is null or basis in ('FTP', 'CP', 'CS', 'CSS', 'LT2')),
  blocks jsonb,
  unique (session_id, level_id),
  check ((blocks is null) = (basis is null))
);

-- ---------------------------------------------------------------------------
-- Instans
-- ---------------------------------------------------------------------------

create table if not exists public.plan_instances (
  id uuid primary key default gen_random_uuid(),
  adept_id uuid not null references public.adepts (id) on delete cascade,
  template_id uuid not null references public.plan_templates (id) on delete restrict,
  version_id uuid not null references public.plan_template_versions (id) on delete restrict,
  /** Titeln när planen startades, för listor. */
  title text not null,
  status text not null default 'aktiv'
    check (status in ('aktiv', 'avslutad', 'avbruten')),

  /** Första dagen i vecka 1. Veckorna börjar på samma veckodag. */
  start_date date not null,
  weeks int not null check (weeks between 1 and 104),
  goal_mode text not null check (goal_mode in ('lopp', 'fritt')),
  race_id uuid references public.adept_races (id) on delete set null,
  race_date date,
  start_level_id uuid not null references public.plan_template_levels (id) on delete restrict,
  -- Mallveckorna i planens ordning: [id för vecka 1, id för vecka 2, …].
  -- Resultatet av periodiseringen som medlemmen godkände.
  week_map jsonb not null,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ended_at timestamptz,

  check (jsonb_typeof(week_map) = 'array' and jsonb_array_length(week_map) = weeks),
  check (goal_mode = 'fritt' or race_date is not null)
);

create index if not exists plan_instances_adept on public.plan_instances (adept_id);

create table if not exists public.plan_level_changes (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.plan_instances (id) on delete cascade,
  adept_id uuid not null references public.adepts (id) on delete cascade,
  /** Planveckan bytet gäller från, 1 är första veckan. */
  effective_week int not null check (effective_week >= 1),
  from_level_id uuid not null references public.plan_template_levels (id) on delete restrict,
  to_level_id uuid not null references public.plan_template_levels (id) on delete restrict,
  /** Varför, i livet: resa, sjukdom … */
  reason text not null check (
    reason in (
      'eget val', 'form', 'resa', 'sjukdom', 'skada', 'arbete', 'familj',
      'uppehåll', 'återstart'
    )
  ),
  /** Hur: ett byte, ett steg i en serie, en tillfällig sänkning, återgången efter den. */
  kind text not null default 'byte'
    check (kind in ('byte', 'stegvis', 'tillfällig', 'återgång', 'återstart')),
  source text not null check (source in ('medlem', 'coach', 'ai')),
  note text,
  /** Byten som hör ihop: stegen i en serie, sänkningen och återgången. */
  group_id uuid,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null
);

create index if not exists plan_level_changes_instance
  on public.plan_level_changes (instance_id, effective_week);

create table if not exists public.plan_session_overrides (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.plan_instances (id) on delete cascade,
  adept_id uuid not null references public.adepts (id) on delete cascade,
  session_id uuid not null references public.plan_template_sessions (id) on delete restrict,
  plan_week int not null check (plan_week >= 1),
  action text not null check (action in ('flytta', 'ersätt', 'stryk')),
  moved_to date,
  workout_id uuid references public.workouts (id) on delete set null,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (instance_id, session_id, plan_week),
  check (action <> 'flytta' or moved_to is not null)
);

create table if not exists public.plan_session_logs (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.plan_instances (id) on delete cascade,
  adept_id uuid not null references public.adepts (id) on delete cascade,
  session_id uuid not null references public.plan_template_sessions (id) on delete restrict,
  plan_week int not null check (plan_week >= 1),
  status text not null check (status in ('genomförd', 'delvis', 'hoppad')),
  activity_id uuid references public.activities (id) on delete set null,
  rpe smallint check (rpe is null or rpe between 1 and 10),
  note text,
  logged_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (instance_id, session_id, plan_week)
);

create table if not exists public.plan_ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.plan_instances (id) on delete cascade,
  adept_id uuid not null references public.adepts (id) on delete cascade,
  kind text not null check (kind in ('nivåbyte', 'återstart', 'övrigt')),
  /** Förslaget som data, till exempel { to_level_id, effective_week }. */
  payload jsonb not null default '{}'::jsonb,
  rationale text not null,
  status text not null default 'föreslagen'
    check (status in ('föreslagen', 'accepterad', 'avvisad', 'utgången')),
  /** Nivåbytena som skrevs när förslaget godkändes. */
  level_change_group uuid,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null
);

create table if not exists public.plan_instance_events (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.plan_instances (id) on delete cascade,
  adept_id uuid not null references public.adepts (id) on delete cascade,
  kind text not null check (
    kind in ('startad', 'pausad', 'återupptagen', 'flyttad', 'avslutad', 'avbruten')
  ),
  detail jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists plan_instance_events_instance
  on public.plan_instance_events (instance_id, created_at);

-- updated_at
drop trigger if exists plan_templates_set_updated_at on public.plan_templates;
create trigger plan_templates_set_updated_at
  before update on public.plan_templates
  for each row execute function public.set_updated_at();
drop trigger if exists plan_template_versions_set_updated_at on public.plan_template_versions;
create trigger plan_template_versions_set_updated_at
  before update on public.plan_template_versions
  for each row execute function public.set_updated_at();
drop trigger if exists plan_instances_set_updated_at on public.plan_instances;
create trigger plan_instances_set_updated_at
  before update on public.plan_instances
  for each row execute function public.set_updated_at();
drop trigger if exists plan_session_overrides_set_updated_at on public.plan_session_overrides;
create trigger plan_session_overrides_set_updated_at
  before update on public.plan_session_overrides
  for each row execute function public.set_updated_at();
drop trigger if exists plan_session_logs_set_updated_at on public.plan_session_logs;
create trigger plan_session_logs_set_updated_at
  before update on public.plan_session_logs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Hjälpfunktioner för RLS
-- ---------------------------------------------------------------------------

-- Får kontot läsa biblioteket? Medlemmar, coacher och admin.
create or replace function public.can_read_plan_library()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (select 1 from public.coaches c where c.id = auth.uid())
    or exists (
      select 1 from public.adepts a
      where a.profile_id = auth.uid() and a.plan = 'medlem'
    );
$$;

-- Får kontot läsa versionen? Publicerade för den som har biblioteket, allt
-- för admin, och den version en plan man ser bygger på – även när den har
-- arkiverats eller medlemskapet upphört.
create or replace function public.can_read_plan_version(plan_version uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1 from public.plan_template_versions v
      where v.id = plan_version
        and v.status = 'publicerad'
        and public.can_read_plan_library()
    )
    or exists (
      select 1 from public.plan_instances i
      where i.version_id = plan_version
        and public.can_view_adept(i.adept_id)
    );
$$;

-- Får kontot ändra adeptens plan? Adepten själv och adeptens coach, så länge
-- adepten är medlem. När medlemskapet upphör blir planen skrivskyddad för
-- båda – ingenting raderas.
create or replace function public.can_edit_plan(adept uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.adepts a
    where a.id = adept
      and a.plan = 'medlem'
      and (a.profile_id = auth.uid() or a.coach_id = auth.uid())
  );
$$;

-- Planveckan ett datum ligger i, 1 är första veckan.
create or replace function public.plan_week_of(instance uuid, day date)
returns int
language sql
stable
set search_path = public
as $$
  select ((day - i.start_date) / 7) + 1
  from public.plan_instances i
  where i.id = instance;
$$;

revoke all on function public.can_read_plan_library() from public, anon;
revoke all on function public.can_read_plan_version(uuid) from public, anon;
revoke all on function public.can_edit_plan(uuid) from public, anon;
revoke all on function public.plan_week_of(uuid, date) from public, anon;
grant execute on function public.can_read_plan_library() to authenticated;
grant execute on function public.can_read_plan_version(uuid) to authenticated;
grant execute on function public.can_edit_plan(uuid) to authenticated;
grant execute on function public.plan_week_of(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Låsen – en publicerad version ändras aldrig
-- ---------------------------------------------------------------------------

create or replace function public.guard_plan_version()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'utkast' then
      raise exception 'En publicerad version kan inte tas bort, bara arkiveras.'
        using errcode = '42501';
    end if;
    return old;
  end if;

  if old.status = 'utkast' then
    -- Ett utkast publiceras bara genom publish_plan_version, som kontrollerar
    -- att det håller ihop.
    if new.status <> 'utkast'
       and coalesce(current_setting('coachvy.publishing', true), '') <> 'on' then
      raise exception 'Publicera med publish_plan_version.' using errcode = '42501';
    end if;
    return new;
  end if;

  -- Publicerad eller arkiverad: bara statusen får ändras, och bara framåt.
  if (to_jsonb(new) - 'status' - 'updated_at')
     is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
    raise exception 'En publicerad version ändras aldrig. Gör ett nytt utkast.'
      using errcode = '42501';
  end if;
  if not (
    (old.status = 'publicerad' and new.status in ('publicerad', 'arkiverad'))
    or (old.status = 'arkiverad' and new.status = 'arkiverad')
  ) then
    raise exception 'Statusen kan inte gå från % till %.', old.status, new.status
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists plan_template_versions_guard on public.plan_template_versions;
create trigger plan_template_versions_guard
  before update or delete on public.plan_template_versions
  for each row execute function public.guard_plan_version();

-- Innehållet i en version ändras bara medan den är ett utkast.
create or replace function public.guard_plan_version_content()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_version uuid := case when tg_op = 'DELETE' then old.version_id else new.version_id end;
  v_status text;
begin
  select status into v_status
  from public.plan_template_versions where id = v_version;
  -- Versionen själv kan vara borta när ett utkast raderas i kaskad.
  if v_status is not null and v_status <> 'utkast' then
    raise exception 'En publicerad version ändras aldrig. Gör ett nytt utkast.'
      using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.version_id <> old.version_id then
    raise exception 'Innehåll flyttas inte mellan versioner.' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'plan_template_levels', 'plan_template_phases', 'plan_template_weeks',
    'plan_template_sessions', 'plan_template_session_variants'
  ] loop
    execute format('drop trigger if exists %I_guard on public.%I', t, t);
    execute format(
      'create trigger %I_guard before insert or update or delete on public.%I
         for each row execute function public.guard_plan_version_content()',
      t, t
    );
  end loop;
end;
$$;

-- Det som hänger ihop ska höra till samma version.
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
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'plan_template_weeks', 'plan_template_sessions', 'plan_template_session_variants'
  ] loop
    execute format('drop trigger if exists %I_links on public.%I', t, t);
    execute format(
      'create trigger %I_links before insert or update on public.%I
         for each row execute function public.guard_plan_version_links()',
      t, t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Publicera och nytt utkast
-- ---------------------------------------------------------------------------

-- Publicerar ett utkast efter en kontroll av att det håller ihop. Den
-- tidigare publicerade versionen arkiveras; planer som bygger på den följer
-- med oförändrade.
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
  if not public.is_admin() then
    raise exception 'Bara en admin publicerar planer.' using errcode = '42501';
  end if;
  select * into v from public.plan_template_versions where id = draft for update;
  if not found then
    raise exception 'Ingen version med det id:t.' using errcode = 'P0002';
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
  return draft;
end;
$$;

-- Ett nytt utkast som kopia av mallens senaste version. Finns redan ett
-- utkast blir det svaret.
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
    prerequisites, min_weeks, max_weeks, created_by
  ) values (
    template, v_src.version + 1, 'utkast', v_src.title, v_src.summary, v_src.goal,
    v_src.description, v_src.prerequisites, v_src.min_weeks, v_src.max_weeks, auth.uid()
  ) returning id into v_new;

  create temp table _map (old uuid primary key, new uuid not null) on commit drop;

  insert into _map
    select id, gen_random_uuid() from public.plan_template_levels where version_id = v_src.id
    union all
    select id, gen_random_uuid() from public.plan_template_phases where version_id = v_src.id
    union all
    select id, gen_random_uuid() from public.plan_template_weeks where version_id = v_src.id
    union all
    select id, gen_random_uuid() from public.plan_template_sessions where version_id = v_src.id;

  insert into public.plan_template_levels (
    id, version_id, rank, key, name, description, hours_min, hours_max,
    sessions_min, sessions_max, intensity
  )
  select m.new, v_new, l.rank, l.key, l.name, l.description, l.hours_min, l.hours_max,
    l.sessions_min, l.sessions_max, l.intensity
  from public.plan_template_levels l join _map m on m.old = l.id
  where l.version_id = v_src.id;

  insert into public.plan_template_phases (
    id, version_id, position, name, season_phase, purpose, focus, specificity,
    intensity, min_weeks, trim_order
  )
  select m.new, v_new, p.position, p.name, p.season_phase, p.purpose, p.focus,
    p.specificity, p.intensity, p.min_weeks, p.trim_order
  from public.plan_template_phases p join _map m on m.old = p.id
  where p.version_id = v_src.id;

  insert into public.plan_template_weeks (id, version_id, phase_id, position, kind, title, note)
  select m.new, v_new, mp.new, w.position, w.kind, w.title, w.note
  from public.plan_template_weeks w
  join _map m on m.old = w.id
  join _map mp on mp.old = w.phase_id
  where w.version_id = v_src.id;

  insert into public.plan_template_sessions (
    id, version_id, week_id, day, position, discipline, type, title, description
  )
  select m.new, v_new, mw.new, s.day, s.position, s.discipline, s.type, s.title, s.description
  from public.plan_template_sessions s
  join _map m on m.old = s.id
  join _map mw on mw.old = s.week_id
  where s.version_id = v_src.id;

  insert into public.plan_template_session_variants (
    version_id, session_id, level_id, description, duration_s, distance_m, zone, basis, blocks
  )
  select v_new, ms.new, ml.new, x.description, x.duration_s, x.distance_m, x.zone, x.basis, x.blocks
  from public.plan_template_session_variants x
  join _map ms on ms.old = x.session_id
  join _map ml on ml.old = x.level_id
  where x.version_id = v_src.id;

  return v_new;
end;
$$;

-- Numrerar om ett utkasts veckor i fasernas ordning (1, 2, 3 …) och håller
-- längsta längden lika med antalet veckor. Körs efter att en vecka lagts
-- till, tagits bort eller en fas flyttats. Som den inloggade: bara admin
-- släpps igenom, och bara medan versionen är ett utkast.
create or replace function public.reorder_plan_weeks(draft uuid)
returns int
language plpgsql
set search_path = public
as $$
declare
  v_count int;
begin
  update public.plan_template_weeks set position = position + 100000
    where version_id = draft;
  with ordered as (
    select w.id, row_number() over (order by p.position, w.position) as n
    from public.plan_template_weeks w
    join public.plan_template_phases p on p.id = w.phase_id
    where w.version_id = draft
  )
  update public.plan_template_weeks w set position = o.n
    from ordered o where o.id = w.id;

  select count(*) into v_count from public.plan_template_weeks where version_id = draft;
  update public.plan_template_versions
    set max_weeks = greatest(v_count, 1),
        min_weeks = least(min_weeks, greatest(v_count, 1))
    where id = draft;
  return v_count;
end;
$$;

-- Kopierar en vecka med pass och varianter till veckan efter den, i samma fas.
create or replace function public.copy_plan_week(week uuid)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  w public.plan_template_weeks%rowtype;
  v_new uuid;
begin
  select * into w from public.plan_template_weeks where id = week;
  if not found then
    raise exception 'Ingen vecka med det id:t.' using errcode = 'P0002';
  end if;
  update public.plan_template_weeks set position = position + 100000
    where version_id = w.version_id and position > w.position;
  insert into public.plan_template_weeks (version_id, phase_id, position, kind, title, note)
    values (w.version_id, w.phase_id, w.position + 1, w.kind, w.title, w.note)
    returning id into v_new;

  create temp table _session_map (old uuid primary key, new uuid not null) on commit drop;
  insert into _session_map
    select id, gen_random_uuid() from public.plan_template_sessions where week_id = week;
  insert into public.plan_template_sessions (
    id, version_id, week_id, day, position, discipline, type, title, description
  )
  select m.new, s.version_id, v_new, s.day, s.position, s.discipline, s.type, s.title, s.description
  from public.plan_template_sessions s join _session_map m on m.old = s.id;
  insert into public.plan_template_session_variants (
    version_id, session_id, level_id, description, duration_s, distance_m, zone, basis, blocks
  )
  select x.version_id, m.new, x.level_id, x.description, x.duration_s, x.distance_m,
    x.zone, x.basis, x.blocks
  from public.plan_template_session_variants x join _session_map m on m.old = x.session_id;

  perform public.reorder_plan_weeks(w.version_id);
  return v_new;
end;
$$;

revoke all on function public.reorder_plan_weeks(uuid) from public, anon;
revoke all on function public.copy_plan_week(uuid) from public, anon;
grant execute on function public.reorder_plan_weeks(uuid) to authenticated;
grant execute on function public.copy_plan_week(uuid) to authenticated;

revoke all on function public.publish_plan_version(uuid) from public, anon;
revoke all on function public.new_plan_draft(uuid) from public, anon;
grant execute on function public.publish_plan_version(uuid) to authenticated;
grant execute on function public.new_plan_draft(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Instansens lås
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
    if old.status <> 'aktiv' and new.status = 'aktiv' then
      raise exception 'En avslutad plan startas inte om. Starta en ny.' using errcode = '42501';
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

  if new.status <> 'aktiv' and new.ended_at is null then
    new.ended_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists plan_instances_guard on public.plan_instances;
create trigger plan_instances_guard
  before insert or update on public.plan_instances
  for each row execute function public.guard_plan_instance();

-- Starten och avslutet loggas.
create or replace function public.log_plan_instance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.plan_instance_events (instance_id, adept_id, kind, detail, created_by)
    values (new.id, new.adept_id, 'startad',
      jsonb_build_object('start_date', new.start_date, 'weeks', new.weeks), auth.uid());
  elsif new.status <> old.status then
    insert into public.plan_instance_events (instance_id, adept_id, kind, created_by)
    values (new.id, new.adept_id, new.status, auth.uid());
  elsif new.start_date <> old.start_date or new.week_map <> old.week_map then
    insert into public.plan_instance_events (instance_id, adept_id, kind, detail, created_by)
    values (new.id, new.adept_id, 'flyttad',
      jsonb_build_object('from', old.start_date, 'to', new.start_date, 'weeks', new.weeks),
      auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists plan_instances_log on public.plan_instances;
create trigger plan_instances_log
  after insert or update on public.plan_instances
  for each row execute function public.log_plan_instance();

-- Medlemskapet: när adepten slutar vara medlem pausas de aktiva planerna –
-- skrivskyddade, inget raderas – och när medlemskapet kommer tillbaka loggas
-- det, så att återstarten kan erbjudas.
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
    where i.adept_id = new.id and i.status = 'aktiv';
  end if;
  return new;
end;
$$;

drop trigger if exists adepts_plan_membership on public.adepts;
create trigger adepts_plan_membership
  after update of plan on public.adepts
  for each row execute function public.log_plan_membership();

-- Rader i en plan hör till planens adept, och pass och nivåer till planens version.
create or replace function public.guard_plan_instance_rows()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  i public.plan_instances%rowtype;
begin
  select * into i from public.plan_instances where id = new.instance_id;
  if not found or i.adept_id <> new.adept_id then
    raise exception 'Raden hör till en annan plan.' using errcode = '23514';
  end if;

  if tg_table_name = 'plan_level_changes' then
    if tg_op = 'UPDATE' then
      -- Historiken skrivs aldrig om. Ett framtida byte kan återkallas, inget annat.
      if (to_jsonb(new) - 'revoked_at' - 'revoked_by')
         is distinct from (to_jsonb(old) - 'revoked_at' - 'revoked_by') then
        raise exception 'Nivåhistoriken skrivs inte om.' using errcode = '42501';
      end if;
      if old.revoked_at is not null then
        raise exception 'Bytet är redan återkallat.' using errcode = '42501';
      end if;
      if new.revoked_at is not null
         and old.effective_week <= public.plan_week_of(old.instance_id, current_date) then
        raise exception 'Ett byte som redan gäller återkallas inte – byt nivå igen i stället.'
          using errcode = '42501';
      end if;
      return new;
    end if;
    if new.effective_week > i.weeks then
      raise exception 'Planen har bara % veckor.', i.weeks using errcode = '23514';
    end if;
    if not exists (select 1 from public.plan_template_levels
                   where id = new.from_level_id and version_id = i.version_id)
       or not exists (select 1 from public.plan_template_levels
                      where id = new.to_level_id and version_id = i.version_id) then
      raise exception 'Nivån hör inte till planen.' using errcode = '23514';
    end if;
  elsif tg_table_name = 'plan_ai_suggestions' then
    -- Förslaget står kvar som det skrevs; bara beslutet läggs till.
    if tg_op = 'UPDATE' and (
      (to_jsonb(new) - 'status' - 'decided_at' - 'decided_by' - 'level_change_group')
      is distinct from
      (to_jsonb(old) - 'status' - 'decided_at' - 'decided_by' - 'level_change_group')
    ) then
      raise exception 'Förslaget ändras inte, bara beslutet.' using errcode = '42501';
    end if;
  elsif tg_table_name in ('plan_session_overrides', 'plan_session_logs') then
    if not exists (select 1 from public.plan_template_sessions
                   where id = new.session_id and version_id = i.version_id) then
      raise exception 'Passet hör inte till planen.' using errcode = '23514';
    end if;
    if new.plan_week > i.weeks then
      raise exception 'Planen har bara % veckor.', i.weeks using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'plan_level_changes', 'plan_session_overrides', 'plan_session_logs', 'plan_ai_suggestions'
  ] loop
    execute format('drop trigger if exists %I_guard on public.%I', t, t);
    execute format(
      'create trigger %I_guard before insert or update on public.%I
         for each row execute function public.guard_plan_instance_rows()',
      t, t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.plan_library_settings enable row level security;
alter table public.plan_categories enable row level security;
alter table public.disciplines enable row level security;
alter table public.plan_templates enable row level security;
alter table public.plan_template_versions enable row level security;
alter table public.plan_template_levels enable row level security;
alter table public.plan_template_phases enable row level security;
alter table public.plan_template_weeks enable row level security;
alter table public.plan_template_sessions enable row level security;
alter table public.plan_template_session_variants enable row level security;
alter table public.plan_instances enable row level security;
alter table public.plan_level_changes enable row level security;
alter table public.plan_session_overrides enable row level security;
alter table public.plan_session_logs enable row level security;
alter table public.plan_ai_suggestions enable row level security;
alter table public.plan_instance_events enable row level security;

-- Uppslagen och inställningen: alla inloggade läser, admin skriver.
do $$
declare t text;
begin
  foreach t in array array['plan_library_settings', 'plan_categories', 'disciplines'] loop
    execute format('drop policy if exists "Inloggade läser" on public.%I', t);
    execute format(
      'create policy "Inloggade läser" on public.%I for select to authenticated using (true)', t);
    execute format('drop policy if exists "Admin skriver" on public.%I', t);
    execute format(
      'create policy "Admin skriver" on public.%I for all to authenticated
         using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end;
$$;

-- Mallen: den som har biblioteket ser mallarna, den som har en plan ser sin.
drop policy if exists "Läs mallar" on public.plan_templates;
create policy "Läs mallar"
  on public.plan_templates for select
  to authenticated
  using (
    public.is_admin()
    or (archived_at is null and public.can_read_plan_library())
    or exists (
      select 1 from public.plan_instances i
      where i.template_id = plan_templates.id and public.can_view_adept(i.adept_id)
    )
  );

drop policy if exists "Admin skriver mallar" on public.plan_templates;
create policy "Admin skriver mallar"
  on public.plan_templates for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Läs versioner" on public.plan_template_versions;
create policy "Läs versioner"
  on public.plan_template_versions for select
  to authenticated
  using (public.can_read_plan_version(id));

drop policy if exists "Admin skriver versioner" on public.plan_template_versions;
create policy "Admin skriver versioner"
  on public.plan_template_versions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

do $$
declare t text;
begin
  foreach t in array array[
    'plan_template_levels', 'plan_template_phases', 'plan_template_weeks',
    'plan_template_sessions', 'plan_template_session_variants'
  ] loop
    execute format('drop policy if exists "Läs versionens innehåll" on public.%I', t);
    execute format(
      'create policy "Läs versionens innehåll" on public.%I for select to authenticated
         using (public.can_read_plan_version(version_id))', t);
    execute format('drop policy if exists "Admin skriver innehåll" on public.%I', t);
    execute format(
      'create policy "Admin skriver innehåll" on public.%I for all to authenticated
         using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end;
$$;

-- Planen: adepten och coachen läser alltid. Båda ändrar så länge adepten är
-- medlem. Ingen raderar – en plan avslutas eller avbryts.
drop policy if exists "Läs planer man har tillgång till" on public.plan_instances;
create policy "Läs planer man har tillgång till"
  on public.plan_instances for select
  to authenticated
  using (public.can_view_adept(adept_id));

drop policy if exists "Medlem eller coach startar en plan" on public.plan_instances;
create policy "Medlem eller coach startar en plan"
  on public.plan_instances for insert
  to authenticated
  with check (public.can_edit_plan(adept_id) and created_by = auth.uid());

drop policy if exists "Medlem eller coach ändrar en plan" on public.plan_instances;
create policy "Medlem eller coach ändrar en plan"
  on public.plan_instances for update
  to authenticated
  using (public.can_edit_plan(adept_id))
  with check (public.can_edit_plan(adept_id));

-- Nivåhistoriken: tillägg, och återkallelse av framtida byten (se triggern).
drop policy if exists "Läs nivåhistorik" on public.plan_level_changes;
create policy "Läs nivåhistorik"
  on public.plan_level_changes for select
  to authenticated
  using (public.can_view_adept(adept_id));

drop policy if exists "Medlem eller coach byter nivå" on public.plan_level_changes;
create policy "Medlem eller coach byter nivå"
  on public.plan_level_changes for insert
  to authenticated
  with check (
    public.can_edit_plan(adept_id)
    and created_by = auth.uid()
    -- Källan är den som faktiskt bytte: coachen skriver som coach, medlemmen
    -- som medlem. Ett godkänt AI-förslag kan komma från båda.
    and (
      source = 'ai'
      or (source = 'coach') = public.is_adept_coach(adept_id)
    )
  );

drop policy if exists "Medlem eller coach återkallar ett framtida byte" on public.plan_level_changes;
create policy "Medlem eller coach återkallar ett framtida byte"
  on public.plan_level_changes for update
  to authenticated
  using (public.can_edit_plan(adept_id))
  with check (public.can_edit_plan(adept_id) and revoked_by = auth.uid());

-- Avvikelserna och loggen: medlemmen och coachen ändrar fritt.
do $$
declare t text;
begin
  foreach t in array array['plan_session_overrides', 'plan_session_logs'] loop
    execute format('drop policy if exists "Läs" on public.%I', t);
    execute format(
      'create policy "Läs" on public.%I for select to authenticated
         using (public.can_view_adept(adept_id))', t);
    execute format('drop policy if exists "Medlem eller coach skriver" on public.%I', t);
    execute format(
      'create policy "Medlem eller coach skriver" on public.%I for insert to authenticated
         with check (public.can_edit_plan(adept_id))', t);
    execute format('drop policy if exists "Medlem eller coach ändrar" on public.%I', t);
    execute format(
      'create policy "Medlem eller coach ändrar" on public.%I for update to authenticated
         using (public.can_edit_plan(adept_id)) with check (public.can_edit_plan(adept_id))', t);
    execute format('drop policy if exists "Medlem eller coach tar bort" on public.%I', t);
    execute format(
      'create policy "Medlem eller coach tar bort" on public.%I for delete to authenticated
         using (public.can_edit_plan(adept_id))', t);
  end loop;
end;
$$;

-- AI-förslagen: skrivs av assistenten i den inloggades namn, beslutas av
-- medlemmen eller coachen. Förslaget självt ändras inte, bara beslutet.
drop policy if exists "Läs förslag" on public.plan_ai_suggestions;
create policy "Läs förslag"
  on public.plan_ai_suggestions for select
  to authenticated
  using (public.can_view_adept(adept_id));

drop policy if exists "Skriv förslag" on public.plan_ai_suggestions;
create policy "Skriv förslag"
  on public.plan_ai_suggestions for insert
  to authenticated
  with check (
    public.can_edit_plan(adept_id) and status = 'föreslagen' and created_by = auth.uid()
  );

drop policy if exists "Besluta om förslag" on public.plan_ai_suggestions;
create policy "Besluta om förslag"
  on public.plan_ai_suggestions for update
  to authenticated
  using (public.can_edit_plan(adept_id) and status = 'föreslagen')
  with check (public.can_edit_plan(adept_id) and decided_by = auth.uid());

-- Händelserna skrivs av triggrarna; läses som allt annat i planen.
drop policy if exists "Läs händelser" on public.plan_instance_events;
create policy "Läs händelser"
  on public.plan_instance_events for select
  to authenticated
  using (public.can_view_adept(adept_id));

grant select, insert, update, delete on
  public.plan_library_settings, public.plan_categories, public.disciplines,
  public.plan_templates, public.plan_template_versions, public.plan_template_levels,
  public.plan_template_phases, public.plan_template_weeks, public.plan_template_sessions,
  public.plan_template_session_variants, public.plan_instances, public.plan_level_changes,
  public.plan_session_overrides, public.plan_session_logs, public.plan_ai_suggestions
  to authenticated;
grant select on public.plan_instance_events to authenticated;
