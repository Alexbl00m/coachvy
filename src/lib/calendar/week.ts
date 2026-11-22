/**
 * En hel vecka i kalendern: att flytta eller kopiera alla pass i en vecka
 * till samma veckodag i en annan vecka. Ren modul, för webbläsaren och
 * serveråtgärden.
 */

import {
  addDays,
  daysBetween,
  isoWeek,
  monthName,
  mondayOf,
} from "@/lib/season/season";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Veckans måndag, eller null när datumet inte är ett datum. */
export function weekStart(date: string): string | null {
  return ISO_DATE.test(date) ? mondayOf(date) : null;
}

/** Dagen ett pass hamnar på när veckan flyttas: samma veckodag. */
export const shiftToWeek = (date: string, from: string, to: string) =>
  addDays(date, daysBetween(mondayOf(from), mondayOf(to)));

const month3 = (iso: string) =>
  monthName(Number(iso.slice(5, 7)) - 1).slice(0, 3);
const dayOf = (iso: string) => Number(iso.slice(8, 10));

/**
 * "v. 50 · 7–13 dec", "v. 49 · 30 nov–6 dec". Året skrivs ut när veckan
 * slutar ett annat år än `year`.
 */
export function weekLabel(monday: string, year?: string): string {
  const sunday = addDays(monday, 6);
  const days =
    monday.slice(5, 7) === sunday.slice(5, 7)
      ? `${dayOf(monday)}–${dayOf(sunday)} ${month3(sunday)}`
      : `${dayOf(monday)} ${month3(monday)}–${dayOf(sunday)} ${month3(sunday)}`;
  const yearText =
    year && sunday.slice(0, 4) !== year ? ` ${sunday.slice(0, 4)}` : "";
  return `v. ${isoWeek(monday)} · ${days}${yearText}`;
}

/**
 * Veckorna att flytta en vecka till: några bakåt och ett halvår framåt,
 * utan veckan själv.
 */
export function weekChoices(
  monday: string,
  before = 4,
  after = 26,
): { monday: string; label: string }[] {
  const start = mondayOf(monday);
  const year = start.slice(0, 4);
  return Array.from({ length: before + after + 1 }, (_, i) =>
    addDays(start, (i - before) * 7),
  )
    .filter((m) => m !== start)
    .map((m) => ({ monday: m, label: weekLabel(m, year) }));
}
