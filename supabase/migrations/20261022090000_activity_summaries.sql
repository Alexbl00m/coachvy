-- Coachvy – AI-sammanfattning per pass.
--
-- Analysen vid uppladdningen säger vad passet var. Sammanfattningen säger vad
-- det betyder i sitt sammanhang – planen den dagen, perioden, veckans
-- belastning, de senaste passen av samma slag – och skrivs av modellen när
-- coachen ber om den. En per pass; en ny ersätter den gamla.
--
-- Coachen äger texten: kan rätta den (edited) och välja att dela den med
-- adepten (shared_at). Adepten ser bara delade sammanfattningar.

create table if not exists public.activity_summaries (
  activity_id uuid primary key references public.activities (id) on delete cascade,
  adept_id uuid not null references public.adepts (id) on delete cascade,
  headline text not null check (char_length(headline) between 1 and 300),
  purpose text check (purpose is null or char_length(purpose) <= 120),
  intensity text check (intensity is null or intensity in ('lugnt', 'medel', 'högt')),
  body text not null check (char_length(body) between 1 and 4000),
  model text,
  edited boolean not null default false,
  shared_at timestamptz,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists activity_summaries_adept_idx
  on public.activity_summaries (adept_id);

comment on table public.activity_summaries is
  'AI-sammanfattning per pass, skriven på coachens begäran. Coachen kan rätta och dela den med adepten.';

drop trigger if exists activity_summaries_updated_at on public.activity_summaries;
create trigger activity_summaries_updated_at
  before update on public.activity_summaries
  for each row execute function public.set_updated_at();

alter table public.activity_summaries enable row level security;

drop policy if exists "Coachen läser, adepten läser delade" on public.activity_summaries;
create policy "Coachen läser, adepten läser delade"
  on public.activity_summaries for select
  to authenticated
  using (
    public.is_adept_coach(adept_id)
    or (shared_at is not null and public.can_view_adept(adept_id))
  );

drop policy if exists "Coachen skriver sammanfattningen" on public.activity_summaries;
create policy "Coachen skriver sammanfattningen"
  on public.activity_summaries for insert
  to authenticated
  with check (public.is_adept_coach(adept_id));

drop policy if exists "Coachen rättar och delar" on public.activity_summaries;
create policy "Coachen rättar och delar"
  on public.activity_summaries for update
  to authenticated
  using (public.is_adept_coach(adept_id))
  with check (public.is_adept_coach(adept_id));

drop policy if exists "Coachen tar bort" on public.activity_summaries;
create policy "Coachen tar bort"
  on public.activity_summaries for delete
  to authenticated
  using (public.is_adept_coach(adept_id));
