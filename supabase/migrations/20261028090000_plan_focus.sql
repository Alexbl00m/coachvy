-- Coachvy – planens fokus: vad planen utvecklar.
--
-- Kategorin säger vilket lopp planen leder mot (maraton, cykel …). Fokus
-- säger vilken egenskap den bygger, och är det appen föreslår planer efter:
-- testet och huvudloppet pekar ut ett fokus, och planerna med det fokuset
-- visas med motiveringen.
--
--   grund       grundträning: aerob volym, polariserat
--   tak         lyft taket: grundperiod som leder in i ett VO2max-block
--   vo2max      boosta VO2max: ett koncentrerat block på 3–4 veckor
--   troskel     höj tröskeln: LT2 och utnyttjandegraden
--   styrka      styrka på cykeln: kraft på låg kadens och tung styrka
--   ultra       ultra: långa lopp, energi och tid på cykeln
--   durability  hålla effekten efter timmar av arbete

alter table public.plan_templates
  add column if not exists focus text
    check (focus is null or focus in (
      'grund', 'tak', 'vo2max', 'troskel', 'styrka', 'ultra', 'durability'
    ));

comment on column public.plan_templates.focus is
  'Vad planen utvecklar. Appen föreslår planer efter fokus ur test och huvudlopp.';

create index if not exists plan_templates_focus_idx
  on public.plan_templates (focus) where focus is not null;

-- En kopia behåller fokuset.
create or replace function public.copy_plan_template(p_template uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.plan_templates%rowtype;
  v_src public.plan_template_versions%rowtype;
  v_own boolean;
  v_base text;
  v_slug text;
  v_n int := 2;
  v_template uuid;
  v_version uuid;
begin
  if not public.can_build_plans() then
    raise exception 'Att bygga planer ingår i medlemskapet för coacher.' using errcode = '42501';
  end if;
  select * into t from public.plan_templates where id = p_template;
  if not found then
    raise exception 'Planen finns inte.' using errcode = 'P0002';
  end if;
  v_own := coalesce(t.owner_id = auth.uid(), false) or public.is_admin();
  if not v_own and not (t.archived_at is null and public.template_shared_with_me(t.id, t.owner_id)) then
    raise exception 'Planen är inte delad med dig.' using errcode = '42501';
  end if;

  select * into v_src from public.plan_template_versions
    where template_id = p_template
      and (v_own or status = 'publicerad')
    order by version desc limit 1;
  if not found then
    raise exception 'Planen har ingen version att kopiera.' using errcode = 'P0002';
  end if;

  v_base := left(regexp_replace(t.slug, '-kopia(-[0-9]+)?$', ''), 52) || '-kopia';
  v_slug := v_base;
  while exists (select 1 from public.plan_templates where slug = v_slug) loop
    v_slug := v_base || '-' || v_n;
    v_n := v_n + 1;
  end loop;

  insert into public.plan_templates (slug, category_id, race_distance_m, focus, created_by, owner_id)
  values (v_slug, t.category_id, t.race_distance_m, t.focus, auth.uid(), auth.uid())
  returning id into v_template;

  insert into public.plan_template_versions (
    template_id, version, status, title, summary, goal, description,
    prerequisites, min_weeks, max_weeks, volume_unit, created_by
  ) values (
    v_template, 1, 'utkast',
    left(case when t.owner_id = auth.uid() then v_src.title || ' (kopia)' else v_src.title end, 120),
    v_src.summary, v_src.goal, v_src.description, v_src.prerequisites,
    v_src.min_weeks, v_src.max_weeks, v_src.volume_unit, auth.uid()
  ) returning id into v_version;

  perform public.copy_plan_version_content(v_src.id, v_version);
  return v_template;
end;
$$;

revoke all on function public.copy_plan_template(uuid) from public, anon;
grant execute on function public.copy_plan_template(uuid) to authenticated;
