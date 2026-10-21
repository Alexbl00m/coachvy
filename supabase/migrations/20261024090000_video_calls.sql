-- Coachvy – videosamtal mellan coach och adept.
--
-- Samtalet går i coachens eget mötesrum (Google Meet, Zoom, Teams …): en
-- länk coachen sparar en gång under Inställningar. Coachvy håller ordning på
-- samtalen – ringa direkt eller boka en tid – och visar dem i tråden, i
-- kalendern och i adeptens Idag. Själva videon går i mötestjänsten.
--
-- Länken sparas på samtalet när det skapas, så att ett bokat samtal leder
-- rätt även om coachen senare byter mötesrum, och så att adepten inte behöver
-- läsrätt på coachens konto. Ett samtal tas inte bort utan avbokas, så att
-- tråden behåller sin historia.

alter table public.coaches
  add column if not exists meeting_url text
    check (
      meeting_url is null
      or (meeting_url ~ '^https://' and char_length(meeting_url) <= 500)
    );

comment on column public.coaches.meeting_url is
  'Coachens mötesrum för videosamtal (https-länk till Meet, Zoom, Teams …).';

create table if not exists public.coach_calls (
  id uuid primary key default gen_random_uuid(),
  adept_id uuid not null references public.adepts (id) on delete cascade,
  coach_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  duration_minutes integer not null default 30
    check (duration_minutes between 5 and 240),
  topic text check (topic is null or char_length(topic) <= 200),
  url text not null check (url ~ '^https://' and char_length(url) <= 500),
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists coach_calls_adept_idx
  on public.coach_calls (adept_id, starts_at);

comment on table public.coach_calls is
  'Videosamtal mellan coach och adept: direkt eller bokade, i coachens mötesrum.';

alter table public.coach_calls enable row level security;

drop policy if exists "Läs samtal för adepter man har tillgång till" on public.coach_calls;
create policy "Läs samtal för adepter man har tillgång till"
  on public.coach_calls for select
  to authenticated
  using (public.can_view_adept(adept_id));

drop policy if exists "Coachen bokar samtal" on public.coach_calls;
create policy "Coachen bokar samtal"
  on public.coach_calls for insert
  to authenticated
  with check (public.is_adept_coach(adept_id) and coach_id = auth.uid());

drop policy if exists "Coachen avbokar samtal" on public.coach_calls;
create policy "Coachen avbokar samtal"
  on public.coach_calls for update
  to authenticated
  using (public.is_adept_coach(adept_id))
  with check (public.is_adept_coach(adept_id));

-- Ett meddelande kan bära ett samtal: tråden visar det som ett samtalskort.
alter table public.coach_messages
  add column if not exists call_id uuid
    references public.coach_calls (id) on delete set null;
