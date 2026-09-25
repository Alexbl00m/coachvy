-- Coachvy – kroppssammansättning på testtillfället.
--
-- Det metabola protokollet (sprint + 3, 6 och 12 minuter) skattar VLamax ur
-- sprinteffekten per kilo fettfri massa. Vikten sparas redan per tillfälle;
-- kroppsfett och kön behövs också, och av samma skäl sparas de här och inte
-- på adepten: kroppsfettet ändras, och ett gammalt test ska kunna räknas om
-- med de värden som gällde då.

alter table public.test_sessions
  add column if not exists body_fat_pct numeric check (
    body_fat_pct is null or (body_fat_pct > 0 and body_fat_pct < 60)
  ),
  add column if not exists sex text check (sex is null or sex in ('man', 'kvinna'));

comment on column public.test_sessions.body_fat_pct is
  'Kroppsfett i procent vid testtillfället. Används för fettfri massa i VLamax-skattningen.';
comment on column public.test_sessions.sex is
  'Kön som VLamax-modellen justerar för. Sparas med testet så att det kan räknas om.';
