-- Coachvy – kontaktförfrågningar från den publika sajten.
--
-- Formuläret på hub-sajten visade bara en toast och kastade innehållet. Här
-- landar det i en tabell som coachen kan läsa inifrån appen.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text,
  email text not null,
  message text not null,
  -- Fritt fält för var förfrågan kom ifrån (sidsektion, kampanj).
  source text,
  status text not null default 'ny',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Formuläret är öppet för omvärlden, så längden begränsas i databasen och
  -- inte bara i klienten.
  constraint leads_first_name_len check (char_length(first_name) between 1 and 120),
  constraint leads_last_name_len check (last_name is null or char_length(last_name) <= 120),
  constraint leads_email_len check (char_length(email) between 3 and 320),
  constraint leads_message_len check (char_length(message) between 1 and 5000),
  constraint leads_status_valid check (status in ('ny', 'kontaktad', 'avslutad'))
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- Är inloggad användare en coach?
create or replace function public.is_coach()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.coaches c where c.id = auth.uid());
$$;

alter table public.leads enable row level security;

-- Vem som helst får skicka in en förfrågan; det är hela poängen med
-- formuläret. Ingen får läsa tillbaka den utan att vara coach.
drop policy if exists "Vem som helst skickar in en förfrågan" on public.leads;
create policy "Vem som helst skickar in en förfrågan"
  on public.leads for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Coach läser förfrågningar" on public.leads;
create policy "Coach läser förfrågningar"
  on public.leads for select
  to authenticated
  using (public.is_coach());

drop policy if exists "Coach uppdaterar förfrågningar" on public.leads;
create policy "Coach uppdaterar förfrågningar"
  on public.leads for update
  to authenticated
  using (public.is_coach())
  with check (public.is_coach());
