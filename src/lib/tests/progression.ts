/**
 * Progression: en adepts tester över tid.
 *
 * Två sorters jämförelse. Laktattesterna jämförs som kurvor – hela testet mot
 * ett tidigare, så att man ser om kurvan flyttat sig åt höger (samma laktat
 * vid högre belastning) eller nedåt (lägre laktat vid samma belastning).
 * Allt annat jämförs som tal över tid: CP, W′, VO2max, VLamax och trösklarna.
 *
 * Trösklarna räknas om ur rådatan här i stället för att läsas ur databasen.
 * Då räknas ett test från 2023 med samma metoder som ett från i dag, och en
 * jämförelse mellan dem jämför atleten, inte två versioner av appen.
 */

import type { IntensityUnit, Sport } from "@/lib/calculators/lactate";
import { analyseSession } from "./analysis";
import {
  cleanPoints,
  heartRateAtIntensity,
  intensityAtLactate,
  lactateAtIntensity,
  type LactatePoint,
} from "./lactate-points";
import { protocolByKey } from "./protocols";
import type { FullSession } from "./session-queries";

export type LactateCurve = {
  sessionId: string;
  performedOn: string;
  sport: Sport;
  unit: IntensityUnit;
  weightKg: number | null;
  points: LactatePoint[];
  lt1: number | null;
  lt2: number | null;
  lt2Method: string | null;
  hrAtLt1: number | null;
  hrAtLt2: number | null;
  at2: number | null;
  at4: number | null;
  /** Wmax/Vmax ur testets all-out-slut, när det finns. */
  peak: number | null;
};

const num = (value: number | string | null | undefined) =>
  value === null || value === undefined ? null : Number(value);

/** Laktattesterna som kurvor, äldst först. */
export function lactateCurves(sessions: FullSession[]): LactateCurve[] {
  return sessions
    .filter((s) => s.protocol === "laktat-steg")
    .map((s) => {
      const points = cleanPoints(
        s.test_efforts
          .filter((e) => e.intensity !== null && e.lactate !== null)
          .map((e) => ({
            intensity: Number(e.intensity),
            lactate: Number(e.lactate),
            heartRate: e.heart_rate === null ? null : Number(e.heart_rate),
          })),
      );

      const analysis = analyseSession({
        protocol: "laktat-steg",
        sport: s.sport,
        unit: s.intensity_unit,
        weightKg: num(s.weight_kg),
        efforts: points.map((p, i) => ({
          ordinal: i + 1,
          intensity: p.intensity,
          lactate: p.lactate,
          heartRate: p.heartRate,
          durationSeconds: null,
          distanceM: null,
        })),
      });
      const find = (key: string) =>
        analysis.metrics.find((m) => m.key === key) ?? null;

      const lt1 = find("LT1")?.value ?? null;
      const lt2 = find("LT2");

      return {
        sessionId: s.id,
        performedOn: s.performed_on,
        sport: s.sport,
        unit: s.intensity_unit,
        weightKg: num(s.weight_kg),
        points,
        lt1,
        lt2: lt2?.value ?? null,
        lt2Method: lt2?.method ?? null,
        hrAtLt1: lt1 === null ? null : heartRateAtIntensity(points, lt1),
        hrAtLt2: lt2 === null ? null : heartRateAtIntensity(points, lt2.value),
        at2: intensityAtLactate(points, 2),
        at4: intensityAtLactate(points, 4),
        peak: num(s.peak_intensity),
      };
    })
    .filter((c) => c.points.length >= 2)
    .sort((a, b) => a.performedOn.localeCompare(b.performedOn));
}

export type CurveComparison = {
  /** Förändring i procent, nu mot då. Positivt är framåt. */
  lt1Pct: number | null;
  lt2Pct: number | null;
  at2Pct: number | null;
  at4Pct: number | null;
  /**
   * Laktatet i båda testerna vid den tidigare LT2 – eller, utan trösklar, vid
   * en belastning båda testerna gick igenom. Samma belastning, lägre laktat
   * är framsteg även när tröskeln inte gått att bestämma.
   */
  probe: { intensity: number; now: number; then: number } | null;
};

const pct = (now: number | null, then: number | null) =>
  now === null || then === null || then === 0
    ? null
    : ((now - then) / then) * 100;

export function compareCurves(
  now: LactateCurve,
  then: LactateCurve,
): CurveComparison {
  const candidates = [then.lt2, then.at4, now.lt2, now.at4].filter(
    (v): v is number => v !== null,
  );

  // Belastningar båda testerna har gått igenom, med den tidigare tröskeln först.
  let probe: CurveComparison["probe"] = null;
  for (const candidate of candidates) {
    const x = Math.round(candidate);
    const a = lactateAtIntensity(now.points, x);
    const b = lactateAtIntensity(then.points, x);
    if (a !== null && b !== null) {
      probe = { intensity: x, now: a, then: b };
      break;
    }
  }
  if (!probe) {
    // Sista utvägen: den högsta belastning som finns i båda.
    const common = now.points
      .map((p) => p.intensity)
      .filter((x) => then.points.some((q) => q.intensity === x));
    const x = common.length > 0 ? Math.max(...common) : null;
    if (x !== null) {
      probe = {
        intensity: x,
        now: lactateAtIntensity(now.points, x) as number,
        then: lactateAtIntensity(then.points, x) as number,
      };
    }
  }

  return {
    lt1Pct: pct(now.lt1, then.lt1),
    lt2Pct: pct(now.lt2, then.lt2),
    at2Pct: pct(now.at2, then.at2),
    at4Pct: pct(now.at4, then.at4),
    probe,
  };
}

// ---------------------------------------------------------------------------
// Tal över tid
// ---------------------------------------------------------------------------

export type TrendPoint = {
  sessionId: string;
  performedOn: string;
  value: number;
  protocol: string;
};

export type Trend = {
  key: string;
  label: string;
  unit: string;
  /** Om ett högre värde är bättre. VLamax har ingen riktning – det beror på målet. */
  higherIsBetter: boolean | null;
  points: TrendPoint[];
};

/**
 * Storheterna som följs, i den ordning de visas. Trösklarna först – de är
 * vad de flesta tester finns till för.
 */
const TRACKED: {
  key: string;
  label: string;
  higherIsBetter: boolean | null;
}[] = [
  { key: "LT2", label: "LT2 – anaerob tröskel", higherIsBetter: true },
  { key: "LT1", label: "LT1 – aerob tröskel", higherIsBetter: true },
  { key: "I_4mmol", label: "Vid 4 mmol", higherIsBetter: true },
  { key: "CP", label: "Critical power", higherIsBetter: true },
  { key: "W_prime", label: "W′", higherIsBetter: true },
  { key: "CS", label: "Critical speed", higherIsBetter: true },
  { key: "D_prime", label: "D′", higherIsBetter: true },
  { key: "FTP", label: "FTP", higherIsBetter: true },
  { key: "Pmax", label: "Wmax / Vmax", higherIsBetter: true },
  { key: "VO2max", label: "VO2max", higherIsBetter: true },
  { key: "VLamax", label: "VLamax", higherIsBetter: null },
  { key: "FatMax", label: "FatMax", higherIsBetter: true },
  { key: "LT2_per_kg", label: "LT2 per kg", higherIsBetter: true },
  { key: "CP_per_kg", label: "CP per kg", higherIsBetter: true },
];

/**
 * En serie per storhet, äldst först. Laktattesternas trösklar tas ur
 * omräkningen, allt annat ur de sparade värdena. Samma storhet i olika
 * enheter (LT2 i watt på cykeln, km/h i löpningen) blir olika serier – en
 * linje som hoppar mellan watt och km/h betyder ingenting.
 */
export function metricTrends(
  sessions: FullSession[],
  curves: LactateCurve[],
): Trend[] {
  const bySession = new Map(curves.map((c) => [c.sessionId, c]));
  const series = new Map<string, Trend>();

  const add = (key: string, unit: string, point: TrendPoint) => {
    const tracked = TRACKED.find((t) => t.key === key);
    if (!tracked || !Number.isFinite(point.value)) return;
    const id = `${key}|${unit}`;
    const trend =
      series.get(id) ??
      ({
        key,
        label: tracked.label,
        unit,
        higherIsBetter: tracked.higherIsBetter,
        points: [],
      } satisfies Trend);
    trend.points.push(point);
    series.set(id, trend);
  };

  for (const s of sessions) {
    const curve = bySession.get(s.id);
    const base = {
      sessionId: s.id,
      performedOn: s.performed_on,
      protocol: s.protocol,
    };

    if (curve) {
      if (curve.lt1 !== null)
        add("LT1", curve.unit, { ...base, value: curve.lt1 });
      if (curve.lt2 !== null)
        add("LT2", curve.unit, { ...base, value: curve.lt2 });
      if (curve.at4 !== null)
        add("I_4mmol", curve.unit, { ...base, value: curve.at4 });
      if (curve.lt2 !== null && curve.weightKg && curve.unit === "W") {
        add("LT2_per_kg", "W/kg", {
          ...base,
          value: curve.lt2 / curve.weightKg,
        });
      }
    }

    // Samma storhet kan finnas med flera metoder. Primärvärdet går före; utan
    // ett sådant tas första raden.
    const seen = new Set<string>();
    const ordered = [...s.test_metrics].sort(
      (a, b) => Number(b.is_primary) - Number(a.is_primary),
    );
    for (const m of ordered) {
      if (m.key.includes(":")) continue;
      if (curve && ["LT1", "LT2", "I_4mmol", "LT2_per_kg"].includes(m.key))
        continue;
      if (seen.has(m.key)) continue;
      seen.add(m.key);
      add(m.key, m.unit, { ...base, value: Number(m.value) });
    }
  }

  const order = (key: string) => TRACKED.findIndex((t) => t.key === key);
  return [...series.values()]
    .map((t) => ({
      ...t,
      points: t.points.sort((a, b) =>
        a.performedOn.localeCompare(b.performedOn),
      ),
    }))
    .sort(
      (a, b) =>
        order(a.key) - order(b.key) || b.points.length - a.points.length,
    );
}

/** Protokollets namn, för tooltips. */
export const protocolLabel = (key: string) => protocolByKey(key)?.label ?? key;
