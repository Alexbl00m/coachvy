/**
 * Rullande critical power och critical speed.
 *
 * Ett testtillfälle är en ögonblicksbild. Men de enskilda maxinsatserna är
 * kvar i databasen, och en atlet som slår sin 3-minuterspersonbästa i ett
 * intervallpass har i praktiken flyttat sin kurva – även om det inte var ett
 * "test".
 *
 * Därför räknas CP/CS om ur den bästa insatsen per duration inom ett rullande
 * fönster. Nya rekord slår igenom direkt; gamla faller ur av sig själva.
 *
 * Två saker gör den här modellen ärlig:
 *
 *  - Insatser grupperas i durationsband, inte på exakt sekund. Annars skulle
 *    ett 181-sekunderstest och ett 179-sekunderstest räknas som två punkter
 *    på "olika" längd och ge en meningslös lutning.
 *  - Bara band inom modellens giltiga spann används. Critical power-modellen
 *    gäller ungefär 2–15 minuter; en 30-sekundersspurt hör inte hemma i
 *    anpassningen, hur maximal den än var.
 */

import {
  calculateCriticalPower,
  isError,
} from "@/lib/calculators/critical-power";
import { linearFit } from "@/lib/calculators/regression";

export type MaximalEffort = {
  /** Testtillfället insatsen kom från. */
  sessionId: string;
  performedOn: string;
  durationSeconds: number;
  /** Effekt i watt, eller sträcka i meter för löpning och simning. */
  intensity: number | null;
  distanceM: number | null;
};

/** Durationsband som modellen räknar på, i sekunder. */
const BANDS: { label: string; min: number; max: number }[] = [
  { label: "2–4 min", min: 120, max: 240 },
  { label: "4–6 min", min: 240, max: 360 },
  { label: "6–9 min", min: 360, max: 540 },
  { label: "9–13 min", min: 540, max: 780 },
  { label: "13–20 min", min: 780, max: 1200 },
];

export type BestEffort = {
  band: string;
  durationSeconds: number;
  value: number;
  performedOn: string;
  sessionId: string;
};

export type RollingResult = {
  /** CP i watt, eller CS i m/s. */
  primary: number;
  /** W′ i joule, eller D′ i meter. */
  reserve: number;
  /** Insatserna anpassningen bygger på. */
  usedEfforts: BestEffort[];
  /** Datum för den färskaste insatsen som ingår. */
  latestEffort: string;
  /** true när en insats i fönstret är nyare än det senaste hela testet. */
  updatedByNewBest: boolean;
  warnings: string[];
};

export type RollingInput = {
  efforts: MaximalEffort[];
  /** Hur långt bakåt insatser räknas. Förval 90 dagar. */
  windowDays?: number;
  /** Dagens datum, injicerat för testbarhet. */
  today?: Date;
  /** Datum för det senaste kompletta testtillfället, om något. */
  lastFullTestOn?: string | null;
};

/** Bästa insatsen per durationsband inom fönstret. */
function bestPerBand(
  efforts: MaximalEffort[],
  valueOf: (e: MaximalEffort) => number | null,
): BestEffort[] {
  const best = new Map<string, BestEffort>();

  for (const effort of efforts) {
    // Översta bandet är stängt uppåt: ett 20-minuterstest ligger exakt på
    // gränsen 1 200 s, och det är det vanligaste fjärrprotokollet av alla.
    // Med en öppen gräns hade det aldrig fått räknas med.
    const band = BANDS.find((b, index) =>
      index === BANDS.length - 1
        ? effort.durationSeconds >= b.min && effort.durationSeconds <= b.max
        : effort.durationSeconds >= b.min && effort.durationSeconds < b.max,
    );
    if (!band) continue;

    const value = valueOf(effort);
    if (value === null || !(value > 0)) continue;

    const current = best.get(band.label);
    if (!current || value > current.value) {
      best.set(band.label, {
        band: band.label,
        durationSeconds: effort.durationSeconds,
        value,
        performedOn: effort.performedOn,
        sessionId: effort.sessionId,
      });
    }
  }

  return BANDS.flatMap((b) => {
    const found = best.get(b.label);
    return found ? [found] : [];
  });
}

function withinWindow(
  efforts: MaximalEffort[],
  windowDays: number,
  today: Date,
): MaximalEffort[] {
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - windowDays);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  return efforts.filter((e) => e.performedOn >= cutoffIso);
}

function summarise(
  used: BestEffort[],
  lastFullTestOn: string | null | undefined,
  windowDays: number,
): { latestEffort: string; updatedByNewBest: boolean; warnings: string[] } {
  const latestEffort = used.reduce(
    (latest, e) => (e.performedOn > latest ? e.performedOn : latest),
    used[0].performedOn,
  );
  const warnings: string[] = [];

  if (used.length === 2) {
    warnings.push(
      "Två durationsband ger en exakt linje utan anpassningsgrad. Ett tredje band gör värdet mycket säkrare.",
    );
  }

  const spread =
    Math.max(...used.map((e) => e.durationSeconds)) /
    Math.min(...used.map((e) => e.durationSeconds));
  if (spread < 2) {
    warnings.push(
      "Insatserna ligger nära varandra i längd. Modellen blir känslig – sikta på minst dubbel skillnad mellan kortaste och längsta.",
    );
  }

  return {
    latestEffort,
    updatedByNewBest: Boolean(lastFullTestOn) && latestEffort > (lastFullTestOn as string),
    warnings: [
      ...warnings,
      `Bygger på bästa insatsen per durationsband de senaste ${windowDays} dagarna.`,
    ],
  };
}

/** Rullande critical power ur maximala effektinsatser. */
export function rollingCriticalPower(input: RollingInput): RollingResult | null {
  const windowDays = input.windowDays ?? 90;
  const today = input.today ?? new Date();

  const used = bestPerBand(
    withinWindow(input.efforts, windowDays, today),
    (e) => e.intensity,
  );
  if (used.length < 2) return null;

  const result = calculateCriticalPower(
    used.map((e) => ({ minutes: e.durationSeconds / 60, watts: e.value })),
    null,
  );
  if (isError(result)) return null;

  const meta = summarise(used, input.lastFullTestOn, windowDays);
  return {
    primary: result.criticalPower,
    reserve: result.wPrime * 1000,
    usedEfforts: used,
    ...meta,
  };
}

/**
 * Rullande critical speed ur maximala löp- eller siminsatser.
 *
 * Anpassar d = CS·t + D′ över bästa sträckan per durationsband.
 */
export function rollingCriticalSpeed(input: RollingInput): RollingResult | null {
  const windowDays = input.windowDays ?? 90;
  const today = input.today ?? new Date();

  const used = bestPerBand(
    withinWindow(input.efforts, windowDays, today),
    (e) => e.distanceM,
  );
  if (used.length < 2) return null;

  const seconds = used.map((e) => e.durationSeconds);
  if (Math.min(...seconds) === Math.max(...seconds)) return null;

  const fit = linearFit(
    seconds,
    used.map((e) => e.value),
  );
  if (!fit || !(fit.slope > 0)) return null;

  const meta = summarise(used, input.lastFullTestOn, windowDays);
  return {
    primary: fit.slope,
    reserve: fit.intercept,
    usedEfforts: used,
    ...meta,
  };
}

export { BANDS };
