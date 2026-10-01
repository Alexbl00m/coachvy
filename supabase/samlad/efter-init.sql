-- Coachvy – alla migrationer efter init, i en fil.
--
-- För ett nytt Supabase-projekt där 20260826000000_init.sql redan är körd.
-- Klistra in hela filen i SQL-editorn och kör. Supabase kör den som en enda
-- transaktion: går något fel ändras ingenting, och felet säger var.
--
-- Genererad ur supabase/migrations/. Filerna där är originalen; den här är
-- bara en genväg för att slippa klistra in tio filer var för sig. Kör den
-- inte på en databas där några av migrationerna redan finns.




-- =============================================================================
-- 20260826120000_adepts_and_tests.sql
-- =============================================================================

-- Coachvy – fas 2: adepter som coachen äger, samt testmodulen.
--
-- Fas 1 lät `adepts.id` peka rakt på `profiles.id`, vilket betydde att en adept
-- måste ha ett eget konto för att existera. En coach ska kunna lägga upp en
-- adept direkt, långt innan adepten loggat in första gången. Därför får
-- `adepts` en egen nyckel och en valfri koppling till en profil.

-- ---------------------------------------------------------------------------
-- adepts: egen identitet, ägd av en coach
-- ---------------------------------------------------------------------------

alter table public.adepts
  add column if not exists profile_id uuid references public.profiles (id) on delete set null,
  add column if not exists full_name text,
  add column if not exists email text,
  add column if not exists last_active_at timestamptz;

-- Befintliga rader (fas 1) har id = profiles.id. Flytta över kopplingen och
-- fyll namn/e-post från profilen innan kolumnerna görs obligatoriska.
update public.adepts a
set
  profile_id = coalesce(a.profile_id, a.id),
  full_name = coalesce(a.full_name, p.full_name),
  email = coalesce(a.email, p.email)
from public.profiles p
where p.id = a.id
  and a.profile_id is null;

-- Kvarvarande rader utan matchande profil får ett platshållarnamn så att
-- NOT NULL kan sättas utan att tappa data.
update public.adepts
set full_name = coalesce(full_name, 'Namnlös adept')
where full_name is null;

alter table public.adepts
  alter column full_name set not null;

-- id ska inte längre ärva profilens nyckel.
alter table public.adepts
  drop constraint if exists adepts_id_fkey;

alter table public.adepts
  alter column id set default gen_random_uuid();

-- En profil kan bara vara en adept.
create unique index if not exists adepts_profile_id_key
  on public.adepts (profile_id)
  where profile_id is not null;

create index if not exists adepts_coach_id_created_idx
  on public.adepts (coach_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Testtyper
--
-- coach_id null = inbyggd typ som alla ser. Sätter en coach upp en egen typ
-- ägs den av coachen och syns bara för hen.
-- ---------------------------------------------------------------------------

create table if not exists public.test_types (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references public.coaches (id) on delete cascade,
  label text not null,
  default_unit text not null,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Samma namn får inte finnas två gånger hos samma ägare.
create unique index if not exists test_types_builtin_label_key
  on public.test_types (lower(label))
  where coach_id is null;

create unique index if not exists test_types_coach_label_key
  on public.test_types (coach_id, lower(label))
  where coach_id is not null;

insert into public.test_types (label, default_unit, sort_order)
values
  ('FTP', 'W', 10),
  ('VO2max', 'ml/kg/min', 20),
  ('VLamax', 'mmol/l/s', 30),
  ('Anaerob tröskel', 'W', 40),
  ('FatMax', 'g/min', 50),
  ('LT1', 'W', 60)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Testresultat
-- ---------------------------------------------------------------------------

create table if not exists public.test_results (
  id uuid primary key default gen_random_uuid(),
  adept_id uuid not null references public.adepts (id) on delete cascade,
  test_type_id uuid not null references public.test_types (id) on delete restrict,
  value numeric not null,
  -- Enheten fylls i från testtypen men sparas per resultat: samma testtyp kan
  -- mätas i olika enheter beroende på sport, och historiken ska inte ändras
  -- retroaktivt om typens standardenhet skrivs om.
  unit text not null,
  tested_on date not null default current_date,
  comment text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists test_results_adept_idx
  on public.test_results (adept_id, tested_on desc);

create index if not exists test_results_adept_type_idx
  on public.test_results (adept_id, test_type_id, tested_on);

drop trigger if exists test_types_set_updated_at on public.test_types;
create trigger test_types_set_updated_at
  before update on public.test_types
  for each row execute function public.set_updated_at();

drop trigger if exists test_results_set_updated_at on public.test_results;
create trigger test_results_set_updated_at
  before update on public.test_results
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Ny användare: adeptgrenen skriver nu till profile_id, inte id
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role public.account_role;
  v_name text;
begin
  v_role := coalesce(nullif(v_meta ->> 'role', ''), 'adept')::public.account_role;
  v_name := coalesce(nullif(v_meta ->> 'full_name', ''), split_part(new.email, '@', 1));

  insert into public.profiles (id, role, full_name, email, accepted_terms_at)
  values (
    new.id,
    v_role,
    v_name,
    new.email,
    case
      when coalesce((v_meta ->> 'accepted_terms')::boolean, false) then now()
      else null
    end
  )
  on conflict (id) do nothing;

  if v_role = 'coach' then
    insert into public.coaches (id, company_name)
    values (new.id, nullif(v_meta ->> 'company_name', ''))
    on conflict (id) do nothing;
  else
    -- Adepten registrerar sig själv och saknar coach tills någon kopplar på en.
    insert into public.adepts (
      profile_id, full_name, email, sport, goal, current_level, last_active_at
    )
    values (
      new.id,
      v_name,
      new.email,
      nullif(v_meta ->> 'sport', ''),
      nullif(v_meta ->> 'goal', ''),
      nullif(v_meta ->> 'current_level', ''),
      now()
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Hjälpfunktioner för RLS
--
-- security definer: policyn måste kunna läsa relationen utan att i sin tur
-- filtreras av RLS på adepts (vilket skulle bli rekursivt).
-- ---------------------------------------------------------------------------

-- Ersätter fas 1-versionen: adepten identifieras nu av profile_id.
-- Parameternamnet ändras, och det klarar inte CREATE OR REPLACE. Policyn som
-- använder funktionen måste bort först, annars blockerar beroendet DROP.
drop policy if exists "Coach läser sina adepters profiler" on public.profiles;
drop function if exists public.is_coach_of(uuid);

create function public.is_coach_of(profile uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.adepts a
    where a.profile_id = profile
      and a.coach_id = auth.uid()
  );
$$;

create policy "Coach läser sina adepters profiler"
  on public.profiles for select
  to authenticated
  using (public.is_coach_of(id));

create or replace function public.current_coach_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select a.coach_id
  from public.adepts a
  where a.profile_id = auth.uid();
$$;

-- Får inloggad användare läsa adeptens data? Coachen som äger raden, eller
-- adepten själv.
create or replace function public.can_view_adept(adept uuid)
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
      and (a.coach_id = auth.uid() or a.profile_id = auth.uid())
  );
$$;

-- Får inloggad användare skriva på adeptens data? Endast coachen.
create or replace function public.is_adept_coach(adept uuid)
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
      and a.coach_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS: adepts (ersätter fas 1-policyerna, som utgick från adepts.id = auth.uid())
-- ---------------------------------------------------------------------------

drop policy if exists "Läs egen adeptrad eller egna adepter" on public.adepts;
drop policy if exists "Uppdatera egen adeptrad" on public.adepts;
drop policy if exists "Coach uppdaterar sina adepter" on public.adepts;
drop policy if exists "Skapa egen adeptrad" on public.adepts;

create policy "Coach läser sina adepter, adept läser sin egen rad"
  on public.adepts for select
  to authenticated
  using (coach_id = auth.uid() or profile_id = auth.uid());

-- En coach kan bara skapa adepter åt sig själv.
create policy "Coach skapar adepter"
  on public.adepts for insert
  to authenticated
  with check (coach_id = auth.uid());

-- ... och kan inte flytta en adept till en annan coach.
create policy "Coach uppdaterar sina adepter"
  on public.adepts for update
  to authenticated
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

create policy "Coach tar bort sina adepter"
  on public.adepts for delete
  to authenticated
  using (coach_id = auth.uid());

-- Adepten får uppdatera sin egen rad men inte byta ägare eller profil.
create policy "Adept uppdaterar sin egen rad"
  on public.adepts for update
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Självregistrerade adepter skapar sin rad via triggern (security definer),
-- så ingen insert-policy behövs för adeptkonton.

-- ---------------------------------------------------------------------------
-- RLS: test_types
-- ---------------------------------------------------------------------------

alter table public.test_types enable row level security;

drop policy if exists "Läs inbyggda och egna testtyper" on public.test_types;
create policy "Läs inbyggda och egna testtyper"
  on public.test_types for select
  to authenticated
  using (
    coach_id is null
    or coach_id = auth.uid()
    -- Adepten måste kunna se sin coachs egna typer för att kunna läsa sina
    -- egna resultat.
    or coach_id = public.current_coach_id()
  );

drop policy if exists "Coach skapar egna testtyper" on public.test_types;
create policy "Coach skapar egna testtyper"
  on public.test_types for insert
  to authenticated
  with check (coach_id = auth.uid());

drop policy if exists "Coach uppdaterar egna testtyper" on public.test_types;
create policy "Coach uppdaterar egna testtyper"
  on public.test_types for update
  to authenticated
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

drop policy if exists "Coach tar bort egna testtyper" on public.test_types;
create policy "Coach tar bort egna testtyper"
  on public.test_types for delete
  to authenticated
  using (coach_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RLS: test_results
-- ---------------------------------------------------------------------------

alter table public.test_results enable row level security;

drop policy if exists "Läs testresultat för adepter man har tillgång till" on public.test_results;
create policy "Läs testresultat för adepter man har tillgång till"
  on public.test_results for select
  to authenticated
  using (public.can_view_adept(adept_id));

drop policy if exists "Coach registrerar testresultat" on public.test_results;
create policy "Coach registrerar testresultat"
  on public.test_results for insert
  to authenticated
  with check (public.is_adept_coach(adept_id));

drop policy if exists "Coach uppdaterar testresultat" on public.test_results;
create policy "Coach uppdaterar testresultat"
  on public.test_results for update
  to authenticated
  using (public.is_adept_coach(adept_id))
  with check (public.is_adept_coach(adept_id));

drop policy if exists "Coach tar bort testresultat" on public.test_results;
create policy "Coach tar bort testresultat"
  on public.test_results for delete
  to authenticated
  using (public.is_adept_coach(adept_id));


-- =============================================================================
-- 20260826180000_leads.sql
-- =============================================================================

-- Coachvy – kontaktförfrågningar från den publika sajten.
--
-- Formuläret på hub-sajten visade bara en toast och kastade innehållet. Här
-- landar det i en tabell som coachen kan läsa inifrån appen.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text,
  email text not null,
  message text not null,
  -- Fritt fält för var förfrågan kom ifrån (sidsektion, kampanj).
  source text,
  status text not null default 'ny',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Formuläret är öppet för omvärlden, så längden begränsas i databasen och
  -- inte bara i klienten.
  constraint leads_first_name_len check (char_length(first_name) between 1 and 120),
  constraint leads_last_name_len check (last_name is null or char_length(last_name) <= 120),
  constraint leads_email_len check (char_length(email) between 3 and 320),
  constraint leads_message_len check (char_length(message) between 1 and 5000),
  constraint leads_status_valid check (status in ('ny', 'kontaktad', 'avslutad'))
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- Är inloggad användare en coach?
create or replace function public.is_coach()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.coaches c where c.id = auth.uid());
$$;

alter table public.leads enable row level security;

-- Vem som helst får skicka in en förfrågan; det är hela poängen med
-- formuläret. Ingen får läsa tillbaka den utan att vara coach.
drop policy if exists "Vem som helst skickar in en förfrågan" on public.leads;
create policy "Vem som helst skickar in en förfrågan"
  on public.leads for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Coach läser förfrågningar" on public.leads;
create policy "Coach läser förfrågningar"
  on public.leads for select
  to authenticated
  using (public.is_coach());

drop policy if exists "Coach uppdaterar förfrågningar" on public.leads;
create policy "Coach uppdaterar förfrågningar"
  on public.leads for update
  to authenticated
  using (public.is_coach())
  with check (public.is_coach());


-- =============================================================================
-- 20260827090000_vlamax.sql
-- =============================================================================

-- Coachvy – VLamax-prediktion.
--
-- Portad från vlamax_calc_app (Streamlit). Där låg referensdatan i en CSV som
-- appen skrev till; här ligger den i databasen så att den växer när fler
-- atleter testas, och så att varje coach kan bygga vidare på sin egen.
--
-- coach_id null = inbyggd referensdata (Alexanders profileringsmätningar).
-- Modellen tränas på inbyggda rader plus coachens egna.

create table if not exists public.vlamax_samples (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references public.coaches (id) on delete cascade,
  label text not null,
  sex text not null,
  weight_kg numeric not null,
  body_fat_pct numeric not null,
  height_cm numeric,
  age integer,
  sprint_seconds numeric not null,
  watt_avg numeric not null,
  watt_peak numeric not null,
  -- Uppmätt VLamax – det modellen tränas mot.
  vlamax numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint vlamax_samples_sex_valid check (sex in ('man', 'kvinna')),
  constraint vlamax_samples_weight_range check (weight_kg between 30 and 200),
  constraint vlamax_samples_fat_range check (body_fat_pct between 3 and 60),
  constraint vlamax_samples_sprint_range check (sprint_seconds between 5 and 60),
  constraint vlamax_samples_watt_avg_range check (watt_avg between 50 and 2000),
  constraint vlamax_samples_watt_peak_range check (watt_peak between 50 and 3000),
  constraint vlamax_samples_vlamax_range check (vlamax between 0.05 and 1.5)
);

create index if not exists vlamax_samples_coach_idx on public.vlamax_samples (coach_id);

drop trigger if exists vlamax_samples_set_updated_at on public.vlamax_samples;
create trigger vlamax_samples_set_updated_at
  before update on public.vlamax_samples
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Inbyggd referensdata: 13 atleter med VLamax från en metabol profilering.
-- ---------------------------------------------------------------------------

insert into public.vlamax_samples
  (label, sex, weight_kg, body_fat_pct, height_cm, age, sprint_seconds, watt_avg, watt_peak, vlamax)
select * from (values
  ('Athlet 1', 'man', 77.4, 14, 186.5, 18, 19, 649, 810, 0.42),
  ('Athlet 2', 'man', 78.5, 13, 186.5, 17, 19, 649, 763, 0.43),
  ('Athlet 3', 'man', 57.8, 14, 170, 18, 20, 664, 973, 0.61),
  ('Athlet 4', 'man', 68, 10, 172, 36, 21, 700, 821, 0.51),
  ('Athlet 5', 'man', 68, 11, 172, 37, 20, 719, 945, 0.56),
  ('Athlet 6', 'man', 56.3, 13.5, 165, 18, 20, 532, 666, 0.45),
  ('Athlet 7', 'man', 104.2, 30, 181, 30, 20, 642, 1002, 0.38),
  ('Athlet 8', 'man', 67.5, 13, 185, 18, 20, 864, 993, 0.73),
  ('Athlet 9', 'man', 71, 10, 165, 35, 21, 601, 872, 0.44),
  ('Athlet 10', 'man', 67.4, 12, 172, 37, 19, 670, 931, 0.5),
  ('Athlet 11', 'man', 69.5, 13, 172, 38, 22, 691, 1013, 0.57),
  ('Athletin 1', 'kvinna', 56, 14, 164, 42, 23, 405, 616, 0.39),
  ('Athletin 2', 'kvinna', 59, 14, 165, 42, 21, 416, 579, 0.41)
) as seed(label, sex, weight_kg, body_fat_pct, height_cm, age, sprint_seconds, watt_avg, watt_peak, vlamax)
where not exists (
  select 1 from public.vlamax_samples existing
  where existing.coach_id is null and existing.label = seed.label
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.vlamax_samples enable row level security;

drop policy if exists "Läs inbyggd referensdata och egen" on public.vlamax_samples;
create policy "Läs inbyggd referensdata och egen"
  on public.vlamax_samples for select
  to authenticated
  using (coach_id is null or coach_id = auth.uid());

drop policy if exists "Coach lägger till egen referensdata" on public.vlamax_samples;
create policy "Coach lägger till egen referensdata"
  on public.vlamax_samples for insert
  to authenticated
  with check (coach_id = auth.uid());

drop policy if exists "Coach uppdaterar egen referensdata" on public.vlamax_samples;
create policy "Coach uppdaterar egen referensdata"
  on public.vlamax_samples for update
  to authenticated
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

drop policy if exists "Coach tar bort egen referensdata" on public.vlamax_samples;
create policy "Coach tar bort egen referensdata"
  on public.vlamax_samples for delete
  to authenticated
  using (coach_id = auth.uid());


-- =============================================================================
-- 20260828090000_test_sessions.sql
-- =============================================================================

-- Coachvy – testtillfällen.
--
-- `test_results` sparar ett skalärt värde per rad: typ, värde, enhet, datum.
-- Det räcker för att följa ett enskilt tal över tid, men inte för det ett
-- riktigt test är. Ett laktatstegtest ger LT1, LT2 och zoner ur ett dussin
-- steg. Ett critical power-test ger CP och W' ur två eller tre ansträngningar.
-- Sparar man bara slutvärdet går rådatan förlorad, och då går det varken att
-- räkna om när modellen förbättras eller att hitta "bästa 3-minuterstestet
-- hittills".
--
-- Därför tre tabeller:
--
--   test_sessions  ett testtillfälle: protokoll, gren, datum
--   test_efforts   rådatan: steg eller ansträngningar
--   test_metrics   de framräknade värdena: CP, W', LT1, LT2, FTP, CS, D' ...
--
-- `test_results` lämnas orört. Den fyller fortfarande sin roll för enstaka
-- värden som inte kommer ur ett protokoll (en vikt, ett VO2max från labbet).

-- ---------------------------------------------------------------------------
-- test_sessions
-- ---------------------------------------------------------------------------

create table if not exists public.test_sessions (
  id uuid primary key default gen_random_uuid(),
  adept_id uuid not null references public.adepts (id) on delete cascade,

  -- Nyckeln till protokollet i koden (src/lib/tests/protocols.ts). Avsiktligt
  -- text och inte en tabell: varje protokoll har en egen beräkning, så ett
  -- protokoll utan kod bakom sig vore bara en etikett.
  protocol text not null,

  sport text not null check (sport in ('cykling', 'löpning', 'simning')),
  intensity_unit text not null check (intensity_unit in ('W', 'km/h', 'm/s')),

  performed_on date not null default current_date,

  -- Vikten vid testtillfället, för W/kg. Sparas per test eftersom den ändras.
  weight_kg numeric check (weight_kg is null or weight_kg > 0),

  -- Vilket zonschema resultatet ska tolkas med. Ett laktattest ger trösklar
  -- som styr tempomultiplar; ett CS-test ger fraktioner av CS. Valet hör till
  -- testet, inte till appen.
  zone_scheme text check (
    zone_scheme is null or zone_scheme in ('tröskel', 'critical-speed', 'ftp')
  ),

  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists test_sessions_adept_idx
  on public.test_sessions (adept_id, performed_on desc);

create index if not exists test_sessions_adept_protocol_idx
  on public.test_sessions (adept_id, protocol, performed_on desc);

-- ---------------------------------------------------------------------------
-- test_efforts – rådatan
--
-- En rad är ett steg i ett stegtest eller en ansträngning i ett CP/CS-test.
-- Kolumnerna är avsiktligt glesa: vilka som är ifyllda beror på protokollet.
-- ---------------------------------------------------------------------------

create table if not exists public.test_efforts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.test_sessions (id) on delete cascade,

  -- Ordningen i testet. Steg 0 är vilovärdet i ett stegtest.
  ordinal integer not null,

  /** Belastningen i testtillfällets enhet: watt, km/h eller m/s. */
  intensity numeric,

  /** Ansträngningens längd. Satt för CP/CS/FTP, null för stegtest. */
  duration_seconds numeric check (duration_seconds is null or duration_seconds > 0),

  /** Tillryggalagd sträcka. Satt för CS-protokoll som mäter distans. */
  distance_m numeric check (distance_m is null or distance_m > 0),

  lactate numeric check (lactate is null or lactate >= 0),
  heart_rate integer check (heart_rate is null or (heart_rate > 0 and heart_rate < 300)),
  rpe integer check (rpe is null or (rpe >= 1 and rpe <= 20)),
  comment text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (session_id, ordinal)
);

create index if not exists test_efforts_session_idx
  on public.test_efforts (session_id, ordinal);

-- Rullande CP/FTP letar upp bästa insatsen per duration. Indexet gör den
-- sökningen billig utan att behöva gå via sessionstabellen först.
create index if not exists test_efforts_duration_idx
  on public.test_efforts (duration_seconds, intensity)
  where duration_seconds is not null;

-- ---------------------------------------------------------------------------
-- test_metrics – de framräknade värdena
--
-- Sparas trots att de går att räkna om ur rådatan, av två skäl: de ska gå att
-- lista och grafa utan att räkna om varje test vid varje sidladdning, och de
-- utgör facit för vad coachen faktiskt såg när testet registrerades.
-- ---------------------------------------------------------------------------

create table if not exists public.test_metrics (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.test_sessions (id) on delete cascade,

  /** 'CP', 'W_prime', 'FTP', 'LT1', 'LT2', 'CS', 'D_prime', 'VO2max' ... */
  key text not null,
  value numeric not null,
  unit text not null,

  /** Vilken metod värdet kom ur, när flera ger samma storhet. */
  method text,

  /** Det värde coachen ska läsa först för den här storheten. */
  is_primary boolean not null default false,

  created_at timestamptz not null default now(),

  unique (session_id, key, method)
);

create index if not exists test_metrics_session_idx
  on public.test_metrics (session_id, key);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

drop trigger if exists test_sessions_set_updated_at on public.test_sessions;
create trigger test_sessions_set_updated_at
  before update on public.test_sessions
  for each row execute function public.set_updated_at();

drop trigger if exists test_efforts_set_updated_at on public.test_efforts;
create trigger test_efforts_set_updated_at
  before update on public.test_efforts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
--
-- Sessionen bär adept_id och kan därför använda samma hjälpfunktioner som
-- test_results. Efforts och metrics ärver behörigheten via sin session – de
-- har inget eget adept_id att kolla mot, och att duplicera det dit vore en
-- kolumn som kan hamna i otakt.
-- ---------------------------------------------------------------------------

alter table public.test_sessions enable row level security;
alter table public.test_efforts enable row level security;
alter table public.test_metrics enable row level security;

-- Får inloggad användare läsa testtillfället?
create or replace function public.can_view_session(session uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.test_sessions s
    where s.id = session
      and public.can_view_adept(s.adept_id)
  );
$$;

-- Får inloggad användare skriva på testtillfället? Endast coachen.
create or replace function public.is_session_coach(session uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.test_sessions s
    where s.id = session
      and public.is_adept_coach(s.adept_id)
  );
$$;

-- test_sessions ---------------------------------------------------------------

drop policy if exists "Läs testtillfällen för adepter man har tillgång till" on public.test_sessions;
create policy "Läs testtillfällen för adepter man har tillgång till"
  on public.test_sessions for select
  to authenticated
  using (public.can_view_adept(adept_id));

drop policy if exists "Coach skapar testtillfällen" on public.test_sessions;
create policy "Coach skapar testtillfällen"
  on public.test_sessions for insert
  to authenticated
  with check (public.is_adept_coach(adept_id));

drop policy if exists "Coach uppdaterar testtillfällen" on public.test_sessions;
create policy "Coach uppdaterar testtillfällen"
  on public.test_sessions for update
  to authenticated
  using (public.is_adept_coach(adept_id))
  with check (public.is_adept_coach(adept_id));

drop policy if exists "Coach tar bort testtillfällen" on public.test_sessions;
create policy "Coach tar bort testtillfällen"
  on public.test_sessions for delete
  to authenticated
  using (public.is_adept_coach(adept_id));

-- test_efforts ----------------------------------------------------------------

drop policy if exists "Läs steg för testtillfällen man ser" on public.test_efforts;
create policy "Läs steg för testtillfällen man ser"
  on public.test_efforts for select
  to authenticated
  using (public.can_view_session(session_id));

drop policy if exists "Coach skapar steg" on public.test_efforts;
create policy "Coach skapar steg"
  on public.test_efforts for insert
  to authenticated
  with check (public.is_session_coach(session_id));

drop policy if exists "Coach uppdaterar steg" on public.test_efforts;
create policy "Coach uppdaterar steg"
  on public.test_efforts for update
  to authenticated
  using (public.is_session_coach(session_id))
  with check (public.is_session_coach(session_id));

drop policy if exists "Coach tar bort steg" on public.test_efforts;
create policy "Coach tar bort steg"
  on public.test_efforts for delete
  to authenticated
  using (public.is_session_coach(session_id));

-- test_metrics ----------------------------------------------------------------

drop policy if exists "Läs värden för testtillfällen man ser" on public.test_metrics;
create policy "Läs värden för testtillfällen man ser"
  on public.test_metrics for select
  to authenticated
  using (public.can_view_session(session_id));

drop policy if exists "Coach skapar värden" on public.test_metrics;
create policy "Coach skapar värden"
  on public.test_metrics for insert
  to authenticated
  with check (public.is_session_coach(session_id));

drop policy if exists "Coach uppdaterar värden" on public.test_metrics;
create policy "Coach uppdaterar värden"
  on public.test_metrics for update
  to authenticated
  using (public.is_session_coach(session_id))
  with check (public.is_session_coach(session_id));

drop policy if exists "Coach tar bort värden" on public.test_metrics;
create policy "Coach tar bort värden"
  on public.test_metrics for delete
  to authenticated
  using (public.is_session_coach(session_id));


-- =============================================================================
-- 20260829090000_workouts.sql
-- =============================================================================

-- Coachvy – enskilda pass.
--
-- Ett pass är ett dokument: det skrivs helt, läses helt och ändras helt. Till
-- skillnad från test_efforts, som frågas ut steg för steg över alla
-- testtillfällen när den rullande CP-modellen letar bästa insatsen per
-- duration, finns det ingen fråga som lyder "alla intervall över 105 % av FTP
-- i februari". Därför ligger stegen som jsonb i en kolumn i stället för i en
-- egen tabell: en normalisering utan en fråga som drar nytta av den är bara
-- fler joins.
--
-- Referensen passet byggdes mot sparas med. Ett pass på 105 % av FTP är inte
-- samma pass i watt när FTP har flyttat sig, och när coachen öppnar ett pass
-- från i våras ska det stå vad som faktiskt var föreskrivet då.

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  adept_id uuid not null references public.adepts (id) on delete cascade,

  title text not null,
  sport text not null check (sport in ('cykling', 'löpning', 'simning')),
  summary text,

  -- Motiveringen bakom upplägget, så att den följer med passet i stället för
  -- att försvinna när fönstret stängs.
  rationale text,

  -- Vad procenttalen i stegen räknas mot, och värdet de räknades mot.
  basis text not null check (basis in ('FTP', 'CP', 'CS', 'CSS', 'LT2')),
  reference numeric not null check (reference > 0),

  -- Tröskeln och reserven W′bal prövades mot, när de fanns. I basenhet:
  -- watt och joule för cykling, m/s och meter för löpning och simning.
  critical numeric check (critical is null or critical > 0),
  reserve numeric check (reserve is null or reserve > 0),

  -- Blocken: [{ type, step } | { type, times, steps }].
  blocks jsonb not null,

  -- Prompten passet kom ur. Sparas för att ett pass som blev bra ska gå att
  -- bygga vidare på, och för att se vad coachen faktiskt bad om.
  prompt text,

  scheduled_for date,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workouts_adept_idx
  on public.workouts (adept_id, created_at desc);

create index if not exists workouts_scheduled_idx
  on public.workouts (adept_id, scheduled_for)
  where scheduled_for is not null;

drop trigger if exists workouts_set_updated_at on public.workouts;
create trigger workouts_set_updated_at
  before update on public.workouts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS – samma regel som testtillfällena: coachen skriver, adepten läser sitt.
-- ---------------------------------------------------------------------------

alter table public.workouts enable row level security;

drop policy if exists "Läs pass för adepter man har tillgång till" on public.workouts;
create policy "Läs pass för adepter man har tillgång till"
  on public.workouts for select
  to authenticated
  using (public.can_view_adept(adept_id));

drop policy if exists "Coach skapar pass" on public.workouts;
create policy "Coach skapar pass"
  on public.workouts for insert
  to authenticated
  with check (public.is_adept_coach(adept_id));

drop policy if exists "Coach uppdaterar pass" on public.workouts;
create policy "Coach uppdaterar pass"
  on public.workouts for update
  to authenticated
  using (public.is_adept_coach(adept_id))
  with check (public.is_adept_coach(adept_id));

drop policy if exists "Coach tar bort pass" on public.workouts;
create policy "Coach tar bort pass"
  on public.workouts for delete
  to authenticated
  using (public.is_adept_coach(adept_id));


-- =============================================================================
-- 20260919090000_checkins_profile_messages.sql
-- =============================================================================

-- Coachvy – återkopplingen tillbaka från adepten.
--
-- Appen har hittills bara gått åt ett håll: coachen mäter, räknar och
-- föreskriver. Passbyggaren förutspår W′bal för ett pass, men ingenting
-- kommer tillbaka om hur det faktiskt gick. Fyra tabeller stänger cirkeln.
--
--   adept_profiles    bakgrunden som inte ryms i adepts: träningsår,
--                     veckovolym, skador, styrkor och svagheter
--   adept_checkins    den dagliga incheckningen: sRPE och återhämtning
--   coach_messages    samtalet mellan coach och adept
--   ai_conversations  AI-coachens tråd per adept
--   ai_messages       meddelandena i den tråden
--
-- Plus en kolumn på test_sessions: vilken träningsfas testet togs i. Ett tapp
-- mitt i ett uppbyggnadsblock betyder inte samma sak som ett tapp i
-- tävlingsperioden, och utan fasen går kurvan inte att läsa.

-- ---------------------------------------------------------------------------
-- Träningsfas på testtillfället
-- ---------------------------------------------------------------------------

alter table public.test_sessions
  add column if not exists training_phase text
  check (
    training_phase is null
    or training_phase in ('grund', 'uppbyggnad', 'specifik', 'topp', 'vila')
  );

comment on column public.test_sessions.training_phase is
  'Perioden testet togs i. Gör progressionskurvan läsbar: ett tapp i ett '
  'uppbyggnadsblock betyder något annat än ett tapp i tävlingsperioden.';

-- ---------------------------------------------------------------------------
-- adept_profiles – bakgrunden
--
-- Egen tabell i stället för fler kolumner på adepts, av två skäl: adepts är
-- coachens register och ska gå att läsa snabbt i en lista, och den här datan
-- är fritext som adepten själv äger. En rad per adept.
-- ---------------------------------------------------------------------------

create table if not exists public.adept_profiles (
  adept_id uuid primary key references public.adepts (id) on delete cascade,

  birth_year integer check (birth_year is null or (birth_year between 1900 and 2100)),
  sex text check (sex is null or sex in ('man', 'kvinna', 'annat')),
  height_cm numeric check (height_cm is null or (height_cm > 50 and height_cm < 260)),

  /** Hur länge atleten tränat strukturerat, i år. */
  training_years numeric check (training_years is null or training_years >= 0),
  /** Normal veckovolym, timmar respektive antal pass. */
  weekly_hours numeric check (weekly_hours is null or (weekly_hours >= 0 and weekly_hours <= 60)),
  weekly_sessions integer check (weekly_sessions is null or (weekly_sessions >= 0 and weekly_sessions <= 30)),

  /** Fritext. Det här är vad coachen annars hade skrivit om i varje prompt. */
  injuries text,
  medical text,
  strengths text,
  weaknesses text,
  /** Nästa mål, med datum när det är ett lopp. */
  goal text,
  goal_date date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- adept_checkins – den dagliga incheckningen
--
-- Två mått som medvetet hålls isär.
--
-- `session_rpe` är Borg CR10 för passet som helhet: 0 är vila, 10 är det
-- hårdaste atleten kan föreställa sig. Multiplicerat med passets längd i
-- minuter ger det träningsbelastningen i godtyckliga enheter (Foster 1998).
--
-- De fyra återhämtningsfrågorna är Hoopers index (Hooper & Mackinnon 1995):
-- sömn, trötthet, muskelömhet och stress. Originalet räknar 1 som bäst och
-- högre som sämre; här är skalan vänd så att 5 alltid är bäst, eftersom
-- resten av appen läser högre tal som bättre. Summan 4–20 är dagens
-- återhämtningspoäng.
--
-- De snittas aldrig ihop. Belastning och återhämtning pekar åt olika håll och
-- ett medelvärde av dem är ett tal utan innebörd.
-- ---------------------------------------------------------------------------

create table if not exists public.adept_checkins (
  id uuid primary key default gen_random_uuid(),
  adept_id uuid not null references public.adepts (id) on delete cascade,

  performed_on date not null default current_date,

  /** Borg CR10 för passet. Null när dagen var en vilodag. */
  session_rpe numeric check (session_rpe is null or (session_rpe >= 0 and session_rpe <= 10)),
  /** Passets längd i minuter. Behövs för belastningen. */
  duration_minutes numeric check (duration_minutes is null or (duration_minutes > 0 and duration_minutes <= 1440)),

  /** Hoopers fyra, vända så att 5 är bäst. */
  sleep integer check (sleep is null or (sleep between 1 and 5)),
  fatigue integer check (fatigue is null or (fatigue between 1 and 5)),
  soreness integer check (soreness is null or (soreness between 1 and 5)),
  stress integer check (stress is null or (stress between 1 and 5)),

  /** Passet incheckningen gäller, när adepten följde ett föreskrivet pass. */
  workout_id uuid references public.workouts (id) on delete set null,

  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- En incheckning per dag och adept. Ändrar man sig skrivs raden över.
  unique (adept_id, performed_on)
);

create index if not exists adept_checkins_adept_idx
  on public.adept_checkins (adept_id, performed_on desc);

-- ---------------------------------------------------------------------------
-- coach_messages – samtalet
-- ---------------------------------------------------------------------------

create table if not exists public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  adept_id uuid not null references public.adepts (id) on delete cascade,

  /** Vem som skrev. Avgör åt vilket håll bubblan pekar och vem som ska läsa. */
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(btrim(body)) > 0),

  /** Sätts när mottagaren har läst. Null betyder oläst. */
  read_at timestamptz,

  /** Ett meddelande kan hänga på ett pass eller ett testtillfälle. */
  workout_id uuid references public.workouts (id) on delete set null,
  session_id uuid references public.test_sessions (id) on delete set null,

  created_at timestamptz not null default now()
);

create index if not exists coach_messages_adept_idx
  on public.coach_messages (adept_id, created_at desc);

create index if not exists coach_messages_unread_idx
  on public.coach_messages (adept_id, read_at)
  where read_at is null;

-- ---------------------------------------------------------------------------
-- AI-coachens trådar
--
-- En tråd per adept och coach, så att samtalet om en viss atlet går att
-- fortsätta i morgon. Meddelandena sparas i klartext eftersom de är det
-- coachen vill kunna läsa om – underlaget som skickades med byggs om vid
-- varje fråga ur färska tal i stället för att frysas ned i tråden.
-- ---------------------------------------------------------------------------

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  adept_id uuid not null references public.adepts (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  title text not null default 'Samtal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (adept_id, created_by)
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_conversation_idx
  on public.ai_messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

drop trigger if exists adept_profiles_set_updated_at on public.adept_profiles;
create trigger adept_profiles_set_updated_at
  before update on public.adept_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists adept_checkins_set_updated_at on public.adept_checkins;
create trigger adept_checkins_set_updated_at
  before update on public.adept_checkins
  for each row execute function public.set_updated_at();

drop trigger if exists ai_conversations_set_updated_at on public.ai_conversations;
create trigger ai_conversations_set_updated_at
  before update on public.ai_conversations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
--
-- Skillnaden mot testtillfällena är att adepten här inte bara läser – hon
-- skriver. Incheckningen är hennes, profilen är hennes bakgrund och
-- meddelandetråden går åt båda håll. `can_view_adept` täcker båda parterna
-- och används därför även för skrivning på de tre första tabellerna.
--
-- AI-coachens tråd är däremot coachens arbetsanteckningar om atleten, inte
-- ett samtal med henne. Den är låst till den som skapade den.
-- ---------------------------------------------------------------------------

-- Är inloggad användare adepten själv?
create or replace function public.is_the_adept(adept uuid)
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
      and a.profile_id = auth.uid()
  );
$$;

alter table public.adept_profiles enable row level security;
alter table public.adept_checkins enable row level security;
alter table public.coach_messages enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

-- adept_profiles --------------------------------------------------------------

drop policy if exists "Läs profil för adepter man har tillgång till" on public.adept_profiles;
create policy "Läs profil för adepter man har tillgång till"
  on public.adept_profiles for select
  to authenticated
  using (public.can_view_adept(adept_id));

drop policy if exists "Coach eller adept skapar profilen" on public.adept_profiles;
create policy "Coach eller adept skapar profilen"
  on public.adept_profiles for insert
  to authenticated
  with check (public.can_view_adept(adept_id));

drop policy if exists "Coach eller adept uppdaterar profilen" on public.adept_profiles;
create policy "Coach eller adept uppdaterar profilen"
  on public.adept_profiles for update
  to authenticated
  using (public.can_view_adept(adept_id))
  with check (public.can_view_adept(adept_id));

drop policy if exists "Coach tar bort profilen" on public.adept_profiles;
create policy "Coach tar bort profilen"
  on public.adept_profiles for delete
  to authenticated
  using (public.is_adept_coach(adept_id));

-- adept_checkins --------------------------------------------------------------

drop policy if exists "Läs incheckningar för adepter man har tillgång till" on public.adept_checkins;
create policy "Läs incheckningar för adepter man har tillgång till"
  on public.adept_checkins for select
  to authenticated
  using (public.can_view_adept(adept_id));

drop policy if exists "Coach eller adept checkar in" on public.adept_checkins;
create policy "Coach eller adept checkar in"
  on public.adept_checkins for insert
  to authenticated
  with check (public.can_view_adept(adept_id));

drop policy if exists "Coach eller adept rättar en incheckning" on public.adept_checkins;
create policy "Coach eller adept rättar en incheckning"
  on public.adept_checkins for update
  to authenticated
  using (public.can_view_adept(adept_id))
  with check (public.can_view_adept(adept_id));

drop policy if exists "Coach eller adept tar bort en incheckning" on public.adept_checkins;
create policy "Coach eller adept tar bort en incheckning"
  on public.adept_checkins for delete
  to authenticated
  using (public.can_view_adept(adept_id));

-- coach_messages --------------------------------------------------------------

drop policy if exists "Läs meddelanden i sin egen tråd" on public.coach_messages;
create policy "Läs meddelanden i sin egen tråd"
  on public.coach_messages for select
  to authenticated
  using (public.can_view_adept(adept_id));

-- Avsändaren måste vara den som skriver. Utan den kontrollen kunde en coach
-- lägga ord i sin adepts mun i hennes egen tråd.
drop policy if exists "Skriv i sin egen tråd som sig själv" on public.coach_messages;
create policy "Skriv i sin egen tråd som sig själv"
  on public.coach_messages for insert
  to authenticated
  with check (public.can_view_adept(adept_id) and sender_id = auth.uid());

-- Bara sina egna meddelanden går att ändra eller ta bort. Att markera någon
-- annans som läst sköts av funktionen nedan, inte av en UPDATE-policy – en
-- sådan hade också släppt igenom ändringar av själva texten.
drop policy if exists "Ändra sina egna meddelanden" on public.coach_messages;
create policy "Ändra sina egna meddelanden"
  on public.coach_messages for update
  to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

drop policy if exists "Ta bort sina egna meddelanden" on public.coach_messages;
create policy "Ta bort sina egna meddelanden"
  on public.coach_messages for delete
  to authenticated
  using (sender_id = auth.uid());

-- Markerar motpartens olästa meddelanden som lästa. Rör bara read_at, och
-- bara på rader som någon annan har skrivit.
create or replace function public.mark_messages_read(adept uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  touched integer;
begin
  if not public.can_view_adept(adept) then
    return 0;
  end if;

  update public.coach_messages
     set read_at = now()
   where adept_id = adept
     and sender_id <> auth.uid()
     and read_at is null;

  get diagnostics touched = row_count;
  return touched;
end;
$$;

-- ai_conversations och ai_messages ---------------------------------------------

drop policy if exists "Läs sina egna AI-trådar" on public.ai_conversations;
create policy "Läs sina egna AI-trådar"
  on public.ai_conversations for select
  to authenticated
  using (created_by = auth.uid() and public.can_view_adept(adept_id));

drop policy if exists "Skapa en AI-tråd på sin adept" on public.ai_conversations;
create policy "Skapa en AI-tråd på sin adept"
  on public.ai_conversations for insert
  to authenticated
  with check (created_by = auth.uid() and public.is_adept_coach(adept_id));

drop policy if exists "Uppdatera sin egen AI-tråd" on public.ai_conversations;
create policy "Uppdatera sin egen AI-tråd"
  on public.ai_conversations for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "Ta bort sin egen AI-tråd" on public.ai_conversations;
create policy "Ta bort sin egen AI-tråd"
  on public.ai_conversations for delete
  to authenticated
  using (created_by = auth.uid());

-- Meddelandena ärver behörigheten via sin tråd.
create or replace function public.owns_conversation(conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ai_conversations c
    where c.id = conversation
      and c.created_by = auth.uid()
  );
$$;

drop policy if exists "Läs meddelanden i sin egen AI-tråd" on public.ai_messages;
create policy "Läs meddelanden i sin egen AI-tråd"
  on public.ai_messages for select
  to authenticated
  using (public.owns_conversation(conversation_id));

drop policy if exists "Skriv i sin egen AI-tråd" on public.ai_messages;
create policy "Skriv i sin egen AI-tråd"
  on public.ai_messages for insert
  to authenticated
  with check (public.owns_conversation(conversation_id));

drop policy if exists "Ta bort meddelanden i sin egen AI-tråd" on public.ai_messages;
create policy "Ta bort meddelanden i sin egen AI-tråd"
  on public.ai_messages for delete
  to authenticated
  using (public.owns_conversation(conversation_id));


-- =============================================================================
-- 20260925090000_vlamax_reference_in_code.sql
-- =============================================================================

-- Coachvy – VLamax-referensdatan flyttar till koden.
--
-- De inbyggda raderna (coach_id null) ligger nu i src/lib/vlamax/reference.ts,
-- tillsammans med tre nya profileringsmätningar. Två skäl:
--
--   * Det metabola testprotokollet räknar i webbläsaren, också på den publika
--     sidan där en anonym besökare inte får läsa den här tabellen. Datan måste
--     finnas där modellen körs.
--   * Modellens form byttes samtidigt – från fem variabler till sprint per kilo
--     fettfri massa – och valet prövades mot just de här raderna. Ligger de i
--     samma commit som modellen går det att se vad som validerades mot vad.
--
-- Coachernas egna mätningar ligger kvar här och läggs till ovanpå.

-- Toppeffekten ingår inte längre i modellen. Den sparas när den finns, men
-- en mätning utan den är inte längre ofullständig.
alter table public.vlamax_samples
  alter column watt_peak drop not null;

-- De inbyggda raderna läses nu ur koden. Ligger de kvar här räknas de två
-- gånger; frågan filtrerar bort dem ändå, men dubbletter i tabellen är en
-- fälla för den som läser den direkt.
delete from public.vlamax_samples where coach_id is null;


-- =============================================================================
-- 20260925100000_test_sessions_body_composition.sql
-- =============================================================================

-- Coachvy – kroppssammansättning på testtillfället.
--
-- Det metabola protokollet (sprint + 3, 6 och 12 minuter) skattar VLamax ur
-- sprinteffekten per kilo fettfri massa. Vikten sparas redan per tillfälle;
-- kroppsfett och kön behövs också, och av samma skäl sparas de här och inte
-- på adepten: kroppsfettet ändras, och ett gammalt test ska kunna räknas om
-- med de värden som gällde då.

alter table public.test_sessions
  add column if not exists body_fat_pct numeric check (
    body_fat_pct is null or (body_fat_pct > 0 and body_fat_pct < 60)
  ),
  add column if not exists sex text check (sex is null or sex in ('man', 'kvinna'));

comment on column public.test_sessions.body_fat_pct is
  'Kroppsfett i procent vid testtillfället. Används för fettfri massa i VLamax-skattningen.';
comment on column public.test_sessions.sex is
  'Kön som VLamax-modellen justerar för. Sparas med testet så att det kan räknas om.';


-- =============================================================================
-- 20260926090000_coach_membership.sql
-- =============================================================================

-- Coachvy – medlemskap på coachkontot.
--
-- Den metabola profilen (sprint + 3, 6 och 12 min), VLamax-kalkylen och den
-- metabola kalkylen ingår i medlemskapet. Vem som helst kan registrera ett
-- coachkonto; det här är vad som skiljer ett gratiskonto från ett betalande.
--
-- Kolumnen sätts av dig i databasen i dag, och av en betalningslösning senare.
-- Aldrig av användaren själv: coachen får uppdatera sin egen rad (företagsnamn),
-- så utan vakten nedan kunde vem som helst göra sig till medlem med ett enda
-- anrop mot API:t.

alter table public.coaches
  add column if not exists plan text not null default 'bas'
    check (plan in ('bas', 'medlem'));

comment on column public.coaches.plan is
  'bas = gratiskonto, medlem = betalande. Kan inte ändras av användaren själv.';

create or replace function public.guard_coach_plan()
returns trigger
language plpgsql
as $$
begin
  -- Inloggade och anonyma anrop via API:t körs som rollerna authenticated och
  -- anon. SQL-editorn, migrationer, registreringstriggern och en framtida
  -- betalningswebhook med service-nyckeln gör det inte.
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.plan := 'bas';
    elsif new.plan is distinct from old.plan then
      raise exception 'Medlemskapet kan inte ändras från appen.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists coaches_guard_plan on public.coaches;
create trigger coaches_guard_plan
  before insert or update on public.coaches
  for each row execute function public.guard_coach_plan();


-- =============================================================================
-- 20260926120000_test_finish.sql
-- =============================================================================

-- Coachvy – slutet på ett stegtest.
--
-- Ett laktatstegtest ska sluta all-out: antingen med en ramp till utmattning,
-- som ger Vmax eller Wmax, eller med ett VO2max-test. Det är toppen på skalan –
-- det tröskeln jämförs mot, och det som gör att VLamax kan räknas ur testet.
-- Sparas per tillfälle, som vikt och kroppsfett, så att testet kan räknas om.

alter table public.test_sessions
  -- Högsta belastning i testets enhet (W, km/h eller m/s). Ur rampen räknas den
  -- som sista fullföljda nivån plus den del av nästa som hanns med.
  add column if not exists peak_intensity numeric check (peak_intensity is null or peak_intensity > 0),
  -- Uppmätt VO2max, ml/kg/min, när testet slutade med ett VO2max-test.
  add column if not exists vo2max numeric check (vo2max is null or (vo2max > 10 and vo2max < 100)),
  add column if not exists peak_lactate numeric check (peak_lactate is null or (peak_lactate > 0 and peak_lactate < 40)),
  add column if not exists peak_heart_rate integer check (peak_heart_rate is null or (peak_heart_rate > 60 and peak_heart_rate < 250));


-- =============================================================================
-- 20260927090000_admins.sql
-- =============================================================================

-- Coachvy – adminrollen.
--
-- En admin ser alla coacher och sätter deras medlemskap direkt i appen, i
-- stället för med SQL. Adminrollen själv ges bara här i SQL-editorn:
--
--   insert into public.admins (profile_id)
--   select id from public.profiles where email = 'din@adress';
--
-- Det finns avsiktligt ingen väg att bli admin från appen. Tabellen har ingen
-- insert-, update- eller delete-policy, så den som bara har en inloggning kan
-- inte skriva i den – varken via appen eller direkt mot API:t.

create table if not exists public.admins (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- Var och en kan se om de själva är admin – inget mer.
drop policy if exists "Läs egen adminrad" on public.admins;
create policy "Läs egen adminrad"
  on public.admins for select
  to authenticated
  using (profile_id = auth.uid());

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where profile_id = auth.uid());
$$;

-- Översikten för adminsidan. Security definer så att den kan räkna adepter
-- utan att admin får läsa adepternas rader; `where is_admin()` gör att alla
-- andra får en tom lista.
drop function if exists public.admin_coach_overview();
create function public.admin_coach_overview()
returns table (
  id uuid,
  full_name text,
  email text,
  company_name text,
  plan text,
  created_at timestamptz,
  adept_count bigint,
  is_admin boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    p.full_name,
    p.email,
    c.company_name,
    c.plan,
    c.created_at,
    (select count(*) from public.adepts a where a.coach_id = c.id),
    exists (select 1 from public.admins ad where ad.profile_id = c.id)
  from public.coaches c
  join public.profiles p on p.id = c.id
  where public.is_admin()
  order by c.created_at desc;
$$;

-- Medlemskapet ändras bara här. Funktionen körs som ägaren, så vakten på
-- coaches.plan släpper igenom den – men först efter att den kontrollerat att
-- den som anropar är admin.
create or replace function public.admin_set_plan(coach uuid, new_plan text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Bara en admin kan ändra medlemskap.' using errcode = '42501';
  end if;
  if new_plan not in ('bas', 'medlem') then
    raise exception 'Okänd plan: %', new_plan using errcode = '22023';
  end if;

  update public.coaches set plan = new_plan where id = coach;
  if not found then
    raise exception 'Ingen coach med det id:t.' using errcode = 'P0002';
  end if;
  return new_plan;
end;
$$;

-- Funktioner får körrätt för alla som standard. De här är bara för inloggade,
-- och inuti dem avgör is_admin() resten.
revoke execute on function public.admin_coach_overview() from public, anon;
revoke execute on function public.admin_set_plan(uuid, text) from public, anon;
grant execute on function public.admin_coach_overview() to authenticated;
grant execute on function public.admin_set_plan(uuid, text) to authenticated;


-- =============================================================================
-- 20260927120000_community.sql
-- =============================================================================

-- Coachvy – community, medlemskap för adepter och en adminsida för alla konton.
--
-- Communityn är sluten: coacher och adepter som är kopplade till en coach.
-- Den som registrerar sig som adept utan coach kommer in först när en coach
-- kopplar på hen. Admin tar bort det som inte hör hemma där.

-- ---------------------------------------------------------------------------
-- Medlemskap för adepter, som för coacher
-- ---------------------------------------------------------------------------

alter table public.adepts
  add column if not exists plan text not null default 'bas'
    check (plan in ('bas', 'medlem'));

-- Coachen får uppdatera sina adepters rader, och adepten sin egen. Ingen av
-- dem får röra medlemskapet – det gör admin, via admin_set_member_plan.
create or replace function public.guard_adept_plan()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.plan := 'bas';
    elsif new.plan is distinct from old.plan then
      raise exception 'Medlemskapet kan inte ändras från appen.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists adepts_guard_plan on public.adepts;
create trigger adepts_guard_plan
  before insert or update on public.adepts
  for each row execute function public.guard_adept_plan();

-- ---------------------------------------------------------------------------
-- Vem är med i communityn
-- ---------------------------------------------------------------------------

create or replace function public.can_use_community()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (select 1 from public.coaches c where c.id = auth.uid())
    or exists (
      select 1 from public.adepts a
      where a.profile_id = auth.uid() and a.coach_id is not null
    );
$$;

-- ---------------------------------------------------------------------------
-- Inlägg, kommentarer och gillningar
-- ---------------------------------------------------------------------------

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  channel text not null default 'allmant'
    check (channel in ('allmant', 'lopning', 'cykling', 'simning', 'triathlon')),
  body text not null check (char_length(body) between 1 and 5000),

  -- Ett delat pass eller testresultat, som en ögonblicksbild. Den byggs på
  -- servern ur det författaren själv får läsa, så att andra ser exakt det som
  -- delades – och inte får läsrätt till passet eller testet i sig.
  attachment jsonb check (
    attachment is null
    or (jsonb_typeof(attachment) = 'object' and pg_column_size(attachment) < 16000)
  ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_posts_created_idx
  on public.community_posts (created_at desc);
create index if not exists community_posts_channel_created_idx
  on public.community_posts (channel, created_at desc);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists community_comments_post_idx
  on public.community_comments (post_id, created_at);

create table if not exists public.community_likes (
  post_id uuid not null references public.community_posts (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);

drop trigger if exists community_posts_set_updated_at on public.community_posts;
create trigger community_posts_set_updated_at
  before update on public.community_posts
  for each row execute function public.set_updated_at();

alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_likes enable row level security;

-- Inlägg
drop policy if exists "Communityn läser inlägg" on public.community_posts;
create policy "Communityn läser inlägg"
  on public.community_posts for select to authenticated
  using (public.can_use_community());

drop policy if exists "Communityn skriver inlägg" on public.community_posts;
create policy "Communityn skriver inlägg"
  on public.community_posts for insert to authenticated
  with check (public.can_use_community() and author_id = auth.uid());

drop policy if exists "Författaren ändrar sitt inlägg" on public.community_posts;
create policy "Författaren ändrar sitt inlägg"
  on public.community_posts for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists "Författaren eller admin tar bort inlägg" on public.community_posts;
create policy "Författaren eller admin tar bort inlägg"
  on public.community_posts for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- Kommentarer
drop policy if exists "Communityn läser kommentarer" on public.community_comments;
create policy "Communityn läser kommentarer"
  on public.community_comments for select to authenticated
  using (public.can_use_community());

drop policy if exists "Communityn kommenterar" on public.community_comments;
create policy "Communityn kommenterar"
  on public.community_comments for insert to authenticated
  with check (public.can_use_community() and author_id = auth.uid());

drop policy if exists "Författaren eller admin tar bort kommentarer" on public.community_comments;
create policy "Författaren eller admin tar bort kommentarer"
  on public.community_comments for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- Gillningar
drop policy if exists "Communityn läser gillningar" on public.community_likes;
create policy "Communityn läser gillningar"
  on public.community_likes for select to authenticated
  using (public.can_use_community());

drop policy if exists "Communityn gillar" on public.community_likes;
create policy "Communityn gillar"
  on public.community_likes for insert to authenticated
  with check (public.can_use_community() and profile_id = auth.uid());

drop policy if exists "Ta bort egen gillning" on public.community_likes;
create policy "Ta bort egen gillning"
  on public.community_likes for delete to authenticated
  using (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Läsning med författarnamn
--
-- Medlemmarna får inte läsa varandras profiler direkt – där finns e-post. De
-- här funktionerna ger namn och roll, inget mer, och bara till den som är med.
-- ---------------------------------------------------------------------------

create or replace function public.community_feed(
  p_channel text default null,
  p_before timestamptz default null,
  p_limit int default 30
)
returns table (
  id uuid,
  channel text,
  body text,
  attachment jsonb,
  created_at timestamptz,
  author_id uuid,
  author_name text,
  author_role text,
  author_is_admin boolean,
  likes bigint,
  liked boolean,
  comments bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.channel, p.body, p.attachment, p.created_at,
    p.author_id, pr.full_name, pr.role::text,
    exists (select 1 from public.admins ad where ad.profile_id = p.author_id),
    (select count(*) from public.community_likes l where l.post_id = p.id),
    exists (select 1 from public.community_likes l where l.post_id = p.id and l.profile_id = auth.uid()),
    (select count(*) from public.community_comments c where c.post_id = p.id)
  from public.community_posts p
  join public.profiles pr on pr.id = p.author_id
  where public.can_use_community()
    and (p_channel is null or p.channel = p_channel)
    and (p_before is null or p.created_at < p_before)
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

create or replace function public.community_post_comments(p_post uuid)
returns table (
  id uuid,
  body text,
  created_at timestamptz,
  author_id uuid,
  author_name text,
  author_role text,
  author_is_admin boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id, c.body, c.created_at, c.author_id, pr.full_name, pr.role::text,
    exists (select 1 from public.admins ad where ad.profile_id = c.author_id)
  from public.community_comments c
  join public.profiles pr on pr.id = c.author_id
  where public.can_use_community() and c.post_id = p_post
  order by c.created_at;
$$;

-- ---------------------------------------------------------------------------
-- Adminsidan: alla konton, inte bara coacher
-- ---------------------------------------------------------------------------

drop function if exists public.admin_coach_overview();
drop function if exists public.admin_set_plan(uuid, text);

create or replace function public.admin_member_overview()
returns table (
  id uuid,
  role text,
  full_name text,
  email text,
  company_name text,
  coach_name text,
  plan text,
  created_at timestamptz,
  adept_count bigint,
  is_admin boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pr.id,
    pr.role::text,
    pr.full_name,
    pr.email,
    c.company_name,
    cp.full_name,
    coalesce(c.plan, a.plan, 'bas'),
    pr.created_at,
    case when c.id is not null
      then (select count(*) from public.adepts x where x.coach_id = c.id)
    end,
    exists (select 1 from public.admins ad where ad.profile_id = pr.id)
  from public.profiles pr
  left join public.coaches c on c.id = pr.id
  left join public.adepts a on a.profile_id = pr.id
  left join public.profiles cp on cp.id = a.coach_id
  where public.is_admin()
  order by pr.created_at desc;
$$;

create or replace function public.admin_set_member_plan(member uuid, new_plan text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Bara en admin kan ändra medlemskap.' using errcode = '42501';
  end if;
  if new_plan not in ('bas', 'medlem') then
    raise exception 'Okänd plan: %', new_plan using errcode = '22023';
  end if;

  update public.coaches set plan = new_plan where id = member;
  if found then return new_plan; end if;

  update public.adepts set plan = new_plan where profile_id = member;
  if found then return new_plan; end if;

  raise exception 'Inget konto med det id:t.' using errcode = 'P0002';
end;
$$;

revoke execute on function public.community_feed(text, timestamptz, int) from public, anon;
revoke execute on function public.community_post_comments(uuid) from public, anon;
revoke execute on function public.admin_member_overview() from public, anon;
revoke execute on function public.admin_set_member_plan(uuid, text) from public, anon;
grant execute on function public.community_feed(text, timestamptz, int) to authenticated;
grant execute on function public.community_post_comments(uuid) to authenticated;
grant execute on function public.admin_member_overview() to authenticated;
grant execute on function public.admin_set_member_plan(uuid, text) to authenticated;


-- =============================================================================
-- 20260927130000_adept_linking.sql
-- =============================================================================

-- Coachvy – koppla adeptkonton till sin coach.
--
-- Två vägar in:
--
-- 1. Coachen lägger till adepten med e-post, adepten registrerar sig sedan med
--    samma adress: kontot kopplas direkt till coachens adeptrad vid
--    registreringen. Supabase kräver att e-posten bekräftas innan man kan logga
--    in, så den som registrerar sig med någon annans adress kommer aldrig åt
--    raden.
-- 2. Adepten har redan ett eget konto när coachen lägger till hen: adepten ser
--    en inbjudan och tackar ja själv. Det adepten redan loggat flyttas med.
--
-- Samtidigt stängs ett hål: en adept fick uppdatera hela sin egen rad, också
-- vilken coach den pekar på, och en coach kunde peka en adeptrad mot vilket
-- konto som helst. Kopplingen ändras nu bara av funktionerna här.

-- ---------------------------------------------------------------------------
-- Låset
-- ---------------------------------------------------------------------------

create or replace function public.guard_adept_links()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      -- Coachen skapar adepter utan konto; kontot kopplas vid registrering
      -- eller inbjudan.
      new.profile_id := null;
    elsif new.profile_id is distinct from old.profile_id
       or new.coach_id is distinct from old.coach_id then
      raise exception 'Kopplingen mellan konto, adept och coach ändras inte från appen.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists adepts_guard_links on public.adepts;
create trigger adepts_guard_links
  before insert or update on public.adepts
  for each row execute function public.guard_adept_links();

-- ---------------------------------------------------------------------------
-- Väg 1: registrering med en adress coachen redan lagt in
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role public.account_role;
  v_name text;
  v_waiting uuid;
begin
  v_role := coalesce(nullif(v_meta ->> 'role', ''), 'adept')::public.account_role;
  v_name := coalesce(nullif(v_meta ->> 'full_name', ''), split_part(new.email, '@', 1));

  insert into public.profiles (id, role, full_name, email, accepted_terms_at)
  values (
    new.id,
    v_role,
    v_name,
    new.email,
    case
      when coalesce((v_meta ->> 'accepted_terms')::boolean, false) then now()
      else null
    end
  )
  on conflict (id) do nothing;

  if v_role = 'coach' then
    insert into public.coaches (id, company_name)
    values (new.id, nullif(v_meta ->> 'company_name', ''))
    on conflict (id) do nothing;
    return new;
  end if;

  -- Har en coach redan lagt till en adept med den här adressen tar kontot
  -- över den raden, med allt coachen registrerat. Den senast skapade vinner
  -- om flera coacher lagt in samma adress; de andra blir inbjudningar.
  select a.id into v_waiting
  from public.adepts a
  where a.profile_id is null
    and a.coach_id is not null
    and a.email is not null
    and lower(a.email) = lower(new.email)
  order by a.created_at desc
  limit 1;

  if v_waiting is not null then
    update public.adepts
    set profile_id = new.id,
        last_active_at = now(),
        sport = coalesce(sport, nullif(v_meta ->> 'sport', '')),
        goal = coalesce(goal, nullif(v_meta ->> 'goal', '')),
        current_level = coalesce(current_level, nullif(v_meta ->> 'current_level', ''))
    where id = v_waiting;
  else
    -- Ingen coach än; kopplas senare via en inbjudan.
    insert into public.adepts (
      profile_id, full_name, email, sport, goal, current_level, last_active_at
    )
    values (
      new.id,
      v_name,
      new.email,
      nullif(v_meta ->> 'sport', ''),
      nullif(v_meta ->> 'goal', ''),
      nullif(v_meta ->> 'current_level', ''),
      now()
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Väg 2: inbjudan till ett konto som redan finns
-- ---------------------------------------------------------------------------

-- Coacher som lagt till en adept med den inloggades e-post.
create or replace function public.my_coach_invitations()
returns table (id uuid, coach_name text, company_name text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, cp.full_name, c.company_name, a.created_at
  from public.adepts a
  join public.coaches c on c.id = a.coach_id
  join public.profiles cp on cp.id = a.coach_id
  join public.profiles me on me.id = auth.uid()
  where a.profile_id is null
    and a.email is not null
    and lower(a.email) = lower(me.email)
    and me.role = 'adept'
  order by a.created_at desc;
$$;

-- Tacka ja: kontot tar över coachens adeptrad, och det adepten loggat på sin
-- egen rad flyttas dit innan den tas bort.
create or replace function public.accept_coach_invitation(invitation uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_email text;
  v_own public.adepts%rowtype;
  v_target public.adepts%rowtype;
begin
  select email into v_email from public.profiles where id = v_me and role = 'adept';
  if v_email is null then
    raise exception 'Bara ett adeptkonto kan tacka ja till en coach.' using errcode = '42501';
  end if;

  select * into v_target from public.adepts
  where id = invitation
    and profile_id is null
    and coach_id is not null
    and lower(email) = lower(v_email);
  if not found then
    raise exception 'Inbjudan finns inte längre.' using errcode = 'P0002';
  end if;

  select * into v_own from public.adepts where profile_id = v_me;

  if found then
    if v_own.coach_id is not null then
      raise exception 'Du är redan kopplad till en coach.' using errcode = '23505';
    end if;

    update public.test_results   set adept_id = v_target.id where adept_id = v_own.id;
    update public.test_sessions  set adept_id = v_target.id where adept_id = v_own.id;
    update public.workouts       set adept_id = v_target.id where adept_id = v_own.id;
    update public.adept_checkins set adept_id = v_target.id where adept_id = v_own.id;
    update public.coach_messages set adept_id = v_target.id where adept_id = v_own.id;
    update public.ai_conversations o set adept_id = v_target.id
    where o.adept_id = v_own.id
      and not exists (
        select 1 from public.ai_conversations t
        where t.adept_id = v_target.id and t.created_by = o.created_by
      );
    -- Bakgrunden: coachens version vinner om båda finns.
    if not exists (select 1 from public.adept_profiles where adept_id = v_target.id) then
      update public.adept_profiles set adept_id = v_target.id where adept_id = v_own.id;
    end if;

    delete from public.adepts where id = v_own.id;
  end if;

  update public.adepts
  set profile_id = v_me,
      last_active_at = now(),
      plan = case when v_own.plan = 'medlem' then 'medlem' else plan end
  where id = v_target.id;

  return v_target.id;
end;
$$;

revoke execute on function public.my_coach_invitations() from public, anon;
revoke execute on function public.accept_coach_invitation(uuid) from public, anon;
grant execute on function public.my_coach_invitations() to authenticated;
grant execute on function public.accept_coach_invitation(uuid) to authenticated;


-- =============================================================================
-- 20260928090000_member_tools.sql
-- =============================================================================

-- Coachvy – det medlemskapet ger.
--
-- Tre nivåer: admin, bas och medlem. Bas är kontot – coachen har sina adepter,
-- adepten ser sina tester och pass. Medlemskapet lägger till verktygen:
-- testmodulerna, passbyggaren också för adepter, och communityn.
--
-- Communityn var tidigare öppen för alla coacher och alla adepter med en
-- coach. Nu är den en medlemsförmån. Den som inte är medlem ser inte längre
-- flödet; det de skrivit ligger kvar och syns för medlemmarna.

-- ---------------------------------------------------------------------------
-- Communityn: admin och medlemmar
-- ---------------------------------------------------------------------------

create or replace function public.can_use_community()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1 from public.coaches c
      where c.id = auth.uid() and c.plan = 'medlem'
    )
    or exists (
      select 1 from public.adepts a
      where a.profile_id = auth.uid() and a.plan = 'medlem'
    );
$$;

-- ---------------------------------------------------------------------------
-- Passbyggaren för adepter som är medlemmar
--
-- En medlemsadept får bygga och spara pass på sin egen rad. Bara sina egna:
-- ett pass coachen lagt får adepten läsa men inte ändra eller ta bort.
-- ---------------------------------------------------------------------------

create or replace function public.is_member_adept(adept uuid)
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
      and a.profile_id = auth.uid()
      and a.plan = 'medlem'
  );
$$;

revoke all on function public.is_member_adept(uuid) from public, anon;
grant execute on function public.is_member_adept(uuid) to authenticated;

drop policy if exists "Medlemsadept skapar egna pass" on public.workouts;
create policy "Medlemsadept skapar egna pass"
  on public.workouts for insert
  to authenticated
  with check (public.is_member_adept(adept_id) and created_by = auth.uid());

drop policy if exists "Medlemsadept tar bort egna pass" on public.workouts;
create policy "Medlemsadept tar bort egna pass"
  on public.workouts for delete
  to authenticated
  using (public.is_member_adept(adept_id) and created_by = auth.uid());


-- =============================================================================
-- 20260928120000_effort_dates_and_member_tests.sql
-- =============================================================================

-- Coachvy – insatser från olika dagar, och medlemmar som registrerar egna tester.
--
-- Ett CP-test eller den metabola profilen görs sällan på en dag: sprinten och
-- 6-minuten en dag, 3- och 12-minuten två dagar senare. Varje insats får
-- därför ett eget datum. Saknas det gäller testtillfällets.
--
-- Insatserna kan också hämtas ur cykeldatorns fil. Då följer maxpulsen i
-- insatsen med, bredvid snittpulsen som redan fanns.

alter table public.test_efforts
  add column if not exists performed_on date,
  add column if not exists heart_rate_max integer check (
    heart_rate_max is null or (heart_rate_max > 0 and heart_rate_max < 300)
  );

comment on column public.test_efforts.performed_on is
  'Dagen insatsen gjordes, när den skiljer sig från testtillfällets datum.';
comment on column public.test_efforts.heart_rate_max is
  'Högsta puls under insatsen. heart_rate är snittet.';

-- ---------------------------------------------------------------------------
-- Medlemsadepter registrerar egna tester
--
-- Samma regel som för passen: på den egna raden, och bara det adepten själv
-- skapat får ändras eller tas bort. Coachens tester är coachens.
-- ---------------------------------------------------------------------------

create or replace function public.is_own_member_session(session uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.test_sessions s
    where s.id = session
      and s.created_by = auth.uid()
      and public.is_member_adept(s.adept_id)
  );
$$;

revoke all on function public.is_own_member_session(uuid) from public, anon;
grant execute on function public.is_own_member_session(uuid) to authenticated;

drop policy if exists "Medlemsadept skapar egna testtillfällen" on public.test_sessions;
create policy "Medlemsadept skapar egna testtillfällen"
  on public.test_sessions for insert
  to authenticated
  with check (public.is_member_adept(adept_id) and created_by = auth.uid());

drop policy if exists "Medlemsadept tar bort egna testtillfällen" on public.test_sessions;
create policy "Medlemsadept tar bort egna testtillfällen"
  on public.test_sessions for delete
  to authenticated
  using (public.is_member_adept(adept_id) and created_by = auth.uid());

drop policy if exists "Medlemsadept skapar steg i egna tester" on public.test_efforts;
create policy "Medlemsadept skapar steg i egna tester"
  on public.test_efforts for insert
  to authenticated
  with check (public.is_own_member_session(session_id));

drop policy if exists "Medlemsadept skapar värden i egna tester" on public.test_metrics;
create policy "Medlemsadept skapar värden i egna tester"
  on public.test_metrics for insert
  to authenticated
  with check (public.is_own_member_session(session_id));

drop policy if exists "Medlemsadept tar bort värden i egna tester" on public.test_metrics;
create policy "Medlemsadept tar bort värden i egna tester"
  on public.test_metrics for delete
  to authenticated
  using (public.is_own_member_session(session_id));


-- =============================================================================
-- 20260930090000_season_and_consent.sql
-- =============================================================================

-- Coachvy – säsongen, samtycket och ett lås på profilen.
--
-- Fyra saker:
--
--   adept_races       tävlingarna, med prioritet A, B eller C
--   training_blocks   perioderna i säsongsplanen: grund, uppbyggnad, specifik,
--                     toppning och vila – samma fem som testtillfällets fas
--   workouts          en medlemsadept får flytta sina egna pass i kalendern
--   profiles          samtycke till behandling av hälsouppgifter, och ett lås
--                     på roll och e-post
--
-- Adeptprofilen hade redan ett mål med datum. Det räcker för ett lopp, men en
-- säsong har flera, och de väger olika: A-loppet planeras allt mot, B-loppen
-- är genomkörare, C-loppen träning med nummerlapp. Utan prioriteten går det
-- inte att säga vilket lopp nedräkningen ska gälla eller var toppningen hör
-- hemma.

-- ---------------------------------------------------------------------------
-- adept_races – tävlingarna
-- ---------------------------------------------------------------------------

create table if not exists public.adept_races (
  id uuid primary key default gen_random_uuid(),
  adept_id uuid not null references public.adepts (id) on delete cascade,

  name text not null check (length(btrim(name)) > 0),
  race_date date not null,
  sport text check (
    sport is null
    or sport in ('cykling', 'löpning', 'simning', 'triathlon', 'annat')
  ),
  /** Fritext: "42,2 km", "1,9/90/21,1", "Vasaloppet 90 km". */
  distance text,
  /** A: säsongens mål. B: viktigt men genomkört. C: träning med nummerlapp. */
  priority text not null default 'B' check (priority in ('A', 'B', 'C')),
  /** Måltiden eller målet med loppet, i fritext. */
  target text,
  note text,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists adept_races_adept_idx
  on public.adept_races (adept_id, race_date);

-- ---------------------------------------------------------------------------
-- training_blocks – perioderna
--
-- En period är ett datumintervall med en av de fem faserna och ett fokus i
-- fritext. Överlapp hindras i appen, inte här: en exkluderingsregel kräver
-- btree_gist, och en överlappande period är ett skrivfel att rätta, inte data
-- som förstörs.
-- ---------------------------------------------------------------------------

create table if not exists public.training_blocks (
  id uuid primary key default gen_random_uuid(),
  adept_id uuid not null references public.adepts (id) on delete cascade,

  phase text not null check (
    phase in ('grund', 'uppbyggnad', 'specifik', 'topp', 'vila')
  ),
  starts_on date not null,
  ends_on date not null,
  focus text,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (ends_on >= starts_on)
);

create index if not exists training_blocks_adept_idx
  on public.training_blocks (adept_id, starts_on);

drop trigger if exists adept_races_set_updated_at on public.adept_races;
create trigger adept_races_set_updated_at
  before update on public.adept_races
  for each row execute function public.set_updated_at();

drop trigger if exists training_blocks_set_updated_at on public.training_blocks;
create trigger training_blocks_set_updated_at
  before update on public.training_blocks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
--
-- Tävlingarna skriver både coachen och adepten: det är atletens kalender, och
-- hen vet oftast först att ett lopp tillkommit. Perioderna är coachens plan.
-- En adept utan coach planerar sin egen säsong.
-- ---------------------------------------------------------------------------

create or replace function public.plans_own_season(adept uuid)
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
      and a.profile_id = auth.uid()
      and a.coach_id is null
  );
$$;

revoke all on function public.plans_own_season(uuid) from public, anon;
grant execute on function public.plans_own_season(uuid) to authenticated;

alter table public.adept_races enable row level security;
alter table public.training_blocks enable row level security;

drop policy if exists "Läs tävlingar för adepter man har tillgång till" on public.adept_races;
create policy "Läs tävlingar för adepter man har tillgång till"
  on public.adept_races for select
  to authenticated
  using (public.can_view_adept(adept_id));

drop policy if exists "Coach eller adept lägger till en tävling" on public.adept_races;
create policy "Coach eller adept lägger till en tävling"
  on public.adept_races for insert
  to authenticated
  with check (public.can_view_adept(adept_id));

drop policy if exists "Coach eller adept ändrar en tävling" on public.adept_races;
create policy "Coach eller adept ändrar en tävling"
  on public.adept_races for update
  to authenticated
  using (public.can_view_adept(adept_id))
  with check (public.can_view_adept(adept_id));

drop policy if exists "Coach eller adept tar bort en tävling" on public.adept_races;
create policy "Coach eller adept tar bort en tävling"
  on public.adept_races for delete
  to authenticated
  using (public.can_view_adept(adept_id));

drop policy if exists "Läs perioder för adepter man har tillgång till" on public.training_blocks;
create policy "Läs perioder för adepter man har tillgång till"
  on public.training_blocks for select
  to authenticated
  using (public.can_view_adept(adept_id));

drop policy if exists "Coach planerar perioder" on public.training_blocks;
create policy "Coach planerar perioder"
  on public.training_blocks for insert
  to authenticated
  with check (
    public.is_adept_coach(adept_id) or public.plans_own_season(adept_id)
  );

drop policy if exists "Coach ändrar perioder" on public.training_blocks;
create policy "Coach ändrar perioder"
  on public.training_blocks for update
  to authenticated
  using (public.is_adept_coach(adept_id) or public.plans_own_season(adept_id))
  with check (
    public.is_adept_coach(adept_id) or public.plans_own_season(adept_id)
  );

drop policy if exists "Coach tar bort perioder" on public.training_blocks;
create policy "Coach tar bort perioder"
  on public.training_blocks for delete
  to authenticated
  using (public.is_adept_coach(adept_id) or public.plans_own_season(adept_id));

-- ---------------------------------------------------------------------------
-- Pass i kalendern
--
-- Ett pass får ett datum när det sparas och kan flyttas efteråt. Coachen
-- ändrar redan sina adepters pass; en medlemsadept som byggt ett eget pass
-- ska kunna flytta det också. Adepten kunde redan skapa och ta bort sina
-- egna pass, så att ändra dem ger ingen ny behörighet.
-- ---------------------------------------------------------------------------

drop policy if exists "Medlemsadept ändrar egna pass" on public.workouts;
create policy "Medlemsadept ändrar egna pass"
  on public.workouts for update
  to authenticated
  using (public.is_member_adept(adept_id) and created_by = auth.uid())
  with check (public.is_member_adept(adept_id) and created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- Samtycke till behandling av hälsouppgifter
--
-- Laktat, puls, VO2max, kroppsfett, skador, sömn och stress är
-- hälsouppgifter, och sådana får behandlas på uttryckligt samtycke
-- (dataskyddsförordningen artikel 9.2 a). Samtycket ska vara särskilt – inte
-- en del av att godkänna villkoren – och gå att ta tillbaka lika lätt som det
-- gavs. Därför en egen kolumn bredvid accepted_terms_at.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists health_consent_at timestamptz;

comment on column public.profiles.health_consent_at is
  'När kontot samtyckte till behandling av hälsouppgifter. Null betyder inget '
  'samtycke, eller att det tagits tillbaka.';

-- ---------------------------------------------------------------------------
-- Låset på profilen
--
-- Policyn "Uppdatera egen profil" släppte igenom varje kolumn. Två av dem
-- avgör behörighet: rollen, som appen läser för att skilja coach från adept,
-- och e-posten, som inbjudningarna matchades mot. En adept kunde byta sin
-- e-post i profilen till någon annans och tacka ja till den personens
-- inbjudan – och därmed ta över adeptraden med allt coachen registrerat.
--
-- Nu ändras de bara av databasen själv. E-posten följer auth.users, och
-- inbjudningarna läser den bekräftade adressen därifrån i stället.
-- Samtyckena tidsstämplas också av databasen, inte av den som skickar dem.
-- ---------------------------------------------------------------------------

create or replace function public.guard_profile_identity()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.id is distinct from old.id
       or new.role is distinct from old.role
       or new.email is distinct from old.email then
      raise exception 'Roll och e-post ändras inte från appen.'
        using errcode = '42501';
    end if;

    if new.accepted_terms_at is distinct from old.accepted_terms_at
       and new.accepted_terms_at is not null then
      new.accepted_terms_at := now();
    end if;

    if new.health_consent_at is distinct from old.health_consent_at
       and new.health_consent_at is not null then
      new.health_consent_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_identity on public.profiles;
create trigger profiles_guard_identity
  before update on public.profiles
  for each row execute function public.guard_profile_identity();

-- E-posten i profilen följer kontots, när den byts och bekräftas i Auth.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Registreringen: samma som förut, plus samtycket till hälsouppgifter
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role public.account_role;
  v_name text;
  v_waiting uuid;
begin
  v_role := coalesce(nullif(v_meta ->> 'role', ''), 'adept')::public.account_role;
  v_name := coalesce(nullif(v_meta ->> 'full_name', ''), split_part(new.email, '@', 1));

  insert into public.profiles (id, role, full_name, email, accepted_terms_at, health_consent_at)
  values (
    new.id,
    v_role,
    v_name,
    new.email,
    case
      when coalesce((v_meta ->> 'accepted_terms')::boolean, false) then now()
      else null
    end,
    case
      when coalesce((v_meta ->> 'health_consent')::boolean, false) then now()
      else null
    end
  )
  on conflict (id) do nothing;

  if v_role = 'coach' then
    insert into public.coaches (id, company_name)
    values (new.id, nullif(v_meta ->> 'company_name', ''))
    on conflict (id) do nothing;
    return new;
  end if;

  -- Har en coach redan lagt till en adept med den här adressen tar kontot
  -- över den raden, med allt coachen registrerat. Den senast skapade vinner
  -- om flera coacher lagt in samma adress; de andra blir inbjudningar.
  select a.id into v_waiting
  from public.adepts a
  where a.profile_id is null
    and a.coach_id is not null
    and a.email is not null
    and lower(a.email) = lower(new.email)
  order by a.created_at desc
  limit 1;

  if v_waiting is not null then
    update public.adepts
    set profile_id = new.id,
        last_active_at = now(),
        sport = coalesce(sport, nullif(v_meta ->> 'sport', '')),
        goal = coalesce(goal, nullif(v_meta ->> 'goal', '')),
        current_level = coalesce(current_level, nullif(v_meta ->> 'current_level', ''))
    where id = v_waiting;
  else
    -- Ingen coach än; kopplas senare via en inbjudan.
    insert into public.adepts (
      profile_id, full_name, email, sport, goal, current_level, last_active_at
    )
    values (
      new.id,
      v_name,
      new.email,
      nullif(v_meta ->> 'sport', ''),
      nullif(v_meta ->> 'goal', ''),
      nullif(v_meta ->> 'current_level', ''),
      now()
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Inbjudningarna: den bekräftade adressen ur Auth, inte profilens
-- ---------------------------------------------------------------------------

create or replace function public.my_coach_invitations()
returns table (id uuid, coach_name text, company_name text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, cp.full_name, c.company_name, a.created_at
  from public.adepts a
  join public.coaches c on c.id = a.coach_id
  join public.profiles cp on cp.id = a.coach_id
  join public.profiles me on me.id = auth.uid()
  join auth.users u on u.id = auth.uid()
  where a.profile_id is null
    and a.email is not null
    and u.email_confirmed_at is not null
    and lower(a.email) = lower(u.email)
    and me.role = 'adept'
  order by a.created_at desc;
$$;

-- Tacka ja: kontot tar över coachens adeptrad, och det adepten loggat på sin
-- egen rad flyttas dit innan den tas bort. Tävlingarna följer med; perioderna
-- bara om coachen inte redan planerat säsongen – coachens plan vinner, som
-- med bakgrunden.
create or replace function public.accept_coach_invitation(invitation uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_email text;
  v_own public.adepts%rowtype;
  v_target public.adepts%rowtype;
begin
  select u.email into v_email
  from auth.users u
  join public.profiles p on p.id = u.id and p.role = 'adept'
  where u.id = v_me
    and u.email_confirmed_at is not null;
  if v_email is null then
    raise exception 'Bara ett adeptkonto kan tacka ja till en coach.' using errcode = '42501';
  end if;

  select * into v_target from public.adepts
  where id = invitation
    and profile_id is null
    and coach_id is not null
    and lower(email) = lower(v_email);
  if not found then
    raise exception 'Inbjudan finns inte längre.' using errcode = 'P0002';
  end if;

  select * into v_own from public.adepts where profile_id = v_me;

  if found then
    if v_own.coach_id is not null then
      raise exception 'Du är redan kopplad till en coach.' using errcode = '23505';
    end if;

    update public.test_results   set adept_id = v_target.id where adept_id = v_own.id;
    update public.test_sessions  set adept_id = v_target.id where adept_id = v_own.id;
    update public.workouts       set adept_id = v_target.id where adept_id = v_own.id;
    update public.adept_checkins set adept_id = v_target.id where adept_id = v_own.id;
    update public.coach_messages set adept_id = v_target.id where adept_id = v_own.id;
    update public.adept_races    set adept_id = v_target.id where adept_id = v_own.id;
    update public.ai_conversations o set adept_id = v_target.id
    where o.adept_id = v_own.id
      and not exists (
        select 1 from public.ai_conversations t
        where t.adept_id = v_target.id and t.created_by = o.created_by
      );
    -- Bakgrunden och säsongsplanen: coachens version vinner om båda finns.
    if not exists (select 1 from public.adept_profiles where adept_id = v_target.id) then
      update public.adept_profiles set adept_id = v_target.id where adept_id = v_own.id;
    end if;
    if not exists (select 1 from public.training_blocks where adept_id = v_target.id) then
      update public.training_blocks set adept_id = v_target.id where adept_id = v_own.id;
    end if;
    delete from public.adepts where id = v_own.id;
  end if;

  update public.adepts
  set profile_id = v_me,
      last_active_at = now(),
      plan = case when v_own.plan = 'medlem' then 'medlem' else plan end
  where id = v_target.id;

  return v_target.id;
end;
$$;

revoke execute on function public.my_coach_invitations() from public, anon;
revoke execute on function public.accept_coach_invitation(uuid) from public, anon;
grant execute on function public.my_coach_invitations() to authenticated;
grant execute on function public.accept_coach_invitation(uuid) to authenticated;


-- =============================================================================
-- 20260930150000_activities.sql
-- =============================================================================

-- Coachvy – genomförda pass och lopp ur klockans fil.
--
-- Filen läses och analyseras i webbläsaren. Det som sparas är analysen –
-- normaliserad effekt, bästa insatser, W′bal, zoner, sträckor – och en
-- nedsamplad serie för kartan och graferna, inte filen själv. Tröskelvärdena
-- analysen räknades mot sparas med, som ett pass sparas med sin referens:
-- ett lopp från i våras ska läsas mot vårens CP, inte dagens.
--
-- En aktivitet kan kopplas till en tävling i säsongsplanen. Då blir den
-- loppets analys.

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  adept_id uuid not null references public.adepts (id) on delete cascade,
  race_id uuid references public.adept_races (id) on delete set null,

  name text not null check (length(btrim(name)) > 0),
  sport text not null check (sport in ('cykling', 'löpning', 'simning', 'annat')),
  started_at timestamptz not null,
  performed_on date not null,
  device text,

  duration_s numeric check (duration_s is null or duration_s >= 0),
  moving_s numeric check (moving_s is null or moving_s >= 0),
  distance_m numeric check (distance_m is null or distance_m >= 0),
  ascent_m numeric check (ascent_m is null or ascent_m >= 0),

  /** Analysen: effekt, puls, bästa insatser, zoner, sträckor, insikter. */
  summary jsonb not null default '{}'::jsonb,
  /** Tröskelvärdena analysen räknades mot, och testet de kom ur. */
  reference jsonb,
  /** Nedsamplad serie: tid, sträcka, läge, höjd, effekt, puls, fart, kadens. */
  streams jsonb not null,
  laps jsonb,
  note text,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Samma fil två gånger blir en aktivitet, inte två.
  unique (adept_id, started_at)
);

create index if not exists activities_adept_idx
  on public.activities (adept_id, performed_on desc);

create index if not exists activities_race_idx
  on public.activities (race_id)
  where race_id is not null;

drop trigger if exists activities_set_updated_at on public.activities;
create trigger activities_set_updated_at
  before update on public.activities
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS – som tävlingarna: både coachen och adepten laddar upp, det är
-- atletens pass. Den som laddar upp står som skapare.
-- ---------------------------------------------------------------------------

alter table public.activities enable row level security;

drop policy if exists "Läs aktiviteter för adepter man har tillgång till" on public.activities;
create policy "Läs aktiviteter för adepter man har tillgång till"
  on public.activities for select
  to authenticated
  using (public.can_view_adept(adept_id));

drop policy if exists "Coach eller adept laddar upp en aktivitet" on public.activities;
create policy "Coach eller adept laddar upp en aktivitet"
  on public.activities for insert
  to authenticated
  with check (public.can_view_adept(adept_id) and created_by = auth.uid());

drop policy if exists "Coach eller adept ändrar en aktivitet" on public.activities;
create policy "Coach eller adept ändrar en aktivitet"
  on public.activities for update
  to authenticated
  using (public.can_view_adept(adept_id))
  with check (public.can_view_adept(adept_id));

drop policy if exists "Coach eller adept tar bort en aktivitet" on public.activities;
create policy "Coach eller adept tar bort en aktivitet"
  on public.activities for delete
  to authenticated
  using (public.can_view_adept(adept_id));

-- ---------------------------------------------------------------------------
-- Inbjudan: aktiviteterna följer med när ett eget konto tar över coachens
-- adeptrad, som allt annat adepten loggat.
-- ---------------------------------------------------------------------------

create or replace function public.accept_coach_invitation(invitation uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_email text;
  v_own public.adepts%rowtype;
  v_target public.adepts%rowtype;
begin
  select u.email into v_email
  from auth.users u
  join public.profiles p on p.id = u.id and p.role = 'adept'
  where u.id = v_me
    and u.email_confirmed_at is not null;
  if v_email is null then
    raise exception 'Bara ett adeptkonto kan tacka ja till en coach.' using errcode = '42501';
  end if;

  select * into v_target from public.adepts
  where id = invitation
    and profile_id is null
    and coach_id is not null
    and lower(email) = lower(v_email);
  if not found then
    raise exception 'Inbjudan finns inte längre.' using errcode = 'P0002';
  end if;

  select * into v_own from public.adepts where profile_id = v_me;

  if found then
    if v_own.coach_id is not null then
      raise exception 'Du är redan kopplad till en coach.' using errcode = '23505';
    end if;

    update public.test_results   set adept_id = v_target.id where adept_id = v_own.id;
    update public.test_sessions  set adept_id = v_target.id where adept_id = v_own.id;
    update public.workouts       set adept_id = v_target.id where adept_id = v_own.id;
    update public.adept_checkins set adept_id = v_target.id where adept_id = v_own.id;
    update public.coach_messages set adept_id = v_target.id where adept_id = v_own.id;
    update public.adept_races    set adept_id = v_target.id where adept_id = v_own.id;
    update public.activities a   set adept_id = v_target.id
    where a.adept_id = v_own.id
      and not exists (
        select 1 from public.activities t
        where t.adept_id = v_target.id and t.started_at = a.started_at
      );
    update public.ai_conversations o set adept_id = v_target.id
    where o.adept_id = v_own.id
      and not exists (
        select 1 from public.ai_conversations t
        where t.adept_id = v_target.id and t.created_by = o.created_by
      );
    -- Bakgrunden och säsongsplanen: coachens version vinner om båda finns.
    if not exists (select 1 from public.adept_profiles where adept_id = v_target.id) then
      update public.adept_profiles set adept_id = v_target.id where adept_id = v_own.id;
    end if;
    if not exists (select 1 from public.training_blocks where adept_id = v_target.id) then
      update public.training_blocks set adept_id = v_target.id where adept_id = v_own.id;
    end if;
    delete from public.adepts where id = v_own.id;
  end if;

  update public.adepts
  set profile_id = v_me,
      last_active_at = now(),
      plan = case when v_own.plan = 'medlem' then 'medlem' else plan end
  where id = v_target.id;

  return v_target.id;
end;
$$;

revoke execute on function public.accept_coach_invitation(uuid) from public, anon;
grant execute on function public.accept_coach_invitation(uuid) to authenticated;


