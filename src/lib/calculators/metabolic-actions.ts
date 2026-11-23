"use server";

import { isMember } from "@/lib/auth/membership";
import { getSessionUser } from "@/lib/auth/session";
import { metabolicCurve, type MetabolicCurve } from "@/lib/tests/metabolic-curve";
import { profileVolRel } from "@/lib/tests/metabolic-profile";

export type CyclingProfileInput = {
  vo2max: number;
  vlamax: number;
  weightKg: number;
  bodyFatPct: number;
  sex: "man" | "kvinna";
  maxHeartRate: number | null;
};

const within = (v: number, lo: number, hi: number) => Number.isFinite(v) && v >= lo && v <= hi;

/**
 * Kalkylens kurvor på cykel, med den kalibrerade modellen. Räknas på servern
 * precis som testerna, så att konstanterna aldrig når webbläsaren. Samma
 * kontroll som sidan: medlemskap.
 */
export async function cyclingProfile(input: CyclingProfileInput): Promise<MetabolicCurve | null> {
  if (!isMember(await getSessionUser())) return null;
  const { vo2max, vlamax, weightKg, bodyFatPct, sex, maxHeartRate } = input;
  if (
    !within(vo2max, 20, 100) ||
    !within(vlamax, 0.05, 2) ||
    !within(weightKg, 35, 150) ||
    !within(bodyFatPct, 3, 45) ||
    (sex !== "man" && sex !== "kvinna")
  ) {
    return null;
  }

  const curve = metabolicCurve(
    [
      { key: "VO2max", value: vo2max, unit: "ml/kg/min" },
      { key: "VLamax", value: vlamax, unit: "mmol/l/s" },
    ],
    "W",
    weightKg,
    null,
    profileVolRel("metabol-profil", "W", sex, bodyFatPct),
  );
  if (!curve || !maxHeartRate || !within(maxHeartRate, 100, 230)) return curve;

  // Modellens puls: linjär från 60 slag mot syrebehovet, som i den äldre kalkylen.
  const withPulse = <T extends { vo2: number } | null>(p: T) =>
    p && {
      ...p,
      heartRate: Math.round(
        Math.max(60, Math.min(maxHeartRate, 60 + ((maxHeartRate - 60) * p.vo2) / vo2max)),
      ),
    };
  return {
    ...curve,
    points: curve.points.map(withPulse),
    thresholds: {
      anaerobicThreshold: withPulse(curve.thresholds.anaerobicThreshold),
      fatMax: withPulse(curve.thresholds.fatMax),
      carbMax: withPulse(curve.thresholds.carbMax),
    },
  };
}
