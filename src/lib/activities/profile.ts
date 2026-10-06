/**
 * Profilen ur träningen: det bästa adepten gjort över varje tid, ur alla pass
 * i en period, och vad det säger om CP och W′ (cykel) eller CS och D′
 * (löpning).
 *
 * Underlaget är bästa-kurvan som räknades för varje pass när det lästes in.
 * Kurvan visar vad adepten *minst* klarar – ett träningspass är sällan
 * maximalt – så den blir bra först med lopp, tester och hårda pass i
 * perioden. Därför räknas också hur många pass som bär varje del av kurvan.
 *
 * Modulen är ren, utan anrop, och körs i webbläsaren när perioden byts.
 */

import { linearFit } from "@/lib/calculators/regression";
import type { BestEffort, Curve } from "./analysis";

export type ProfileSource = {
  id: string;
  name: string;
  sport: string;
  performed_on: string;
  curve: Curve | null;
  /** Löpningens bästa tider på distanser, ur samma pass. */
  best: BestEffort[] | null;
};

export type CurveKind = "power" | "speed";

export type CurvePoint = {
  /** Sekunder. */
  span: number;
  /** W, eller m/s. */
  value: number;
  activityId: string;
  date: string;
  name: string;
  /** Hur många pass i perioden som är minst så här långa. */
  support: number;
};

/** Perioderna att välja mellan, i dagar. `null` är allt. */
export const PERIODS: { key: string; label: string; days: number | null }[] = [
  { key: "6v", label: "6 veckor", days: 42 },
  { key: "90d", label: "90 dagar", days: 90 },
  { key: "12m", label: "12 månader", days: 365 },
  { key: "allt", label: "Allt", days: null },
];

const DAY_MS = 86_400_000;

export function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Perioden som datum, och samma längd närmast före den. */
export function periodRange(
  days: number | null,
  today: string,
): {
  from: string | null;
  to: string;
  prevFrom: string | null;
  prevTo: string | null;
} {
  if (days === null)
    return { from: null, to: today, prevFrom: null, prevTo: null };
  const end = Date.parse(today);
  const from = isoDay(end - (days - 1) * DAY_MS);
  return {
    from,
    to: today,
    prevFrom: isoDay(end - (2 * days - 1) * DAY_MS),
    prevTo: isoDay(end - days * DAY_MS),
  };
}

const sportOfKind = (kind: CurveKind) =>
  kind === "power" ? "cykling" : "löpning";

/** Passen i gren och period som har en kurva av slaget. */
export function inPeriod(
  sources: ProfileSource[],
  kind: CurveKind,
  from: string | null,
  to: string | null,
): ProfileSource[] {
  const sport = sportOfKind(kind);
  return sources.filter(
    (s) =>
      s.sport === sport &&
      (s.curve?.[kind]?.length ?? 0) > 0 &&
      (from === null || s.performed_on >= from) &&
      (to === null || s.performed_on <= to),
  );
}

/** Det bästa över varje längd, och passet det kom ur. */
export function bestCurve(
  sources: ProfileSource[],
  kind: CurveKind,
): CurvePoint[] {
  const best = new Map<number, CurvePoint>();
  const support = new Map<number, number>();
  for (const s of sources) {
    for (const [span, value] of s.curve?.[kind] ?? []) {
      support.set(span, (support.get(span) ?? 0) + 1);
      const current = best.get(span);
      if (!current || value > current.value) {
        best.set(span, {
          span,
          value,
          activityId: s.id,
          date: s.performed_on,
          name: s.name,
          support: 0,
        });
      }
    }
  }
  return [...best.values()]
    .map((p) => ({ ...p, support: support.get(p.span) ?? 0 }))
    .sort((a, b) => a.span - b.span);
}

/** Längderna CP och CS räknas ur: 3–20 minuter, som i ett CP-test. */
const FIT_MIN_S = 180;
const FIT_MAX_S = 1200;

export type CriticalFit = {
  /** CP i W, eller CS i m/s. */
  critical: number;
  /** W′ i J, eller D′ i m. */
  reserve: number;
  /** Punkterna anpassningen bygger på. */
  spans: number[];
  /** Förklaringsgraden för arbete (sträcka) mot tid. */
  r2: number;
  /** Utanför det rimliga: kurvan är troligen inte maximal i 3–20 min. */
  doubtful: boolean;
};

/**
 * CP och W′ (CS och D′) ur kurvan: arbetet över tid är en rät linje,
 * W = W′ + CP·t, för insatser på 3–20 minuter. Kräver minst tre punkter.
 */
export function fitCritical(
  curve: CurvePoint[],
  kind: CurveKind,
): CriticalFit | null {
  const points = curve.filter(
    (p) => p.span >= FIT_MIN_S && p.span <= FIT_MAX_S,
  );
  if (points.length < 3) return null;
  const t = points.map((p) => p.span);
  const work = points.map((p) => p.value * p.span);
  const fit = linearFit(t, work);
  if (!fit || !(fit.slope > 0)) return null;

  const mean = work.reduce((a, b) => a + b, 0) / work.length;
  const ssTot = work.reduce((s, w) => s + (w - mean) ** 2, 0);
  const ssRes = work.reduce(
    (s, w, i) => s + (w - (fit.intercept + fit.slope * t[i])) ** 2,
    0,
  );
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  // Rimliga spann ur litteraturen: W′ 5–40 kJ, D′ 50–400 m.
  const [lo, hi] = kind === "power" ? [5_000, 40_000] : [50, 400];
  return {
    critical: fit.slope,
    reserve: fit.intercept,
    spans: t,
    r2,
    doubtful: fit.intercept < lo || fit.intercept > hi,
  };
}

export type DistanceBest = {
  span: number;
  label: string;
  /** Sekunder. */
  seconds: number;
  activityId: string;
  date: string;
  name: string;
};

/** Löpningens snabbaste tid på varje distans i perioden. */
export function bestDistances(sources: ProfileSource[]): DistanceBest[] {
  const best = new Map<number, DistanceBest>();
  for (const s of sources) {
    for (const b of s.best ?? []) {
      const current = best.get(b.span);
      if (!current || b.value < current.seconds) {
        best.set(b.span, {
          span: b.span,
          label: b.label,
          seconds: b.value,
          activityId: s.id,
          date: s.performed_on,
          name: s.name,
        });
      }
    }
  }
  return [...best.values()].sort((a, b) => a.span - b.span);
}

/** Längderna som visas i tabellen och som nyckeltal. */
export const KEY_SPANS: Record<CurveKind, number[]> = {
  power: [5, 60, 300, 1200, 3600],
  speed: [60, 300, 1200, 3600],
};

export function spanLabel(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  const h = seconds / 3600;
  return `${Number.isInteger(h) ? h : h.toFixed(1).replace(".", ",")} h`;
}
