/**
 * Ett pass som dras i kalendern: vad som ska hända när det släpps på en dag.
 *
 * Modulen är ren och används i webbläsaren och i serveråtgärden.
 */

import type { CalendarWorkout } from "./queries";

export type DragPass =
  /** Ett eget pass: får nytt datum. */
  | { kind: "pass"; id: string; adeptId: string; title: string }
  /** Ett pass i en startad plan: flyttas i planen. */
  | {
      kind: "planpass";
      instanceId: string;
      sessionId: string;
      week: number;
      adeptId: string;
      title: string;
    }
  /** Ett pass ur en plan i biblioteket: kopieras till adepten som ett eget pass. */
  | {
      kind: "mall";
      sessionId: string;
      levelId: string;
      adeptId: string;
      title: string;
    };

/** Datatypen i dra och släpp, så att bara Coachvys pass tas emot. */
export const DRAG_TYPE = "application/x-coachvy-pass";

/** Passet som det dras, eller null för det som inte går att flytta. */
export function dragOf(w: Pick<CalendarWorkout, "id" | "adeptId" | "title" | "fromPlan" | "planRef">): DragPass | null {
  if (w.planRef) return { kind: "planpass", ...w.planRef, adeptId: w.adeptId, title: w.title };
  if (w.fromPlan) return null;
  return { kind: "pass", id: w.id, adeptId: w.adeptId, title: w.title };
}

/** Passet ur dra och släpp, eller null när datan inte är ett pass. */
export function parseDrag(text: string): DragPass | null {
  try {
    const value = JSON.parse(text) as Partial<DragPass>;
    if (value.kind === "pass" && typeof value.id === "string") return value as DragPass;
    if (value.kind === "planpass" && typeof value.instanceId === "string") return value as DragPass;
    if (value.kind === "mall" && typeof value.sessionId === "string") return value as DragPass;
    return null;
  } catch {
    return null;
  }
}
