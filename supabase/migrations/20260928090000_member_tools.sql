-- Coachvy – det medlemskapet ger.
--
-- Tre nivåer: admin, bas och medlem. Bas är kontot – coachen har sina adepter,
-- adepten ser sina tester och pass. Medlemskapet lägger till verktygen:
-- testmodulerna, passbyggaren också för adepter, och communityn.
--
-- Communityn var tidigare öppen för alla coacher och alla adepter med en
-- coach. Nu är den en medlemsförmån. Den som inte är medlem ser inte längre
-- flödet; det de skrivit ligger kvar och syns för medlemmarna.

-- ---------------------------------------------------------------------------
-- Communityn: admin och medlemmar
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
    or exists (
      select 1 from public.coaches c
      where c.id = auth.uid() and c.plan = 'medlem'
    )
    or exists (
      select 1 from public.adepts a
      where a.profile_id = auth.uid() and a.plan = 'medlem'
    );
$$;

-- ---------------------------------------------------------------------------
-- Passbyggaren för adepter som är medlemmar
--
-- En medlemsadept får bygga och spara pass på sin egen rad. Bara sina egna:
-- ett pass coachen lagt får adepten läsa men inte ändra eller ta bort.
-- ---------------------------------------------------------------------------

create or replace function public.is_member_adept(adept uuid)
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
      and a.plan = 'medlem'
  );
$$;

revoke all on function public.is_member_adept(uuid) from public, anon;
grant execute on function public.is_member_adept(uuid) to authenticated;

drop policy if exists "Medlemsadept skapar egna pass" on public.workouts;
create policy "Medlemsadept skapar egna pass"
  on public.workouts for insert
  to authenticated
  with check (public.is_member_adept(adept_id) and created_by = auth.uid());

drop policy if exists "Medlemsadept tar bort egna pass" on public.workouts;
create policy "Medlemsadept tar bort egna pass"
  on public.workouts for delete
  to authenticated
  using (public.is_member_adept(adept_id) and created_by = auth.uid());
