import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { ActivityRow } from "@/lib/types/database";
import type { BestEffort, Curve } from "./analysis";

/** Allt utom serien – listor behöver inte kartan. */
const LIST_COLUMNS =
  "id, adept_id, race_id, name, sport, started_at, performed_on, device, duration_s, moving_s, distance_m, ascent_m, summary, reference, note, created_by, created_at, updated_at";

export type ActivityListItem = Omit<ActivityRow, "streams" | "laps">;

/** Migrationen för aktiviteter är inte körd: visa ingenting i stället för fel. */
const notMigrated = (error: { code?: string } | null) =>
  error?.code === "PGRST205" ||
  error?.code === "42P01" ||
  error?.code === "PGRST200";

const numeric = <T extends Partial<ActivityRow>>(row: T): T => ({
  ...row,
  duration_s: row.duration_s === null ? null : Number(row.duration_s),
  moving_s: row.moving_s === null ? null : Number(row.moving_s),
  distance_m: row.distance_m === null ? null : Number(row.distance_m),
  ascent_m: row.ascent_m === null ? null : Number(row.ascent_m),
});

/**
 * En aktivitet i en lista: raden, de nyckeltal listan visar och bästa-kurvan
 * för profilen – inte hela analysen. En historik kan vara hundratals pass.
 */
export type ActivityHead = {
  id: string;
  adept_id: string;
  race_id: string | null;
  name: string;
  sport: string;
  started_at: string;
  performed_on: string;
  duration_s: number | null;
  distance_m: number | null;
  normalized_power: number | null;
  intensity_factor: number | null;
  avg_speed: number | null;
  curve: Curve | null;
  best: BestEffort[] | null;
  imported: boolean | null;
};

const HEAD_COLUMNS =
  "id, adept_id, race_id, name, sport, started_at, performed_on, duration_s, distance_m, normalized_power:summary->normalizedPower, intensity_factor:summary->intensityFactor, avg_speed:summary->avgSpeed, curve:summary->curve, best:summary->best, imported:summary->imported";

/** Adeptens aktiviteter, nyast först. */
export async function listActivities(adeptId: string): Promise<ActivityHead[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select(HEAD_COLUMNS)
    .eq("adept_id", adeptId)
    .order("started_at", { ascending: false });
  if (notMigrated(error)) return [];
  if (error)
    throw new Error(`Kunde inte hämta aktiviteterna: ${error.message}`);
  return ((data ?? []) as unknown as ActivityHead[]).map((row) => ({
    ...row,
    duration_s: row.duration_s === null ? null : Number(row.duration_s),
    distance_m: row.distance_m === null ? null : Number(row.distance_m),
  }));
}

export async function getActivity(id: string): Promise<ActivityRow | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (notMigrated(error)) return null;
  if (error) throw new Error(`Kunde inte hämta aktiviteten: ${error.message}`);
  return data ? numeric(data as ActivityRow) : null;
}

export type ActivityInRange = ActivityListItem & { adept_name: string };

/** Aktiviteter mellan två datum, för kalendern. RLS avgör vilka adepter. */
export async function listActivitiesBetween(
  from: string,
  to: string,
  adeptId: string | null,
): Promise<ActivityInRange[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  let query = supabase
    .from("activities")
    .select(`${LIST_COLUMNS}, adepts(full_name)`)
    .gte("performed_on", from)
    .lte("performed_on", to)
    .order("started_at", { ascending: true });
  if (adeptId) query = query.eq("adept_id", adeptId);
  const { data, error } = await query;
  if (notMigrated(error)) return [];
  if (error)
    throw new Error(`Kunde inte hämta aktiviteterna: ${error.message}`);
  type Row = ActivityListItem & {
    adepts: { full_name: string } | { full_name: string }[] | null;
  };
  return ((data ?? []) as unknown as Row[]).map(({ adepts, ...row }) => ({
    ...numeric(row),
    adept_name: (Array.isArray(adepts) ? adepts[0] : adepts)?.full_name ?? "",
  }));
}
