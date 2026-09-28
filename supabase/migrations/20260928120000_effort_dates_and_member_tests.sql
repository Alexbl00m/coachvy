-- Coachvy – insatser från olika dagar, och medlemmar som registrerar egna tester.
--
-- Ett CP-test eller den metabola profilen görs sällan på en dag: sprinten och
-- 6-minuten en dag, 3- och 12-minuten två dagar senare. Varje insats får
-- därför ett eget datum. Saknas det gäller testtillfällets.
--
-- Insatserna kan också hämtas ur cykeldatorns fil. Då följer maxpulsen i
-- insatsen med, bredvid snittpulsen som redan fanns.

alter table public.test_efforts
  add column if not exists performed_on date,
  add column if not exists heart_rate_max integer check (
    heart_rate_max is null or (heart_rate_max > 0 and heart_rate_max < 300)
  );

comment on column public.test_efforts.performed_on is
  'Dagen insatsen gjordes, när den skiljer sig från testtillfällets datum.';
comment on column public.test_efforts.heart_rate_max is
  'Högsta puls under insatsen. heart_rate är snittet.';

-- ---------------------------------------------------------------------------
-- Medlemsadepter registrerar egna tester
--
-- Samma regel som för passen: på den egna raden, och bara det adepten själv
-- skapat får ändras eller tas bort. Coachens tester är coachens.
-- ---------------------------------------------------------------------------

create or replace function public.is_own_member_session(session uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.test_sessions s
    where s.id = session
      and s.created_by = auth.uid()
      and public.is_member_adept(s.adept_id)
  );
$$;

revoke all on function public.is_own_member_session(uuid) from public, anon;
grant execute on function public.is_own_member_session(uuid) to authenticated;

drop policy if exists "Medlemsadept skapar egna testtillfällen" on public.test_sessions;
create policy "Medlemsadept skapar egna testtillfällen"
  on public.test_sessions for insert
  to authenticated
  with check (public.is_member_adept(adept_id) and created_by = auth.uid());

drop policy if exists "Medlemsadept tar bort egna testtillfällen" on public.test_sessions;
create policy "Medlemsadept tar bort egna testtillfällen"
  on public.test_sessions for delete
  to authenticated
  using (public.is_member_adept(adept_id) and created_by = auth.uid());

drop policy if exists "Medlemsadept skapar steg i egna tester" on public.test_efforts;
create policy "Medlemsadept skapar steg i egna tester"
  on public.test_efforts for insert
  to authenticated
  with check (public.is_own_member_session(session_id));

drop policy if exists "Medlemsadept skapar värden i egna tester" on public.test_metrics;
create policy "Medlemsadept skapar värden i egna tester"
  on public.test_metrics for insert
  to authenticated
  with check (public.is_own_member_session(session_id));

drop policy if exists "Medlemsadept tar bort värden i egna tester" on public.test_metrics;
create policy "Medlemsadept tar bort värden i egna tester"
  on public.test_metrics for delete
  to authenticated
  using (public.is_own_member_session(session_id));
