"use server";

import { addDays, isoWeek } from "@/lib/season/season";

import { dragOf, parseDrag, type DragPass } from "./drag";
import { movePass } from "./move-actions";
import { listScheduledWorkouts } from "./queries";
import { shiftToWeek, weekStart } from "./week";

/** Ett pass som flyttades, så att flytten går att ångra. */
export type MovedPass = { pass: DragPass; from: string; to: string };

export type WeekResult =
  | {
      ok: true;
      /** Passen som flyttades eller kopierades. */
      count: number;
      /** Passen som inte gick, med skälet. */
      failed: string[];
      /** Det som flyttades; tomt när veckan kopierades. */
      moved: MovedPass[];
    }
  | { ok: false; error: string };

/**
 * Flyttar eller kopierar en adepts vecka till en annan vecka: varje pass
 * som går att flytta hamnar på samma veckodag. Egna pass får nytt datum,
 * planpass flyttas i planen och planerade styrkepass får ny dag, precis som
 * när de dras ett och ett (`movePass`, där behörigheten prövas).
 * Genomförda aktiviteter, loggade styrkepass, tester och tävlingar ligger
 * kvar.
 *
 * Passen tas ett i taget, så att två pass i samma plan inte skriver över
 * varandra. Går ett pass inte att flytta fortsätter resten, och svaret
 * säger vilka som inte gick.
 */
export async function moveWeek(input: {
  adeptId: string;
  from: string;
  to: string;
  copy: boolean;
}): Promise<WeekResult> {
  const from = weekStart(input.from);
  const to = weekStart(input.to);
  if (!from || !to) return { ok: false, error: "Välj en vecka." };
  if (from === to) {
    return { ok: false, error: "Välj en annan vecka än den passen ligger i." };
  }

  const passes = (
    await listScheduledWorkouts(from, addDays(from, 6), input.adeptId)
  ).flatMap((w) => {
    const pass = dragOf(w);
    return pass && w.adeptId === input.adeptId ? [{ pass, date: w.date }] : [];
  });
  if (passes.length === 0) {
    return {
      ok: false,
      error: `Vecka ${isoWeek(from)} har inga pass att flytta.`,
    };
  }

  const moved: MovedPass[] = [];
  const failed: string[] = [];
  for (const { pass, date } of passes) {
    const target = shiftToWeek(date, from, to);
    const result = await movePass(pass, target, input.copy);
    if (result.ok) {
      if (!input.copy) moved.push({ pass, from: date, to: target });
    } else {
      failed.push(`${pass.title}: ${result.error}`);
    }
  }

  const count = passes.length - failed.length;
  if (count === 0) {
    return {
      ok: false,
      error:
        `Inget pass gick att ${input.copy ? "kopiera" : "flytta"}. ${failed[0] ?? ""}`.trim(),
    };
  }
  return { ok: true, count, failed, moved };
}

/** Flyttar tillbaka passen en veckoflytt flyttade. */
export async function undoWeekMove(moved: MovedPass[]): Promise<WeekResult> {
  const failed: string[] = [];
  let count = 0;
  for (const m of moved) {
    const pass = parseDrag(JSON.stringify(m.pass));
    if (!pass || pass.kind === "vecka" || pass.kind === "mall") continue;
    const result = await movePass(pass, m.from);
    if (result.ok) count += 1;
    else failed.push(`${pass.title}: ${result.error}`);
  }
  if (count === 0) {
    return {
      ok: false,
      error: failed[0] ?? "Flytten gick inte att ångra.",
    };
  }
  return { ok: true, count, failed, moved: [] };
}
