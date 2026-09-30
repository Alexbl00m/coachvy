"use server";

import { revalidatePath } from "next/cache";

import { requireSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type SettingsResult = { ok: true } | { ok: false; error: string };

/** Byter kontots namn. Rollen och e-posten ändras inte härifrån. */
export async function updateName(name: string): Promise<SettingsResult> {
  const user = await requireSessionUser();
  const fullName = name.trim().slice(0, 120);
  if (fullName.length === 0) return { ok: false, error: "Fyll i ditt namn." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", user.id);
  if (error) return { ok: false, error: `Kunde inte spara: ${error.message}` };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function changePassword(
  password: string,
): Promise<SettingsResult> {
  await requireSessionUser();
  if (password.length < 8) {
    return { ok: false, error: "Lösenordet måste vara minst 8 tecken." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Ger eller tar tillbaka samtycket till behandling av hälsouppgifter.
 *
 * Databasen tidsstämplar samtycket själv, så värdet som skickas spelar ingen
 * roll utom att det inte är null. Att ta tillbaka det raderar inget: det som
 * redan registrerats ligger kvar tills adepten ber om att få det raderat,
 * och coachen ser att samtycket saknas.
 */
export async function setHealthConsent(give: boolean): Promise<SettingsResult> {
  const user = await requireSessionUser();

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ health_consent_at: give ? new Date().toISOString() : null })
    .eq("id", user.id);
  if (error) return { ok: false, error: `Kunde inte spara: ${error.message}` };

  revalidatePath("/", "layout");
  return { ok: true };
}
