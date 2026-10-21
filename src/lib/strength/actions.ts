"use server";

import { revalidatePath } from "next/cache";

import { requireSessionUser } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

import { cleanEntries } from "./strength";

export type StrengthResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Sparar ett styrkepass – nytt, eller ändrat när `id` finns. Adepten och
 * hennes coach får båda skriva (RLS: can_view_adept).
 */
export async function saveStrengthSession(input: {
  id?: string | null;
  adeptId: string;
  performedOn: string;
  title: string;
  exercises: unknown;
  note: string;
  sessionRpe: number | null;
}): Promise<StrengthResult> {
  const user = await requireSessionUser();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.performedOn)) {
    return { ok: false, error: "Välj ett datum." };
  }
  const exercises = cleanEntries(input.exercises);
  if (exercises.length === 0) {
    return { ok: false, error: "Lägg till minst en övning." };
  }
  const rpe = input.sessionRpe;
  if (rpe !== null && !(Number.isFinite(rpe) && rpe >= 0 && rpe <= 10)) {
    return { ok: false, error: "RPE för passet är 0–10." };
  }

  const row = {
    adept_id: input.adeptId,
    performed_on: input.performedOn,
    title: input.title.trim().slice(0, 80) || null,
    exercises,
    note: input.note.trim().slice(0, 1000) || null,
    session_rpe: rpe,
  };

  const supabase = await createClient();
  const query = input.id
    ? supabase
        .from("strength_sessions")
        .update(row)
        .eq("id", input.id)
        .eq("adept_id", input.adeptId)
        .select("id")
    : supabase
        .from("strength_sessions")
        .insert({ ...row, created_by: user.id })
        .select("id");
  const { data, error } = await query;
  if (error) return { ok: false, error: `Kunde inte spara: ${error.message}` };
  const id = data?.[0]?.id as string | undefined;
  if (!id) {
    return {
      ok: false,
      error: "Passet hittades inte, eller så får du inte ändra det.",
    };
  }

  revalidatePath(routes.strength);
  revalidatePath(`${routes.adepts}/${input.adeptId}`, "layout");
  return { ok: true, id };
}

export async function deleteStrengthSession(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSessionUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("strength_sessions")
    .delete()
    .eq("id", id)
    .select("id, adept_id");
  if (error)
    return { ok: false, error: `Kunde inte ta bort: ${error.message}` };
  if (!data || data.length === 0) {
    return { ok: false, error: "Passet hittades inte." };
  }
  revalidatePath(routes.strength);
  revalidatePath(`${routes.adepts}/${data[0].adept_id}`, "layout");
  return { ok: true };
}
