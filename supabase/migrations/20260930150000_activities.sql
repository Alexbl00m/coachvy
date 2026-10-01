-- Coachvy – genomförda pass och lopp ur klockans fil.
--
-- Filen läses och analyseras i webbläsaren. Det som sparas är analysen –
-- normaliserad effekt, bästa insatser, W′bal, zoner, sträckor – och en
-- nedsamplad serie för kartan och graferna, inte filen själv. Tröskelvärdena
-- analysen räknades mot sparas med, som ett pass sparas med sin referens:
-- ett lopp från i våras ska läsas mot vårens CP, inte dagens.
--
-- En aktivitet kan kopplas till en tävling i säsongsplanen. Då blir den
-- loppets analys.

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  adept_id uuid not null references public.adepts (id) on delete cascade,
  race_id uuid references public.adept_races (id) on delete set null,

  name text not null check (length(btrim(name)) > 0),
  sport text not null check (sport in ('cykling', 'löpning', 'simning', 'annat')),
  started_at timestamptz not null,
  performed_on date not null,
  device text,

  duration_s numeric check (duration_s is null or duration_s >= 0),
  moving_s numeric check (moving_s is null or moving_s >= 0),
  distance_m numeric check (distance_m is null or distance_m >= 0),
  ascent_m numeric check (ascent_m is null or ascent_m >= 0),

  /** Analysen: effekt, puls, bästa insatser, zoner, sträckor, insikter. */
  summary jsonb not null default '{}'::jsonb,
  /** Tröskelvärdena analysen räknades mot, och testet de kom ur. */
  reference jsonb,
  /** Nedsamplad serie: tid, sträcka, läge, höjd, effekt, puls, fart, kadens. */
  streams jsonb not null,
  laps jsonb,
  note text,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Samma fil två gånger blir en aktivitet, inte två.
  unique (adept_id, started_at)
);

create index if not exists activities_adept_idx
  on public.activities (adept_id, performed_on desc);

create index if not exists activities_race_idx
  on public.activities (race_id)
  where race_id is not null;

drop trigger if exists activities_set_updated_at on public.activities;
create trigger activities_set_updated_at
  before update on public.activities
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS – som tävlingarna: både coachen och adepten laddar upp, det är
-- atletens pass. Den som laddar upp står som skapare.
-- ---------------------------------------------------------------------------

alter table public.activities enable row level security;

drop policy if exists "Läs aktiviteter för adepter man har tillgång till" on public.activities;
create policy "Läs aktiviteter för adepter man har tillgång till"
  on public.activities for select
  to authenticated
  using (public.can_view_adept(adept_id));

drop policy if exists "Coach eller adept laddar upp en aktivitet" on public.activities;
create policy "Coach eller adept laddar upp en aktivitet"
  on public.activities for insert
  to authenticated
  with check (public.can_view_adept(adept_id) and created_by = auth.uid());

drop policy if exists "Coach eller adept ändrar en aktivitet" on public.activities;
create policy "Coach eller adept ändrar en aktivitet"
  on public.activities for update
  to authenticated
  using (public.can_view_adept(adept_id))
  with check (public.can_view_adept(adept_id));

drop policy if exists "Coach eller adept tar bort en aktivitet" on public.activities;
create policy "Coach eller adept tar bort en aktivitet"
  on public.activities for delete
  to authenticated
  using (public.can_view_adept(adept_id));

-- ---------------------------------------------------------------------------
-- Inbjudan: aktiviteterna följer med när ett eget konto tar över coachens
-- adeptrad, som allt annat adepten loggat.
-- ---------------------------------------------------------------------------

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
    update public.activities a   set adept_id = v_target.id
    where a.adept_id = v_own.id
      and not exists (
        select 1 from public.activities t
        where t.adept_id = v_target.id and t.started_at = a.started_at
      );
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

revoke execute on function public.accept_coach_invitation(uuid) from public, anon;
grant execute on function public.accept_coach_invitation(uuid) to authenticated;
