import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { VlamaxSample } from "@/lib/types/database";

/**
 * Referensdatan modellen tränas på: den inbyggda plus coachens egen. RLS
 * sköter avgränsningen, så inget filter behövs här.
 */
export async function listVlamaxSamples(): Promise<VlamaxSample[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vlamax_samples")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Kunde inte hämta referensdata: ${error.message}`);
  return data ?? [];
}
