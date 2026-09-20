import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { AdeptCheckinRow } from "@/lib/types/database";
import type { Checkin } from "./load";

const COLUMNS =
  "id, adept_id, performed_on, session_rpe, duration_minutes, sleep, fatigue, soreness, stress, workout_id, note, created_at, updated_at";

/** Raden som beräkningsmodulen vill ha den. numeric kommer som sträng. */
export function toCheckin(row: AdeptCheckinRow): Checkin {
  const num = (value: number | null) => (value === null ? null : Number(value));
  return {
    performedOn: row.performed_on,
    sessionRpe: num(row.session_rpe),
    durationMinutes: num(row.duration_minutes),
    sleep: num(row.sleep),
    fatigue: num(row.fatigue),
    soreness: num(row.soreness),
    stress: num(row.stress),
  };
}

/**
 * Incheckningarna för en adept, nyast först.
 *
 * `days` styr hur långt bakåt. Belastningsmodellen behöver 28 dagar före den
 * första punkten den redovisar, så den som vill ha en åttaveckorsgraf måste
 * hämta ungefär tolv veckor.
 */
export async function listCheckins(
  adeptId: string,
  days = 120,
): Promise<AdeptCheckinRow[]> {
  if (!isSupabaseConfigured()) return [];

  const since = new Date();
  since.setDate(since.getDate() - days);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("adept_checkins")
    .select(COLUMNS)
    .eq("adept_id", adeptId)
    .gte("performed_on", since.toISOString().slice(0, 10))
    .order("performed_on", { ascending: false });

  if (error) throw new Error(`Kunde inte hämta incheckningarna: ${error.message}`);
  return (data ?? []) as AdeptCheckinRow[];
}

/** Incheckningen för en viss dag, om den finns. */
export async function getCheckin(
  adeptId: string,
  performedOn: string,
): Promise<AdeptCheckinRow | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("adept_checkins")
    .select(COLUMNS)
    .eq("adept_id", adeptId)
    .eq("performed_on", performedOn)
    .maybeSingle();

  if (error) throw new Error(`Kunde inte hämta incheckningen: ${error.message}`);
  return (data ?? null) as AdeptCheckinRow | null;
}
