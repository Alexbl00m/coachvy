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
