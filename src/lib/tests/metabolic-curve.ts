import "server-only";

/**
 * Mader-kurvan för ett testtillfälle: laktatbalans och bränsle över hela
 * effektspannet, ur testets VO2max och VLamax.
 *
 * Räknas på servern precis som profilen. Webbläsaren får punkterna att rita,
 * aldrig modellen – samma princip som `metabolic-profile.ts`.
 */

import {
  calculateMetabolicProfile,
  type MetabolicPoint,
  type MetabolicThresholds,
} from "@/lib/calculators/metabolic";
import type { ZoneRow } from "./zones";

export type MetabolicCurve = {
  points: MetabolicPoint[];
  thresholds: MetabolicThresholds;
  vo2max: number;
  vlamax: number;
};

type StoredMetric = { key: string; value: number | string; unit: string };

const valueOf = (metrics: StoredMetric[], key: string) => {
  const m = metrics.find((x) => x.key === key);
  return m && Number(m.value) > 0 ? Number(m.value) : null;
};

/**
 * Kurvan för ett cykeltest med VO2max och VLamax: den metabola profilen och
 * stegtestet med medlemsdelen. Effekten vid VO2max är stegtestets topp, och i
 * den metabola profilen ACSM-ekvationen baklänges – samma väg som VO2max
 * räknades fram, så kurvan och nyckeltalen hänger ihop.
 */
export function metabolicCurve(
  metrics: StoredMetric[],
  unit: string,
  weightKg: number | null,
  peak: number | null,
): MetabolicCurve | null {
  if (unit !== "W" || !weightKg || !(weightKg > 0)) return null;
  const vo2max = valueOf(metrics, "VO2max");
  const vlamax = valueOf(metrics, "VLamax");
  if (vo2max === null || vlamax === null) return null;

  const vo2maxPower =
    peak && peak > 0
      ? peak
      : (valueOf(metrics, "Pmax") ?? (vo2max * weightKg - 7 * weightKg) / 10.8);
  if (!(vo2maxPower > 0)) return null;

  const profile = calculateMetabolicProfile({
    vo2max,
    vlamax,
    vo2maxPower,
    weightKg,
  });
  if (profile.points.length === 0) return null;
  // Varannan punkt räcker för att rita – 100 i stället för 200.
  return {
    points: profile.points.filter((_, i) => i % 2 === 1),
    thresholds: profile.thresholds,
    vo2max,
    vlamax,
  };
}

/**
 * Bränslet i varje zon, vid zonens mitt. Den översta zonen saknar övre gräns
 * och läses vid sin undre plus hälften av zonen under.
 */
export function fuelByZone(
  zones: ZoneRow[],
  curve: MetabolicCurve,
): ({ fat: number; carbs: number } | null)[] {
  const at = (power: number) =>
    curve.points.reduce((best, p) =>
      Math.abs(p.power - power) < Math.abs(best.power - power) ? p : best,
    );
  const top = curve.points[curve.points.length - 1].power;
  return zones.map((z) => {
    const low = z.min ?? 0;
    const high = z.max ?? low * 1.1;
    const mid = (low + high) / 2;
    if (!(mid > 0) || mid > top) return null;
    const p = at(mid);
    return { fat: p.fatPerHour, carbs: p.carbsPerHour };
  });
}
