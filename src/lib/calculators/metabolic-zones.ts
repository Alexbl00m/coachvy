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

/** Spannet för fett och kolhydrat vid en punkt, g/h. */
export type FuelBand = {
  fat: [number, number];
  carbs: [number, number];
};

/** VLamax typiska fel i referensmodellen, mmol/l/s. */
export const VLAMAX_SPREAD = 0.04;

/**
 * Osäkerhetsbandet runt bränslekurvorna: samma modell med VLamax ± spread.
 * `compute` räknar kurvan för en VLamax med allt annat lika, så att punkterna
 * hamnar på samma effekter och kan läggas bredvid varandra index för index.
 */
export function fuelBand(
  compute: (vlamax: number) => MetabolicPoint[],
  vlamax: number,
  spread = VLAMAX_SPREAD,
): FuelBand[] {
  const low = compute(Math.max(vlamax - spread, 0.05));
  const high = compute(vlamax + spread);
  const mid = compute(vlamax);
  return mid.map((p, i) => {
    const fats = [p.fatPerHour, low[i]?.fatPerHour, high[i]?.fatPerHour].filter(
      (v): v is number => v !== undefined,
    );
    const carbs = [
      p.carbsPerHour,
      low[i]?.carbsPerHour,
      high[i]?.carbsPerHour,
    ].filter((v): v is number => v !== undefined);
    return {
      fat: [Math.min(...fats), Math.max(...fats)],
      carbs: [Math.min(...carbs), Math.max(...carbs)],
    };
  });
}
