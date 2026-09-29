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
import { analyseSessionOnServer } from "./metabolic-profile";
import { toEfforts, type FullSession } from "./session-queries";
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

export type MetabolicHistoryEntry = {
  sessionId: string;
  performedOn: string;
  protocol: string;
  curve: MetabolicCurve;
};

/**
 * Adeptens metabola profiler över tid: varje cykeltest som ger VO2max och
 * VLamax – den metabola profilen, och stegtestet när det sparades med
 * medlemsdelen. Räknas om ur rådatan precis som testsidan, så att en profil
 * från i fjol räknas med samma modell som den från i dag.
 */
export function metabolicHistory(
  sessions: FullSession[],
): MetabolicHistoryEntry[] {
  const n = (v: number | string | null) => (v === null ? null : Number(v));
  return sessions
    .filter(
      (s) =>
        s.sport === "cykling" &&
        (s.protocol === "metabol-profil" ||
          (s.protocol === "laktat-steg" &&
            s.test_metrics.some((m) => m.key === "VLamax"))),
    )
    .flatMap((s) => {
      const analysis = analyseSessionOnServer(
        {
          protocol: s.protocol,
          sport: s.sport,
          unit: s.intensity_unit,
          efforts: toEfforts(s.test_efforts),
          weightKg: n(s.weight_kg),
          bodyFatPct: n(s.body_fat_pct),
          sex: s.sex ?? null,
          finish: {
            peakIntensity: n(s.peak_intensity),
            vo2max: n(s.vo2max),
            peakLactate: n(s.peak_lactate),
            peakHeartRate: n(s.peak_heart_rate),
          },
        },
        { members: true },
      );
      const curve = metabolicCurve(
        analysis.metrics,
        s.intensity_unit,
        n(s.weight_kg),
        s.protocol === "laktat-steg" ? n(s.peak_intensity) : null,
      );
      return curve
        ? [
            {
              sessionId: s.id,
              performedOn: s.performed_on,
              protocol: s.protocol,
              curve,
            },
          ]
        : [];
    })
    .sort((a, b) => a.performedOn.localeCompare(b.performedOn));
}
