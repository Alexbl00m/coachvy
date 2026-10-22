/**
 * En sparad bikefit i korthet: det ur videoanalysen som behövs för rapporten
 * och uppföljningen, utan bildserien. Ren modul.
 */

import type { BdcReading, ClipAnalysis } from "./chain";
import type { Discipline } from "./templates";

export type BikeFitAnalysis = {
  /** Posemodellen som hittade punkterna. */
  model: string;
  fps: number;
  frames: number;
  durationS: number;
  side: "left" | "right" | null;
  cadenceRpm: number | null;
  problems: string[];
  sideRatio: number | null;
  lowConfShare: number;
  /** Varje varvs nedre dödläge. */
  bdc: BdcReading[];
  kneeSpread: number | null;
  /** Knäböjningen var tionde sekund-del, för kurvan i rapporten. */
  kneeSeries: (number | null)[];
};

/** Analysen kortad till det som sparas. */
export function summariseAnalysis(
  a: ClipAnalysis,
  model: string,
  points = 600,
): BikeFitAnalysis {
  const step = Math.max(1, Math.ceil(a.series.knee.length / points));
  const kneeSeries: (number | null)[] = [];
  for (let i = 0; i < a.series.knee.length; i += step) {
    const v = a.series.knee[i];
    kneeSeries.push(v === null ? null : Math.round(v * 10) / 10);
  }
  return {
    model,
    fps: a.fps,
    frames: a.frames,
    durationS: a.check.durationS,
    side: a.side,
    cadenceRpm: a.cadenceRpm,
    problems: a.check.problems,
    sideRatio: a.check.sideRatio,
    lowConfShare: a.check.lowConfShare,
    bdc: a.bdc.map((b) => ({
      at: Math.round(b.at * 10) / 10,
      flex: Math.round(b.flex * 100) / 100,
    })),
    kneeSpread: a.kneeSpread,
    kneeSeries,
  };
}

export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  landsväg: "Landsväg",
  gravel: "Gravel",
  tempo: "Tempo / triathlon",
  mtb: "Mountainbike",
};

/** Var filerna ligger i hinken. */
export const fitPath = (adeptId: string, fitId: string, file: string) =>
  `${adeptId}/${fitId}/${file}`;

/**
 * Fiten att jämföra med: den närmast äldre i samma gren. Listan är nyast
 * först, som `listFits` ger den.
 */
export function previousFit<T extends { id: string; discipline: Discipline }>(
  fits: T[],
  fit: T,
): T | null {
  const i = fits.findIndex((f) => f.id === fit.id);
  if (i < 0) return null;
  return fits.slice(i + 1).find((f) => f.discipline === fit.discipline) ?? null;
}
