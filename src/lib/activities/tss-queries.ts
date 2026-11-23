import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { listSessions } from "@/lib/tests/session-queries";
import { protocolByKey } from "@/lib/tests/protocols";

import { candidatesFrom } from "./reference";
import {
  activityTss,
  thresholdsOn,
  type ActivityTss,
  type TssInput,
} from "./tss";

/** Det som behövs av en aktivitet för TSS och veckans summa. */
export type DoneLoad = TssInput & {
  id: string;
  adept_id: string;
  performed_on: string;
  work_kj: number | null;
  /** TSS räknad mot trösklarna den dagen, eller null. */
  load: ActivityTss | null;
};

const num = (v: unknown) =>
  v === null || v === undefined || v === "" ? null : Number(v);

/**
 * En adepts genomförda pass mellan två datum med TSS: ur filen när den hade
 * effekt, annars rTSS, sTSS eller hrTSS mot trösklarna som gällde dagen
 * (tss.ts). Bara fälten som behövs – inga serier – så att flera månader
 * bakåt går att hämta för fitness och form.
 */
export async function listDoneLoads(
  adeptId: string,
  from: string,
  to: string,
): Promise<DoneLoad[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const [{ data, error }, sessions] = await Promise.all([
    supabase
      .from("activities")
      .select(
        "id, adept_id, sport, performed_on, moving_s, duration_s, distance_m, tss:summary->tss, intensity_factor:summary->intensityFactor, avg_speed:summary->avgSpeed, normalized_speed:summary->normalizedSpeed, avg_hr:summary->avgHr, hr_zones:summary->hrZones, work_kj:summary->workKj",
      )
      .eq("adept_id", adeptId)
      .gte("performed_on", from)
      .lte("performed_on", to)
      .order("performed_on", { ascending: true }),
    listSessions(adeptId).catch(() => []),
  ]);
  if (error) return [];
  const candidates = candidatesFrom(
    sessions,
    (key) => protocolByKey(key)?.label ?? key,
  );
  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const row = {
      id: String(r.id),
      adept_id: String(r.adept_id),
      sport: String(r.sport),
      performed_on: String(r.performed_on),
      moving_s: num(r.moving_s),
      duration_s: num(r.duration_s),
      distance_m: num(r.distance_m),
      tss: num(r.tss),
      intensity_factor: num(r.intensity_factor),
      avg_speed: num(r.avg_speed),
      normalized_speed: num(r.normalized_speed),
      avg_hr: num(r.avg_hr),
      hr_zones: Array.isArray(r.hr_zones)
        ? (r.hr_zones as TssInput["hr_zones"])
        : null,
      work_kj: num(r.work_kj),
    };
    return {
      ...row,
      load: activityTss(row, thresholdsOn(candidates, row.performed_on)),
    };
  });
}
