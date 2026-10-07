import "server-only";

import {
  inPeriod,
  periodRange,
  type ProfileSource,
} from "@/lib/activities/profile";
import { listActivities } from "@/lib/activities/queries";
import { getAdeptProfile } from "@/lib/adepts/profile";
import { listRaces } from "@/lib/season/queries";
import { todayIso } from "@/lib/season/season";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { protocolByKey } from "@/lib/tests/protocols";
import { listFullSessions } from "@/lib/tests/session-queries";
import type { Adept } from "@/lib/types/database";
import { computeGoals } from "./goals";
import { powerProfileRows } from "./power-profile";
import { parseReferenceLevels, type ReferenceLevels } from "./reference-levels";
import { benchmarkSummary } from "./summary";

/**
 * Coachens referensgrupper, eller appens utgångsvärden. Adepter läser sin
 * coachs rad (RLS: current_coach_id), så samma anrop fungerar för båda.
 */
export async function referenceLevelsFor(
  coachId: string | null,
): Promise<ReferenceLevels> {
  if (!coachId || !isSupabaseConfigured()) return parseReferenceLevels(null);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coaches")
    .select("reference_levels")
    .eq("id", coachId)
    .maybeSingle();
  // Kolumnen finns inte förrän migrationen körts: utgångsvärdena gäller.
  if (error || !data) return parseReferenceLevels(null);
  return parseReferenceLevels(
    (data as { reference_levels?: unknown }).reference_levels ?? null,
  );
}

/**
 * Gap-analysen och effektprofilen som text, för AI-coachens underlag.
 * Effektprofilen räknas över 90 dagar, eller 12 månader när de senaste 90
 * dagarna har färre än tre cykelpass med effekt.
 */
export async function benchmarkSummaryFor(
  adept: Adept,
): Promise<string | null> {
  const [levels, profile, activities, races, sessions] = await Promise.all([
    referenceLevelsFor(adept.coach_id),
    getAdeptProfile(adept.id),
    listActivities(adept.id),
    listRaces(adept.id),
    listFullSessions(adept.id),
  ]);
  const today = todayIso();
  const sources: ProfileSource[] = activities.map((a) => ({
    id: a.id,
    name: a.name,
    sport: a.sport,
    performed_on: a.performed_on,
    curve: a.curve,
    best: a.sport === "löpning" ? a.best : null,
  }));
  const goals = computeGoals({
    targetLevel: adept.target_level,
    sessions,
    profileSex: profile?.sex ?? null,
    sources,
    races,
    levels,
    today,
    protocolLabel: (key) => protocolByKey(key)?.label ?? key,
  });

  let power: Parameters<typeof benchmarkSummary>[0]["power"] = null;
  const weightKg = goals.values.weightKg;
  if (weightKg) {
    const ninety = periodRange(90, today);
    const year = periodRange(365, today);
    const recent =
      inPeriod(sources, "power", ninety.from, ninety.to).length >= 3;
    const range = recent ? ninety : year;
    power = {
      rows: powerProfileRows({
        sources,
        weightKg,
        sex: goals.sex,
        testFtp: goals.values.ftp,
        from: range.from,
        to: range.to,
      }),
      sex: goals.sex,
      sexKnown: goals.values.sex !== null,
      weightKg,
      period: recent ? "senaste 90 dagarna" : "senaste 12 månaderna",
    };
  }

  return benchmarkSummary({
    goals,
    levelsAreDefault: levels.isDefault,
    power,
  });
}
