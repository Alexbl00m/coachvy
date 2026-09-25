-- Coachvy – VLamax-referensdatan flyttar till koden.
--
-- De inbyggda raderna (coach_id null) ligger nu i src/lib/vlamax/reference.ts,
-- tillsammans med tre nya profileringsmätningar. Två skäl:
--
--   * Det metabola testprotokollet räknar i webbläsaren, också på den publika
--     sidan där en anonym besökare inte får läsa den här tabellen. Datan måste
--     finnas där modellen körs.
--   * Modellens form byttes samtidigt – från fem variabler till sprint per kilo
--     fettfri massa – och valet prövades mot just de här raderna. Ligger de i
--     samma commit som modellen går det att se vad som validerades mot vad.
--
-- Coachernas egna mätningar ligger kvar här och läggs till ovanpå.

-- Toppeffekten ingår inte längre i modellen. Den sparas när den finns, men
-- en mätning utan den är inte längre ofullständig.
alter table public.vlamax_samples
  alter column watt_peak drop not null;

-- De inbyggda raderna läses nu ur koden. Ligger de kvar här räknas de två
-- gånger; frågan filtrerar bort dem ändå, men dubbletter i tabellen är en
-- fälla för den som läser den direkt.
delete from public.vlamax_samples where coach_id is null;
