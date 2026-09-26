-- Coachvy – medlemskap på coachkontot.
--
-- Den metabola profilen (sprint + 3, 6 och 12 min), VLamax-kalkylen och den
-- metabola kalkylen ingår i medlemskapet. Vem som helst kan registrera ett
-- coachkonto; det här är vad som skiljer ett gratiskonto från ett betalande.
--
-- Kolumnen sätts av dig i databasen i dag, och av en betalningslösning senare.
-- Aldrig av användaren själv: coachen får uppdatera sin egen rad (företagsnamn),
-- så utan vakten nedan kunde vem som helst göra sig till medlem med ett enda
-- anrop mot API:t.

alter table public.coaches
  add column if not exists plan text not null default 'bas'
    check (plan in ('bas', 'medlem'));

comment on column public.coaches.plan is
  'bas = gratiskonto, medlem = betalande. Kan inte ändras av användaren själv.';

create or replace function public.guard_coach_plan()
returns trigger
language plpgsql
as $$
begin
  -- Inloggade och anonyma anrop via API:t körs som rollerna authenticated och
  -- anon. SQL-editorn, migrationer, registreringstriggern och en framtida
  -- betalningswebhook med service-nyckeln gör det inte.
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.plan := 'bas';
    elsif new.plan is distinct from old.plan then
      raise exception 'Medlemskapet kan inte ändras från appen.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists coaches_guard_plan on public.coaches;
create trigger coaches_guard_plan
  before insert or update on public.coaches
  for each row execute function public.guard_coach_plan();
