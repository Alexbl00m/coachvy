/**
 * TSS och IF för ett pass i en biblioteksplan. Planens steg är andelar av en
 * referens, så TSS går att räkna utan atletens watt eller fart; steg i meter
 * får tid ur passets längd när ingen fart är given (se workouts/load.ts).
 *
 * Modulen är ren, utan anrop.
 */

import type { Sport } from "@/lib/calculators/lactate";
import {
  impliedReference,
  workoutLoad,
  type WorkoutLoad,
} from "@/lib/workouts/load";

import type { Variant } from "./types";

const SPORTS: Sport[] = ["cykling", "löpning", "simning"];

/** Grenen ett pass räknas i, eller null för pass utan struktur, som styrka. */
export const structureSport = (sport: string | null | undefined) =>
  SPORTS.includes(sport as Sport) ? (sport as Sport) : null;

/**
 * Passets belastning, eller null när det saknar steg eller gren. `reference`
 * är farten passet räknas mot när den är känd (löpplanernas loppfarter).
 */
export function variantLoad(
  variant: Pick<Variant, "basis" | "blocks" | "durationS">,
  sport: Sport | null,
  reference: number | null = null,
): WorkoutLoad | null {
  if (!sport || !variant.basis || !variant.blocks?.length) return null;
  const workout = { sport, basis: variant.basis, blocks: variant.blocks };
  return workoutLoad(
    workout,
    reference ?? impliedReference(workout, variant.durationS),
  );
}
