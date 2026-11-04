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
 *
 * Ett planerat pass är coachens mål för dagen. När adepten loggar det sparas
 * samma rad som genomförd, med det som faktiskt gjordes.
 */
export async function saveStrengthSession(input: {
  id?: string | null;
  adeptId: string;
  performedOn: string;
  title: string;
  exercises: unknown;
  note: string;
  sessionRpe: number | null;
  /** Planerat eller genomfört; utan anges genomfört, som förut. */
  status?: "planerad" | "genomförd";
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

  const status = input.status ?? "genomförd";
  const row = {
    adept_id: input.adeptId,
    performed_on: input.performedOn,
    status,
    title: input.title.trim().slice(0, 80) || null,
    exercises,
    note: input.note.trim().slice(0, 1000) || null,
    // Ett planerat pass har ingen upplevd ansträngning än.
    session_rpe: status === "planerad" ? null : rpe,
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

  refresh(input.adeptId);
  return { ok: true, id };
}

function refresh(adeptId: string) {
  revalidatePath(routes.strength);
  revalidatePath(`${routes.adepts}/${adeptId}`, "layout");
  revalidatePath(routes.calendar);
  revalidatePath(routes.dashboard);
}

/** Flyttar ett planerat styrkepass till en annan dag. */
export async function moveStrengthSession(
  id: string,
  date: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSessionUser();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return { ok: false, error: "Välj ett datum." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("strength_sessions")
    .update({ performed_on: date })
    .eq("id", id)
    .eq("status", "planerad")
    .select("adept_id");
  if (error) return { ok: false, error: `Kunde inte flytta: ${error.message}` };
  if (!data || data.length === 0) {
    return { ok: false, error: "Bara ett planerat styrkepass går att flytta." };
  }
  refresh(data[0].adept_id);
  return { ok: true };
}

/** Kopierar ett styrkepass till en dag, som ett planerat pass med samma övningar. */
export async function copyStrengthSession(
  id: string,
  date: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireSessionUser();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return { ok: false, error: "Välj ett datum." };
  const supabase = await createClient();
  const { data: original } = await supabase
    .from("strength_sessions")
    .select("adept_id, title, exercises, note")
    .eq("id", id)
    .maybeSingle();
  if (!original) return { ok: false, error: "Passet hittades inte." };
  const { error } = await supabase.from("strength_sessions").insert({
    adept_id: original.adept_id,
    performed_on: date,
    status: "planerad",
    title: original.title,
    exercises: original.exercises,
    note: original.note,
    created_by: user.id,
  });
  if (error)
    return { ok: false, error: `Kunde inte kopiera: ${error.message}` };
  refresh(original.adept_id);
  return { ok: true };
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
  refresh(data[0].adept_id);
  return { ok: true };
}
