import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { strainFromSeries, type LoadActivity } from "./load";

type LoadRow = {
  id: string;
  sport: string;
  performed_on: string;
  duration_s: number | null;
  moving_s: number | null;
  distance_m: number | null;
  work_kj: number | null;
  strain: number | null;
};

type SeriesRow = {
  id: string;
  sport: string;
  cp: number | null;
  w_prime: number | null;
  cs: number | null;
  d_prime: number | null;
  t: number[] | null;
  power: (number | null)[] | null;
  speed: (number | null)[] | null;
};

/**
 * Passen sedan ett datum, som volym och strain.
 *
 * Pass som lästes in innan strain räknades har den inte i analysen. För dem
 * uppskattas den ur den sparade serien, mot CP/W′ som gällde för passet – en
 * extra fråga bara för de passen, och bara för serien som behövs.
 */
export async function listLoadActivities(
  adeptId: string,
  since: string,
): Promise<LoadActivity[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select(
      "id, sport, performed_on, duration_s, moving_s, distance_m, work_kj:summary->workKj, strain:summary->strain",
    )
    .eq("adept_id", adeptId)
    .gte("performed_on", since)
    .order("performed_on", { ascending: true });
  if (error) return [];
  const rows = (data ?? []) as unknown as LoadRow[];

  const missing = rows
    .filter(
      (r) =>
        r.strain === null && (r.sport === "cykling" || r.sport === "löpning"),
    )
    .map((r) => r.id);
  const estimated = new Map<string, number>();
  if (missing.length > 0) {
    const { data: series } = await supabase
      .from("activities")
      .select(
        "id, sport, cp:reference->cp, w_prime:reference->wPrime, cs:reference->cs, d_prime:reference->dPrime, t:streams->t, power:streams->power, speed:streams->speed",
      )
      .in("id", missing);
    for (const s of (series ?? []) as unknown as SeriesRow[]) {
      if (!s.t) continue;
      const value =
        s.sport === "cykling" && s.power && s.cp && s.w_prime
          ? strainFromSeries(
              s.t,
              s.power,
              Number(s.cp),
              Number(s.w_prime),
              "power",
            )
          : s.sport === "löpning" && s.speed && s.cs && s.d_prime
            ? strainFromSeries(
                s.t,
                s.speed,
                Number(s.cs),
                Number(s.d_prime),
                "speed",
              )
            : null;
      if (value !== null) estimated.set(s.id, value);
    }
  }

  return rows.map((r) => {
    const fromSeries = estimated.get(r.id);
    return {
      id: r.id,
      sport: r.sport,
      performed_on: r.performed_on,
      seconds: Number(r.moving_s ?? r.duration_s ?? 0),
      kj: r.work_kj === null ? null : Number(r.work_kj),
      km: r.distance_m === null ? null : Number(r.distance_m) / 1000,
      strain: r.strain !== null ? Number(r.strain) : (fromSeries ?? null),
      estimated: r.strain === null && fromSeries !== undefined,
    };
  });
}
