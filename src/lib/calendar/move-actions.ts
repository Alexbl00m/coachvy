"use server";

import { moveSession } from "@/lib/plan-library/actions";
import { scheduleWorkout } from "@/lib/workouts/actions";

import type { DragPass } from "./drag";

export type MoveResult = { ok: true } | { ok: false; error: string };

/**
 * Flyttar ett pass i kalendern till en annan dag: ett eget pass får nytt
 * datum, ett pass ur en plan flyttas i planen (som när det flyttas i
 * veckoplanen). Behörigheten prövas där, som vanligt.
 */
export async function movePass(pass: DragPass, date: string): Promise<MoveResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Välj ett datum." };
  if (pass.kind === "pass") {
    const result = await scheduleWorkout(pass.id, pass.adeptId, date);
    return result.ok ? { ok: true } : { ok: false, error: result.error ?? "Passet gick inte att flytta." };
  }
  if (pass.kind === "planpass") {
    const result = await moveSession({
      instanceId: pass.instanceId,
      sessionId: pass.sessionId,
      week: pass.week,
      date,
    });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }
  return { ok: false, error: "Passet går inte att flytta härifrån." };
}
