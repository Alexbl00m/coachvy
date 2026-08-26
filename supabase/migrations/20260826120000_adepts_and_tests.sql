-- Coachvy – fas 2: adepter som coachen äger, samt testmodulen.
--
-- Fas 1 lät `adepts.id` peka rakt på `profiles.id`, vilket betydde att en adept
-- måste ha ett eget konto för att existera. En coach ska kunna lägga upp en
-- adept direkt, långt innan adepten loggat in första gången. Därför får
-- `adepts` en egen nyckel och en valfri koppling till en profil.

-- ---------------------------------------------------------------------------
-- adepts: egen identitet, ägd av en coach
-- ---------------------------------------------------------------------------

alter table public.adepts
  add column if not exists profile_id uuid references public.profiles (id) on delete set null,
  add column if not exists full_name text,
  add column if not exists email text,
  add column if not exists last_active_at timestamptz;

-- Befintliga rader (fas 1) har id = profiles.id. Flytta över kopplingen och
-- fyll namn/e-post från profilen innan kolumnerna görs obligatoriska.
update public.adepts a
set
  profile_id = coalesce(a.profile_id, a.id),
  full_name = coalesce(a.full_name, p.full_name),
  email = coalesce(a.email, p.email)
from public.profiles p
where p.id = a.id
  and a.profile_id is null;

-- Kvarvarande rader utan matchande profil får ett platshållarnamn så att
-- NOT NULL kan sättas utan att tappa data.
update public.adepts
set full_name = coalesce(full_name, 'Namnlös adept')
where full_name is null;

alter table public.adepts
  alter column full_name set not null;

-- id ska inte längre ärva profilens nyckel.
alter table public.adepts
  drop constraint if exists adepts_id_fkey;

alter table public.adepts
  alter column id set default gen_random_uuid();

-- En profil kan bara vara en adept.
create unique index if not exists adepts_profile_id_key
  on public.adepts (profile_id)
  where profile_id is not null;

create index if not exists adepts_coach_id_created_idx
  on public.adepts (coach_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Testtyper
--
-- coach_id null = inbyggd typ som alla ser. Sätter en coach upp en egen typ
-- ägs den av coachen och syns bara för hen.
-- ---------------------------------------------------------------------------

create table if not exists public.test_types (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references public.coaches (id) on delete cascade,
  label text not null,
  default_unit text not null,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Samma namn får inte finnas två gånger hos samma ägare.
create unique index if not exists test_types_builtin_label_key
  on public.test_types (lower(label))
  where coach_id is null;

create unique index if not exists test_types_coach_label_key
  on public.test_types (coach_id, lower(label))
  where coach_id is not null;

insert into public.test_types (label, default_unit, sort_order)
values
  ('FTP', 'W', 10),
  ('VO2max', 'ml/kg/min', 20),
  ('VLamax', 'mmol/l/s', 30),
  ('Anaerob tröskel', 'W', 40),
  ('FatMax', 'g/min', 50),
  ('LT1', 'W', 60)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Testresultat
-- ---------------------------------------------------------------------------

create table if not exists public.test_results (
  id uuid primary key default gen_random_uuid(),
  adept_id uuid not null references public.adepts (id) on delete cascade,
  test_type_id uuid not null references public.test_types (id) on delete restrict,
  value numeric not null,
  -- Enheten fylls i från testtypen men sparas per resultat: samma testtyp kan
  -- mätas i olika enheter beroende på sport, och historiken ska inte ändras
  -- retroaktivt om typens standardenhet skrivs om.
  unit text not null,
  tested_on date not null default current_date,
  comment text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists test_results_adept_idx
  on public.test_results (adept_id, tested_on desc);

create index if not exists test_results_adept_type_idx
  on public.test_results (adept_id, test_type_id, tested_on);

drop trigger if exists test_types_set_updated_at on public.test_types;
create trigger test_types_set_updated_at
  before update on public.test_types
  for each row execute function public.set_updated_at();

drop trigger if exists test_results_set_updated_at on public.test_results;
create trigger test_results_set_updated_at
  before update on public.test_results
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Ny användare: adeptgrenen skriver nu till profile_id, inte id
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
  else
    -- Adepten registrerar sig själv och saknar coach tills någon kopplar på en.
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
-- Hjälpfunktioner för RLS
--
-- security definer: policyn måste kunna läsa relationen utan att i sin tur
-- filtreras av RLS på adepts (vilket skulle bli rekursivt).
-- ---------------------------------------------------------------------------

-- Ersätter fas 1-versionen: adepten identifieras nu av profile_id.
-- Parameternamnet ändras, och det klarar inte CREATE OR REPLACE. Policyn som
-- använder funktionen måste bort först, annars blockerar beroendet DROP.
drop policy if exists "Coach läser sina adepters profiler" on public.profiles;
drop function if exists public.is_coach_of(uuid);

create function public.is_coach_of(profile uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.adepts a
    where a.profile_id = profile
      and a.coach_id = auth.uid()
  );
$$;

create policy "Coach läser sina adepters profiler"
  on public.profiles for select
  to authenticated
  using (public.is_coach_of(id));

create or replace function public.current_coach_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select a.coach_id
  from public.adepts a
  where a.profile_id = auth.uid();
$$;

-- Får inloggad användare läsa adeptens data? Coachen som äger raden, eller
-- adepten själv.
create or replace function public.can_view_adept(adept uuid)
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
      and (a.coach_id = auth.uid() or a.profile_id = auth.uid())
  );
$$;

-- Får inloggad användare skriva på adeptens data? Endast coachen.
create or replace function public.is_adept_coach(adept uuid)
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
      and a.coach_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS: adepts (ersätter fas 1-policyerna, som utgick från adepts.id = auth.uid())
-- ---------------------------------------------------------------------------

drop policy if exists "Läs egen adeptrad eller egna adepter" on public.adepts;
drop policy if exists "Uppdatera egen adeptrad" on public.adepts;
drop policy if exists "Coach uppdaterar sina adepter" on public.adepts;
drop policy if exists "Skapa egen adeptrad" on public.adepts;

create policy "Coach läser sina adepter, adept läser sin egen rad"
  on public.adepts for select
  to authenticated
  using (coach_id = auth.uid() or profile_id = auth.uid());

-- En coach kan bara skapa adepter åt sig själv.
create policy "Coach skapar adepter"
  on public.adepts for insert
  to authenticated
  with check (coach_id = auth.uid());

-- ... och kan inte flytta en adept till en annan coach.
create policy "Coach uppdaterar sina adepter"
  on public.adepts for update
  to authenticated
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

create policy "Coach tar bort sina adepter"
  on public.adepts for delete
  to authenticated
  using (coach_id = auth.uid());

-- Adepten får uppdatera sin egen rad men inte byta ägare eller profil.
create policy "Adept uppdaterar sin egen rad"
  on public.adepts for update
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Självregistrerade adepter skapar sin rad via triggern (security definer),
-- så ingen insert-policy behövs för adeptkonton.

-- ---------------------------------------------------------------------------
-- RLS: test_types
-- ---------------------------------------------------------------------------

alter table public.test_types enable row level security;

drop policy if exists "Läs inbyggda och egna testtyper" on public.test_types;
create policy "Läs inbyggda och egna testtyper"
  on public.test_types for select
  to authenticated
  using (
    coach_id is null
    or coach_id = auth.uid()
    -- Adepten måste kunna se sin coachs egna typer för att kunna läsa sina
    -- egna resultat.
    or coach_id = public.current_coach_id()
  );

drop policy if exists "Coach skapar egna testtyper" on public.test_types;
create policy "Coach skapar egna testtyper"
  on public.test_types for insert
  to authenticated
  with check (coach_id = auth.uid());

drop policy if exists "Coach uppdaterar egna testtyper" on public.test_types;
create policy "Coach uppdaterar egna testtyper"
  on public.test_types for update
  to authenticated
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

drop policy if exists "Coach tar bort egna testtyper" on public.test_types;
create policy "Coach tar bort egna testtyper"
  on public.test_types for delete
  to authenticated
  using (coach_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RLS: test_results
-- ---------------------------------------------------------------------------

alter table public.test_results enable row level security;

drop policy if exists "Läs testresultat för adepter man har tillgång till" on public.test_results;
create policy "Läs testresultat för adepter man har tillgång till"
  on public.test_results for select
  to authenticated
  using (public.can_view_adept(adept_id));

drop policy if exists "Coach registrerar testresultat" on public.test_results;
create policy "Coach registrerar testresultat"
  on public.test_results for insert
  to authenticated
  with check (public.is_adept_coach(adept_id));

drop policy if exists "Coach uppdaterar testresultat" on public.test_results;
create policy "Coach uppdaterar testresultat"
  on public.test_results for update
  to authenticated
  using (public.is_adept_coach(adept_id))
  with check (public.is_adept_coach(adept_id));

drop policy if exists "Coach tar bort testresultat" on public.test_results;
create policy "Coach tar bort testresultat"
  on public.test_results for delete
  to authenticated
  using (public.is_adept_coach(adept_id));
