-- Coachvy – passbiblioteket: coachens egna pass att återanvända.
--
-- Ett utvecklingsblock bygger på ett eller två återkommande kvalitetsformat.
-- Formatet ska inte skrivas om för varje plan och varje adept, utan finnas
-- ett ställe där syftet, strukturen och hur det byggs på står tillsammans.
--
-- Ett pass i biblioteket är en mall, inte ett pass på en adept:
--
--   structure   raden passet skrivs som (structure.ts) – med zoner som
--               @LO och @HM-10K eller procent av en bas. Raden är originalet.
--   blocks      samma rad tolkad till block, för profil och förhandsvisning.
--   basis       vad procenten räknas mot. Zoner står mot maratonfart (MP).
--   purpose     vilken egenskap passet utvecklar, ur träningsfilosofin.
--   progression hur det byggs på – en variabel i taget.
--   phases      faserna passet hör hemma i.
--
-- Biblioteket är coachens eget. En admin kan dela ett pass med alla
-- coacher; delade pass går att kopiera till det egna biblioteket men bara
-- ägaren ändrar dem.

create table if not exists public.session_library (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  shared boolean not null default false,

  title text not null check (char_length(title) between 1 and 120),
  sport text not null check (sport in ('löpning', 'cykling', 'simning')),
  kind text check (kind is null or char_length(kind) <= 60),
  intensity text check (intensity is null or char_length(intensity) <= 40),
  purpose text check (purpose is null or char_length(purpose) <= 1000),
  description text check (description is null or char_length(description) <= 2000),
  progression text check (progression is null or char_length(progression) <= 1000),
  phases text[] not null default '{}'
    check (phases <@ array['grund', 'uppbyggnad', 'specifik', 'topp', 'vila']::text[]),

  basis text not null
    check (basis in ('FTP', 'CP', 'CS', 'CSS', 'LT2', '5K', '10K', 'HM', 'MP')),
  structure text not null check (char_length(structure) between 1 and 2000),
  blocks jsonb not null check (jsonb_typeof(blocks) = 'array'),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.session_library is
  'Coachens passbibliotek: pass att återanvända i planmallar och hos adepter.';
comment on column public.session_library.shared is
  'Syns för alla coacher. Bara en admin kan dela.';

create index if not exists session_library_owner_idx
  on public.session_library (owner_id, updated_at desc);
create index if not exists session_library_shared_idx
  on public.session_library (updated_at desc) where shared;

drop trigger if exists session_library_set_updated_at on public.session_library;
create trigger session_library_set_updated_at
  before update on public.session_library
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS – egna pass, och de delade för den som är coach eller admin.
-- ---------------------------------------------------------------------------

alter table public.session_library enable row level security;

drop policy if exists "Läs egna och delade pass" on public.session_library;
create policy "Läs egna och delade pass"
  on public.session_library for select
  to authenticated
  using (
    owner_id = auth.uid()
    or (shared and (public.is_coach() or public.is_admin()))
  );

drop policy if exists "Coach lägger till pass" on public.session_library;
create policy "Coach lägger till pass"
  on public.session_library for insert
  to authenticated
  with check (
    owner_id = auth.uid()
    and (public.is_coach() or public.is_admin())
    and (not shared or public.is_admin())
  );

drop policy if exists "Ägaren ändrar sina pass" on public.session_library;
create policy "Ägaren ändrar sina pass"
  on public.session_library for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and (not shared or public.is_admin()));

drop policy if exists "Ägaren tar bort sina pass" on public.session_library;
create policy "Ägaren tar bort sina pass"
  on public.session_library for delete
  to authenticated
  using (owner_id = auth.uid());

grant select, insert, update, delete on public.session_library to authenticated;
