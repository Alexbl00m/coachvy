-- Referensnivåer och målnivå.
--
-- Coachens egna referensgrupper (till exempel Motionär, Ambitiös, Svensk
-- elit) med värden per mått och kön, som JSON. Tomt betyder att appens
-- utgångsvärden gäller. Adepterna läser sin coachs rad redan (current_coach_id),
-- så jämförelsen ser likadan ut för båda.
alter table public.coaches
  add column if not exists reference_levels jsonb;

comment on column public.coaches.reference_levels is
  'Coachens referensgrupper för den metabola jämförelsen. Null = appens utgångsvärden.';

-- Målnivån för en adept: id på en av coachens referensgrupper. Gap-analysen
-- räknar avståndet till den.
alter table public.adepts
  add column if not exists target_level text;

comment on column public.adepts.target_level is
  'Id på referensgruppen adepten siktar mot, för gap-analysen.';
