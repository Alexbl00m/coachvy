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
