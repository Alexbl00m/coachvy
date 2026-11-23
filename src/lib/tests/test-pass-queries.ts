import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

import { nearRange } from "./test-passes";

/** Ett test ett pass hör till, eller kan höra till. */
export type TestRef = {
  id: string;
  protocol: string;
  sport: string;
  performed_on: string;
};

/** Ett pass i ett test, eller ett som kan läggas till. */
export type PassRef = {
  id: string;
  name: string;
  sport: string;
  performed_on: string;
  moving_s: number | null;
};

const notMigrated = (error: { code?: string } | null) =>
  error?.code === "PGRST205" || error?.code === "42P01";

type Linked<T> = { [key: string]: T | T[] | null };
const one = <T>(v: T | T[] | null): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : v;

/** Testen ett genomfört pass hör till. */
export async function listActivityTests(
  activityId: string,
): Promise<TestRef[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_activities")
    .select("test_sessions(id, protocol, sport, performed_on)")
    .eq("activity_id", activityId);
  if (error) return [];
  return ((data ?? []) as unknown as Linked<TestRef>[])
    .map((r) => one(r.test_sessions))
    .filter((t): t is TestRef => t !== null)
    .sort((a, b) => a.performed_on.localeCompare(b.performed_on));
}

/** Passen ett test bygger på. */
export async function listTestActivities(
  sessionId: string,
): Promise<PassRef[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_activities")
    .select("activities(id, name, sport, performed_on, moving_s)")
    .eq("session_id", sessionId);
  if (error) return [];
  return ((data ?? []) as unknown as Linked<PassRef>[])
    .map((r) => one(r.activities))
    .filter((a): a is PassRef => a !== null)
    .map((a) => ({
      ...a,
      moving_s: a.moving_s === null ? null : Number(a.moving_s),
    }))
    .sort((a, b) => a.performed_on.localeCompare(b.performed_on));
}

/** Adeptens test i samma gren två veckor runt en dag – att lägga ett pass i. */
export async function listTestsNear(
  adeptId: string,
  date: string,
  sport: string,
): Promise<TestRef[]> {
  if (!isSupabaseConfigured()) return [];
  const { from, to } = nearRange(date);
  const supabase = await createClient();
  const { data } = await supabase
    .from("test_sessions")
    .select("id, protocol, sport, performed_on")
    .eq("adept_id", adeptId)
    .eq("sport", sport)
    .gte("performed_on", from)
    .lte("performed_on", to)
    .order("performed_on", { ascending: true });
  return (data ?? []) as TestRef[];
}

/** Adeptens genomförda pass två veckor runt ett test – att koppla till det. */
export async function listPassesNear(
  adeptId: string,
  date: string,
): Promise<PassRef[]> {
  if (!isSupabaseConfigured()) return [];
  const { from, to } = nearRange(date);
  const supabase = await createClient();
  const { data } = await supabase
    .from("activities")
    .select("id, name, sport, performed_on, moving_s")
    .eq("adept_id", adeptId)
    .gte("performed_on", from)
    .lte("performed_on", to)
    .order("started_at", { ascending: true });
  return ((data ?? []) as PassRef[]).map((a) => ({
    ...a,
    moving_s: a.moving_s === null ? null : Number(a.moving_s),
  }));
}

/**
 * Testprotokollen per genomfört pass, för kalendern: passets id till
 * protokollen det är en del av.
 */
export async function listTestProtocolsFor(
  activityIds: string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!isSupabaseConfigured() || activityIds.length === 0) return out;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_activities")
    .select("activity_id, test_sessions(protocol)")
    .in("activity_id", activityIds);
  if (notMigrated(error) || error) return out;
  for (const row of (data ?? []) as unknown as (Linked<{ protocol: string }> & {
    activity_id: string;
  })[]) {
    const protocol = one(row.test_sessions)?.protocol;
    if (!protocol) continue;
    out.set(row.activity_id, [...(out.get(row.activity_id) ?? []), protocol]);
  }
  return out;
}
