-- Coachvy – säsongsplanen: eget namn på en period.
--
-- Fasen styr färgen, testernas fas och AI-underlaget och är kvar som den är.
-- Namnet är coachens eget, som "Vinterbas", "Höghöjdsläger" eller
-- "VO₂max-block 1", och visas i stället för fasens namn där det finns.

alter table public.training_blocks
  add column if not exists name text;

alter table public.training_blocks
  drop constraint if exists training_blocks_name_check;
alter table public.training_blocks
  add constraint training_blocks_name_check
  check (name is null or char_length(name) <= 60);

comment on column public.training_blocks.name is
  'Periodens eget namn. Tomt: fasens namn visas.';
