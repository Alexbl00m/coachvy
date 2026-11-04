"use server";

import { moveSession } from "@/lib/plan-library/actions";
import {
  copyPlanSession,
  copyScheduledPlanSession,
} from "@/lib/plan-library/copy-actions";
import {
  copyStrengthSession,
  moveStrengthSession,
} from "@/lib/strength/actions";
import { copyWorkoutToDates, scheduleWorkout } from "@/lib/workouts/actions";

import type { DragPass } from "./drag";

export type MoveResult = { ok: true } | { ok: false; error: string };

const done = (result: { ok: boolean; error?: string }): MoveResult =>
  result.ok
    ? { ok: true }
    : { ok: false, error: result.error ?? "Passet gick inte att flytta." };

/**
 * Flyttar eller kopierar ett pass i kalendern till en dag.
 *
 * Flytta: ett eget pass får nytt datum, ett pass ur en plan flyttas i planen
 * (som när det flyttas i veckoplanen), ett planerat styrkepass får ny dag.
 *
 * Kopiera (Ctrl eller Alt när passet släpps): ett eget pass och ett
 * styrkepass kopieras som det är, ett planpass läggs in som ett eget pass i
 * nivån adepten har den veckan. Ett pass ur en plan i biblioteket kopieras
 * alltid. Behörigheten prövas där, som vanligt.
 */
export async function movePass(
  pass: DragPass,
  date: string,
  copy = false,
): Promise<MoveResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return { ok: false, error: "Välj ett datum." };
  switch (pass.kind) {
    case "pass":
      return done(
        copy
          ? await copyWorkoutToDates(pass.id, pass.adeptId, [date])
          : await scheduleWorkout(pass.id, pass.adeptId, date),
      );
    case "planpass":
      return done(
        copy
          ? await copyScheduledPlanSession({ ...pass, date })
          : await moveSession({
              instanceId: pass.instanceId,
              sessionId: pass.sessionId,
              week: pass.week,
              date,
            }),
      );
    case "styrka":
      return done(
        copy
          ? await copyStrengthSession(pass.id, date)
          : await moveStrengthSession(pass.id, date),
      );
    case "mall":
      return done(
        await copyPlanSession({
          sessionId: pass.sessionId,
          levelId: pass.levelId,
          adeptId: pass.adeptId,
          date,
        }),
      );
  }
}
