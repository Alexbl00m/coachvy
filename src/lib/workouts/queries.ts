import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { SavedWorkout } from "./schema";

const COLUMNS =
  "id, adept_id, title, sport, summary, rationale, basis, reference, critical, reserve, blocks, prompt, scheduled_for, created_at";

/** numeric kommer tillbaka som sträng ur PostgREST när precisionen kräver det. */
const num = (value: unknown): number => Number(value);
const maybe = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

function toSaved(row: Record<string, unknown>): SavedWorkout {
  return {
    ...(row as unknown as SavedWorkout),
    reference: num(row.reference),
    critical: maybe(row.critical),
    reserve: maybe(row.reserve),
  };
}

export async function listWorkouts(adeptId: string): Promise<SavedWorkout[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workouts")
    .select(COLUMNS)
    .eq("adept_id", adeptId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Kunde inte hämta passen: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map(toSaved);
}

export async function getWorkout(id: string): Promise<SavedWorkout | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workouts")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Kunde inte hämta passet: ${error.message}`);
  return data ? toSaved(data as Record<string, unknown>) : null;
}
