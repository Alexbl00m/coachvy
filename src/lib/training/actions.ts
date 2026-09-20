"use server";

import { revalidatePath } from "next/cache";

import { requireSessionUser } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export type SaveCheckinInput = {
  adeptId: string;
  performedOn: string;
  /** Borg CR10 för passet. null betyder vilodag. */
  sessionRpe: number | null;
  durationMinutes: number | null;
  sleep: number | null;
  fatigue: number | null;
  soreness: number | null;
  stress: number | null;
  workoutId: string | null;
  note: string | null;
};

export type SaveCheckinResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

const inRange = (value: number | null, min: number, max: number) =>
  value === null || (Number.isFinite(value) && value >= min && value <= max);

/**
 * Sparar dagens incheckning.
 *
 * En rad per adept och dag: ändrar man sig skrivs raden över i stället för att
 * ligga kvar som en andra mätning samma dag. Därför `upsert` på nyckeln
 * (adept_id, performed_on).
 *
 * `requireSessionUser` och inte `requireCoach`: incheckningen är adeptens
 * egen, och det är hela poängen med den. RLS avgör vem som får skriva på
 * vilken adept.
 */
export async function saveCheckin(
  input: SaveCheckinInput,
): Promise<SaveCheckinResult> {
  await requireSessionUser();

  if (!input.performedOn) return { ok: false, error: "Välj ett datum." };
  if (!inRange(input.sessionRpe, 0, 10)) {
    return { ok: false, error: "RPE ska ligga mellan 0 och 10." };
  }
  if (!inRange(input.durationMinutes, 1, 1440)) {
    return { ok: false, error: "Längden ska anges i minuter." };
  }
  for (const [label, value] of [
    ["Sömn", input.sleep],
    ["Trötthet", input.fatigue],
    ["Muskelömhet", input.soreness],
    ["Stress", input.stress],
  ] as const) {
    if (!inRange(value, 1, 5)) {
      return { ok: false, error: `${label} ska ligga mellan 1 och 5.` };
    }
  }

  // Ett RPE utan längd går inte att räkna belastning ur, och tvärtom.
  if ((input.sessionRpe === null) !== (input.durationMinutes === null)) {
    return {
      ok: false,
      error:
        "Ange både hur passet kändes och hur långt det var – belastningen är de två gånger varandra.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("adept_checkins")
    .upsert(
      {
        adept_id: input.adeptId,
        performed_on: input.performedOn,
        session_rpe: input.sessionRpe,
        duration_minutes: input.durationMinutes,
        sleep: input.sleep,
        fatigue: input.fatigue,
        soreness: input.soreness,
        stress: input.stress,
        workout_id: input.workoutId,
        note: input.note,
      },
      { onConflict: "adept_id,performed_on" },
    )
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: `Kunde inte spara incheckningen: ${error?.message ?? "okänt fel"}`,
    };
  }

  revalidatePath(`${routes.adepts}/${input.adeptId}`);
  revalidatePath(routes.dashboard);
  return { ok: true, id: data.id };
}

export async function deleteCheckin(
  id: string,
  adeptId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireSessionUser();

  const supabase = await createClient();
  const { error } = await supabase.from("adept_checkins").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`${routes.adepts}/${adeptId}`);
  return { ok: true };
}
