"use server";

import { revalidatePath } from "next/cache";

import { requireCoach } from "@/lib/auth/session";
import { adeptHref, routes } from "@/lib/routes";
import { todayIso } from "@/lib/season/season";
import { createClient } from "@/lib/supabase/server";

import { proposePeriodization } from "./periodization";
import { loadVersion } from "./queries";
import { closeGap, nextPhaseStart, type QueuedPhase } from "./queue";

export type QueueResult = { ok: true } | { ok: false; error: string };

const fail = (error: string): QueueResult => ({ ok: false, error });

function refresh(adeptId: string) {
  revalidatePath(adeptHref(adeptId, "bibliotek"));
  revalidatePath(routes.calendar);
  revalidatePath(routes.myPlan);
}

/** Adeptens faser, och att adepten är den inloggade coachens. */
async function coachQueue(adeptId: string) {
  const user = await requireCoach();
  const supabase = await createClient();
  const [{ data: adept }, { data: phases }] = await Promise.all([
    supabase.from("adepts").select("id, coach_id").eq("id", adeptId).maybeSingle(),
    supabase
      .from("plan_instances")
      .select("id, status, start_date, weeks")
      .eq("adept_id", adeptId),
  ]);
  if (!adept || adept.coach_id !== user.id) return null;
  return { user, supabase, phases: (phases ?? []) as QueuedPhase[] };
}

/**
 * Lägger en plan sist i adeptens kö: direkt efter den sista fasen, eller
 * på det valda datumet när kön är tom. Börjar den i dag eller tidigare och
 * ingen plan är aktiv blir den aktiv direkt.
 */
export async function queuePhase(input: {
  adeptId: string;
  versionId: string;
  weeks: number;
  levelId: string;
  startDate: string | null;
}): Promise<QueueResult> {
  const ctx = await coachQueue(input.adeptId);
  if (!ctx) return fail("Bara adeptens coach lägger faser i kön.");
  const { user, supabase, phases } = ctx;

  const content = await loadVersion(input.versionId);
  if (!content || content.version.status !== "publicerad") {
    return fail("Planen finns inte längre i biblioteket. Ladda om sidan.");
  }
  const { version, domain } = content;
  if (!domain.levels.some((l) => l.id === input.levelId)) return fail("Välj en nivå.");
  const weeks = Math.round(input.weeks);
  if (!(weeks >= version.min_weeks && weeks <= version.max_weeks)) {
    return fail(`Välj ${version.min_weeks}–${version.max_weeks} veckor.`);
  }

  const today = todayIso();
  const start = nextPhaseStart(phases, input.startDate, today);
  if (!start.ok) return fail(start.error);

  const proposal = proposePeriodization({
    phases: domain.phases,
    weeks: domain.weeks,
    minWeeks: version.min_weeks,
    maxWeeks: version.max_weeks,
    goal: { mode: "fritt", startDate: start.start },
    length: weeks,
  });
  if (!proposal.ok) return fail(proposal.error);

  const hasActive = phases.some((p) => p.status === "aktiv");
  const status = !hasActive && start.start <= today ? "aktiv" : "kommande";

  const { error } = await supabase.from("plan_instances").insert({
    adept_id: input.adeptId,
    template_id: version.template_id,
    version_id: version.id,
    title: version.title,
    status,
    start_date: proposal.startDate,
    weeks: proposal.length,
    goal_mode: "fritt",
    start_level_id: input.levelId,
    week_map: proposal.weekMap,
    pace_mode: "form",
    created_by: user.id,
  });
  if (error) return fail(error.message);

  refresh(input.adeptId);
  return { ok: true };
}

/**
 * Tar bort en kommande fas ur kön. Faserna efter den flyttas fram så att
 * kön hänger ihop. Den aktiva fasen avslutas i planvyn, inte här.
 */
export async function removeQueuedPhase(input: {
  adeptId: string;
  instanceId: string;
}): Promise<QueueResult> {
  const ctx = await coachQueue(input.adeptId);
  if (!ctx) return fail("Bara adeptens coach ändrar kön.");
  const { supabase, phases } = ctx;
  const target = phases.find((p) => p.id === input.instanceId);
  if (!target || target.status !== "kommande") {
    return fail("Bara en kommande fas kan tas bort ur kön.");
  }

  const moves = closeGap(phases, target.id);
  const { error } = await supabase
    .from("plan_instances")
    .update({ status: "avbruten" })
    .eq("id", target.id);
  if (error) return fail(error.message);
  // Flyttas i ordning, så att ingen fas krockar med nästa på vägen.
  for (const move of moves) {
    const { error: moveError } = await supabase
      .from("plan_instances")
      .update({ start_date: move.start_date })
      .eq("id", move.id);
    if (moveError) return fail(moveError.message);
  }

  refresh(input.adeptId);
  return { ok: true };
}
