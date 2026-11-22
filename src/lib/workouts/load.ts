/**
 * Belastningen i ett planerat pass med de vedertagna måtten: TSS, IF, NP och
 * arbete i kJ. Samma tal som genomförda pass får ur filen, så att planen går
 * att lägga mot det som gjordes och läsas som i andra verktyg.
 *
 * - **TSS** = timmar × IF² × 100 (Coggan). Ett pass i en timme på tröskeln
 *   är 100.
 * - **IF** är passets normaliserade intensitet genom tröskeln. På cykel och
 *   i löpning normaliseras den som NP: 30 sekunders glidande medel och
 *   fjärde potens, så att intervaller väger tyngre än samma medel jämnt.
 *   Löpningens rTSS bygger på normaliserad graderad fart, som är gjord på
 *   samma sätt; ett planerat pass har ingen lutning.
 * - **sTSS** för simning: IF är sträckan genom tiden utan vilor, delad med
 *   tröskeln, och IF tas i kubik i stället för i kvadrat – vattnets motstånd
 *   gör att belastningen växer brantare med farten.
 * - **NP** och **kJ** på cykel, när passet har en referens i watt.
 *
 * Tröskeln är FTP på cykel, tröskelfarten (det som går att hålla ungefär en
 * timme) i löpning och CSS i simning. Stegen sparas som andel av en
 * referens, och `THRESHOLD` säger var tröskeln ligger i den referensen. IF
 * och TSS beror därför bara på andelarna och tiden, inte på atletens watt
 * eller fart – samma pass ur biblioteket har samma TSS för alla. Bara steg i
 * meter behöver referensen, för att få en tid.
 *
 * Modulen är ren, utan anrop.
 */

import type { Sport } from "@/lib/calculators/lactate";

import {
  flattenWorkout,
  type TargetBasis,
  type Workout,
  type WorkoutStep,
} from "./schema";

/**
 * Tröskeln som andel av referensen. FTP och LT2 är tröskeln. CP ligger över
 * FTP (FTP = 0,95 × CP, som i context.ts) och CS på samma sätt över
 * tröskelfarten. Loppfarterna följer zonmodellen (intensity.ts): 5 km-fart
 * ligger kring 104 % av CS, milfart vid CS, halvmaratonfart kring 92 % och
 * maratonfart kring 88 %. Simningens sTSS räknar mot CSS.
 */
export const THRESHOLD: Record<TargetBasis, number> = {
  FTP: 1,
  LT2: 1,
  CP: 0.95,
  CS: 0.95,
  CSS: 1,
  "5K": 0.912,
  "10K": 0.95,
  HM: 1.036,
  MP: 1.083,
};

export type LoadKind = "TSS" | "rTSS" | "sTSS";

export const LOAD_KIND: Record<Sport, LoadKind> = {
  cykling: "TSS",
  löpning: "rTSS",
  simning: "sTSS",
};

export type WorkoutLoad = {
  /** Passets tid, sekunder. */
  seconds: number;
  tss: number;
  /** Normaliserad intensitet genom tröskeln. */
  intensityFactor: number;
  kind: LoadKind;
  /** NP i watt; cykel med referens. */
  normalizedPower: number | null;
  /** Arbete i kJ; cykel med referens. */
  kj: number | null;
  /** Sträcka i meter; löpning och simning när den går att räkna. */
  metres: number | null;
  /** Något steg gick inte att räkna (meter utan referens); talen gäller resten. */
  partial: boolean;
};

/** 30 sekunders glidande medel, fjärde potens – som NP. */
function normalized(series: number[]): number {
  if (series.length < 30) {
    return series.reduce((s, v) => s + v, 0) / Math.max(series.length, 1);
  }
  let sum = 0;
  let acc = 0;
  let n = 0;
  for (let i = 0; i < series.length; i += 1) {
    sum += series[i];
    if (i >= 30) sum -= series[i - 30];
    if (i >= 29) {
      acc += (sum / 30) ** 4;
      n += 1;
    }
  }
  return (acc / n) ** 0.25;
}

type Part = {
  seconds: number;
  metres: number | null;
  /** Andel av referensen, mitt i målet. */
  fraction: number;
  /** Stillastående vila: ett vilosteg i tid, inte i meter. */
  still: boolean;
};

function partOf(
  step: WorkoutStep,
  sport: Sport,
  reference: number | null,
): Part | null {
  const fraction = Math.max(0, (step.low + step.high) / 2);
  const ref = reference !== null && reference > 0 ? reference : null;
  if (step.durationSeconds !== null && step.durationSeconds > 0) {
    return {
      seconds: step.durationSeconds,
      metres:
        sport === "cykling" || ref === null
          ? null
          : step.durationSeconds * fraction * ref,
      fraction,
      still: step.kind === "vila",
    };
  }
  if (
    step.distanceM !== null &&
    step.distanceM > 0 &&
    sport !== "cykling" &&
    ref !== null &&
    fraction > 0
  ) {
    return {
      seconds: step.distanceM / (fraction * ref),
      metres: step.distanceM,
      fraction,
      still: false,
    };
  }
  return null;
}

/**
 * Belastningen i ett pass, eller null när det inte går att räkna: ingen tid
 * alls, eller en gren utan TSS.
 */
export function workoutLoad(
  workout: Pick<Workout, "sport" | "basis" | "blocks">,
  reference: number | null,
): WorkoutLoad | null {
  const kind = LOAD_KIND[workout.sport];
  const share = THRESHOLD[workout.basis];
  if (!kind || !share) return null;

  const parts: Part[] = [];
  let partial = false;
  for (const { step } of flattenWorkout(workout as Workout)) {
    const part = partOf(step, workout.sport, reference);
    if (part) parts.push(part);
    else partial = true;
  }
  const seconds = parts.reduce((s, p) => s + p.seconds, 0);
  if (!(seconds > 0)) return null;

  const metres =
    workout.sport === "cykling" || parts.some((p) => p.metres === null)
      ? null
      : parts.reduce((s, p) => s + (p.metres as number), 0);

  let intensityFactor: number;
  let tss: number;
  if (workout.sport === "simning") {
    // sTSS: sträckan genom tiden utan vilor vid kanten, IF i kubik.
    const moving = parts.filter((p) => !p.still);
    const movingSeconds = moving.reduce((s, p) => s + p.seconds, 0);
    if (!(movingSeconds > 0)) return null;
    intensityFactor =
      moving.reduce((s, p) => s + p.fraction * p.seconds, 0) /
      movingSeconds /
      share;
    tss = (movingSeconds / 3600) * intensityFactor ** 3 * 100;
  } else {
    // En sekund i taget, som en fil, så att normaliseringen blir densamma
    // som för ett genomfört pass.
    const series: number[] = [];
    let carry = 0;
    for (const p of parts) {
      const exact = p.seconds + carry;
      const whole = Math.round(exact);
      carry = exact - whole;
      for (let i = 0; i < whole; i += 1) series.push(p.fraction / share);
    }
    intensityFactor = normalized(series);
    tss = (seconds / 3600) * intensityFactor ** 2 * 100;
  }

  const watts =
    workout.sport === "cykling" && reference !== null && reference > 0;
  return {
    seconds,
    tss,
    intensityFactor,
    kind,
    normalizedPower: watts ? intensityFactor * share * reference : null,
    kj: watts
      ? parts.reduce((s, p) => s + p.fraction * reference * p.seconds, 0) / 1000
      : null,
    metres,
    partial,
  };
}

/**
 * Referensen ett pass utan egen referens måste ha haft för att ta
 * `totalSeconds`: steg i meter tar tid ur farten, och farten är andelen
 * gånger referensen. Planbibliotekets pass har en längd men ingen fart, så
 * deras steg i meter får sin tid härifrån. Null när passet saknar steg i
 * meter eller längden inte räcker till dem.
 */
export function impliedReference(
  workout: Pick<Workout, "sport" | "blocks">,
  totalSeconds: number | null,
): number | null {
  if (workout.sport === "cykling" || !totalSeconds || !(totalSeconds > 0))
    return null;
  let timed = 0;
  let perReference = 0;
  for (const { step } of flattenWorkout(workout as Workout)) {
    const fraction = (step.low + step.high) / 2;
    if (step.durationSeconds && step.durationSeconds > 0)
      timed += step.durationSeconds;
    else if (step.distanceM && step.distanceM > 0 && fraction > 0)
      perReference += step.distanceM / fraction;
  }
  const left = totalSeconds - timed;
  return perReference > 0 && left > 0 ? perReference / left : null;
}

// ---------------------------------------------------------------------------
// Summor
// ---------------------------------------------------------------------------

export type LoadTotals = {
  sessions: number;
  seconds: number;
  tss: number;
  /** Pass utan TSS: styrka, eller pass som inte går att räkna. */
  withoutTss: number;
  kj: number;
  /** Meter per gren. */
  metres: Partial<Record<Sport, number>>;
};

export const emptyTotals = (): LoadTotals => ({
  sessions: 0,
  seconds: 0,
  tss: 0,
  withoutTss: 0,
  kj: 0,
  metres: {},
});

/** Lägger ett pass till summan. */
export function addLoad(
  totals: LoadTotals,
  item: {
    sport: Sport | string;
    seconds: number | null;
    tss: number | null;
    kj?: number | null;
    metres?: number | null;
  },
): LoadTotals {
  const metres = { ...totals.metres };
  if (
    item.metres &&
    item.metres > 0 &&
    (item.sport === "löpning" || item.sport === "simning")
  ) {
    metres[item.sport] = (metres[item.sport] ?? 0) + item.metres;
  }
  return {
    sessions: totals.sessions + 1,
    seconds: totals.seconds + (item.seconds ?? 0),
    tss: totals.tss + (item.tss ?? 0),
    withoutTss: totals.withoutTss + (item.tss === null ? 1 : 0),
    kj: totals.kj + (item.kj ?? 0),
    metres,
  };
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

const comma = (value: number, digits: number) =>
  value.toFixed(digits).replace(".", ",");

/** "1 250" – tusental med smalt mellanrum. */
export const wholeNumber = (value: number) =>
  Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/** "9:30 h", "45 min". */
export function hoursText(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")} h`;
}

export const tssText = (tss: number) => wholeNumber(tss);
export const ifText = (value: number) => comma(value, 2);

/** "12,4 km", "2 400 m" för simning. */
export function distanceText(metres: number, sport: Sport | string): string {
  return sport === "simning"
    ? `${wholeNumber(metres)} m`
    : `${comma(metres / 1000, 1)} km`;
}

/** Passets mått som en rad: "TSS 85 · IF 0,82 · NP 231 W · 1 140 kJ". */
export function loadLine(load: WorkoutLoad): string {
  return [
    `${load.kind} ${tssText(load.tss)}`,
    `IF ${ifText(load.intensityFactor)}`,
    load.normalizedPower !== null &&
      `NP ${wholeNumber(load.normalizedPower)} W`,
    load.kj !== null && `${wholeNumber(load.kj)} kJ`,
  ]
    .filter(Boolean)
    .join(" · ");
}
