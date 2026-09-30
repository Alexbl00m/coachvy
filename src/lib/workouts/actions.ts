"use server";

import { revalidatePath } from "next/cache";

import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { requireWorkoutAuthor } from "./access";
import { sanitiseWorkout } from "./parse";
import { resolveWorkout, type Workout } from "./schema";

export type SaveWorkoutInput = {
  adeptId: string;
  workout: Workout;
  /** Referensen passet byggdes mot, i W eller m/s. */
  reference: number;
  critical: number | null;
  reserve: number | null;
  prompt: string | null;
  scheduledFor: string | null;
};

export type SaveWorkoutResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Sparar ett pass på en adept.
 *
 * Passet körs genom samma kontroll här som när det kom från modellen. Klienten
 * får redigera stegen fritt, och det som hamnar i databasen ska ändå gå att
 * räkna på – samma skäl som att testanalysen körs om på servern innan den
 * sparas.
 */
export async function saveWorkout(
  input: SaveWorkoutInput,
): Promise<SaveWorkoutResult> {
  const access = await requireWorkoutAuthor(input.adeptId);
  if (!access.ok) return access;
  const { user } = access;

  const workout = sanitiseWorkout(input.workout);
  if (!workout) {
    return { ok: false, error: "Passet saknar steg som går att räkna på." };
  }
  if (!(input.reference > 0)) {
    return { ok: false, error: "Referensvärdet saknas." };
  }

  const resolved = resolveWorkout(workout, input.reference);
  if (resolved.steps.length === 0) {
    return { ok: false, error: "Inget av stegen gick att lösa upp i tid." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workouts")
    .insert({
      adept_id: input.adeptId,
      title: workout.title,
      sport: workout.sport,
      summary: workout.summary || null,
      rationale: workout.rationale || null,
      basis: workout.basis,
      reference: input.reference,
      critical: input.critical,
      reserve: input.reserve,
      blocks: workout.blocks,
      prompt: input.prompt,
      scheduled_for: input.scheduledFor,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: `Kunde inte spara passet: ${error?.message ?? "okänt fel"}`,
    };
  }

  revalidatePath(`${routes.adepts}/${input.adeptId}`);
  revalidatePath(routes.workoutBuilder);
  return { ok: true, id: data.id };
}

export async function deleteWorkout(
  id: string,
  adeptId: string,
): Promise<{ ok: boolean; error?: string }> {
  // En coach tar bort pass på sina adepter, en medlemsadept sina egna –
  // raden ska dessutom vara skapad av adepten, vilket databasen kontrollerar.
  const access = await requireWorkoutAuthor(adeptId);
  if (!access.ok) return access;

  const supabase = await createClient();
  const { error } = await supabase.from("workouts").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`${routes.adepts}/${adeptId}`);
  revalidatePath(routes.workoutBuilder);
  return { ok: true };
}

/**
 * Lägger ett sparat pass på ett datum i kalendern, eller tar bort datumet.
 *
 * Coachen flyttar sina adepters pass; en medlemsadept de pass hen byggt
 * själv. RLS avgör – blir ingen rad ändrad fanns ingen behörighet.
 */
export async function scheduleWorkout(
  id: string,
  adeptId: string,
  date: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const access = await requireWorkoutAuthor(adeptId);
  if (!access.ok) return access;

  if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: "Välj ett datum." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workouts")
    .update({ scheduled_for: date })
    .eq("id", id)
    .eq("adept_id", adeptId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "Passet går inte att flytta härifrån." };
  }

  revalidatePath(`${routes.adepts}/${adeptId}`);
  revalidatePath(routes.calendar);
  revalidatePath(routes.dashboard);
  return { ok: true };
}
