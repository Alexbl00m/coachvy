/**
 * Faserna i kö: planer efter varandra på en adept, grund före uppbyggnad
 * före specifik före toppning. Varje fas är en vanlig plan med sina datum;
 * kön räknar bara ut var nästa börjar.
 *
 * Modulen är ren: datum in, datum ut.
 */

import { addDays } from "@/lib/season/season";

export type QueuedPhase = {
  id: string;
  status: "aktiv" | "kommande" | "avslutad" | "avbruten";
  start_date: string;
  weeks: number;
};

/** Första dagen efter planens sista vecka. */
export const phaseEnd = (p: Pick<QueuedPhase, "start_date" | "weeks">) =>
  addDays(p.start_date, p.weeks * 7);

/** Den aktiva fasen och de kommande, i ordning. */
export function queueOf<T extends QueuedPhase>(phases: T[]): T[] {
  return phases
    .filter((p) => p.status === "aktiv" || p.status === "kommande")
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
}

/**
 * Var nästa fas börjar: dagen efter kön, eller det valda datumet när kön
 * är tom. Ett datum i en tom kö får inte ligga mer än en vecka bakåt.
 */
export function nextPhaseStart(
  phases: QueuedPhase[],
  chosen: string | null,
  today: string,
): { ok: true; start: string } | { ok: false; error: string } {
  const queue = queueOf(phases);
  if (queue.length > 0) {
    return { ok: true, start: phaseEnd(queue[queue.length - 1]) };
  }
  if (!chosen || !/^\d{4}-\d{2}-\d{2}$/.test(chosen)) {
    return { ok: false, error: "Välj när den första fasen börjar." };
  }
  if (chosen < addDays(today, -6)) {
    return { ok: false, error: "Fasen kan inte börja mer än en vecka bakåt i tiden." };
  }
  return { ok: true, start: chosen };
}

/**
 * Nya startdatum när en kommande fas tas bort: faserna efter den flyttas
 * fram så att kön hänger ihop. Den aktiva fasen rörs aldrig.
 */
export function closeGap(
  phases: QueuedPhase[],
  removedId: string,
): { id: string; start_date: string }[] {
  const queue = queueOf(phases);
  const index = queue.findIndex((p) => p.id === removedId);
  if (index < 0) return [];
  const removed = queue[index];
  let start = removed.start_date;
  const moves: { id: string; start_date: string }[] = [];
  for (const p of queue.slice(index + 1)) {
    if (p.status !== "kommande") continue;
    if (p.start_date !== start) moves.push({ id: p.id, start_date: start });
    start = phaseEnd({ start_date: start, weeks: p.weeks });
  }
  return moves;
}
