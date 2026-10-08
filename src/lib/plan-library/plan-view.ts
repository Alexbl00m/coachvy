import "server-only";

import type { CalendarWorkout } from "@/lib/calendar/queries";
import type { Sport } from "@/lib/calculators/lactate";
import { routes } from "@/lib/routes";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

import { planContext, planContextToText } from "./context";
import { hoursMinutes } from "./labels";
import { levelForWeek } from "./levels";
import { spansFromWeekMap, type PhaseSpan } from "./periodization";
import { templateProfile } from "./profile";
import {
  listDisciplines,
  loadInstance,
  type DisciplineRow,
  type InstanceContent,
} from "./queries";
import { buildSchedule, currentPlanWeek, type ScheduleWeek } from "./schedule";
import type { Level, LevelChange, Override, SessionLog } from "./types";

/**
 * Allt planvyn, kalendern, översikten och AI-underlaget behöver om en
 * startad plan, räknat en gång.
 */
export type PlanView = InstanceContent & {
  levels: Level[];
  spans: PhaseSpan[];
  schedule: ScheduleWeek[];
  /** Nivåhistoriken som planbibliotekets begrepp; `changes` är raderna. */
  history: (LevelChange & { id: string })[];
  currentWeek: number;
  currentLevelId: string;
  /** Planen har inte börjat ännu. */
  notStarted: boolean;
  /** Planen är slut i tid. */
  finished: boolean;
  disciplines: DisciplineRow[];
};

export const toChange = (
  r: InstanceContent["changes"][number],
): LevelChange & { id: string } => ({
  id: r.id,
  effectiveWeek: r.effective_week,
  fromLevelId: r.from_level_id,
  toLevelId: r.to_level_id,
  kind: r.kind,
  reason: r.reason,
  source: r.source,
  groupId: r.group_id,
  note: r.note,
  createdAt: r.created_at,
  revokedAt: r.revoked_at,
});

const toOverride = (r: InstanceContent["overrides"][number]): Override => ({
  sessionId: r.session_id,
  planWeek: r.plan_week,
  action: r.action,
  movedTo: r.moved_to,
  workoutId: r.workout_id,
  note: r.note,
});

const toLog = (r: InstanceContent["logs"][number]): SessionLog => ({
  sessionId: r.session_id,
  planWeek: r.plan_week,
  status: r.status,
  activityId: r.activity_id,
  rpe: r.rpe,
  note: r.note,
});

export async function loadPlanView(
  instanceId: string,
  today: string,
): Promise<PlanView | null> {
  const [data, disciplines] = await Promise.all([
    loadInstance(instanceId),
    listDisciplines(),
  ]);
  if (!data) return null;
  const { instance, content } = data;
  const weekMap = instance.week_map as string[];
  const history = data.changes.map(toChange);
  const schedule = buildSchedule({
    startDate: instance.start_date,
    weekMap,
    templateWeeks: content.domain.weeks,
    sessions: content.domain.sessions,
    startLevelId: instance.start_level_id,
    changes: history,
    overrides: data.overrides.map(toOverride),
    logs: data.logs.map(toLog),
  });
  const currentWeek = currentPlanWeek(
    instance.start_date,
    instance.weeks,
    today,
  );
  return {
    ...data,
    levels: content.domain.levels,
    spans: spansFromWeekMap({
      startDate: instance.start_date,
      weekMap,
      weeks: content.domain.weeks,
      phases: content.domain.phases,
    }),
    schedule,
    history,
    currentWeek,
    currentLevelId: levelForWeek(instance.start_level_id, history, currentWeek),
    notStarted: today < instance.start_date,
    finished: today > schedule.at(-1)!.endsOn,
    disciplines,
  };
}

/** Den aktiva planens id för en adept, eller null. */
export async function activeInstanceId(
  adeptId: string,
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plan_instances")
    .select("id")
    .eq("adept_id", adeptId)
    .eq("status", "aktiv")
    .maybeSingle();
  if (error) return null;
  return data?.id ?? null;
}

const SPORTS: Sport[] = ["cykling", "löpning", "simning"];

/**
 * Planens pass i ett datumintervall, i kalenderns form. Utan adept: alla
 * aktiva planer kontot ser – coachens adepter, eller adeptens egen.
 */
export async function listPlanSessionsBetween(
  from: string,
  to: string,
  adeptId: string | null,
  today: string,
): Promise<CalendarWorkout[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  let query = supabase
    .from("plan_instances")
    .select("id, adept_id, start_date, weeks")
    .eq("status", "aktiv")
    .lte("start_date", to);
  if (adeptId) query = query.eq("adept_id", adeptId);
  const { data, error } = await query;
  if (error || !data) return [];

  const relevant = data.filter(
    (i) => addDaysIso(i.start_date, i.weeks * 7 - 1) >= from,
  );
  if (relevant.length === 0) return [];

  const [{ data: adepts }, { data: auth }] = await Promise.all([
    supabase
      .from("adepts")
      .select("id, full_name, profile_id")
      .in(
        "id",
        relevant.map((i) => i.adept_id),
      ),
    supabase.auth.getUser(),
  ]);

  const out: CalendarWorkout[] = [];
  for (const instance of relevant) {
    const view = await loadPlanView(instance.id, today);
    if (!view) continue;
    // Adepten själv hamnar på Min plan, coachen på adeptens plan.
    const own =
      adepts?.find((a) => a.id === instance.adept_id)?.profile_id ===
      auth.user?.id;
    const href = own
      ? routes.myPlan
      : `${routes.adepts}/${instance.adept_id}/plan`;
    for (const week of view.schedule) {
      if (week.endsOn < from || week.startsOn > to) continue;
      for (const s of week.sessions) {
        if (!s.date || s.date < from || s.date > to) continue;
        if (s.state === "struken") continue;
        const sport = view.disciplines.find(
          (d) => d.key === s.session.discipline,
        )?.structure_sport;
        out.push({
          id: `plan-${instance.id}-${s.key}`,
          adeptId: instance.adept_id,
          adeptName:
            adepts?.find((a) => a.id === instance.adept_id)?.full_name ?? "",
          date: s.date,
          title: s.session.title,
          sport: SPORTS.includes(sport as Sport) ? (sport as Sport) : "annat",
          duration: hoursMinutes(s.variant.durationS) || null,
          summary: [
            `${view.instance.title}, vecka ${s.week}`,
            s.log?.status === "genomförd"
              ? "genomfört"
              : s.log?.status === "hoppad"
                ? "hoppat över"
                : null,
          ]
            .filter(Boolean)
            .join(" · "),
          profile: templateProfile(s.variant.blocks, s.variant.basis),
          href: `${href}?vecka=${s.week}`,
          fromPlan: true,
        });
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

const addDaysIso = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);

/** Planen i text för AI-coachens underlag, eller null utan aktiv plan. */
export async function planSummaryFor(
  adeptId: string,
  today: string,
): Promise<string | null> {
  const id = await activeInstanceId(adeptId);
  if (!id) return null;
  const view = await loadPlanView(id, today);
  if (!view) return null;
  const race = view.instance.race_date
    ? {
        name: null as string | null,
        date: view.instance.race_date,
      }
    : null;
  return planContextToText(
    planContext({
      title: view.instance.title,
      startDate: view.instance.start_date,
      weeks: view.instance.weeks,
      currentWeek: view.currentWeek,
      race,
      levels: view.levels,
      startLevelId: view.instance.start_level_id,
      changes: view.history,
      phases: view.spans,
      schedule: view.schedule,
    }),
  );
}

/** Adeptens egna pass, att ersätta ett planpass med. */
export async function listWorkoutOptions(
  adeptId: string,
): Promise<{ id: string; title: string }[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("workouts")
    .select("id, title")
    .eq("adept_id", adeptId)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

/** Får den inloggade ändra adeptens plan just nu? */
export async function canEditPlan(adeptId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = await createClient();
  const { data } = await supabase.rpc("can_edit_plan", { adept: adeptId });
  return data === true;
}
