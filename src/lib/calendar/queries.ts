import type { Sport } from "@/lib/calculators/lactate";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { sessionHeadline } from "@/lib/tests/headline";
import { protocolByKey } from "@/lib/tests/protocols";
import type { AdeptCheckinRow } from "@/lib/types/database";
import {
  formatDuration,
  resolveWorkout,
  toWorkout,
  type SavedWorkout,
} from "@/lib/workouts/schema";

/**
 * Kalenderns underlag: det som har ett datum. Alla frågor tar ett intervall
 * och valfritt en adept. Utan adept avgör RLS vilka som syns – coachen får
 * sina adepters, adepten sina egna.
 */

type Embedded = {
  adepts: { full_name: string } | { full_name: string }[] | null;
};
const nameOf = (row: Embedded) => {
  const a = Array.isArray(row.adepts) ? row.adepts[0] : row.adepts;
  return a?.full_name ?? "";
};

export type CalendarWorkout = {
  id: string;
  adeptId: string;
  adeptName: string;
  date: string;
  title: string;
  sport: Sport;
  /** Passets längd ur stegen, "1:15:00". null när den inte går att räkna. */
  duration: string | null;
  summary: string | null;
};

export type CalendarTest = {
  id: string;
  adeptId: string;
  adeptName: string;
  date: string;
  label: string;
  sport: Sport;
  headline: string | null;
};

const WORKOUT_COLUMNS =
  "id, adept_id, title, sport, summary, rationale, basis, reference, critical, reserve, blocks, prompt, scheduled_for, created_by, created_at";

export async function listScheduledWorkouts(
  from: string,
  to: string,
  adeptId: string | null,
): Promise<CalendarWorkout[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  let query = supabase
    .from("workouts")
    .select(`${WORKOUT_COLUMNS}, adepts(full_name)`)
    .gte("scheduled_for", from)
    .lte("scheduled_for", to)
    .order("scheduled_for", { ascending: true });
  if (adeptId) query = query.eq("adept_id", adeptId);

  const { data, error } = await query;
  if (error) throw new Error(`Kunde inte hämta passen: ${error.message}`);

  return (
    (data ?? []) as unknown as (Record<string, unknown> & Embedded)[]
  ).map((row) => {
    const saved = {
      ...(row as unknown as SavedWorkout),
      reference: Number(row.reference),
    };
    let duration: string | null = null;
    try {
      const total = resolveWorkout(
        toWorkout(saved),
        saved.reference,
      ).totalSeconds;
      duration = total > 0 ? formatDuration(total) : null;
    } catch {
      // Ett pass som inte går att lösa upp visas ändå, utan längd.
    }
    return {
      id: saved.id,
      adeptId: saved.adept_id,
      adeptName: nameOf(row),
      date: saved.scheduled_for as string,
      title: saved.title,
      sport: saved.sport,
      duration,
      summary: saved.summary,
    };
  });
}

export async function listSessionsBetween(
  from: string,
  to: string,
  adeptId: string | null,
): Promise<CalendarTest[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  let query = supabase
    .from("test_sessions")
    .select(
      "id, adept_id, protocol, sport, performed_on, test_metrics(key, value, unit, is_primary), adepts(full_name)",
    )
    .gte("performed_on", from)
    .lte("performed_on", to)
    .order("performed_on", { ascending: true });
  if (adeptId) query = query.eq("adept_id", adeptId);

  const { data, error } = await query;
  if (error)
    throw new Error(`Kunde inte hämta testtillfällen: ${error.message}`);

  type Row = Embedded & {
    id: string;
    adept_id: string;
    protocol: string;
    sport: Sport;
    performed_on: string;
    test_metrics: {
      key: string;
      value: number;
      unit: string;
      is_primary: boolean;
    }[];
  };
  return ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    adeptId: row.adept_id,
    adeptName: nameOf(row),
    date: row.performed_on,
    label: protocolByKey(row.protocol)?.label ?? row.protocol,
    sport: row.sport,
    headline: sessionHeadline(row.test_metrics ?? [], row.sport),
  }));
}

/** En adepts incheckningar inom intervallet. */
export async function listCheckinsBetween(
  adeptId: string,
  from: string,
  to: string,
): Promise<AdeptCheckinRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("adept_checkins")
    .select(
      "id, adept_id, performed_on, session_rpe, duration_minutes, sleep, fatigue, soreness, stress, workout_id, note, created_at, updated_at",
    )
    .eq("adept_id", adeptId)
    .gte("performed_on", from)
    .lte("performed_on", to)
    .order("performed_on", { ascending: true });

  if (error)
    throw new Error(`Kunde inte hämta incheckningarna: ${error.message}`);
  return (data ?? []) as AdeptCheckinRow[];
}
