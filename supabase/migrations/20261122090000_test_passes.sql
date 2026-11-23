-- Coachvy – pass som del av ett test.
--
-- Ett test går ofta över flera dagar: en sprint och tre minuter en dag, sex
-- minuter en annan och tolv minuter på söndagen. Testtillfället har redan
-- insatserna med sina datum, men passen de kom ur såg ut som vanlig träning.
--
-- test_activities kopplar ett genomfört pass till ett testtillfälle. Samma
-- pass kan höra till flera test – critical power och metabol profil räknas
-- ofta ur samma insatser – och ett test till flera pass. Kopplingen följer
-- testets behörighet: den som ser testet ser kopplingen, coachen (och en
-- medlemsadept i sina egna test) ändrar den.
--
-- workouts.test_protocol märker ett planerat pass som en del av ett test i
-- ett protokoll, så att testveckan syns i planen innan den är gjord.

create table if not exists public.test_activities (
  session_id uuid not null references public.test_sessions (id) on delete cascade,
  activity_id uuid not null references public.activities (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (session_id, activity_id)
);

create index if not exists test_activities_activity_idx
  on public.test_activities (activity_id);

comment on table public.test_activities is
  'Genomförda pass som hör till ett testtillfälle. Många-till-många: ett pass kan ingå i flera test.';

-- Passet och testet hör till samma adept.
create or replace function public.guard_test_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.test_sessions s
    join public.activities a on a.adept_id = s.adept_id
    where s.id = new.session_id and a.id = new.activity_id
  ) then
    raise exception 'Passet och testet hör till olika adepter.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_test_activity on public.test_activities;
create trigger guard_test_activity
  before insert or update on public.test_activities
  for each row execute function public.guard_test_activity();

alter table public.test_activities enable row level security;

drop policy if exists "Läs testets pass" on public.test_activities;
create policy "Läs testets pass"
  on public.test_activities for select
  to authenticated
  using (public.can_view_session(session_id));

drop policy if exists "Coach kopplar pass till test" on public.test_activities;
create policy "Coach kopplar pass till test"
  on public.test_activities for insert
  to authenticated
  with check (
    public.is_session_coach(session_id)
    or public.is_own_member_session(session_id)
  );

drop policy if exists "Coach tar bort pass ur test" on public.test_activities;
create policy "Coach tar bort pass ur test"
  on public.test_activities for delete
  to authenticated
  using (
    public.is_session_coach(session_id)
    or public.is_own_member_session(session_id)
  );

grant select, insert, delete on public.test_activities to authenticated;

-- Planerade pass som del av ett test ------------------------------------------

alter table public.workouts
  add column if not exists test_protocol text
    check (test_protocol is null or length(test_protocol) between 1 and 40);

comment on column public.workouts.test_protocol is
  'Protokollet passet är en del av när det är ett test (protocols.ts), annars null.';
