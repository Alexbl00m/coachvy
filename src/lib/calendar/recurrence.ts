/**
 * Ett pass som återkommer: samma veckodagar ett antal veckor framåt, med
 * början på en dag. "Varje onsdag i fyra veckor" blir fyra datum. Ren modul.
 */

import { addDays, mondayOf, weekdayIndex } from "@/lib/season/season";

/** Veckodagarna, måndag först – samma index som `weekdayIndex`. */
export const WEEKDAYS = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

/** Taket: ett år av ett pass i veckan. */
export const MAX_DATES = 52;

export type Recurrence = {
  /** Första dagen, YYYY-MM-DD. Inget datum före den kommer med. */
  start: string;
  /** Veckodagar, 0 = måndag. */
  weekdays: number[];
  /** Antal veckor, räknat från startdagens vecka. */
  weeks: number;
};

/** Datumen, i ordning, högst `MAX_DATES`. */
export function recurringDates({
  start,
  weekdays,
  weeks,
}: Recurrence): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || weeks < 1) return [];
  const days = [...new Set(weekdays)]
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    .sort((a, b) => a - b);
  const monday = mondayOf(start);
  const out: string[] = [];
  for (let week = 0; week < weeks; week += 1) {
    for (const day of days) {
      const date = addDays(monday, week * 7 + day);
      if (date >= start) out.push(date);
      if (out.length >= MAX_DATES) return out;
    }
  }
  return out;
}

/** Startdagens veckodag, som förval. */
export const weekdayOf = (iso: string) => weekdayIndex(iso);
