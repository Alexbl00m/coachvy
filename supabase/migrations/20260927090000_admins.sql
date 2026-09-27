-- Coachvy – adminrollen.
--
-- En admin ser alla coacher och sätter deras medlemskap direkt i appen, i
-- stället för med SQL. Adminrollen själv ges bara här i SQL-editorn:
--
--   insert into public.admins (profile_id)
--   select id from public.profiles where email = 'din@adress';
--
-- Det finns avsiktligt ingen väg att bli admin från appen. Tabellen har ingen
-- insert-, update- eller delete-policy, så den som bara har en inloggning kan
-- inte skriva i den – varken via appen eller direkt mot API:t.

create table if not exists public.admins (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- Var och en kan se om de själva är admin – inget mer.
drop policy if exists "Läs egen adminrad" on public.admins;
create policy "Läs egen adminrad"
  on public.admins for select
  to authenticated
  using (profile_id = auth.uid());

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where profile_id = auth.uid());
$$;

-- Översikten för adminsidan. Security definer så att den kan räkna adepter
-- utan att admin får läsa adepternas rader; `where is_admin()` gör att alla
-- andra får en tom lista.
drop function if exists public.admin_coach_overview();
create function public.admin_coach_overview()
returns table (
  id uuid,
  full_name text,
  email text,
  company_name text,
  plan text,
  created_at timestamptz,
  adept_count bigint,
  is_admin boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    p.full_name,
    p.email,
    c.company_name,
    c.plan,
    c.created_at,
    (select count(*) from public.adepts a where a.coach_id = c.id),
    exists (select 1 from public.admins ad where ad.profile_id = c.id)
  from public.coaches c
  join public.profiles p on p.id = c.id
  where public.is_admin()
  order by c.created_at desc;
$$;

-- Medlemskapet ändras bara här. Funktionen körs som ägaren, så vakten på
-- coaches.plan släpper igenom den – men först efter att den kontrollerat att
-- den som anropar är admin.
create or replace function public.admin_set_plan(coach uuid, new_plan text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Bara en admin kan ändra medlemskap.' using errcode = '42501';
  end if;
  if new_plan not in ('bas', 'medlem') then
    raise exception 'Okänd plan: %', new_plan using errcode = '22023';
  end if;

  update public.coaches set plan = new_plan where id = coach;
  if not found then
    raise exception 'Ingen coach med det id:t.' using errcode = 'P0002';
  end if;
  return new_plan;
end;
$$;

-- Funktioner får körrätt för alla som standard. De här är bara för inloggade,
-- och inuti dem avgör is_admin() resten.
revoke execute on function public.admin_coach_overview() from public, anon;
revoke execute on function public.admin_set_plan(uuid, text) from public, anon;
grant execute on function public.admin_coach_overview() to authenticated;
grant execute on function public.admin_set_plan(uuid, text) to authenticated;
