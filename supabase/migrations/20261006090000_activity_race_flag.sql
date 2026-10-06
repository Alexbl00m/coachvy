-- Coachvy – tävlingsmarkering på aktiviteter.
--
-- En aktivitet kan vara en tävling utan att höra till säsongsplanen: ett
-- lopp som anmäldes i sista stund, en träningstävling. `is_race` säger att det
-- var en tävling; `race_id` säger vilken planerad tävling den hör till. En
-- kopplad aktivitet är alltid en tävling.

alter table public.activities
  add column if not exists is_race boolean not null default false;

update public.activities set is_race = true where race_id is not null and not is_race;

comment on column public.activities.is_race is
  'Aktiviteten var en tävling – planerad (race_id satt) eller oplanerad.';
