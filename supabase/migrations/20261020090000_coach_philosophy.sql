-- Coachvy – coachens egen träningsfilosofi.
--
-- AI-coachen och passbyggaren resonerar utifrån Coachvys grundfilosofi
-- (docs/traningsfilosofi.md). En ansluten coach kan skriva sin egen och
-- välja om den kompletterar grundfilosofin – och går före där de skiljer
-- sig – eller ersätter den helt. Adepterna läser sin coachs rad redan
-- (current_coach_id), så en medlemsadepts passbyggare får coachens filosofi.

alter table public.coaches
  add column if not exists philosophy text,
  add column if not exists philosophy_mode text not null default 'komplettera',
  add column if not exists philosophy_updated_at timestamptz;

alter table public.coaches
  drop constraint if exists coaches_philosophy_check;
alter table public.coaches
  add constraint coaches_philosophy_check
  check (philosophy is null or char_length(philosophy) <= 40000);

alter table public.coaches
  drop constraint if exists coaches_philosophy_mode_check;
alter table public.coaches
  add constraint coaches_philosophy_mode_check
  check (philosophy_mode in ('komplettera', 'ersatt'));

comment on column public.coaches.philosophy is
  'Coachens egen träningsfilosofi, till AI-coachen och passbyggaren. Tom: grundfilosofin gäller.';
comment on column public.coaches.philosophy_mode is
  'komplettera: grundfilosofin plus coachens, som går före där de skiljer sig. ersatt: bara coachens.';
