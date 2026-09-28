import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { IntensityUnit, Sport } from "@/lib/calculators/lactate";
import type { Effort } from "./analysis";
import type { MaximalEffort } from "./rolling";
import { LAP_PROTOCOLS, type ProtocolKey, type ZoneScheme } from "./protocols";

export type TestSession = {
  id: string;
  adept_id: string;
  protocol: ProtocolKey;
  sport: Sport;
  intensity_unit: IntensityUnit;
  performed_on: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  sex: "man" | "kvinna" | null;
  peak_intensity: number | null;
  vo2max: number | null;
  peak_lactate: number | null;
  peak_heart_rate: number | null;
  zone_scheme: ZoneScheme | null;
  training_phase: string | null;
  notes: string | null;
  created_at: string;
};

export type SessionMetric = {
  id: string;
  key: string;
  value: number;
  unit: string;
  method: string | null;
  is_primary: boolean;
};

export type SessionEffortRow = {
  id: string;
  ordinal: number;
  intensity: number | null;
  duration_seconds: number | null;
  distance_m: number | null;
  lactate: number | null;
  heart_rate: number | null;
  heart_rate_max: number | null;
  performed_on: string | null;
  comment: string | null;
};

export type SessionWithMetrics = TestSession & {
  test_metrics: SessionMetric[];
};

export type FullSession = TestSession & {
  test_metrics: SessionMetric[];
  test_efforts: SessionEffortRow[];
};

/** Testtillfällen för en adept, nyast först, med de framräknade värdena. */
export async function listSessions(
  adeptId: string,
): Promise<SessionWithMetrics[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_sessions")
    .select("*, test_metrics(id, key, value, unit, method, is_primary)")
    .eq("adept_id", adeptId)
    .order("performed_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Kunde inte hämta testtillfällen: ${error.message}`);
  return (data ?? []) as unknown as SessionWithMetrics[];
}

/** Ett testtillfälle med både rådata och värden. */
export async function getSession(id: string): Promise<FullSession | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_sessions")
    .select(
      "*, test_metrics(id, key, value, unit, method, is_primary), test_efforts(id, ordinal, intensity, duration_seconds, distance_m, lactate, heart_rate, heart_rate_max, performed_on, comment)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Kunde inte hämta testtillfället: ${error.message}`);
  if (!data) return null;

  const session = data as unknown as FullSession;
  session.test_efforts.sort((a, b) => a.ordinal - b.ordinal);
  return session;
}

/**
 * Alla testtillfällen med rådata och värden, äldst först – underlaget för
 * progressionen. Tyngre än `listSessions`, så den används bara där kurvorna
 * ska ritas.
 */
export async function listFullSessions(adeptId: string): Promise<FullSession[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_sessions")
    .select(
      "*, test_metrics(id, key, value, unit, method, is_primary), test_efforts(id, ordinal, intensity, duration_seconds, distance_m, lactate, heart_rate, heart_rate_max, performed_on, comment)",
    )
    .eq("adept_id", adeptId)
    .order("performed_on", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Kunde inte hämta testtillfällen: ${error.message}`);
  const sessions = (data ?? []) as unknown as FullSession[];
  for (const s of sessions) s.test_efforts.sort((a, b) => a.ordinal - b.ordinal);
  return sessions;
}

/**
 * Alla maximala insatser för en adept i en gren, som underlag för den
 * rullande modellen.
 *
 * Bara insatser med en längd räknas – ett stegtest har ingen "maximal insats"
 * i den meningen, det har steg som avbryts när protokollet säger till.
 */
export async function listMaximalEfforts(
  adeptId: string,
  sport: Sport,
): Promise<MaximalEffort[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_sessions")
    .select(
      "id, performed_on, sport, intensity_unit, protocol, test_efforts(duration_seconds, intensity, distance_m, performed_on)",
    )
    .eq("adept_id", adeptId)
    .eq("sport", sport)
    .neq("protocol", "laktat-steg");

  if (error) throw new Error(`Kunde inte hämta insatser: ${error.message}`);

  type Row = {
    id: string;
    performed_on: string;
    protocol: string;
    intensity_unit: IntensityUnit;
    test_efforts: {
      duration_seconds: number | null;
      intensity: number | null;
      distance_m: number | null;
      performed_on: string | null;
    }[];
  };

  return ((data ?? []) as unknown as Row[]).flatMap((session) => {
    const timed = session.test_efforts.filter(
      (e) => e.duration_seconds !== null && e.duration_seconds > 0,
    );

    // Varvtesterna (5 km, 20 min, lopp) är en insats, inte en per varv: en
    // kilometer mitt i ett 5 km-lopp är ingen maximal kilometer.
    if (LAP_PROTOCOLS.includes(session.protocol as ProtocolKey)) {
      if (timed.length === 0) return [];
      const seconds = timed.reduce((sum, e) => sum + Number(e.duration_seconds), 0);
      const metres = timed.every((e) => e.distance_m !== null)
        ? timed.reduce((sum, e) => sum + Number(e.distance_m), 0)
        : null;
      return [
        {
          sessionId: session.id,
          performedOn: timed[0].performed_on ?? session.performed_on,
          durationSeconds: seconds,
          intensity: null,
          distanceM: metres,
        },
      ];
    }

    // 3 min all-out: delintervallen är kumulativa och bara helheten är en
    // maxinsats – de första 150 sekunderna av ett all-out-test sprangs inte
    // som ett 150-sekunderslopp.
    const rows =
      session.protocol === "cs-3min" && timed.length > 0
        ? [
            timed.reduce((a, b) =>
              Number(b.duration_seconds) > Number(a.duration_seconds) ? b : a,
            ),
          ]
        : timed;

    return rows.map((e) => ({
      sessionId: session.id,
      // Insatsen kan vara gjord en annan dag än testtillfället.
      performedOn: e.performed_on ?? session.performed_on,
      durationSeconds: e.duration_seconds as number,
      intensity: e.intensity,
      distanceM: e.distance_m,
    }));
  });
}

/** Rådatan i den form beräkningslagret vill ha den. */
export function toEfforts(rows: SessionEffortRow[]): Effort[] {
  return rows.map((row) => ({
    ordinal: row.ordinal,
    intensity: row.intensity,
    durationSeconds: row.duration_seconds,
    distanceM: row.distance_m,
    lactate: row.lactate,
    heartRate: row.heart_rate,
  }));
}
