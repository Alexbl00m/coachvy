import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

import { parseCoachPhilosophy, type CoachPhilosophy } from "./philosophy";

/**
 * Coachens egen filosofi, eller null när grundfilosofin gäller. Adepter läser
 * sin coachs rad (RLS: current_coach_id), så en medlemsadepts passbyggare får
 * samma filosofi som coachens.
 */
export async function coachPhilosophyFor(
  coachId: string | null,
): Promise<CoachPhilosophy | null> {
  if (!coachId || !isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coaches")
    .select("philosophy, philosophy_mode")
    .eq("id", coachId)
    .maybeSingle();
  // Kolumnerna finns inte förrän migrationen körts: grundfilosofin gäller.
  if (error || !data) return null;
  return parseCoachPhilosophy(data);
}
