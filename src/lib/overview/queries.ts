import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { AdeptCheckinRow } from "@/lib/types/database";

/**
 * Översiktens frågor. De hämtar för alla adepter på en gång och låter RLS
 * avgöra vilka – en fråga per tabell i stället för en per adept, så att
 * översikten inte blir långsammare för varje adept coachen lägger till.
 */

/** Alla synliga incheckningar sedan ett datum. */
export async function listCheckinsSince(
  since: string,
): Promise<AdeptCheckinRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("adept_checkins")
    .select(
      "id, adept_id, performed_on, session_rpe, duration_minutes, sleep, fatigue, soreness, stress, workout_id, note, created_at, updated_at",
    )
    .gte("performed_on", since)
    .order("performed_on", { ascending: true });

  if (error)
    throw new Error(`Kunde inte hämta incheckningarna: ${error.message}`);
  return (data ?? []) as AdeptCheckinRow[];
}

/**
 * Olästa meddelanden från motparten, per adept.
 *
 * Egna meddelanden räknas aldrig, som i `countUnread`.
 */
export async function unreadByAdept(
  viewerId: string,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!isSupabaseConfigured()) return counts;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_messages")
    .select("adept_id")
    .neq("sender_id", viewerId)
    .is("read_at", null);

  if (error) return counts;
  for (const row of data ?? []) {
    counts.set(row.adept_id, (counts.get(row.adept_id) ?? 0) + 1);
  }
  return counts;
}
