-- Coachvy – fyra nivåer i passbiblioteket.
--
-- Ett pass i biblioteket har haft tre nivåer, A–C. Planerna har fyra, A–D,
-- och simpassen följer simmarens nivå i fyra steg (träningsfilosofin,
-- avsnitt 27). Ett pass har nu inga, tre eller fyra nivåer; B är passets
-- namn och förval som förut.

alter table public.session_library
  drop constraint if exists session_library_levels_check;
alter table public.session_library
  add constraint session_library_levels_check
  check (jsonb_typeof(levels) = 'array' and jsonb_array_length(levels) <= 4);

comment on column public.session_library.levels is
  'Strukturen per nivå, A (mest) till C eller D (minst). Tom: bara structure.';
