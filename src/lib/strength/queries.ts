import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

import { cleanEntries, type StrengthSession } from "./strength";

const COLUMNS =
  "id, adept_id, performed_on, title, exercises, note, session_rpe, created_by, created_at";

/** Adeptens styrkepass, nyast först. RLS avgör vem som får läsa. */
export async function listStrengthSessions(
  adeptId: string,
): Promise<StrengthSession[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("strength_sessions")
    .select(COLUMNS)
    .eq("adept_id", adeptId)
    .order("performed_on", { ascending: false })
    .order("created_at", { ascending: false });
  // Tabellen finns inte förrän migrationen körts: ingen logg ännu.
  if (error) return [];
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    ...(row as unknown as StrengthSession),
    // Raderna läses genom samma kontroll som när de sparas.
    exercises: cleanEntries(row.exercises),
    session_rpe: row.session_rpe === null ? null : Number(row.session_rpe),
  }));
}
