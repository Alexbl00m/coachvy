/**
 * Passet i korthet, för kort och listor: arbetet som "3×5 min" och tiden som
 * "41 min". Ren modul.
 */

import { formatAmount } from "@/lib/plan-library/structure";
import type { ProfileBlock } from "./blocks";
import type { WorkoutBlock, WorkoutStep } from "./schema";

/**
 * Arbetet i passets första repetition: "3×5 min", "8×400 m". Arbetssteget är
 * intervallsteget, eller det hårdaste om inget är märkt. Null när passet
 * saknar repetitioner – då är det inget arbete att räkna.
 */
export function workText(blocks: WorkoutBlock[]): string | null {
  const reps = blocks.find((b) => b.type === "repetition");
  if (!reps || reps.type !== "repetition" || reps.steps.length === 0)
    return null;
  const hardest = (a: WorkoutStep, b: WorkoutStep) =>
    b.low + b.high > a.low + a.high ? b : a;
  const work =
    reps.steps.find((s) => s.kind === "intervall") ??
    reps.steps.reduce(hardest);
  return `${reps.times}×${formatAmount(work)}`;
}

/** Profilens tid i sekunder. */
export const profileSeconds = (blocks: ProfileBlock[]) =>
  blocks.reduce((sum, b) => sum + b.seconds, 0);
