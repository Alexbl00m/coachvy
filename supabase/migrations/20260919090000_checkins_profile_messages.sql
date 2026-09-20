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
