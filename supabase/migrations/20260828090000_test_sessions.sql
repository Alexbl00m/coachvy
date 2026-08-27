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
