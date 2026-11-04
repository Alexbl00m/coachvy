import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

import { cleanEntries, type StrengthSession } from "./strength";

const COLUMNS =
  "id, adept_id, performed_on, status, title, exercises, note, session_rpe, created_by, created_at";

const toSession = (row: Record<string, unknown>): StrengthSession => ({
  ...(row as unknown as StrengthSession),
  // Raderna läses genom samma kontroll som när de sparas.
  exercises: cleanEntries(row.exercises),
  session_rpe: row.session_rpe === null ? null : Number(row.session_rpe),
});

/**
 * Adeptens genomförda styrkepass, nyast först: det progressionen, läget och
 * AI-underlaget räknar på. RLS avgör vem som får läsa.
 */
export async function listStrengthSessions(
  adeptId: string,
): Promise<StrengthSession[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("strength_sessions")
    .select(COLUMNS)
    .eq("adept_id", adeptId)
    .eq("status", "genomförd")
    .order("performed_on", { ascending: false })
    .order("created_at", { ascending: false });
  // Tabellen finns inte förrän migrationen körts: ingen logg ännu.
  if (error) return [];
  return ((data ?? []) as Record<string, unknown>[]).map(toSession);
}

/** Adeptens planerade styrkepass, i datumordning: de som väntar på att loggas. */
export async function listPlannedStrength(
  adeptId: string,
): Promise<StrengthSession[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("strength_sessions")
    .select(COLUMNS)
    .eq("adept_id", adeptId)
    .eq("status", "planerad")
    .order("performed_on", { ascending: true });
  if (error) return [];
  return ((data ?? []) as Record<string, unknown>[]).map(toSession);
}

/**
 * Styrkepassen mellan två datum, för kalendern: planerade, eller med
 * `status` null också de genomförda. Utan adept: alla den inloggade ser.
 */
export async function listStrengthBetween(
  from: string,
  to: string,
  adeptId: string | null,
  status: "planerad" | null = "planerad",
): Promise<(StrengthSession & { adept_name: string })[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  let query = supabase
    .from("strength_sessions")
    .select(`${COLUMNS}, adepts(full_name)`)
    .gte("performed_on", from)
    .lte("performed_on", to)
    .order("performed_on", { ascending: true });
  if (adeptId) query = query.eq("adept_id", adeptId);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) return [];
  return ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const adepts = row.adepts as
      | { full_name: string }
      | { full_name: string }[]
      | null;
    return {
      ...toSession(row),
      adept_name: (Array.isArray(adepts) ? adepts[0] : adepts)?.full_name ?? "",
    };
  });
}
