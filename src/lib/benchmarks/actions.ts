"use server";

import { revalidatePath } from "next/cache";

import { requireCoach } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { parseReferenceLevels } from "./reference-levels";

export type BenchmarkResult = { ok: true } | { ok: false; error: string };

/**
 * Sparar coachens referensgrupper. `null` återställer appens utgångsvärden.
 * Det som skickas kontrolleras på samma sätt som när det läses: okända mått
 * och orimliga tal faller bort.
 */
export async function saveReferenceLevels(
  input: unknown,
): Promise<BenchmarkResult> {
  const user = await requireCoach();
  const parsed = input === null ? null : parseReferenceLevels(input);
  if (parsed && parsed.isDefault) {
    return {
      ok: false,
      error:
        "Minst en grupp med namn behövs. Återställ i stället för att tömma.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("coaches")
    .update({ reference_levels: parsed ? { groups: parsed.groups } : null })
    .eq("id", user.id);
  if (error) return { ok: false, error: `Kunde inte spara: ${error.message}` };

  revalidatePath(routes.settings);
  revalidatePath(routes.progression);
  return { ok: true };
}

/** Sätter målnivån för en adept – id på en av coachens grupper, eller ingen. */
export async function setTargetLevel(
  adeptId: string,
  groupId: string | null,
): Promise<BenchmarkResult> {
  await requireCoach();
  if (groupId !== null && !/^[a-z0-9-]{1,40}$/.test(groupId)) {
    return { ok: false, error: "Okänd nivå." };
  }

  const supabase = await createClient();
  // RLS begränsar till coachens egna adepter.
  const { data, error } = await supabase
    .from("adepts")
    .update({ target_level: groupId })
    .eq("id", adeptId)
    .select("id");
  if (error) return { ok: false, error: `Kunde inte spara: ${error.message}` };
  if (!data || data.length === 0) {
    return {
      ok: false,
      error: "Adepten hittades inte, eller så är den inte din.",
    };
  }

  revalidatePath(routes.progression);
  return { ok: true };
}
