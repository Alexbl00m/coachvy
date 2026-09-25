import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { VlamaxSample } from "@/lib/types/database";
import { BUILT_IN_SAMPLES, withBuiltIn } from "./reference";

/**
 * Referensdatan modellen tränas på: den inbyggda ur koden plus coachens egen
 * ur databasen. RLS avgränsar till coachens egna rader; eventuella inbyggda
 * rader som ligger kvar i tabellen från före flytten filtreras bort, så att
 * ingen atlet räknas två gånger.
 */
export async function listVlamaxSamples(): Promise<VlamaxSample[]> {
  if (!isSupabaseConfigured()) return BUILT_IN_SAMPLES;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vlamax_samples")
    .select("*")
    .not("coach_id", "is", null)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Kunde inte hämta referensdata: ${error.message}`);
  return withBuiltIn(data ?? []);
}
