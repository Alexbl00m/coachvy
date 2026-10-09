-- Coachvy – planbiblioteket, del 3: tempot räknas ur formen eller ur en måltid.
--
-- Procenten i en plan ligger fast. Vad de räknas mot kan medlemmen välja:
--
--   form   formuppskattningen – ett test, ett lopp eller en inskriven tid
--          (standard, och det som följer med när formen ändras)
--   mål    en måltid för maraton, som medlemmen anger. Tempona räknas då ur
--          måltiden, som i planer som bygger på målfart.
--
-- Valet gäller planen och kan bytas medan planen är aktiv. Det ändrar inga
-- pass, bara tempona.

alter table public.plan_instances
  add column if not exists pace_mode text not null default 'form'
    check (pace_mode in ('form', 'mål'));

alter table public.plan_instances
  add column if not exists goal_seconds numeric
    check (goal_seconds is null or (goal_seconds >= 7200 and goal_seconds <= 28800));

comment on column public.plan_instances.pace_mode is
  'Vad tempona räknas ur: form (formuppskattningen) eller mål (goal_seconds).';
comment on column public.plan_instances.goal_seconds is
  'Måltid för maraton i sekunder, när pace_mode är mål.';

create or replace function public.guard_plan_pace()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.pace_mode = 'mål' and new.goal_seconds is null then
    raise exception 'Ange en måltid för att räkna tempona ur målet.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace trigger plan_instances_pace
  before insert or update on public.plan_instances
  for each row execute function public.guard_plan_pace();

revoke all on function public.guard_plan_pace() from public, anon, authenticated;
