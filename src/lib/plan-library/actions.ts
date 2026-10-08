"use server";

import { revalidatePath } from "next/cache";

import { isMember } from "@/lib/auth/membership";
import { requireSessionUser } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { saveRace } from "@/lib/season/actions";
import { addDays, todayIso } from "@/lib/season/season";
import { createClient } from "@/lib/supabase/server";

import { proposePeriodization } from "./periodization";
import { loadVersion } from "./queries";

/**
 * Medlemmens åtgärder i planbiblioteket. RLS avgör vem som får: adepten
 * själv och adeptens coach, så länge adepten är medlem.
 */

export type PlanResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

const fail = (error: string): PlanResult => ({ ok: false, error });

const dbError = (error: { message?: string; code?: string }) =>
  error.code === "42501" ||
  error.code === "23514" ||
  error.code === "23505" ||
  error.code === "P0001"
    ? fail(error.message ?? "Det gick inte.")
    : fail(`Det gick inte att spara: ${error.message ?? "okänt fel"}.`);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function refreshPlan() {
  revalidatePath(routes.myPlan);
  revalidatePath(routes.planLibrary, "layout");
  revalidatePath(routes.calendar);
  revalidatePath(routes.dashboard);
}

export type StartPlanInput = {
  versionId: string;
  goal:
    | {
        mode: "lopp";
        raceId: string | null;
        /** Ett nytt lopp, som läggs in i säsongsplanen som A-lopp. */
        newRace: { name: string; date: string } | null;
        weekStart: number;
      }
    | { mode: "fritt"; startDate: string };
  length: number;
  counts: Record<string, number> | null;
  levelId: string;
};

/**
 * Startar en plan: periodiseringen räknas om här med samma funktion som
 * förslaget, så att det som sparas är det medlemmen såg.
 */
export async function startPlan(input: StartPlanInput): Promise<PlanResult> {
  const user = await requireSessionUser();
  const adept = user.adept;
  if (user.profile?.role !== "adept" || !adept) {
    return fail("Planer startas av medlemmen själv.");
  }
  if (!isMember(user)) return fail("Planbiblioteket ingår i medlemskapet.");

  const content = await loadVersion(input.versionId);
  if (!content || content.version.status !== "publicerad") {
    return fail("Planen finns inte längre i biblioteket. Ladda om sidan.");
  }
  const { version, domain } = content;
  if (!domain.levels.some((l) => l.id === input.levelId)) {
    return fail("Välj en nivå.");
  }

  const today = todayIso();
  const supabase = await createClient();
  let raceId: string | null = null;
  let raceDate: string | null = null;

  if (input.goal.mode === "lopp") {
    if (input.goal.newRace) {
      const { name, date } = input.goal.newRace;
      if (!ISO_DATE.test(date)) return fail("Välj loppets datum.");
      const saved = await saveRace({
        adeptId: adept.id,
        name,
        raceDate: date,
        sport: null,
        distance: null,
        priority: "A",
        target: null,
        note: null,
      });
      if (!saved.ok) return fail(saved.error);
      raceId = saved.id;
      raceDate = date;
    } else if (input.goal.raceId) {
      const { data: race } = await supabase
        .from("adept_races")
        .select("id, race_date")
        .eq("id", input.goal.raceId)
        .eq("adept_id", adept.id)
        .maybeSingle();
      if (!race) return fail("Loppet hittades inte.");
      raceId = race.id;
      raceDate = race.race_date;
    } else {
      return fail("Välj ett lopp.");
    }
  } else if (!ISO_DATE.test(input.goal.startDate)) {
    return fail("Välj ett startdatum.");
  } else if (input.goal.startDate < addDays(today, -6)) {
    return fail("Planen kan inte börja mer än en vecka bakåt i tiden.");
  }

  const proposal = proposePeriodization({
    phases: domain.phases,
    weeks: domain.weeks,
    minWeeks: version.min_weeks,
    maxWeeks: version.max_weeks,
    goal:
      input.goal.mode === "lopp"
        ? {
            mode: "lopp",
            raceDate: raceDate!,
            earliest: today,
            weekStart: Math.max(
              0,
              Math.min(6, Math.round(input.goal.weekStart)),
            ),
          }
        : { mode: "fritt", startDate: input.goal.startDate },
    length: input.length,
    counts: input.counts ?? undefined,
  });
  if (!proposal.ok) return fail(proposal.error);

  const { data, error } = await supabase
    .from("plan_instances")
    .insert({
      adept_id: adept.id,
      template_id: version.template_id,
      version_id: version.id,
      title: version.title,
      start_date: proposal.startDate,
      weeks: proposal.length,
      goal_mode: input.goal.mode,
      race_id: raceId,
      race_date: raceDate,
      start_level_id: input.levelId,
      week_map: proposal.weekMap,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return dbError(error);

  refreshPlan();
  return { ok: true, id: data.id };
}
