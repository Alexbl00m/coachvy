import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { CoachMessageRow } from "@/lib/types/database";

const COLUMNS =
  "id, adept_id, sender_id, body, read_at, workout_id, session_id, created_at";

/** Tråden för en adept, äldst först så att den läses uppifrån och ned. */
export async function listMessages(
  adeptId: string,
  limit = 200,
): Promise<CoachMessageRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_messages")
    .select(COLUMNS)
    .eq("adept_id", adeptId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Kunde inte hämta meddelandena: ${error.message}`);
  return ((data ?? []) as CoachMessageRow[]).reverse();
}

/**
 * Antal olästa meddelanden från motparten.
 *
 * Egna meddelanden räknas aldrig som olästa, hur nyss de än skickades. Det
 * låter självklart men är precis det en naiv `read_at is null` missar.
 */
export async function countUnread(
  adeptId: string,
  viewerId: string,
): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("coach_messages")
    .select("id", { count: "exact", head: true })
    .eq("adept_id", adeptId)
    .neq("sender_id", viewerId)
    .is("read_at", null);

  if (error) return 0;
  return count ?? 0;
}
