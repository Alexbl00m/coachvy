-- Coachvy – planförslag ur AI-chatten.
--
-- När coachen planerar en säsong eller ett block med AI:n föreslår den
-- perioder och pass i ett verktygsanrop. Förslaget sparas här, kontrollerat
-- mot biblioteket och filosofin, och visas i chatten. Inget läggs i
-- kalendern förrän coachen godkänner det. Då skapas perioderna, de nya
-- passen i passbiblioteket och passen på adepten, och det som skapades
-- sparas i `applied` så att inläggningen går att ångra.
--
-- Förslagen följer tråden: samma behörighet som AI-trådarna, coachen som
-- äger tråden och är adeptens coach.

create table if not exists public.ai_plan_drafts (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  -- Svaret förslaget kom med; null tills svaret är sparat.
  message_id uuid references public.ai_messages (id) on delete set null,
  adept_id uuid not null references public.adepts (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  title text not null check (length(title) between 1 and 120),
  plan jsonb not null,
  -- Varningarna ur kontrollen när förslaget gjordes.
  warnings jsonb not null default '[]'::jsonb,
  status text not null default 'förslag'
    check (status in ('förslag', 'inlagd', 'ersatt', 'förkastad')),
  -- Det som skapades när förslaget lades in: perioder, pass och nya bibliotekspass.
  applied jsonb,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);

create index if not exists ai_plan_drafts_conversation_idx
  on public.ai_plan_drafts (conversation_id, created_at);

comment on table public.ai_plan_drafts is
  'Planförslag ur AI-chatten: perioder och pass som läggs i kalendern först när coachen godkänner dem.';

alter table public.ai_plan_drafts enable row level security;

drop policy if exists "Läs planförslag i sin egen AI-tråd" on public.ai_plan_drafts;
create policy "Läs planförslag i sin egen AI-tråd"
  on public.ai_plan_drafts for select
  to authenticated
  using (public.owns_conversation(conversation_id));

drop policy if exists "Skapa planförslag i sin egen AI-tråd" on public.ai_plan_drafts;
create policy "Skapa planförslag i sin egen AI-tråd"
  on public.ai_plan_drafts for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and public.owns_conversation(conversation_id)
    and public.is_adept_coach(adept_id)
  );

drop policy if exists "Ändra planförslag i sin egen AI-tråd" on public.ai_plan_drafts;
create policy "Ändra planförslag i sin egen AI-tråd"
  on public.ai_plan_drafts for update
  to authenticated
  using (public.owns_conversation(conversation_id))
  with check (public.owns_conversation(conversation_id) and public.is_adept_coach(adept_id));

grant select, insert, update on public.ai_plan_drafts to authenticated;
