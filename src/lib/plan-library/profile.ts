/**
 * Profilen för ett pass i en mall, utan någon atlet.
 *
 * Mallens mål är andelar av en bas, och profilen ritar just andelarna. För
 * steg angivna i meter behövs en fart för att få en längd i tid, så de räknas
 * mot en tänkt atlet – det påverkar bara hur breda blocken blir, inte höjden
 * eller zonen. När planen följs räknas passet mot medlemmens egna värden.
 *
 * Modulen är ren.
 */

import type { Sport } from "@/lib/calculators/lactate";
import { profileBlocks, type ProfileBlock } from "@/lib/workouts/blocks";
import {
  resolveWorkout,
  type TargetBasis,
  type WorkoutBlock,
} from "@/lib/workouts/schema";

const NOMINAL: Record<TargetBasis, { sport: Sport; reference: number }> = {
  FTP: { sport: "cykling", reference: 250 },
  CP: { sport: "cykling", reference: 250 },
  CS: { sport: "löpning", reference: 4.2 },
  LT2: { sport: "löpning", reference: 4.2 },
  CSS: { sport: "simning", reference: 1.35 },
  "5K": { sport: "löpning", reference: 4.37 },
  MP: { sport: "löpning", reference: 3.68 },
};

export const sportForBasis = (basis: TargetBasis): Sport =>
  NOMINAL[basis].sport;

export function templateProfile(
  blocks: WorkoutBlock[] | null,
  basis: TargetBasis | null,
): ProfileBlock[] {
  if (!blocks || !basis) return [];
  const { sport, reference } = NOMINAL[basis];
  const resolved = resolveWorkout(
    { title: "", sport, summary: "", rationale: "", basis, blocks },
    reference,
  );
  return profileBlocks(resolved.steps, reference, basis);
}
