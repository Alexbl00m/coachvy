-- Coachvy – styrkeloggen.
--
-- Styrkepassen planeras ofta någon annanstans (TrainingPeaks) och loggades
-- som en kommentar: "FB 4x8 50 kg, RM 4x8 70 kg". Här loggar adepten dem i
-- stället, så att både hon och coachen kan följa progressionen per övning.
--
-- Ett pass är en rad; övningarna ligger som jsonb, eftersom passet läses och
-- skrivs som en helhet och progressionen räknas i appen:
--   [{ "name": "Frontböj", "key": "frontbo", "sets": 4, "reps": 8,
--      "weightKg": 50, "perSide": false }]
--
-- Samma åtkomst som incheckningarna: adepten och hennes coach läser och
-- skriver (can_view_adept).

create table if not exists public.strength_sessions (
  id uuid primary key default gen_random_uuid(),
  adept_id uuid not null references public.adepts (id) on delete cascade,
  performed_on date not null,
  title text check (title is null or char_length(title) <= 80),
  exercises jsonb not null default '[]'::jsonb
    check (jsonb_typeof(exercises) = 'array'),
  note text check (note is null or char_length(note) <= 1000),
  session_rpe numeric check (session_rpe is null or (session_rpe >= 0 and session_rpe <= 10)),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists strength_sessions_adept_idx
  on public.strength_sessions (adept_id, performed_on desc);

comment on table public.strength_sessions is
  'Styrkepass som adepten eller coachen loggat, med övningarna som jsonb.';

drop trigger if exists strength_sessions_updated_at on public.strength_sessions;
create trigger strength_sessions_updated_at
  before update on public.strength_sessions
  for each row execute function public.set_updated_at();

alter table public.strength_sessions enable row level security;

drop policy if exists "Läs styrkepass för adepter man har tillgång till" on public.strength_sessions;
create policy "Läs styrkepass för adepter man har tillgång till"
  on public.strength_sessions for select
  to authenticated
  using (public.can_view_adept(adept_id));

drop policy if exists "Coach eller adept loggar styrka" on public.strength_sessions;
create policy "Coach eller adept loggar styrka"
  on public.strength_sessions for insert
  to authenticated
  with check (public.can_view_adept(adept_id));

drop policy if exists "Coach eller adept rättar ett styrkepass" on public.strength_sessions;
create policy "Coach eller adept rättar ett styrkepass"
  on public.strength_sessions for update
  to authenticated
  using (public.can_view_adept(adept_id))
  with check (public.can_view_adept(adept_id));

drop policy if exists "Coach eller adept tar bort ett styrkepass" on public.strength_sessions;
create policy "Coach eller adept tar bort ett styrkepass"
  on public.strength_sessions for delete
  to authenticated
  using (public.can_view_adept(adept_id));
