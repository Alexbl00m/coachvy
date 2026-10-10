-- Coachvy – planbiblioteket, del 4: loppdistans och fler formtider.
--
-- Fyra saker:
--
--   plan_templates.race_distance_m
--                            loppet planen leder fram till: 5 km, 10 km,
--                            halvmaraton eller maraton. Måltiden gäller den
--                            distansen, och tempona räknas ur farten på den.
--   fitness_estimates        en 10 km-tid och en halvmaratontid bredvid 5 km
--                            och maraton. Tiden närmast loppet styr.
--   plan_instances.goal_seconds
--                            en måltid för vilken av distanserna som helst,
--                            inte bara maraton.
--   basis 10K och HM         passens mål i procent av milfart eller
--                            halvmaratonfart.

-- ---------------------------------------------------------------------------
-- Loppdistansen
-- ---------------------------------------------------------------------------

alter table public.plan_templates
  add column if not exists race_distance_m numeric
    check (race_distance_m is null or race_distance_m in (5000, 10000, 21097.5, 42195));

comment on column public.plan_templates.race_distance_m is
  'Loppet planen leder fram till, i meter. Null: ingen bestämd distans.';

-- Löpkategorierna har en självklar distans.
update public.plan_templates t
set race_distance_m = case c.key
    when 'maraton' then 42195
    when 'halvmaraton' then 21097.5
    when '10-km' then 10000
  end
from public.plan_categories c
where c.id = t.category_id
  and t.race_distance_m is null
  and c.key in ('maraton', 'halvmaraton', '10-km');

-- ---------------------------------------------------------------------------
-- Formtiderna
-- ---------------------------------------------------------------------------

alter table public.fitness_estimates
  add column if not exists ten_k_seconds numeric
    check (ten_k_seconds is null or ten_k_seconds > 0);
alter table public.fitness_estimates
  add column if not exists half_seconds numeric
    check (half_seconds is null or half_seconds > 0);

alter table public.fitness_estimates
  drop constraint if exists fitness_estimates_check;
alter table public.fitness_estimates
  add constraint fitness_estimates_check
  check (
    five_k_seconds is not null or ten_k_seconds is not null
    or half_seconds is not null or marathon_seconds is not null
  );

-- ---------------------------------------------------------------------------
-- Måltiden
-- ---------------------------------------------------------------------------

-- Från en snabb 5 km till ett långsamt maraton. Rimligheten per distans
-- prövas i appen, som vet vilket lopp planen gäller.
alter table public.plan_instances
  drop constraint if exists plan_instances_goal_seconds_check;
alter table public.plan_instances
  add constraint plan_instances_goal_seconds_check
  check (goal_seconds is null or (goal_seconds >= 600 and goal_seconds <= 28800));

-- ---------------------------------------------------------------------------
-- Fartbaserna
-- ---------------------------------------------------------------------------

alter table public.plan_template_session_variants
  drop constraint if exists plan_template_session_variants_basis_check;
alter table public.plan_template_session_variants
  add constraint plan_template_session_variants_basis_check
  check (basis is null or basis in ('FTP', 'CP', 'CS', 'CSS', 'LT2', '5K', '10K', 'HM', 'MP'));
