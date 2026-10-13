-- Coachvy – passbiblioteket: nivåer och passets förklaring.
--
-- Planmallarna har tre nivåer, A (mest) till C (minst): samma format, olika
-- mängd. Ett pass i biblioteket kan nu skrivas på samma sätt, så att det
-- fyller alla tre nivåerna i en mall på en gång och går att ge en adept på
-- rätt nivå.
--
--   levels       [{ key: 'A' | 'B' | 'C', structure, blocks }] – tom när
--                passet bara har en struktur. Med nivåer är structure och
--                blocks nivå B, så att allt som läser en struktur fungerar
--                som förut.
--
-- Passet ska också förklara sig för den som tränar, inte bara beskriva
-- stegen. Syfte, utförande och progression fanns; nu även:
--
--   adaptations  vad kroppen anpassar sig till
--   fueling      energi och vätska under passet
--   timing       när passet passar: fas, hur ofta och var

alter table public.session_library
  add column if not exists levels jsonb not null default '[]'::jsonb;

alter table public.session_library
  drop constraint if exists session_library_levels_check;
alter table public.session_library
  add constraint session_library_levels_check
  check (jsonb_typeof(levels) = 'array' and jsonb_array_length(levels) <= 3);

alter table public.session_library
  add column if not exists adaptations text
    check (adaptations is null or char_length(adaptations) <= 1000);

alter table public.session_library
  add column if not exists fueling text
    check (fueling is null or char_length(fueling) <= 600);

alter table public.session_library
  add column if not exists timing text
    check (timing is null or char_length(timing) <= 600);

comment on column public.session_library.levels is
  'Strukturen per nivå, A (mest) till C (minst). Tom: bara structure.';
comment on column public.session_library.adaptations is
  'Vad kroppen anpassar sig till.';
comment on column public.session_library.fueling is
  'Energi och vätska under passet.';
comment on column public.session_library.timing is
  'När passet passar: fas, hur ofta och var.';
