/**
 * Critical speed — samma modell som critical power, fast i distans och tid:
 * D = CS·t + D'. Används för både löpning och simning; det som skiljer är
 * vilka distanser som prognosticeras och hur tempot skrivs ut.
 *
 * Portad från metabolic-insights-dashboard (`src/utils/criticalSpeed/`).
 */

import { formatDuration, formatPacePer100m, formatPacePerKm } from "./time";
import type { CalculationError } from "./critical-power";

export type DistanceTest = {
  /** Testets tid i minuter. */
  minutes: number;
  /** Tillryggalagd distans i meter. */
  metres: number;
};

export type Discipline = "löpning" | "simning";

export type CriticalSpeedResult = {
  /** Meter per sekund. */
  criticalSpeed: number;
  /** Distanskapacitet över CS, i meter. */
  dPrime: number;
  lactateThreshold: number;
  vo2max: number | null;
  goodnessOfFit: number | null;
  testCount: number;
};

export type SpeedZone = {
  zone: string;
  minPace: string;
  targetPace: string;
  maxPace: string;
};

export type PaceForecast = {
  metres: number;
  label: string;
  time: string;
  pace: string;
};

export function formatSpeed(
  metresPerSecond: number,
  discipline: Discipline,
): string {
  return discipline === "simning"
    ? formatPacePer100m(metresPerSecond)
    : formatPacePerKm(metresPerSecond);
}

export function calculateCriticalSpeed(
  tests: DistanceTest[],
  discipline: Discipline,
): CriticalSpeedResult | CalculationError {
  const valid = tests
    .filter((t) => t.minutes > 0 && t.metres > 0)
    .sort((a, b) => a.minutes - b.minutes);

  if (valid.length < 2) {
    return { error: "Minst två test med både tid och distans krävs." };
  }
  if (valid[0].minutes === valid[valid.length - 1].minutes) {
    return { error: "Testerna måste ha olika längd." };
  }

  const points = valid.map((t) => ({ seconds: t.minutes * 60, metres: t.metres }));

  let criticalSpeed: number;
  let dPrime: number;
  let goodnessOfFit: number | null;

  if (points.length === 2) {
    const [a, b] = points;
    criticalSpeed = (b.metres - a.metres) / (b.seconds - a.seconds);
    dPrime = a.metres - criticalSpeed * a.seconds;
    // Originalet rapporterade 0,97 här — ett påhittat värde. Två punkter ger
    // en exakt linje, alltså inget mått på anpassning.
    goodnessOfFit = null;
  } else {
    const n = points.length;
    const sumX = points.reduce((s, p) => s + p.seconds, 0);
    const sumY = points.reduce((s, p) => s + p.metres, 0);
    const sumXY = points.reduce((s, p) => s + p.seconds * p.metres, 0);
    const sumXX = points.reduce((s, p) => s + p.seconds * p.seconds, 0);

    criticalSpeed = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    dPrime = (sumY - criticalSpeed * sumX) / n;

    const meanY = sumY / n;
    const ssTot = points.reduce((s, p) => s + (p.metres - meanY) ** 2, 0);
    const ssRes = points.reduce(
      (s, p) => s + (p.metres - (criticalSpeed * p.seconds + dPrime)) ** 2,
      0,
    );
    goodnessOfFit = ssTot > 0 ? Math.round((1 - ssRes / ssTot) * 100) : null;
  }

  if (!(criticalSpeed > 0) || !(dPrime > 0)) {
    return {
      error:
        "Testerna ger ingen giltig modell. Kontrollera att det kortare testet hölls i högre fart.",
    };
  }

  // VO2max skattas bara för löpning: ACSM:s löpekvation ger ungefär
  // 3,5 ml/kg/min per km/h. Originalet räknade m/s · 3,5 · kroppsvikt, vilket
  // gav storleksordningen 1000 ml/kg/min — dimensionellt fel.
  const vo2max =
    discipline === "löpning"
      ? Math.round(criticalSpeed * 1.1 * 3.6 * 3.5)
      : null;

  return {
    criticalSpeed,
    dPrime,
    lactateThreshold: criticalSpeed * 0.9,
    vo2max,
    goodnessOfFit,
    testCount: points.length,
  };
}

const SPEED_ZONE_SPEC: { zone: string; factors: [number, number, number] }[] = [
  { zone: "Zon 1 – Återhämtning", factors: [0.65, 0.7, 0.75] },
  { zone: "Zon 2 – Uthållighet", factors: [0.75, 0.8, 0.85] },
  { zone: "Zon 3 – Tempo/sweetspot", factors: [0.85, 0.9, 0.95] },
  { zone: "Zon 4 – Tröskel", factors: [0.95, 1.0, 1.05] },
  { zone: "Zon 5 – VO2max", factors: [1.05, 1.1, 1.15] },
  { zone: "Zon 6 – Anaerob kapacitet", factors: [1.15, 1.2, 1.25] },
];

export function speedZones(
  criticalSpeed: number,
  discipline: Discipline,
): SpeedZone[] {
  return SPEED_ZONE_SPEC.map(({ zone, factors }) => ({
    zone,
    // Långsammast först: högre fart ger lägre tempo-siffra.
    minPace: formatSpeed(criticalSpeed * factors[0], discipline),
    targetPace: formatSpeed(criticalSpeed * factors[1], discipline),
    maxPace: formatSpeed(criticalSpeed * factors[2], discipline),
  }));
}

const RUN_DISTANCES: { metres: number; label: string }[] = [
  { metres: 1500, label: "1 500 m" },
  { metres: 3000, label: "3 000 m" },
  { metres: 5000, label: "5 km" },
  { metres: 10000, label: "10 km" },
  { metres: 21097, label: "Halvmaraton" },
  { metres: 42195, label: "Maraton" },
];

const SWIM_DISTANCES: { metres: number; label: string }[] = [
  { metres: 100, label: "100 m" },
  { metres: 200, label: "200 m" },
  { metres: 400, label: "400 m" },
  { metres: 800, label: "800 m" },
  { metres: 1500, label: "1 500 m" },
  { metres: 3800, label: "Ironman-simning" },
];

/**
 * Prognos per distans ur samma modell: t = d/CS + D'/CS.
 *
 * Originalet visade tre kolumner — "perfekt", "normal" och "tuff" fart — men
 * skillnaden mellan dem satt bara på D'-termen, som är några tiotals sekunder
 * även på maraton. De tre kolumnerna skilde sig alltså med ett par sekunder
 * och antydde en precision modellen inte har. Här är det en prognos.
 */
export function paceForecasts(
  criticalSpeed: number,
  dPrime: number,
  discipline: Discipline,
): PaceForecast[] {
  const distances = discipline === "simning" ? SWIM_DISTANCES : RUN_DISTANCES;

  return distances.map(({ metres, label }) => {
    const seconds = metres / criticalSpeed + dPrime / criticalSpeed;
    return {
      metres,
      label,
      time: formatDuration(seconds),
      pace: formatSpeed(metres / seconds, discipline),
    };
  });
}
