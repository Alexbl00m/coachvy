import type { SessionGoal } from "@/lib/season/distribution";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { Summary } from "./analysis";
import {
  classifyActivity,
  effectiveGoal,
  type GoalSource,
} from "./intensity-class";

/** Ett genomfört pass i fördelningen. */
export type DoneGoal = {
  id: string;
  date: string;
  sport: string;
  /** Tävlingar räknas för sig: riktmärkena gäller träningen. */
  isRace: boolean;
  goal: SessionGoal | null;
  source: GoalSource | null;
};

type Row = {
  id: string;
  sport: string;
  performed_on: string;
  is_race: boolean;
  race_id: string | null;
  intensity: SessionGoal | null;
  moving_s: number | null;
  elapsed_s: number | null;
  power_zones: Summary["powerZones"];
  hr_zones: Summary["hrZones"];
  above: number | null;
};

/**
 * De genomförda passen mellan två datum, klassade efter huvudsyfte: coachens
 * klassning, annars AI-sammanfattningens, annars den automatiska ur zonerna.
 */
export async function listDoneGoals(
  adeptId: string,
  from: string,
  to: string,
): Promise<DoneGoal[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select(
      "id, sport, performed_on, is_race, race_id, intensity, moving_s:summary->movingS, elapsed_s:summary->elapsedS, power_zones:summary->powerZones, hr_zones:summary->hrZones, above:summary->aboveCriticalS",
    )
    .eq("adept_id", adeptId)
    .gte("performed_on", from)
    .lte("performed_on", to)
    .order("performed_on", { ascending: true });
  // Migrationen är inte körd: utan kolumnen räknas inga genomförda pass.
  if (error) return [];
  const rows = (data ?? []) as unknown as Row[];
  if (rows.length === 0) return [];

  const { data: summaries } = await supabase
    .from("activity_summaries")
    .select("activity_id, intensity")
    .in(
      "activity_id",
      rows.map((r) => r.id),
    );
  const fromSummary = new Map(
    (summaries ?? []).map((s) => [s.activity_id, s.intensity]),
  );

  return rows.map((r) => {
    const automatic = classifyActivity(
      {
        movingS: Number(r.moving_s ?? 0),
        elapsedS: Number(r.elapsed_s ?? 0),
        powerZones: r.power_zones,
        hrZones: r.hr_zones,
        aboveCriticalS: r.above === null ? null : Number(r.above),
      },
      r.sport,
    );
    const effective = effectiveGoal({
      coach: r.intensity,
      summary: fromSummary.get(r.id) ?? null,
      automatic,
    });
    return {
      id: r.id,
      date: r.performed_on,
      sport: r.sport,
      isRace: r.is_race || r.race_id !== null,
      goal: effective?.goal ?? null,
      source: effective?.source ?? null,
    };
  });
}
