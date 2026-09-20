"use server";

import { revalidatePath } from "next/cache";

import { requireSessionUser } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export type SaveProfileInput = {
  adeptId: string;
  birthYear: number | null;
  sex: "man" | "kvinna" | "annat" | null;
  heightCm: number | null;
  trainingYears: number | null;
  weeklyHours: number | null;
  weeklySessions: number | null;
  injuries: string | null;
  medical: string | null;
  strengths: string | null;
  weaknesses: string | null;
  goal: string | null;
  goalDate: string | null;
};

export type SaveProfileResult = { ok: true } | { ok: false; error: string };

const bounded = (value: number | null, min: number, max: number) =>
  value === null || (Number.isFinite(value) && value >= min && value <= max);

/**
 * Sparar adeptens bakgrund.
 *
 * Både coachen och adepten får skriva: det mesta här vet atleten bäst själv,
 * men en coach som håller i registret ska kunna fylla i det åt någon som inte
 * har ett konto ännu. RLS avgör vilken adept.
 */
export async function saveAdeptProfile(
  input: SaveProfileInput,
): Promise<SaveProfileResult> {
  await requireSessionUser();

  const year = new Date().getFullYear();
  if (!bounded(input.birthYear, 1900, year)) {
    return { ok: false, error: "Födelseåret ser inte ut att stämma." };
  }
  if (!bounded(input.heightCm, 50, 260)) {
    return { ok: false, error: "Längden anges i centimeter." };
  }
  if (!bounded(input.trainingYears, 0, 80)) {
    return { ok: false, error: "Antal träningsår ser inte ut att stämma." };
  }
  if (!bounded(input.weeklyHours, 0, 60)) {
    return { ok: false, error: "Veckotimmarna ska ligga mellan 0 och 60." };
  }
  if (!bounded(input.weeklySessions, 0, 30)) {
    return { ok: false, error: "Antal pass per vecka ska ligga mellan 0 och 30." };
  }

  const trimmed = (value: string | null) => {
    const text = (value ?? "").trim();
    return text.length > 0 ? text : null;
  };

  const supabase = await createClient();
  const { error } = await supabase.from("adept_profiles").upsert(
    {
      adept_id: input.adeptId,
      birth_year: input.birthYear,
      sex: input.sex,
      height_cm: input.heightCm,
      training_years: input.trainingYears,
      weekly_hours: input.weeklyHours,
      weekly_sessions: input.weeklySessions,
      injuries: trimmed(input.injuries),
      medical: trimmed(input.medical),
      strengths: trimmed(input.strengths),
      weaknesses: trimmed(input.weaknesses),
      goal: trimmed(input.goal),
      goal_date: input.goalDate || null,
    },
    { onConflict: "adept_id" },
  );

  if (error) {
    return { ok: false, error: `Kunde inte spara profilen: ${error.message}` };
  }

  revalidatePath(`${routes.adepts}/${input.adeptId}`);
  revalidatePath(routes.workoutBuilder);
  return { ok: true };
}
