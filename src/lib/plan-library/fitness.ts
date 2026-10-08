import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { listFullSessions } from "@/lib/tests/session-queries";
import { speedProfile } from "@/lib/tests/speed-profile";

import {
  completeEstimate,
  currentEstimate,
  estimateFromProfile,
  referenceSpeeds,
  type FitnessEstimate,
  type ReferenceSpeeds,
} from "./paces";
import type { Row } from "./queries";

export type EstimateRow = Row<"fitness_estimates">;

export type RunningFitness = {
  /** Den som gäller: den nyaste av testerna och de inskrivna. */
  current: FitnessEstimate | null;
  /** Uppskattningen ur testerna och loppen, om någon. */
  fromTests: FitnessEstimate | null;
  /** De inskrivna, nyast först. */
  entries: EstimateRow[];
  /** Farterna passens procent räknas mot. */
  refs: ReferenceSpeeds;
};

const toSpeed = (value: number, unit: string) =>
  unit === "m/s" ? value : unit === "km/h" ? value / 3.6 : null;

/**
 * Löparens formuppskattning: testerna och loppen genom fartprofilen, och
 * tiderna adepten eller coachen skrivit in. CS och LT2 följer med när de
 * finns, för planer som räknar mot dem.
 */
export async function loadRunningFitness(
  adeptId: string,
): Promise<RunningFitness> {
  const empty: RunningFitness = {
    current: null,
    fromTests: null,
    entries: [],
    refs: {},
  };
  if (!isSupabaseConfigured()) return empty;
  const supabase = await createClient();
  const [sessions, { data: entries, error }] = await Promise.all([
    listFullSessions(adeptId),
    supabase
      .from("fitness_estimates")
      .select("*")
      .eq("adept_id", adeptId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const rows = error ? [] : (entries ?? []);

  const profile = speedProfile(sessions);
  const fromTests = estimateFromProfile(profile);
  const latest = rows[0];
  const manual = latest
    ? completeEstimate({
        fiveKSeconds: latest.five_k_seconds,
        marathonSeconds: latest.marathon_seconds,
        source: "manuell",
        date: latest.created_at.slice(0, 10),
        note: latest.note,
      })
    : null;
  const current = currentEstimate(fromTests, manual);

  // LT2 ur det senaste löptestet som har en.
  let lt2: number | null = null;
  for (const s of [...sessions].reverse()) {
    if (s.sport !== "löpning") continue;
    const m = s.test_metrics.find(
      (x) => x.key === "LT2" && (x.is_primary || !x.method),
    );
    const speed = m ? toSpeed(Number(m.value), m.unit) : null;
    if (speed && speed > 0) {
      lt2 = speed;
      break;
    }
  }

  return {
    current,
    fromTests,
    entries: rows,
    refs: referenceSpeeds(current, { cs: profile?.cs?.speed ?? null, lt2 }),
  };
}
