-- Coachvy – koppla adeptkonton till sin coach.
--
-- Två vägar in:
--
-- 1. Coachen lägger till adepten med e-post, adepten registrerar sig sedan med
--    samma adress: kontot kopplas direkt till coachens adeptrad vid
--    registreringen. Supabase kräver att e-posten bekräftas innan man kan logga
--    in, så den som registrerar sig med någon annans adress kommer aldrig åt
--    raden.
-- 2. Adepten har redan ett eget konto när coachen lägger till hen: adepten ser
--    en inbjudan och tackar ja själv. Det adepten redan loggat flyttas med.
--
-- Samtidigt stängs ett hål: en adept fick uppdatera hela sin egen rad, också
-- vilken coach den pekar på, och en coach kunde peka en adeptrad mot vilket
-- konto som helst. Kopplingen ändras nu bara av funktionerna här.

-- ---------------------------------------------------------------------------
-- Låset
-- ---------------------------------------------------------------------------

create or replace function public.guard_adept_links()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      -- Coachen skapar adepter utan konto; kontot kopplas vid registrering
      -- eller inbjudan.
      new.profile_id := null;
    elsif new.profile_id is distinct from old.profile_id
       or new.coach_id is distinct from old.coach_id then
      raise exception 'Kopplingen mellan konto, adept och coach ändras inte från appen.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists adepts_guard_links on public.adepts;
create trigger adepts_guard_links
  before insert or update on public.adepts
  for each row execute function public.guard_adept_links();

-- ---------------------------------------------------------------------------
-- Väg 1: registrering med en adress coachen redan lagt in
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role public.account_role;
  v_name text;
  v_waiting uuid;
begin
  v_role := coalesce(nullif(v_meta ->> 'role', ''), 'adept')::public.account_role;
  v_name := coalesce(nullif(v_meta ->> 'full_name', ''), split_part(new.email, '@', 1));

  insert into public.profiles (id, role, full_name, email, accepted_terms_at)
  values (
    new.id,
    v_role,
    v_name,
    new.email,
    case
      when coalesce((v_meta ->> 'accepted_terms')::boolean, false) then now()
      else null
    end
  )
  on conflict (id) do nothing;

  if v_role = 'coach' then
    insert into public.coaches (id, company_name)
    values (new.id, nullif(v_meta ->> 'company_name', ''))
    on conflict (id) do nothing;
    return new;
  end if;

  -- Har en coach redan lagt till en adept med den här adressen tar kontot
  -- över den raden, med allt coachen registrerat. Den senast skapade vinner
  -- om flera coacher lagt in samma adress; de andra blir inbjudningar.
  select a.id into v_waiting
  from public.adepts a
  where a.profile_id is null
    and a.coach_id is not null
    and a.email is not null
    and lower(a.email) = lower(new.email)
  order by a.created_at desc
  limit 1;

  if v_waiting is not null then
    update public.adepts
    set profile_id = new.id,
        last_active_at = now(),
        sport = coalesce(sport, nullif(v_meta ->> 'sport', '')),
        goal = coalesce(goal, nullif(v_meta ->> 'goal', '')),
        current_level = coalesce(current_level, nullif(v_meta ->> 'current_level', ''))
    where id = v_waiting;
  else
    -- Ingen coach än; kopplas senare via en inbjudan.
    insert into public.adepts (
      profile_id, full_name, email, sport, goal, current_level, last_active_at
    )
    values (
      new.id,
      v_name,
      new.email,
      nullif(v_meta ->> 'sport', ''),
      nullif(v_meta ->> 'goal', ''),
      nullif(v_meta ->> 'current_level', ''),
      now()
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Väg 2: inbjudan till ett konto som redan finns
-- ---------------------------------------------------------------------------

-- Coacher som lagt till en adept med den inloggades e-post.
create or replace function public.my_coach_invitations()
returns table (id uuid, coach_name text, company_name text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, cp.full_name, c.company_name, a.created_at
  from public.adepts a
  join public.coaches c on c.id = a.coach_id
  join public.profiles cp on cp.id = a.coach_id
  join public.profiles me on me.id = auth.uid()
  where a.profile_id is null
    and a.email is not null
    and lower(a.email) = lower(me.email)
    and me.role = 'adept'
  order by a.created_at desc;
$$;

-- Tacka ja: kontot tar över coachens adeptrad, och det adepten loggat på sin
-- egen rad flyttas dit innan den tas bort.
create or replace function public.accept_coach_invitation(invitation uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_email text;
  v_own public.adepts%rowtype;
  v_target public.adepts%rowtype;
begin
  select email into v_email from public.profiles where id = v_me and role = 'adept';
  if v_email is null then
    raise exception 'Bara ett adeptkonto kan tacka ja till en coach.' using errcode = '42501';
  end if;

  select * into v_target from public.adepts
  where id = invitation
    and profile_id is null
    and coach_id is not null
    and lower(email) = lower(v_email);
  if not found then
    raise exception 'Inbjudan finns inte längre.' using errcode = 'P0002';
  end if;

  select * into v_own from public.adepts where profile_id = v_me;

  if found then
    if v_own.coach_id is not null then
      raise exception 'Du är redan kopplad till en coach.' using errcode = '23505';
    end if;

    update public.test_results   set adept_id = v_target.id where adept_id = v_own.id;
    update public.test_sessions  set adept_id = v_target.id where adept_id = v_own.id;
    update public.workouts       set adept_id = v_target.id where adept_id = v_own.id;
    update public.adept_checkins set adept_id = v_target.id where adept_id = v_own.id;
    update public.coach_messages set adept_id = v_target.id where adept_id = v_own.id;
    update public.ai_conversations o set adept_id = v_target.id
    where o.adept_id = v_own.id
      and not exists (
        select 1 from public.ai_conversations t
        where t.adept_id = v_target.id and t.created_by = o.created_by
      );
    -- Bakgrunden: coachens version vinner om båda finns.
    if not exists (select 1 from public.adept_profiles where adept_id = v_target.id) then
      update public.adept_profiles set adept_id = v_target.id where adept_id = v_own.id;
    end if;

    delete from public.adepts where id = v_own.id;
  end if;

  update public.adepts
  set profile_id = v_me,
      last_active_at = now(),
      plan = case when v_own.plan = 'medlem' then 'medlem' else plan end
  where id = v_target.id;

  return v_target.id;
end;
$$;

revoke execute on function public.my_coach_invitations() from public, anon;
revoke execute on function public.accept_coach_invitation(uuid) from public, anon;
grant execute on function public.my_coach_invitations() to authenticated;
grant execute on function public.accept_coach_invitation(uuid) to authenticated;
