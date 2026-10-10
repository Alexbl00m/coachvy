import "server-only";

import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { PlanLibraryTables } from "@/lib/types/plan-library.generated";
import type { Sport } from "@/lib/calculators/lactate";
import type { TrainingPhase } from "@/lib/tests/phases";
import type { TargetBasis, WorkoutBlock } from "@/lib/workouts/schema";

import type { LibrarySession } from "./library";

type LibraryRow = PlanLibraryTables["session_library"]["Row"];

/** Tabellen finns inte ännu – migrationen är inte körd. Då är biblioteket tomt. */
const notMigrated = (error: { code?: string } | null) =>
  error?.code === "PGRST205" || error?.code === "42P01";

function toSession(row: LibraryRow, userId: string | null): LibrarySession {
  return {
    id: row.id,
    own: row.owner_id === userId,
    shared: row.shared,
    title: row.title,
    sport: row.sport as Sport,
    kind: row.kind ?? "",
    intensity: row.intensity ?? "",
    purpose: row.purpose ?? "",
    description: row.description ?? "",
    progression: row.progression ?? "",
    phases: (row.phases ?? []) as TrainingPhase[],
    basis: row.basis as TargetBasis,
    structure: row.structure,
    blocks: row.blocks as unknown as WorkoutBlock[],
    updatedAt: row.updated_at,
  };
}

/**
 * Passen den inloggade ser: de egna och de delade. RLS avgör; här sorteras
 * bara, de egna först och det senast ändrade överst.
 */
export async function listLibrary(): Promise<LibrarySession[]> {
  if (!isSupabaseConfigured()) return [];
  const user = await getSessionUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session_library")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) {
    if (notMigrated(error)) return [];
    throw new Error(`Kunde inte läsa passbiblioteket: ${error.message}`);
  }
  const sessions = (data ?? []).map((row) => toSession(row, user.id));
  return [...sessions.filter((s) => s.own), ...sessions.filter((s) => !s.own)];
}

export async function getLibrarySession(
  id: string,
): Promise<LibrarySession | null> {
  if (!isSupabaseConfigured()) return null;
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session_library")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return toSession(data, user.id);
}
