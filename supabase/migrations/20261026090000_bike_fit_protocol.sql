-- Coachvy – bikefit som hel fit: samtalet, kroppens mått, funktionstester av
-- cykeln, cykelns mått före och efter, och fynd per område.
--
-- En fit börjar med ett samtal (syfte, mål, besvär) och mätning av kroppen,
-- fortsätter med tester av rörlighet och kontroll, och slutar på cykeln där
-- måtten justeras. Måtten före och efter sparas båda, så att rapporten visar
-- vad som flyttades vid fiten – och nästa fit kan börja där den här slutade.

alter table public.bike_fits
  add column if not exists measures_before jsonb not null default '{}'::jsonb,
  add column if not exists body jsonb not null default '{}'::jsonb,
  add column if not exists intake jsonb not null default '{}'::jsonb,
  add column if not exists screening jsonb not null default '{}'::jsonb,
  add column if not exists findings jsonb not null default '{}'::jsonb;

comment on column public.bike_fits.measures is 'Cykelns mått efter fiten, nyckel per mått i mallen.';
comment on column public.bike_fits.measures_before is 'Cykelns mått när adepten kom, samma nycklar som measures.';
comment on column public.bike_fits.body is 'Kroppens mått: längd, vikt, ben och armar per sida, sittbensbredd …';
comment on column public.bike_fits.intake is 'Samtalet före: syfte, mål, bakgrund, besvär och skador.';
comment on column public.bike_fits.screening is 'Funktionstester av cykeln, per test och sida.';
comment on column public.bike_fits.findings is 'Fynd och åtgärder per område: klossar, sadel, styre, teknik, övningar.';

-- Vinklarna mäts oftast på cykeln som den kom, och sadeln flyttas sedan.
-- Rapporten behöver veta vilket läge vinklarna gäller för att inte föreslå
-- en flytt som redan är gjord.
alter table public.bike_fits
  add column if not exists angles_at text not null default 'efter'
    check (angles_at in ('före', 'efter'));

comment on column public.bike_fits.angles_at is 'Om vinklarna mättes före eller efter fitens ändringar.';
