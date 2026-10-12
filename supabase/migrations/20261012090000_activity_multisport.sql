-- Coachvy – multisport: ett triathlon är tre pass, inte ett.
--
-- En multisportfil från klockan (Garmins auto_multi_sport) har en session
-- per gren och en per växling. Tidigare lästes bara den första sessionens
-- gren, så ett helt triathlon sparades som ett simpass på fyra timmar.
--
-- Nu blir varje gren en egen aktivitet, med sin egen analys – simfart,
-- cykelns effekt, löpningens tempo – och alla delar samma sammanfattning:
--
--   multisport  { id, kind, leg, parts: [{ kind, sport, startedAt,
--                 seconds, distanceM }], totalS, distanceM }
--
-- `id` är gemensamt för grenarna, `leg` grenens plats bland dem och
-- `parts` hela loppet i ordning, växlingarna inräknade.

alter table public.activities
  add column if not exists multisport jsonb;

comment on column public.activities.multisport is
  'En gren i ett multisportlopp: gemensamt id, grenens plats och hela loppets delar med växlingar.';

create index if not exists activities_multisport_idx
  on public.activities (adept_id, ((multisport ->> 'id')))
  where multisport is not null;
