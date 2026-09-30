-- Coachvy – säsongen, samtycket och ett lås på profilen.
--
-- Fyra saker:
--
--   adept_races       tävlingarna, med prioritet A, B eller C
--   training_blocks   perioderna i säsongsplanen: grund, uppbyggnad, specifik,
--                     toppning och vila – samma fem som testtillfällets fas
--   workouts          en medlemsadept får flytta sina egna pass i kalendern
--   profiles          samtycke till behandling av hälsouppgifter, och ett lås
--                     på roll och e-post
--
-- Adeptprofilen hade redan ett mål med datum. Det räcker för ett lopp, men en
-- säsong har flera, och de väger olika: A-loppet planeras allt mot, B-loppen
-- är genomkörare, C-loppen träning med nummerlapp. Utan prioriteten går det
-- inte att säga vilket lopp nedräkningen ska gälla eller var toppningen hör
-- hemma.

-- ---------------------------------------------------------------------------
-- adept_races – tävlingarna
-- ---------------------------------------------------------------------------

create table if not exists public.adept_races (
  id uuid primary key default gen_random_uuid(),
  adept_id uuid not null references public.adepts (id) on delete cascade,

  name text not null check (length(btrim(name)) > 0),
  race_date date not null,
  sport text check (
    sport is null
    or sport in ('cykling', 'löpning', 'simning', 'triathlon', 'annat')
  ),
  /** Fritext: "42,2 km", "1,9/90/21,1", "Vasaloppet 90 km". */
  distance text,
  /** A: säsongens mål. B: viktigt men genomkört. C: träning med nummerlapp. */
  priority text not null default 'B' check (priority in ('A', 'B', 'C')),
  /** Måltiden eller målet med loppet, i fritext. */
  target text,
  note text,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists adept_races_adept_idx
  on public.adept_races (adept_id, race_date);

-- ---------------------------------------------------------------------------
-- training_blocks – perioderna
--
-- En period är ett datumintervall med en av de fem faserna och ett fokus i
-- fritext. Överlapp hindras i appen, inte här: en exkluderingsregel kräver
-- btree_gist, och en överlappande period är ett skrivfel att rätta, inte data
-- som förstörs.
-- ---------------------------------------------------------------------------

create table if not exists public.training_blocks (
  id uuid primary key default gen_random_uuid(),
  adept_id uuid not null references public.adepts (id) on delete cascade,

  phase text not null check (
    phase in ('grund', 'uppbyggnad', 'specifik', 'topp', 'vila')
  ),
  starts_on date not null,
  ends_on date not null,
  focus text,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (ends_on >= starts_on)
);

create index if not exists training_blocks_adept_idx
  on public.training_blocks (adept_id, starts_on);

drop trigger if exists adept_races_set_updated_at on public.adept_races;
create trigger adept_races_set_updated_at
  before update on public.adept_races
  for each row execute function public.set_updated_at();

drop trigger if exists training_blocks_set_updated_at on public.training_blocks;
create trigger training_blocks_set_updated_at
  before update on public.training_blocks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
--
-- Tävlingarna skriver både coachen och adepten: det är atletens kalender, och
-- hen vet oftast först att ett lopp tillkommit. Perioderna är coachens plan.
-- En adept utan coach planerar sin egen säsong.
-- ---------------------------------------------------------------------------

create or replace function public.plans_own_season(adept uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.adepts a
    where a.id = adept
      and a.profile_id = auth.uid()
      and a.coach_id is null
  );
$$;

revoke all on function public.plans_own_season(uuid) from public, anon;
grant execute on function public.plans_own_season(uuid) to authenticated;

alter table public.adept_races enable row level security;
alter table public.training_blocks enable row level security;

drop policy if exists "Läs tävlingar för adepter man har tillgång till" on public.adept_races;
create policy "Läs tävlingar för adepter man har tillgång till"
  on public.adept_races for select
  to authenticated
  using (public.can_view_adept(adept_id));

drop policy if exists "Coach eller adept lägger till en tävling" on public.adept_races;
create policy "Coach eller adept lägger till en tävling"
  on public.adept_races for insert
  to authenticated
  with check (public.can_view_adept(adept_id));

drop policy if exists "Coach eller adept ändrar en tävling" on public.adept_races;
create policy "Coach eller adept ändrar en tävling"
  on public.adept_races for update
  to authenticated
  using (public.can_view_adept(adept_id))
  with check (public.can_view_adept(adept_id));

drop policy if exists "Coach eller adept tar bort en tävling" on public.adept_races;
create policy "Coach eller adept tar bort en tävling"
  on public.adept_races for delete
  to authenticated
  using (public.can_view_adept(adept_id));

drop policy if exists "Läs perioder för adepter man har tillgång till" on public.training_blocks;
create policy "Läs perioder för adepter man har tillgång till"
  on public.training_blocks for select
  to authenticated
  using (public.can_view_adept(adept_id));

drop policy if exists "Coach planerar perioder" on public.training_blocks;
create policy "Coach planerar perioder"
  on public.training_blocks for insert
  to authenticated
  with check (
    public.is_adept_coach(adept_id) or public.plans_own_season(adept_id)
  );

drop policy if exists "Coach ändrar perioder" on public.training_blocks;
create policy "Coach ändrar perioder"
  on public.training_blocks for update
  to authenticated
  using (public.is_adept_coach(adept_id) or public.plans_own_season(adept_id))
  with check (
    public.is_adept_coach(adept_id) or public.plans_own_season(adept_id)
  );

drop policy if exists "Coach tar bort perioder" on public.training_blocks;
create policy "Coach tar bort perioder"
  on public.training_blocks for delete
  to authenticated
  using (public.is_adept_coach(adept_id) or public.plans_own_season(adept_id));

-- ---------------------------------------------------------------------------
-- Pass i kalendern
--
-- Ett pass får ett datum när det sparas och kan flyttas efteråt. Coachen
-- ändrar redan sina adepters pass; en medlemsadept som byggt ett eget pass
-- ska kunna flytta det också. Adepten kunde redan skapa och ta bort sina
-- egna pass, så att ändra dem ger ingen ny behörighet.
-- ---------------------------------------------------------------------------

drop policy if exists "Medlemsadept ändrar egna pass" on public.workouts;
create policy "Medlemsadept ändrar egna pass"
  on public.workouts for update
  to authenticated
  using (public.is_member_adept(adept_id) and created_by = auth.uid())
  with check (public.is_member_adept(adept_id) and created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- Samtycke till behandling av hälsouppgifter
--
-- Laktat, puls, VO2max, kroppsfett, skador, sömn och stress är
-- hälsouppgifter, och sådana får behandlas på uttryckligt samtycke
-- (dataskyddsförordningen artikel 9.2 a). Samtycket ska vara särskilt – inte
-- en del av att godkänna villkoren – och gå att ta tillbaka lika lätt som det
-- gavs. Därför en egen kolumn bredvid accepted_terms_at.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists health_consent_at timestamptz;

comment on column public.profiles.health_consent_at is
  'När kontot samtyckte till behandling av hälsouppgifter. Null betyder inget '
  'samtycke, eller att det tagits tillbaka.';

-- ---------------------------------------------------------------------------
-- Låset på profilen
--
-- Policyn "Uppdatera egen profil" släppte igenom varje kolumn. Två av dem
-- avgör behörighet: rollen, som appen läser för att skilja coach från adept,
-- och e-posten, som inbjudningarna matchades mot. En adept kunde byta sin
-- e-post i profilen till någon annans och tacka ja till den personens
-- inbjudan – och därmed ta över adeptraden med allt coachen registrerat.
--
-- Nu ändras de bara av databasen själv. E-posten följer auth.users, och
-- inbjudningarna läser den bekräftade adressen därifrån i stället.
-- Samtyckena tidsstämplas också av databasen, inte av den som skickar dem.
-- ---------------------------------------------------------------------------

create or replace function public.guard_profile_identity()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.id is distinct from old.id
       or new.role is distinct from old.role
       or new.email is distinct from old.email then
      raise exception 'Roll och e-post ändras inte från appen.'
        using errcode = '42501';
    end if;

    if new.accepted_terms_at is distinct from old.accepted_terms_at
       and new.accepted_terms_at is not null then
      new.accepted_terms_at := now();
    end if;

    if new.health_consent_at is distinct from old.health_consent_at
       and new.health_consent_at is not null then
      new.health_consent_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_identity on public.profiles;
create trigger profiles_guard_identity
  before update on public.profiles
  for each row execute function public.guard_profile_identity();

-- E-posten i profilen följer kontots, när den byts och bekräftas i Auth.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Registreringen: samma som förut, plus samtycket till hälsouppgifter
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

  insert into public.profiles (id, role, full_name, email, accepted_terms_at, health_consent_at)
  values (
    new.id,
    v_role,
    v_name,
    new.email,
    case
      when coalesce((v_meta ->> 'accepted_terms')::boolean, false) then now()
      else null
    end,
    case
      when coalesce((v_meta ->> 'health_consent')::boolean, false) then now()
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
-- Inbjudningarna: den bekräftade adressen ur Auth, inte profilens
-- ---------------------------------------------------------------------------

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
  join auth.users u on u.id = auth.uid()
  where a.profile_id is null
    and a.email is not null
    and u.email_confirmed_at is not null
    and lower(a.email) = lower(u.email)
    and me.role = 'adept'
  order by a.created_at desc;
$$;

-- Tacka ja: kontot tar över coachens adeptrad, och det adepten loggat på sin
-- egen rad flyttas dit innan den tas bort. Tävlingarna följer med; perioderna
-- bara om coachen inte redan planerat säsongen – coachens plan vinner, som
-- med bakgrunden.
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
  select u.email into v_email
  from auth.users u
  join public.profiles p on p.id = u.id and p.role = 'adept'
  where u.id = v_me
    and u.email_confirmed_at is not null;
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
    update public.adept_races    set adept_id = v_target.id where adept_id = v_own.id;
    update public.ai_conversations o set adept_id = v_target.id
    where o.adept_id = v_own.id
      and not exists (
        select 1 from public.ai_conversations t
        where t.adept_id = v_target.id and t.created_by = o.created_by
      );
    -- Bakgrunden och säsongsplanen: coachens version vinner om båda finns.
    if not exists (select 1 from public.adept_profiles where adept_id = v_target.id) then
      update public.adept_profiles set adept_id = v_target.id where adept_id = v_own.id;
    end if;
    if not exists (select 1 from public.training_blocks where adept_id = v_target.id) then
      update public.training_blocks set adept_id = v_target.id where adept_id = v_own.id;
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
