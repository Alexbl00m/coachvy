/**
 * Passets steg som block: längd, höjd och zon – det profilen ritar.
 *
 * Blocken är små och serialiserbara, så att en lista med pass kan räkna fram
 * dem på servern och skicka dem vidare utan att skicka hela passet.
 */

import { zoneOf, type IntensityZone } from "./intensity";
import type { ResolvedStep, TargetBasis } from "./schema";

export type ProfileBlock = {
  seconds: number;
  /** Målet som procent av referensen – blockets höjd. */
  percent: number;
  zone: IntensityZone;
};

export function profileBlocks(
  steps: ResolvedStep[],
  reference: number,
  basis: TargetBasis,
): ProfileBlock[] {
  if (!(reference > 0)) return [];
  return steps.map((step) => ({
    seconds: step.seconds,
    percent: (step.target / reference) * 100,
    zone: zoneOf((step.lowFraction + step.highFraction) / 2, basis),
  }));
}
