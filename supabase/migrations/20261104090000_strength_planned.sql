-- Coachvy – planerade styrkepass.
--
-- Styrkeloggen fick bara gjorda pass, så coachen skrev styrkan som text i
-- ett cykelpass. Nu kan ett styrkepass vara planerat: coachen lägger det på
-- en dag med övningar, set, repetitioner och vikt som mål, det syns i
-- kalendern och under Idag, och adepten loggar det när det är gjort. Då
-- blir samma rad genomförd, med det som faktiskt gjordes.
--
-- Progressionen räknar bara genomförda pass. Åtkomsten är densamma som för
-- loggen (can_view_adept).

alter table public.strength_sessions
  add column if not exists status text not null default 'genomförd'
    check (status in ('planerad', 'genomförd'));

create index if not exists strength_sessions_planned_idx
  on public.strength_sessions (adept_id, performed_on)
  where status = 'planerad';

comment on column public.strength_sessions.status is
  'planerad: lagt på en dag som mål; genomförd: loggat som gjort.';
