/**
 * TSS för ett genomfört pass, också när filen saknar effekt. Räknas ur det
 * som sparades när filen laddades upp – tiden, sträckan, farten, pulsen och
 * tiden i pulszoner – mot trösklarna som gällde den dagen, så att ett test
 * som görs senare inte ändrar gamla pass.
 *
 * - **TSS** (effekt): ur filen, NP genom FTP. Räknades när filen laddades upp.
 * - **rTSS** (löpning med fart): timmar × IF² × 100, där IF är den
 *   normaliserade farten genom tröskelfarten. Äldre pass saknar den
 *   normaliserade farten och räknas på snittfarten i rörelse, som ger något
 *   lägre värden för intervallpass. Tröskelfarten är LT2 ur ett laktattest,
 *   annars 0,95 × CS (som för planerade pass, workouts/load.ts).
 * - **sTSS** (simning): timmar × IF³ × 100, IF = sträckan genom tiden i
 *   rörelse, genom CSS (CS ur ett simtest).
 * - **hrTSS** (puls): tiden i Friels pulszoner mot tröskelpulsen, med poäng
 *   per timme ur zonens motsvarande IF i kvadrat, så att en timme på
 *   tröskeln ger omkring 100. Pulsen ligger efter i korta intervaller, så
 *   hård träning blir något för lågt räknad. Utan zontid räknas
 *   snittpulsens zon.
 *
 * Modulen är ren, utan anrop.
 */

import type { ReferenceCandidate } from "./reference";
import type { ZoneTime } from "./analysis";

export type TssKind = "TSS" | "rTSS" | "sTSS" | "hrTSS";

export type ActivityTss = {
  tss: number;
  kind: TssKind;
  intensityFactor: number | null;
};

/** Trösklarna ett pass räknas mot, de som gällde passets dag. */
export type Thresholds = {
  /** Tröskelfart i löpning, m/s. */
  runSpeed: number | null;
  /** CSS i simning, m/s. */
  css: number | null;
  /** Tröskelpuls. */
  lthr: number | null;
};

const mps = (v: number, unit: string) =>
  unit === "m/s" ? v : unit === "km/h" ? v / 3.6 : null;
const bpm = (v: number, unit: string) => (unit === "slag/min" ? v : null);

type Hit = { value: number; on: string };

/** Värdena för en nyckel, omräknade, med dagen de mättes. */
function hitsOf(
  candidates: ReferenceCandidate[],
  sport: string | null,
  key: string,
  convert: (v: number, unit: string) => number | null,
): Hit[] {
  return candidates
    .filter((c) => sport === null || c.sport === sport)
    .flatMap((c) => {
      const m = c.metrics.find((x) => x.key === key);
      const value = m ? convert(Number(m.value), m.unit) : null;
      return value !== null && value > 0 ? [{ value, on: c.performedOn }] : [];
    });
}

/**
 * Senaste värdet till och med dagen; finns inget, det första efter – som
 * pickReference. Ett senare test tar aldrig över ett tidigare.
 */
function latest(hits: Hit[], date: string): Hit | null {
  const before = hits
    .filter((h) => h.on <= date)
    .sort((a, b) => b.on.localeCompare(a.on));
  return (
    before[0] ?? [...hits].sort((a, b) => a.on.localeCompare(b.on))[0] ?? null
  );
}

export function thresholdsOn(
  candidates: ReferenceCandidate[],
  date: string,
): Thresholds {
  // Löpningens tröskel: det senaste av LT2 och CS, LT2 som den är och CS
  // nedräknad till tröskeln.
  const run = latest(
    [
      ...hitsOf(candidates, "löpning", "LT2", mps),
      ...hitsOf(candidates, "löpning", "CS", mps).map((h) => ({
        ...h,
        value: h.value * 0.95,
      })),
    ],
    date,
  );
  return {
    runSpeed: run?.value ?? null,
    css: latest(hitsOf(candidates, "simning", "CS", mps), date)?.value ?? null,
    lthr: latest(hitsOf(candidates, null, "LTHR", bpm), date)?.value ?? null,
  };
}

/**
 * Friels pulszoner (Z1–Z5) som IF: zonens mitt som andel av tröskeln i
 * Coggans effektnivåer – återhämtning, uthållighet, tempo, under tröskeln,
 * över tröskeln. Poäng per timme: 25, 42, 69, 90 och 110.
 */
const HR_ZONE_IF = [0.5, 0.65, 0.83, 0.95, 1.05];
/** Zongränserna på cykel, som andel av tröskelpulsen (analysis.ts). */
const HR_CUTS = [0.81, 0.9, 0.94, 1.0];

export type TssInput = {
  sport: string;
  moving_s: number | null;
  duration_s: number | null;
  distance_m: number | null;
  /** Ur filen, när den hade effekt. */
  tss: number | null;
  intensity_factor: number | null;
  /** km/h, i rörelse. */
  avg_speed: number | null;
  /** km/h, normaliserad som NP; saknas i äldre pass. */
  normalized_speed?: number | null;
  avg_hr: number | null;
  hr_zones: ZoneTime[] | null;
};

const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

export function activityTss(a: TssInput, t: Thresholds): ActivityTss | null {
  const seconds = a.moving_s ?? a.duration_s;
  if (!seconds || !(seconds > 0)) return null;
  const hours = seconds / 3600;

  if (finite(a.tss) && a.tss > 0) {
    return {
      tss: a.tss,
      kind: "TSS",
      intensityFactor: finite(a.intensity_factor) ? a.intensity_factor : null,
    };
  }

  const speed = finite(a.normalized_speed)
    ? a.normalized_speed
    : finite(a.avg_speed)
      ? a.avg_speed
      : null;
  if (a.sport === "löpning" && speed && t.runSpeed) {
    const ifactor = speed / 3.6 / t.runSpeed;
    return {
      tss: hours * ifactor ** 2 * 100,
      kind: "rTSS",
      intensityFactor: ifactor,
    };
  }

  if (a.sport === "simning" && a.distance_m && a.distance_m > 0 && t.css) {
    const ifactor = a.distance_m / seconds / t.css;
    return {
      tss: hours * ifactor ** 3 * 100,
      kind: "sTSS",
      intensityFactor: ifactor,
    };
  }

  if (t.lthr) {
    const zones = (a.hr_zones ?? []).filter(
      (z) => finite(z.seconds) && z.seconds > 0,
    );
    if (zones.length > 0) {
      const tss = zones.reduce((sum, z) => {
        const index = Number(/Z(\d)/.exec(z.zone)?.[1] ?? 0) - 1;
        const ifactor = HR_ZONE_IF[Math.min(Math.max(index, 0), 4)];
        return sum + (z.seconds / 3600) * ifactor ** 2 * 100;
      }, 0);
      return { tss, kind: "hrTSS", intensityFactor: null };
    }
    if (finite(a.avg_hr) && a.avg_hr > 0) {
      const share = a.avg_hr / t.lthr;
      const zone = HR_CUTS.findIndex((cut) => share <= cut);
      const ifactor = HR_ZONE_IF[zone === -1 ? 4 : zone];
      return {
        tss: hours * ifactor ** 2 * 100,
        kind: "hrTSS",
        intensityFactor: null,
      };
    }
  }
  return null;
}
