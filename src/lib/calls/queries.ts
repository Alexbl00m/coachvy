import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { CoachCallRow } from "@/lib/types/database";

const COLUMNS =
  "id, adept_id, coach_id, starts_at, duration_minutes, topic, url, cancelled_at, created_at";

/** En adepts samtal, äldst först. Tom lista när migrationen inte körts. */
export async function listCalls(adeptId: string): Promise<CoachCallRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_calls")
    .select(COLUMNS)
    .eq("adept_id", adeptId)
    .order("starts_at", { ascending: true });
  if (error) return [];
  return data ?? [];
}

export type CallWithAdept = CoachCallRow & { adeptName: string };

/**
 * Samtal mellan två tidpunkter som inte avbokats – en adepts, eller alla
 * coachens när `adeptId` är null. Databasen avgör vad den inloggade ser.
 */
export async function listCallsBetween(
  fromIso: string,
  toIso: string,
  adeptId: string | null,
): Promise<CallWithAdept[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  let query = supabase
    .from("coach_calls")
    .select(`${COLUMNS}, adepts(full_name)`)
    .gte("starts_at", fromIso)
    .lte("starts_at", toIso)
    .is("cancelled_at", null)
    .order("starts_at", { ascending: true });
  if (adeptId) query = query.eq("adept_id", adeptId);
  const { data, error } = await query;
  if (error) return [];
  return (
    (data ?? []) as unknown as (CoachCallRow & {
      adepts: { full_name: string } | null;
    })[]
  ).map(({ adepts, ...call }) => ({
    ...call,
    adeptName: adepts?.full_name ?? "",
  }));
}
