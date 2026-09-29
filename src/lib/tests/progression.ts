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
import {
  UTILISATION_RANGES,
  vo2AtIntensity,
  vo2maxFromRampPeak,
} from "./vo2max";

// ---------------------------------------------------------------------------
// VO2max och utnyttjandegrad
// ---------------------------------------------------------------------------

/** Ett VO2max att räkna utnyttjandegraden mot, och var det kom ifrån. */
export type Vo2Source = {
  sessionId: string;
  performedOn: string;
  sport: Sport;
  /** ml/kg/min */
  value: number;
  weightKg: number | null;
  measured: boolean;
  method: string;
};

/**
 * Alla VO2max adepten har, uppmätta och skattade.
 *
 * Ett laktattest utan eget VO2max lånar det närmaste i tid från ett annat
 * test i samma gren – ett 5-minuterstest, ett ramptest eller ett labbvärde.
 */
export function vo2maxSources(sessions: FullSession[]): Vo2Source[] {
  const out: Vo2Source[] = [];
  for (const s of sessions) {
    const base = {
      sessionId: s.id,
      performedOn: s.performed_on,
      sport: s.sport,
      weightKg: num(s.weight_kg),
    };
    if (s.vo2max !== null && Number(s.vo2max) > 0) {
      out.push({
        ...base,
        value: Number(s.vo2max),
        measured: true,
        method: "uppmätt",
      });
      continue;
    }
    const stored = s.test_metrics
      .filter((m) => m.key === "VO2max" && Number(m.value) > 0)
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))[0];
    if (stored) {
      out.push({
        ...base,
        value: Number(stored.value),
        measured: stored.method === "uppmätt",
        method: stored.method ?? "skattad",
      });
      continue;
    }
    // Ett stegtest med ramp sist som sparades innan skattningen fanns.
    const peak = num(s.peak_intensity);
    if (
      s.protocol === "laktat-steg" &&
      s.intensity_unit === "W" &&
      peak &&
      base.weightKg
    ) {
      out.push({
        ...base,
        value: vo2maxFromRampPeak(peak, base.weightKg),
        measured: false,
        method: "Hawley–Noakes ur Wmax",
      });
    }
  }
  return out;
}

const DAY = 86_400_000;

/** Det VO2max ett test ska räknas mot: testets eget, annars det närmaste i tid. */
export function vo2maxFor(
  sources: Vo2Source[],
  session: { id: string; performed_on: string; sport: Sport },
): Vo2Source | null {
  const own = sources.find((v) => v.sessionId === session.id);
  if (own) return own;
  const at = Date.parse(session.performed_on);
  return (
    sources
      .filter((v) => v.sport === session.sport)
      .sort(
        (a, b) =>
          Math.abs(Date.parse(a.performedOn) - at) -
            Math.abs(Date.parse(b.performedOn) - at) ||
          Number(b.measured) - Number(a.measured),
      )[0] ?? null
  );
}

/**
 * Tröskeln i procent av VO2max.
 *
 * Absoluta tal (ml/min), så att en tröskel vid 80 kg och ett VO2max mätt vid
 * 79 kg jämförs rätt.
 */
export function utilisation(
  intensity: number | null,
  unit: IntensityUnit,
  weightKg: number | null,
  source: Vo2Source | null,
): number | null {
  if (intensity === null || !source) return null;
  const kg = weightKg ?? source.weightKg;
  if (!kg) return null;
  const max = source.value * (source.weightKg ?? kg);
  return (vo2AtIntensity(intensity, unit, kg) / max) * 100;
}

/** Hur långt från testet VO2max är lånat, i dagar. 0 när det är testets eget. */
export const daysBetween = (a: string, b: string) =>
  Math.round(Math.abs(Date.parse(a) - Date.parse(b)) / DAY);

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
  /** VO2max tröskeln räknas mot – testets eget eller det närmaste i tid. */
  vo2max: Vo2Source | null;
  lt1PctVo2max: number | null;
  lt2PctVo2max: number | null;
};

const num = (value: number | string | null | undefined) =>
  value === null || value === undefined ? null : Number(value);

/** Laktattesterna som kurvor, äldst först. */
export function lactateCurves(sessions: FullSession[]): LactateCurve[] {
  const sources = vo2maxSources(sessions);
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
      const vo2max = vo2maxFor(sources, s);
      const kg = num(s.weight_kg);

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
        vo2max,
        lt1PctVo2max: utilisation(lt1, s.intensity_unit, kg, vo2max),
        lt2PctVo2max: utilisation(
          lt2?.value ?? null,
          s.intensity_unit,
          kg,
          vo2max,
        ),
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
  /** Unik per serie: storhet, enhet och – för VDOT och fartvariation – test. */
  id: string;
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
  /**
   * En serie per test. VDOT ur ett 5 km-test och ur ett halvmaraton skiljer
   * sig med atletens fartprofil, inte med formen: i samma linje ser en löpare
   * som tappar mycket fart på långa distanser ut att gå bakåt.
   */
  byProtocol?: boolean;
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
  { key: "VO2max", label: "VO2max – uppmätt", higherIsBetter: true },
  { key: "VO2max_est", label: "VO2max – skattat", higherIsBetter: true },
  { key: "VLamax", label: "VLamax", higherIsBetter: null },
  { key: "FatMax", label: "FatMax", higherIsBetter: true },
  // Tröskelfarten ur löptesterna är 88 % av VDOT – samma kurva en gång till.
  { key: "VDOT", label: "VDOT", higherIsBetter: true, byProtocol: true },
  {
    key: "PACE_cv",
    label: "Fartvariation",
    higherIsBetter: false,
    byProtocol: true,
  },
  { key: "U_LT2", label: "LT2 i % av VO2max", higherIsBetter: true },
  { key: "U_LT1", label: "LT1 i % av VO2max", higherIsBetter: true },
  { key: "U_CP", label: "CP i % av VO2max", higherIsBetter: true },
  { key: "LT2_per_kg", label: "LT2 per kg", higherIsBetter: true },
  { key: "CP_per_kg", label: "CP per kg", higherIsBetter: true },
];

/**
 * En serie per storhet, äldst först. Laktattesternas trösklar tas ur
 * omräkningen, allt annat ur de sparade värdena. Samma storhet i olika
 * enheter (LT2 i watt på cykeln, km/h i löpningen) blir olika serier – en
 * linje som hoppar mellan watt och km/h betyder ingenting.
 */
/** Seriernas namn när en storhet delas per test. */
const SERIES_NAMES: Record<string, string> = {
  "lopp-5km": "5 km-test",
  "lopp-20min": "20 min-test",
  lopp: "lopp",
};

export function metricTrends(
  sessions: FullSession[],
  curves: LactateCurve[],
): Trend[] {
  const bySession = new Map(curves.map((c) => [c.sessionId, c]));
  const series = new Map<string, Trend>();
  const sources = vo2maxSources(sessions);

  const add = (key: string, unit: string, point: TrendPoint) => {
    const tracked = TRACKED.find((t) => t.key === key);
    if (!tracked || !Number.isFinite(point.value)) return;
    const test = tracked.byProtocol ? point.protocol : "";
    const id = `${key}|${unit}|${test}`;
    const trend =
      series.get(id) ??
      ({
        id,
        key,
        label: test
          ? `${tracked.label} – ${SERIES_NAMES[test] ?? protocolLabel(test)}`
          : tracked.label,
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
      if (curve.lt1PctVo2max !== null)
        add("U_LT1", "%", { ...base, value: curve.lt1PctVo2max });
      if (curve.lt2PctVo2max !== null)
        add("U_LT2", "%", { ...base, value: curve.lt2PctVo2max });
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
      // Uppmätt och skattat VO2max är olika serier. I samma linje ser ett
      // labbvärde följt av en 5-minutersskattning ut som en nedgång.
      const key =
        m.key === "VO2max" && m.method !== "uppmätt" ? "VO2max_est" : m.key;
      add(key, m.unit, { ...base, value: Number(m.value) });
      if (m.key === "CP" && m.unit === "W") {
        const pct = utilisation(
          Number(m.value),
          "W",
          num(s.weight_kg),
          vo2maxFor(sources, s),
        );
        if (pct !== null) add("U_CP", "%", { ...base, value: pct });
      }
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

// ---------------------------------------------------------------------------
// Utnyttjandegraden just nu
// ---------------------------------------------------------------------------

export type UtilisationRange = { from: number; to: number; note?: string };

export type UtilisationRow = {
  key: string;
  label: string;
  intensity: number;
  unit: IntensityUnit;
  pct: number;
  performedOn: string;
  protocol: string;
  /** Det VO2max raden räknas mot – det närmaste i tid. */
  vo2max: Vo2Source;
  range: UtilisationRange | null;
};

export type UtilisationSummary = {
  rows: UtilisationRow[];
  /** VO2max för det senaste testet – det kortet räknar mot i första hand. */
  vo2max: Vo2Source;
  /** LT1 i procent av LT2 ur samma test. */
  lt1OfLt2: number | null;
  sport: Sport;
};

/**
 * Trösklarna som går att räkna utnyttjandegrad på, i den ordning de brukar
 * ligga. Olika tester ger olika markörer – ett laktattest LT1 och LT2, den
 * metabola profilen anaerob tröskel och FatMax, ett CP-test CP och FTP – och
 * alla tas med, så att ingen försvinner för att den heter något annat.
 */
const MARKERS: {
  key: string;
  label: string;
  range: UtilisationRange | null;
}[] = [
  { key: "FatMax", label: "FatMax", range: UTILISATION_RANGES.FatMax },
  { key: "LT1", label: "LT1 – aerob tröskel", range: UTILISATION_RANGES.LT1 },
  { key: "CarbMax", label: "CarbMax 90 g/h", range: null },
  { key: "LT2", label: "LT2 – anaerob tröskel", range: UTILISATION_RANGES.LT2 },
  { key: "AT", label: "Anaerob tröskel (Mader)", range: UTILISATION_RANGES.LT2 },
  { key: "T_speed", label: "Tröskelfart (Daniels)", range: UTILISATION_RANGES.LT2 },
  { key: "FTP", label: "FTP", range: UTILISATION_RANGES.LT2 },
  { key: "I_4mmol", label: "4 mmol (OBLA)", range: UTILISATION_RANGES.LT2 },
  { key: "CP", label: "Critical power", range: UTILISATION_RANGES.LT2 },
  { key: "CS", label: "Critical speed", range: UTILISATION_RANGES.LT2 },
];

/**
 * Varje tröskel i procent av VO2max, från det senaste testet som har den och
 * räknad mot det VO2max som ligger närmast det testet i tid. Laktattestets
 * trösklar tas ur omräkningen, resten ur de sparade värdena.
 */
export function latestUtilisation(
  sessions: FullSession[],
  curves: LactateCurve[],
): UtilisationSummary | null {
  const sources = vo2maxSources(sessions);
  const found = new Map<
    string,
    {
      intensity: number;
      unit: IntensityUnit;
      performedOn: string;
      protocol: string;
      session: FullSession;
    }
  >();
  const offer = (
    key: string,
    intensity: number | null,
    unit: string,
    session: FullSession,
  ) => {
    if (intensity === null || !(intensity > 0)) return;
    if (unit !== "W" && unit !== "km/h" && unit !== "m/s") return;
    const current = found.get(key);
    if (current && current.performedOn >= session.performed_on) return;
    found.set(key, {
      intensity,
      unit: unit as IntensityUnit,
      performedOn: session.performed_on,
      protocol: session.protocol,
      session,
    });
  };

  const bySession = new Map(curves.map((c) => [c.sessionId, c]));
  for (const s of sessions) {
    const curve = bySession.get(s.id);
    if (curve) {
      offer("LT1", curve.lt1, curve.unit, s);
      offer("LT2", curve.lt2, curve.unit, s);
      offer("I_4mmol", curve.at4, curve.unit, s);
    }
    for (const m of s.test_metrics) {
      if (curve && ["LT1", "LT2", "I_4mmol"].includes(m.key)) continue;
      if (MARKERS.some((k) => k.key === m.key)) {
        offer(m.key, Number(m.value), m.unit, s);
      }
    }
  }

  const rows: UtilisationRow[] = [];
  for (const marker of MARKERS) {
    const hit = found.get(marker.key);
    if (!hit) continue;
    const vo2max = vo2maxFor(sources, hit.session);
    const pct = utilisation(
      hit.intensity,
      hit.unit,
      num(hit.session.weight_kg),
      vo2max,
    );
    if (pct === null || !vo2max) continue;
    rows.push({
      key: marker.key,
      label: marker.label,
      intensity: hit.intensity,
      unit: hit.unit,
      pct,
      performedOn: hit.performedOn,
      protocol: hit.protocol,
      vo2max,
      range: marker.range,
    });
  }
  if (rows.length === 0) return null;

  const newest = rows.reduce((a, b) => (a.performedOn > b.performedOn ? a : b));
  const curve = [...curves]
    .reverse()
    .find((c) => c.lt1 !== null && c.lt2 !== null && c.lt2 > 0);

  return {
    rows: rows.sort((a, b) => a.pct - b.pct),
    vo2max: newest.vo2max,
    lt1OfLt2:
      curve && curve.lt1 !== null && curve.lt2 !== null
        ? (curve.lt1 / curve.lt2) * 100
        : null,
    sport: newest.vo2max.sport,
  };
}
