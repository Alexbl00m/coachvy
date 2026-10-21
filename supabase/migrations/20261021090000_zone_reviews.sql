-- Coachvy – coachens beslut om zonförslag ur träningen.
--
-- När bästa-kurvan ur de senaste 90 dagarnas pass ger en CP (CS) tydligt
-- över senaste testet föreslår appen nya zoner. Coachen godkänner (då sparas
-- insatserna som ett vanligt CP- eller CS-test, session_id pekar på det) eller
-- avvisar. Avvisningen sparas så att samma förslag inte kommer tillbaka förrän
-- träningen visar mer.
--
-- Raderna skrivs en gång och ändras inte. Coachen skriver; coachen och
-- adepten läser.

create table if not exists public.zone_reviews (
  id uuid primary key default gen_random_uuid(),
  adept_id uuid not null references public.adepts (id) on delete cascade,
  sport text not null check (sport in ('cykling', 'löpning')),
  decision text not null check (decision in ('godkänd', 'avvisad')),
  -- CP i W, eller CS i m/s.
  proposed_critical numeric not null check (proposed_critical > 0),
  -- W′ i J, eller D′ i m.
  proposed_reserve numeric,
  previous_critical numeric,
  session_id uuid references public.test_sessions (id) on delete set null,
  decided_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists zone_reviews_adept_idx
  on public.zone_reviews (adept_id, created_at desc);

comment on table public.zone_reviews is
  'Coachens beslut om zonförslag ur träningen: godkänd (med testet som sparades) eller avvisad.';

alter table public.zone_reviews enable row level security;

drop policy if exists "Läs zonbeslut för adepter man har tillgång till" on public.zone_reviews;
create policy "Läs zonbeslut för adepter man har tillgång till"
  on public.zone_reviews for select
  to authenticated
  using (public.can_view_adept(adept_id));

drop policy if exists "Coachen beslutar om zonförslag" on public.zone_reviews;
create policy "Coachen beslutar om zonförslag"
  on public.zone_reviews for insert
  to authenticated
  with check (public.is_adept_coach(adept_id));
