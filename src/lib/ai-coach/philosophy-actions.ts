"use server";

import { revalidatePath } from "next/cache";

import { requireCoach } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

import { PHILOSOPHY_MAX, type PhilosophyMode } from "./philosophy";

export type PhilosophyResult = { ok: true } | { ok: false; error: string };

/**
 * Sparar coachens egen filosofi. Tom text tar bort den, och då gäller
 * grundfilosofin igen. Gäller från nästa fråga till AI-coachen och nästa pass
 * ur passbyggaren – inget som redan sparats skrivs om.
 */
export async function savePhilosophy(input: {
  text: string;
  mode: PhilosophyMode;
}): Promise<PhilosophyResult> {
  const user = await requireCoach();
  const text = input.text.replace(/\r\n/g, "\n").trim();
  if (text.length > PHILOSOPHY_MAX) {
    return {
      ok: false,
      error: `Filosofin får vara högst ${PHILOSOPHY_MAX.toLocaleString("sv-SE")} tecken. Den är nu ${text.length.toLocaleString("sv-SE")}.`,
    };
  }
  if (input.mode !== "komplettera" && input.mode !== "ersatt") {
    return {
      ok: false,
      error: "Välj om filosofin kompletterar eller ersätter.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coaches")
    .update({
      philosophy: text || null,
      philosophy_mode: input.mode,
      philosophy_updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select("id");
  if (error) return { ok: false, error: `Kunde inte spara: ${error.message}` };
  if (!data || data.length === 0) {
    return { ok: false, error: "Coachkontot hittades inte." };
  }

  revalidatePath(routes.settings);
  revalidatePath(routes.aiCoach);
  return { ok: true };
}
