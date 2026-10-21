import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { ActivityAiSummaryRow } from "@/lib/types/database";

/**
 * Passets AI-sammanfattning, om det finns en som den inloggade får se:
 * coachen ser alltid sin, adepten bara en delad. Databasen avgör.
 */
export async function getActivitySummary(
  activityId: string,
): Promise<ActivityAiSummaryRow | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_summaries")
    .select("*")
    .eq("activity_id", activityId)
    .maybeSingle();
  // Migrationen är inte körd: ingen sammanfattning, men sidan fungerar.
  if (error) return null;
  return data;
}
