/**
 * Zonerna läst mot Mader-kurvan: bränsle vid zonens mitt och modellens puls
 * vid zonens gränser. Rena funktioner, så att både testsidan (på servern) och
 * kalkylen (i webbläsaren) kan använda dem.
 */

import type { MetabolicPoint } from "./metabolic";
import type { ZoneRow } from "@/lib/tests/zones";

const nearest = (points: MetabolicPoint[], power: number) =>
  points.reduce((best, p) =>
    Math.abs(p.power - power) < Math.abs(best.power - power) ? p : best,
  );

/**
 * Fett och kolhydrat i g/h vid zonens mitt. Den översta zonen saknar övre
 * gräns och läses tio procent ovanför sin undre.
 */
export function fuelByZone(
  zones: ZoneRow[],
  points: MetabolicPoint[],
): ({ fat: number; carbs: number } | null)[] {
  if (points.length === 0) return zones.map(() => null);
  const top = points[points.length - 1].power;
  return zones.map((z) => {
    const low = z.min ?? 0;
    const high = z.max ?? low * 1.1;
    const mid = (low + high) / 2;
    if (!(mid > 0) || mid > top) return null;
    const p = nearest(points, mid);
    return { fat: p.fatPerHour, carbs: p.carbsPerHour };
  });
}

/** Modellens puls vid zonernas gränser, när maxpulsen är känd. */
export function heartRateByZone(
  zones: ZoneRow[],
  points: MetabolicPoint[],
): [number | null, number | null][] | undefined {
  if (points.length === 0 || points.every((p) => p.heartRate === null)) {
    return undefined;
  }
  const top = points[points.length - 1].power;
  const at = (power: number | null) =>
    power === null || power > top ? null : nearest(points, power).heartRate;
  return zones.map((z) => [at(z.min), at(z.max)]);
}
