/**
 * Ett genomfört pass klassat efter sitt huvudsyfte: lugnt, medel eller högt.
 *
 * Filosofins avsnitt 19 räknar fördelningen per pass efter huvudsyftet, inte
 * efter minuter i zon: ett VO₂max-pass är högt även om det mest är uppvärmning
 * och vila, ett distanspass med några stegringar är lugnt. För de planerade
 * passen läses syftet ur stegen (`sessionGoal`); här läses det ur vad som
 * faktiskt gjordes:
 *
 * - **Högt** när minst 8 minuter låg över LT2 – över CP (CS), eller i
 *   effektzon 5 och uppåt – och det är minst 6 % av passet. Pulsen ligger
 *   efter i korta intervaller, så med bara puls räcker 6 minuter i zon 5.
 * - **Medel** när minst 20 minuter låg mellan trösklarna (zon 3–4) och det är
 *   minst 15 % av passet.
 * - **Lugnt** annars.
 *
 * Gränserna är tumregler. Klassningen visar alltid vad den bygger på, och
 * coachen kan sätta en egen – den går före, liksom AI-sammanfattningens, som
 * läst passet mot planen.
 *
 * Modulen är ren, utan anrop.
 */

import type { SessionGoal } from "@/lib/season/distribution";
import type { Summary } from "./analysis";

const HIGH_MIN_S = 8 * 60;
const HIGH_MIN_S_HR = 6 * 60;
const HIGH_SHARE = 0.06;
const MID_MIN_S = 20 * 60;
const MID_SHARE = 0.15;

export type ActivityGoal = {
  goal: SessionGoal;
  /** Vad klassningen bygger på, i ord. */
  reason: string;
};

const minutes = (s: number) => `${Math.round(s / 60)} min`;

/** Tid i zonerna i tre band: zon 1–2, 3–4 och 5 och uppåt. */
function bands(zones: { seconds: number }[] | null) {
  if (!zones || zones.length < 5) return null;
  const sum = (from: number, to: number) =>
    zones.slice(from, to).reduce((s, z) => s + z.seconds, 0);
  return { low: sum(0, 2), mid: sum(2, 4), high: sum(4, zones.length) };
}

/** Den automatiska klassningen, eller null när passet saknar underlag. */
export function classifyActivity(
  summary: Pick<
    Summary,
    "movingS" | "elapsedS" | "powerZones" | "hrZones" | "aboveCriticalS"
  >,
  sport: string,
): ActivityGoal | null {
  if (sport !== "cykling" && sport !== "löpning") return null;
  const power = bands(summary.powerZones);
  const hr = bands(summary.hrZones);
  const above = summary.aboveCriticalS ?? 0;
  if (!power && !hr && !(above > 0)) return null;

  const total = summary.movingS || summary.elapsedS || 1;
  const threshold = sport === "cykling" ? "CP" : "CS";

  // Över LT2: effekten (eller farten mot CS) väger tyngst; pulsen bara utan.
  const measured = Math.max(power?.high ?? 0, above);
  const viaHr = measured === 0 && hr !== null;
  const high = viaHr ? hr.high : measured;
  const highMin = viaHr ? HIGH_MIN_S_HR : HIGH_MIN_S;
  if (high >= highMin && high / total >= HIGH_SHARE) {
    return {
      goal: "hög",
      reason: viaHr
        ? `${minutes(high)} i pulszon 5`
        : above >= (power?.high ?? 0)
          ? `${minutes(high)} över ${threshold}`
          : `${minutes(high)} i effektzon 5 och uppåt`,
    };
  }

  const mid = power?.mid ?? hr?.mid ?? 0;
  if (mid >= MID_MIN_S && mid / total >= MID_SHARE) {
    return {
      goal: "medel",
      reason: `${minutes(mid)} mellan trösklarna (${power ? "effekt" : "puls"}zon 3–4)`,
    };
  }

  return {
    goal: "lugn",
    reason:
      high >= 60
        ? `huvudsakligen under LT1, ${minutes(high)} över LT2`
        : "huvudsakligen under LT1",
  };
}

export type GoalSource = "coach" | "sammanfattning" | "automatisk";

export const GOAL_SOURCE_TEXT: Record<GoalSource, string> = {
  coach: "satt av coachen",
  sammanfattning: "ur AI-sammanfattningen",
  automatisk: "automatisk",
};

/** AI-sammanfattningens ord i fördelningens. */
export const GOAL_OF_SUMMARY: Record<string, SessionGoal> = {
  lugnt: "lugn",
  medel: "medel",
  högt: "hög",
};

/**
 * Passets klassning: coachens går före, sedan AI-sammanfattningens, sist den
 * automatiska.
 */
export function effectiveGoal(input: {
  coach: SessionGoal | null;
  summary: string | null;
  automatic: ActivityGoal | null;
}): { goal: SessionGoal; source: GoalSource; reason: string | null } | null {
  if (input.coach) return { goal: input.coach, source: "coach", reason: null };
  const fromSummary = input.summary ? GOAL_OF_SUMMARY[input.summary] : null;
  if (fromSummary)
    return { goal: fromSummary, source: "sammanfattning", reason: null };
  if (input.automatic)
    return {
      goal: input.automatic.goal,
      source: "automatisk",
      reason: input.automatic.reason,
    };
  return null;
}
