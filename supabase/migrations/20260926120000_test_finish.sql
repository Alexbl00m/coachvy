-- Coachvy – slutet på ett stegtest.
--
-- Ett laktatstegtest ska sluta all-out: antingen med en ramp till utmattning,
-- som ger Vmax eller Wmax, eller med ett VO2max-test. Det är toppen på skalan –
-- det tröskeln jämförs mot, och det som gör att VLamax kan räknas ur testet.
-- Sparas per tillfälle, som vikt och kroppsfett, så att testet kan räknas om.

alter table public.test_sessions
  -- Högsta belastning i testets enhet (W, km/h eller m/s). Ur rampen räknas den
  -- som sista fullföljda nivån plus den del av nästa som hanns med.
  add column if not exists peak_intensity numeric check (peak_intensity is null or peak_intensity > 0),
  -- Uppmätt VO2max, ml/kg/min, när testet slutade med ett VO2max-test.
  add column if not exists vo2max numeric check (vo2max is null or (vo2max > 10 and vo2max < 100)),
  add column if not exists peak_lactate numeric check (peak_lactate is null or (peak_lactate > 0 and peak_lactate < 40)),
  add column if not exists peak_heart_rate integer check (peak_heart_rate is null or (peak_heart_rate > 60 and peak_heart_rate < 250));
