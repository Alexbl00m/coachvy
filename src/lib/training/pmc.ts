/**
 * Fitness, trötthet och form ur TSS dag för dag – Banisters
 * impuls–respons-modell som Coggans Performance Manager räknar den:
 *
 * - **CTL** (fitness): ett exponentiellt glidande medel av TSS per dag med
 *   tidskonstanten 42 dagar.
 * - **ATL** (trötthet): samma med 7 dagar.
 * - **TSB** (form): CTL − ATL. Negativ under belastning, positiv när
 *   tröttheten släppt.
 *
 * Bakåt räknas det genomförda; från i dag och framåt planen, så att formen
 * inför ett lopp eller efter ett läger går att se innan veckorna är
 * gjorda. Serien börjar på noll, så de första veckorna i en kort historik
 * underskattar fitness – därför räknas den från flera månader före det som
 * visas.
 *
 * Talen är en modell av belastningen, inte av idrottaren. Filosofin läser
 * dem mot effekt, puls och upplevd ansträngning (avsnitt 22), inte ensamma.
 *
 * Modulen är ren, utan anrop.
 */

import { addDays, daysBetween } from "@/lib/season/season";

export const CTL_DAYS = 42;
export const ATL_DAYS = 7;
/** Så långt bakåt serien börjar räknas, så att fitness hinner byggas upp. */
export const PMC_WARMUP_DAYS = 180;

export type PmcPoint = {
  date: string;
  /** TSS den dagen: genomfört, eller planerat när dagen inte är gjord. */
  tss: number;
  /** Efter dagen. */
  ctl: number;
  atl: number;
  /** Formen efter dagen, CTL − ATL. */
  tsb: number;
  /** Dagen räknas ur planen. */
  projected: boolean;
};

/**
 * Serien från `from` till `to`. En dag före i dag räknas ur det genomförda;
 * i dag och framåt ur det genomförda när något är gjort, annars planen.
 */
export function pmcSeries(input: {
  from: string;
  to: string;
  today: string;
  done: Map<string, number>;
  planned: Map<string, number>;
}): PmcPoint[] {
  const days = daysBetween(input.from, input.to);
  const points: PmcPoint[] = [];
  let ctl = 0;
  let atl = 0;
  for (let i = 0; i <= days; i += 1) {
    const date = addDays(input.from, i);
    const done = input.done.get(date) ?? 0;
    const projected = date >= input.today && done === 0;
    const tss = projected ? (input.planned.get(date) ?? 0) : done;
    ctl += (tss - ctl) / CTL_DAYS;
    atl += (tss - atl) / ATL_DAYS;
    points.push({ date, tss, ctl, atl, tsb: ctl - atl, projected });
  }
  return points;
}

export type WeekForm = {
  /** Efter veckans söndag. */
  ctl: number;
  atl: number;
  tsb: number;
  /** Fitness efter veckan mot efter veckan före: rampen. */
  ramp: number | null;
  /** Något i veckan räknas ur planen. */
  projected: boolean;
};

/** Formen efter en vecka, ur serien. Null när veckan ligger utanför. */
export function weekForm(points: PmcPoint[], monday: string): WeekForm | null {
  const index = new Map(points.map((p, i) => [p.date, i]));
  const end = index.get(addDays(monday, 6));
  if (end === undefined) return null;
  const last = points[end];
  const before = index.get(addDays(monday, -1));
  const week = points.slice(Math.max(0, end - 6), end + 1);
  return {
    ctl: last.ctl,
    atl: last.atl,
    tsb: last.tsb,
    ramp: before === undefined ? null : last.ctl - points[before].ctl,
    projected: week.some((p) => p.projected && p.tss > 0),
  };
}

/** TSS per dag ur en lista. */
export function dailyTss(
  items: { date: string; tss: number | null | undefined }[],
): Map<string, number> {
  const out = new Map<string, number>();
  for (const { date, tss } of items) {
    if (tss && tss > 0) out.set(date, (out.get(date) ?? 0) + tss);
  }
  return out;
}
