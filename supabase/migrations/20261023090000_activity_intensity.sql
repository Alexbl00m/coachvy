-- Coachvy – passets intensitet efter huvudsyfte, satt av coachen.
--
-- Genomförda pass klassas automatiskt som lugnt, medel eller högt ur zonerna
-- (src/lib/activities/intensity-class.ts), eller ur AI-sammanfattningen om
-- en finns. Den här kolumnen är coachens egen klassning och går före båda;
-- null betyder att den automatiska gäller. Samma åtkomst som resten av
-- passet: den som får rätta passet får sätta den.

alter table public.activities
  add column if not exists intensity text
    check (intensity is null or intensity in ('lugn', 'medel', 'hög'));

comment on column public.activities.intensity is
  'Coachens klassning efter huvudsyfte (lugn/medel/hög). Null = automatisk.';
