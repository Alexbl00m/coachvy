-- Coachvy – VLamax-prediktion.
--
-- Portad från vlamax_calc_app (Streamlit). Där låg referensdatan i en CSV som
-- appen skrev till; här ligger den i databasen så att den växer när fler
-- atleter testas, och så att varje coach kan bygga vidare på sin egen.
--
-- coach_id null = inbyggd referensdata (Alexanders INSCYD-mätningar).
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
  -- Uppmätt VLamax (INSCYD) – det modellen tränas mot.
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
-- Inbyggd referensdata: 13 atleter med VLamax uppmätt via INSCYD.
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
