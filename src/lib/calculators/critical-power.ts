/**
 * Critical power-modellen (Monod & Scherrer): utfört arbete växer linjärt med
 * tiden, W = CP·t + W'. Lutningen är den effekt som teoretiskt kan hållas
 * hur länge som helst, och skärningen är den ändliga arbetskapaciteten över
 * den nivån.
 *
 * Portad från metabolic-insights-dashboard (`src/utils/criticalPower/`).
 */

export type PowerTest = {
  /** Testets längd i minuter. */
  minutes: number;
  /** Medeleffekt under testet i watt. */
  watts: number;
};

export type CriticalPowerResult = {
  criticalPower: number;
  /** Anaerob arbetskapacitet i kJ. */
  wPrime: number;
  ftp: number;
  vo2maxPower: number;
  vo2max: number | null;
  aerobicThreshold: { min: number; max: number };
  /** R² som procent. null när två punkter använts — se kommentaren nedan. */
  goodnessOfFit: number | null;
  testCount: number;
};

export type TrainingZone = {
  zone: string;
  min: number;
  mid: number;
  max: number;
  cadence: string;
  rpe: string;
};

export type IntervalZone = {
  type: string;
  min: number;
  mid: number;
  max: number;
  recovery: number;
  cadence: string;
};

export type CalculationError = { error: string };

function isError<T>(value: T | CalculationError): value is CalculationError {
  return typeof value === "object" && value !== null && "error" in value;
}

export function calculateCriticalPower(
  tests: PowerTest[],
  weightKg: number | null,
): CriticalPowerResult | CalculationError {
  const valid = tests
    .filter((t) => t.minutes > 0 && t.watts > 0)
    .sort((a, b) => a.minutes - b.minutes);

  if (valid.length < 2) {
    return { error: "Minst två test med både längd och effekt krävs." };
  }

  // Testerna måste skilja sig i längd, annars finns ingen lutning att mäta.
  if (valid[0].minutes === valid[valid.length - 1].minutes) {
    return { error: "Testerna måste ha olika längd." };
  }

  const points = valid.map((t) => ({ seconds: t.minutes * 60, watts: t.watts }));

  let criticalPower: number;
  let wPrimeJoules: number;
  let goodnessOfFit: number | null;

  if (points.length === 2) {
    const [a, b] = points;
    criticalPower =
      (b.watts * b.seconds - a.watts * a.seconds) / (b.seconds - a.seconds);
    wPrimeJoules = (a.watts - criticalPower) * a.seconds;
    // Två punkter definierar linjen exakt. Originalet rapporterade "99 %"
    // anpassning här, vilket antyder en uppmätt kvalitet som inte finns.
    goodnessOfFit = null;
  } else {
    const work = points.map((p) => ({ x: p.seconds, y: p.watts * p.seconds }));
    const n = work.length;
    const sumX = work.reduce((s, p) => s + p.x, 0);
    const sumY = work.reduce((s, p) => s + p.y, 0);
    const sumXY = work.reduce((s, p) => s + p.x * p.y, 0);
    const sumXX = work.reduce((s, p) => s + p.x * p.x, 0);

    criticalPower = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    wPrimeJoules = (sumY - criticalPower * sumX) / n;

    const meanY = sumY / n;
    const ssTot = work.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
    const ssRes = work.reduce(
      (s, p) => s + (p.y - (criticalPower * p.x + wPrimeJoules)) ** 2,
      0,
    );
    goodnessOfFit = ssTot > 0 ? Math.round((1 - ssRes / ssTot) * 100) : null;
  }

  if (!(criticalPower > 0) || !(wPrimeJoules > 0)) {
    return {
      error:
        "Testerna ger ingen giltig modell. Kontrollera att det kortare testet har högre effekt än det längre.",
    };
  }

  const cp = Math.round(criticalPower);
  const vo2maxPower = Math.round(cp * 1.15);

  // ACSM:s cykelekvation: VO2 (ml/kg/min) = 10.8 · W / kg + 7. Originalet
  // använde 0.2 · W/kg + 45, som i praktiken ger ~46 för varje tänkbar atlet.
  const vo2max =
    weightKg && weightKg > 0
      ? Math.round((10.8 * vo2maxPower) / weightKg + 7)
      : null;

  return {
    criticalPower: cp,
    wPrime: Number((wPrimeJoules / 1000).toFixed(1)),
    ftp: Math.round(cp * 0.95),
    vo2maxPower,
    vo2max,
    aerobicThreshold: { min: Math.round(cp * 0.59), max: Math.round(cp * 0.75) },
    goodnessOfFit,
    testCount: points.length,
  };
}

/** Tid till utmattning vid en effekt över CP. TTE = W' / (P − CP). */
export function timeToExhaustion(
  wPrimeKj: number,
  criticalPower: number,
  targetWatts: number,
): number | null {
  if (!(wPrimeKj > 0) || !(criticalPower > 0)) return null;
  if (targetWatts <= criticalPower) return null;
  return (wPrimeKj * 1000) / (targetWatts - criticalPower);
}

/** Effekt som kan hållas en given tid. P = CP + W' / t. */
export function powerForDuration(
  wPrimeKj: number,
  criticalPower: number,
  seconds: number,
): number | null {
  if (!(wPrimeKj > 0) || !(criticalPower > 0) || !(seconds > 0)) return null;
  return Math.round(criticalPower + (wPrimeKj * 1000) / seconds);
}

type ZoneSpec = {
  zone: string;
  /** Andelar av CP: [min, mitt, max]. */
  factors: [number, number, number];
  cadence: string;
  rpe: string;
};

const ZONE_SPEC: ZoneSpec[] = [
  { zone: "Zon 1 – Återhämtning", factors: [0.42, 0.47, 0.52], cadence: "80–100", rpe: "< 2" },
  { zone: "Zon 2 – Extensiv uthållighet", factors: [0.52, 0.62, 0.72], cadence: "80–100", rpe: "2–3" },
  { zone: "Zon 3 – Intensiv uthållighet", factors: [0.72, 0.78, 0.86], cadence: "85–110", rpe: "3–4" },
  { zone: "Zon 4 – Tröskel", factors: [0.86, 0.93, 1.0], cadence: "85–110", rpe: "4–5" },
  { zone: "Zon 5 – VO2max", factors: [1.0, 1.07, 1.14], cadence: "85–110", rpe: "5–6" },
  { zone: "Zon 6 – Anaerob tolerans", factors: [1.14, 1.43, 1.72], cadence: "95–120", rpe: "6–7" },
  { zone: "Zon 7 – Anaerob produktion", factors: [1.72, 1.81, 1.9], cadence: "> 120", rpe: "8–9" },
  { zone: "Zon MU – Muskulär uthållighet", factors: [0.84, 0.9, 0.96], cadence: "40–60", rpe: "3–4" },
];

export function trainingZones(criticalPower: number): TrainingZone[] {
  return ZONE_SPEC.map(({ zone, factors, cadence, rpe }) => ({
    zone,
    min: Math.round(criticalPower * factors[0]),
    mid: Math.round(criticalPower * factors[1]),
    max: Math.round(criticalPower * factors[2]),
    cadence,
    rpe,
  }));
}

const INTERVAL_SPEC: {
  type: string;
  factors: [number, number, number];
  recovery: number;
  cadence: string;
}[] = [
  { type: "Intensiv uthållighet", factors: [0.6, 0.64, 0.67], recovery: 0.41, cadence: "85–110" },
  // Originalet hade min 1.24 och mitt 1.18 här, alltså ett min större än sin
  // mittpunkt. Ordningen är rättad.
  { type: "Intermittent VO2max", factors: [1.18, 1.24, 1.41], recovery: 0.59, cadence: "85–110" },
  { type: "VO2max", factors: [1.06, 1.12, 1.17], recovery: 0.73, cadence: "85–110" },
  { type: "Laktat-clearance", factors: [0.95, 1.01, 1.06], recovery: 0.7, cadence: "85–110" },
];

export function intervalZones(criticalPower: number): IntervalZone[] {
  return INTERVAL_SPEC.map(({ type, factors, recovery, cadence }) => ({
    type,
    min: Math.round(criticalPower * factors[0]),
    mid: Math.round(criticalPower * factors[1]),
    max: Math.round(criticalPower * factors[2]),
    recovery: Math.round(criticalPower * recovery),
    cadence,
  }));
}

export { isError };
