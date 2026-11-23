-- Coachvy – tävlingsfart i simning.
--
-- Simpassen skrivs som tillägg till CSS ("CSS+8-15") och med tävlingsfarten
-- för Ironman och 70.3 ("@IM", "@703"). Tävlingsfarten är adeptens egen,
-- bedömd ur CSS, simvana och öppet vatten-erfarenhet (träningsfilosofin,
-- avsnitt 27), och räknas inte fram som en fast skillnad från CSS. Den står
-- på adeptens profil i sekunder per 100 m, och samma behörighet gäller som
-- för resten av profilen.

alter table public.adept_profiles
  add column if not exists swim_im_pace numeric
    check (swim_im_pace is null or swim_im_pace between 50 and 300),
  add column if not exists swim_703_pace numeric
    check (swim_703_pace is null or swim_703_pace between 50 and 300);

comment on column public.adept_profiles.swim_im_pace is
  'Tävlingsfart i simning för Ironman, sekunder per 100 m.';
comment on column public.adept_profiles.swim_703_pace is
  'Tävlingsfart i simning för 70.3, sekunder per 100 m.';
