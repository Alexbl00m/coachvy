-- Coachvy – fas 1: identitet och relationen coach ⇄ adept.
--
-- Kör i Supabase SQL Editor, eller via `supabase db push` om du länkat CLI:t.

-- ---------------------------------------------------------------------------
-- Typer
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'account_role') then
    create type public.account_role as enum ('coach', 'adept');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Tabeller
-- ---------------------------------------------------------------------------

-- En rad per användare i auth.users. Gemensamma fält oavsett kontotyp.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.account_role not null,
  full_name text not null,
  email text not null,
  accepted_terms_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Coach-specifika fält.
create table if not exists public.coaches (
  id uuid primary key references public.profiles (id) on delete cascade,
  company_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Adept-specifika fält plus kopplingen till coachen.
create table if not exists public.adepts (
  id uuid primary key references public.profiles (id) on delete cascade,
  coach_id uuid references public.coaches (id) on delete set null,
  sport text,
  goal text,
  current_level text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists adepts_coach_id_idx on public.adepts (coach_id);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists coaches_set_updated_at on public.coaches;
create trigger coaches_set_updated_at
  before update on public.coaches
  for each row execute function public.set_updated_at();

drop trigger if exists adepts_set_updated_at on public.adepts;
create trigger adepts_set_updated_at
  before update on public.adepts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Ny användare -> profil + rollrad
--
-- Metadatan sätts av `supabase.auth.signUp` i src/lib/auth/actions.ts.
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
begin
  v_role := coalesce(nullif(v_meta ->> 'role', ''), 'adept')::public.account_role;

  insert into public.profiles (id, role, full_name, email, accepted_terms_at)
  values (
    new.id,
    v_role,
    coalesce(nullif(v_meta ->> 'full_name', ''), split_part(new.email, '@', 1)),
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
  else
    insert into public.adepts (id, sport, goal, current_level)
    values (
      new.id,
      nullif(v_meta ->> 'sport', ''),
      nullif(v_meta ->> 'goal', ''),
      nullif(v_meta ->> 'current_level', '')
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Hjälpfunktioner för RLS
--
-- security definer så att policyn kan läsa relationen utan att fastna i
-- RLS på tabellen den frågar mot (och utan rekursiva policies).
-- ---------------------------------------------------------------------------

-- Är inloggad användare coach för den här adepten?
create or replace function public.is_coach_of(adept_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.adepts a
    where a.id = adept_id
      and a.coach_id = auth.uid()
  );
$$;

-- Vilken coach är kopplad till inloggad adept?
create or replace function public.current_coach_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select a.coach_id
  from public.adepts a
  where a.id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.coaches enable row level security;
alter table public.adepts enable row level security;

-- profiles ------------------------------------------------------------------

drop policy if exists "Läs egen profil" on public.profiles;
create policy "Läs egen profil"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "Coach läser sina adepters profiler" on public.profiles;
create policy "Coach läser sina adepters profiler"
  on public.profiles for select
  to authenticated
  using (public.is_coach_of(id));

drop policy if exists "Adept läser sin coachs profil" on public.profiles;
create policy "Adept läser sin coachs profil"
  on public.profiles for select
  to authenticated
  using (id = public.current_coach_id());

drop policy if exists "Uppdatera egen profil" on public.profiles;
create policy "Uppdatera egen profil"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "Skapa egen profil" on public.profiles;
create policy "Skapa egen profil"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

-- coaches -------------------------------------------------------------------

drop policy if exists "Läs egen coachrad" on public.coaches;
create policy "Läs egen coachrad"
  on public.coaches for select
  to authenticated
  using (id = auth.uid() or id = public.current_coach_id());

drop policy if exists "Uppdatera egen coachrad" on public.coaches;
create policy "Uppdatera egen coachrad"
  on public.coaches for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "Skapa egen coachrad" on public.coaches;
create policy "Skapa egen coachrad"
  on public.coaches for insert
  to authenticated
  with check (id = auth.uid());

-- adepts --------------------------------------------------------------------

drop policy if exists "Läs egen adeptrad eller egna adepter" on public.adepts;
create policy "Läs egen adeptrad eller egna adepter"
  on public.adepts for select
  to authenticated
  using (id = auth.uid() or coach_id = auth.uid());

drop policy if exists "Uppdatera egen adeptrad" on public.adepts;
create policy "Uppdatera egen adeptrad"
  on public.adepts for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Coachen får redigera sina egna adepters rader, men inte flytta dem till
-- någon annan coach.
drop policy if exists "Coach uppdaterar sina adepter" on public.adepts;
create policy "Coach uppdaterar sina adepter"
  on public.adepts for update
  to authenticated
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

drop policy if exists "Skapa egen adeptrad" on public.adepts;
create policy "Skapa egen adeptrad"
  on public.adepts for insert
  to authenticated
  with check (id = auth.uid());
