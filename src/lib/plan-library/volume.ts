/**
 * Veckans volym: det som skiljer nivåerna åt.
 *
 * Mallen anger volymen per vecka och nivå, i kilometer eller timmar. Passen
 * i veckan täcker en del av den; resten fylls ut med lugn löpning. Hur
 * mycket det blir räknas ur passens längd med löparens egna tempon – utan
 * tempon, eller med pass som saknar längd, blir det en grov uppgift och
 * sägs vara det.
 *
 * Modulen är ren.
 */

import type { VolumeUnit, WeekVolume } from "./types";

export type VolumeRange = { min: number; max: number | null };

export function volumeFor(
  volumes: WeekVolume[],
  weekId: string,
  levelId: string,
): VolumeRange | null {
  const v = volumes.find((x) => x.weekId === weekId && x.levelId === levelId);
  return v ? { min: v.min, max: v.max } : null;
}

const num = (n: number) =>
  (Math.round(n * 10) / 10).toString().replace(".", ",");

/** "55–65 km", "8 h". */
export function volumeText(range: VolumeRange, unit: VolumeUnit): string {
  const max = range.max !== null && range.max > range.min ? range.max : null;
  return `${num(range.min)}${max !== null ? `–${num(max)}` : ""} ${unit}`;
}

export type PlannedPart = { metres: number | null; seconds: number | null };

export type VolumeSummary = {
  target: VolumeRange;
  unit: VolumeUnit;
  /** Det passen täcker, i volymens enhet. */
  planned: number;
  /** Pass som inte gick att räkna in. */
  unknown: number;
  /** Det som är kvar att fylla med lugn löpning. Null: passen räcker. */
  fill: VolumeRange | null;
};

export function summarizeVolume(input: {
  target: VolumeRange;
  unit: VolumeUnit;
  sessions: PlannedPart[];
}): VolumeSummary {
  const { target, unit } = input;
  let planned = 0;
  let unknown = 0;
  for (const s of input.sessions) {
    const value =
      unit === "km"
        ? s.metres !== null
          ? s.metres / 1000
          : null
        : s.seconds !== null
          ? s.seconds / 3600
          : null;
    if (value === null) unknown += 1;
    else planned += value;
  }
  const left = (n: number) => Math.max(0, n - planned);
  const min = left(target.min);
  const max = target.max !== null ? left(target.max) : null;
  return {
    target,
    unit,
    planned,
    unknown,
    fill:
      min > 0 || (max !== null && max > 0)
        ? { min, max: max !== null && max > min ? max : null }
        : null,
  };
}
