-- Coachvy – admin, community och koppling adept–coach, i en fil.
--
-- För en databas där init och efter-init.sql redan är körda (före
-- 2026-09-27). Klistra in hela filen i SQL-editorn och kör. Supabase kör den
-- som en enda transaktion: går något fel ändras ingenting.
--
-- Samma tre filer som i supabase/migrations/, i ordning. Är du på ett helt
-- nytt projekt räcker init + efter-init.sql, som redan innehåller dem.


-- =============================================================================
-- 20260927090000_admins.sql
-- =============================================================================

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


-- =============================================================================
-- 20260927120000_community.sql
-- =============================================================================

-- Coachvy – community, medlemskap för adepter och en adminsida för alla konton.
--
-- Communityn är sluten: coacher och adepter som är kopplade till en coach.
-- Den som registrerar sig som adept utan coach kommer in först när en coach
-- kopplar på hen. Admin tar bort det som inte hör hemma där.

-- ---------------------------------------------------------------------------
-- Medlemskap för adepter, som för coacher
-- ---------------------------------------------------------------------------

alter table public.adepts
  add column if not exists plan text not null default 'bas'
    check (plan in ('bas', 'medlem'));

-- Coachen får uppdatera sina adepters rader, och adepten sin egen. Ingen av
-- dem får röra medlemskapet – det gör admin, via admin_set_member_plan.
create or replace function public.guard_adept_plan()
returns trigger
language plpgsql
as $$
begin
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

drop trigger if exists adepts_guard_plan on public.adepts;
create trigger adepts_guard_plan
  before insert or update on public.adepts
  for each row execute function public.guard_adept_plan();

-- ---------------------------------------------------------------------------
-- Vem är med i communityn
-- ---------------------------------------------------------------------------

create or replace function public.can_use_community()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (select 1 from public.coaches c where c.id = auth.uid())
    or exists (
      select 1 from public.adepts a
      where a.profile_id = auth.uid() and a.coach_id is not null
    );
$$;

-- ---------------------------------------------------------------------------
-- Inlägg, kommentarer och gillningar
-- ---------------------------------------------------------------------------

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  channel text not null default 'allmant'
    check (channel in ('allmant', 'lopning', 'cykling', 'simning', 'triathlon')),
  body text not null check (char_length(body) between 1 and 5000),

  -- Ett delat pass eller testresultat, som en ögonblicksbild. Den byggs på
  -- servern ur det författaren själv får läsa, så att andra ser exakt det som
  -- delades – och inte får läsrätt till passet eller testet i sig.
  attachment jsonb check (
    attachment is null
    or (jsonb_typeof(attachment) = 'object' and pg_column_size(attachment) < 16000)
  ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_posts_created_idx
  on public.community_posts (created_at desc);
create index if not exists community_posts_channel_created_idx
  on public.community_posts (channel, created_at desc);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists community_comments_post_idx
  on public.community_comments (post_id, created_at);

create table if not exists public.community_likes (
  post_id uuid not null references public.community_posts (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);

drop trigger if exists community_posts_set_updated_at on public.community_posts;
create trigger community_posts_set_updated_at
  before update on public.community_posts
  for each row execute function public.set_updated_at();

alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_likes enable row level security;

-- Inlägg
drop policy if exists "Communityn läser inlägg" on public.community_posts;
create policy "Communityn läser inlägg"
  on public.community_posts for select to authenticated
  using (public.can_use_community());

drop policy if exists "Communityn skriver inlägg" on public.community_posts;
create policy "Communityn skriver inlägg"
  on public.community_posts for insert to authenticated
  with check (public.can_use_community() and author_id = auth.uid());

drop policy if exists "Författaren ändrar sitt inlägg" on public.community_posts;
create policy "Författaren ändrar sitt inlägg"
  on public.community_posts for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists "Författaren eller admin tar bort inlägg" on public.community_posts;
create policy "Författaren eller admin tar bort inlägg"
  on public.community_posts for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- Kommentarer
drop policy if exists "Communityn läser kommentarer" on public.community_comments;
create policy "Communityn läser kommentarer"
  on public.community_comments for select to authenticated
  using (public.can_use_community());

drop policy if exists "Communityn kommenterar" on public.community_comments;
create policy "Communityn kommenterar"
  on public.community_comments for insert to authenticated
  with check (public.can_use_community() and author_id = auth.uid());

drop policy if exists "Författaren eller admin tar bort kommentarer" on public.community_comments;
create policy "Författaren eller admin tar bort kommentarer"
  on public.community_comments for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- Gillningar
drop policy if exists "Communityn läser gillningar" on public.community_likes;
create policy "Communityn läser gillningar"
  on public.community_likes for select to authenticated
  using (public.can_use_community());

drop policy if exists "Communityn gillar" on public.community_likes;
create policy "Communityn gillar"
  on public.community_likes for insert to authenticated
  with check (public.can_use_community() and profile_id = auth.uid());

drop policy if exists "Ta bort egen gillning" on public.community_likes;
create policy "Ta bort egen gillning"
  on public.community_likes for delete to authenticated
  using (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Läsning med författarnamn
--
-- Medlemmarna får inte läsa varandras profiler direkt – där finns e-post. De
-- här funktionerna ger namn och roll, inget mer, och bara till den som är med.
-- ---------------------------------------------------------------------------

create or replace function public.community_feed(
  p_channel text default null,
  p_before timestamptz default null,
  p_limit int default 30
)
returns table (
  id uuid,
  channel text,
  body text,
  attachment jsonb,
  created_at timestamptz,
  author_id uuid,
  author_name text,
  author_role text,
  author_is_admin boolean,
  likes bigint,
  liked boolean,
  comments bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.channel, p.body, p.attachment, p.created_at,
    p.author_id, pr.full_name, pr.role::text,
    exists (select 1 from public.admins ad where ad.profile_id = p.author_id),
    (select count(*) from public.community_likes l where l.post_id = p.id),
    exists (select 1 from public.community_likes l where l.post_id = p.id and l.profile_id = auth.uid()),
    (select count(*) from public.community_comments c where c.post_id = p.id)
  from public.community_posts p
  join public.profiles pr on pr.id = p.author_id
  where public.can_use_community()
    and (p_channel is null or p.channel = p_channel)
    and (p_before is null or p.created_at < p_before)
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

create or replace function public.community_post_comments(p_post uuid)
returns table (
  id uuid,
  body text,
  created_at timestamptz,
  author_id uuid,
  author_name text,
  author_role text,
  author_is_admin boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id, c.body, c.created_at, c.author_id, pr.full_name, pr.role::text,
    exists (select 1 from public.admins ad where ad.profile_id = c.author_id)
  from public.community_comments c
  join public.profiles pr on pr.id = c.author_id
  where public.can_use_community() and c.post_id = p_post
  order by c.created_at;
$$;

-- ---------------------------------------------------------------------------
-- Adminsidan: alla konton, inte bara coacher
-- ---------------------------------------------------------------------------

drop function if exists public.admin_coach_overview();
drop function if exists public.admin_set_plan(uuid, text);

create or replace function public.admin_member_overview()
returns table (
  id uuid,
  role text,
  full_name text,
  email text,
  company_name text,
  coach_name text,
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
    pr.id,
    pr.role::text,
    pr.full_name,
    pr.email,
    c.company_name,
    cp.full_name,
    coalesce(c.plan, a.plan, 'bas'),
    pr.created_at,
    case when c.id is not null
      then (select count(*) from public.adepts x where x.coach_id = c.id)
    end,
    exists (select 1 from public.admins ad where ad.profile_id = pr.id)
  from public.profiles pr
  left join public.coaches c on c.id = pr.id
  left join public.adepts a on a.profile_id = pr.id
  left join public.profiles cp on cp.id = a.coach_id
  where public.is_admin()
  order by pr.created_at desc;
$$;

create or replace function public.admin_set_member_plan(member uuid, new_plan text)
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

  update public.coaches set plan = new_plan where id = member;
  if found then return new_plan; end if;

  update public.adepts set plan = new_plan where profile_id = member;
  if found then return new_plan; end if;

  raise exception 'Inget konto med det id:t.' using errcode = 'P0002';
end;
$$;

revoke execute on function public.community_feed(text, timestamptz, int) from public, anon;
revoke execute on function public.community_post_comments(uuid) from public, anon;
revoke execute on function public.admin_member_overview() from public, anon;
revoke execute on function public.admin_set_member_plan(uuid, text) from public, anon;
grant execute on function public.community_feed(text, timestamptz, int) to authenticated;
grant execute on function public.community_post_comments(uuid) to authenticated;
grant execute on function public.admin_member_overview() to authenticated;
grant execute on function public.admin_set_member_plan(uuid, text) to authenticated;


-- =============================================================================
-- 20260927130000_adept_linking.sql
-- =============================================================================

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
