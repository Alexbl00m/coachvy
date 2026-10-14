"use server";

import { revalidatePath } from "next/cache";

import { loadRunningFitness } from "@/lib/plan-library/fitness";
import { routes } from "@/lib/routes";
import { saveWorkout } from "@/lib/workouts/actions";
import { requireWorkoutAuthor } from "@/lib/workouts/access";
import { contextForAdept } from "@/lib/workouts/generate";

import { LIBRARY_LEVELS, toAdeptWorkout } from "./library";
import { getLibrarySession } from "./queries";

export type ScheduleLibraryInput = {
  libraryId: string;
  adeptId: string;
  /** A, B eller C; null för ett pass utan nivåer. */
  level: string | null;
  /** YYYY-MM-DD. */
  date: string;
};

export type ScheduleLibraryResult =
  | { ok: true; id: string; note: string | null }
  | { ok: false; error: string };

/**
 * Lägger ett pass ur biblioteket direkt i en adepts kalender.
 *
 * Samma omräkning som när passet öppnas i passbyggaren – procenten mot
 * adeptens tröskel i passets gren, löpzonerna mot formuppskattningen – men
 * utan omvägen. Passet sparas som ett vanligt pass på adepten och går att
 * öppna och ändra i passbyggaren efteråt.
 */
export async function scheduleLibrarySession(
  input: ScheduleLibraryInput,
): Promise<ScheduleLibraryResult> {
  const access = await requireWorkoutAuthor(input.adeptId);
  if (!access.ok) return access;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { ok: false, error: "Välj ett datum." };
  }

  const pass = await getLibrarySession(input.libraryId);
  if (!pass) {
    return { ok: false, error: "Passet finns inte i ditt passbibliotek." };
  }

  const context = await contextForAdept(input.adeptId, pass.sport);
  if (!context) return { ok: false, error: "Adepten hittades inte." };
  if (!(context.reference !== null && context.reference > 0)) {
    return {
      ok: false,
      error: `Adepten saknar en tröskel i ${pass.sport} att räkna passet mot. Lägg in ett test i ${pass.sport} först.`,
    };
  }

  const speeds =
    pass.sport === "löpning" && pass.basis !== context.basis
      ? (await loadRunningFitness(input.adeptId)).refs
      : {};
  const level = LIBRARY_LEVELS.find((l) => l.key === input.level)?.key ?? null;
  const converted = toAdeptWorkout(
    pass,
    {
      sport: context.sport,
      basis: context.basis,
      reference: context.reference,
    },
    speeds,
    level,
  );
  if (!converted.ok) return converted;

  const saved = await saveWorkout({
    adeptId: input.adeptId,
    workout: converted.workout,
    reference: context.reference ?? 0,
    critical: context.balance?.critical ?? null,
    reserve: context.balance?.reserve ?? null,
    prompt: null,
    scheduledFor: input.date,
  });
  if (!saved.ok) return saved;

  revalidatePath(routes.calendar);
  revalidatePath(routes.dashboard);
  return { ok: true, id: saved.id, note: converted.note };
}
