import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { Curve } from "./analysis";
import {
  DURABILITY_SPANS,
  durabilityFromSeries,
  type Durability,
  type DurabilityAxis,
  type DurabilitySource,
} from "./durability";

type Row = {
  id: string;
  sport: string;
  performed_on: string;
  moving_s: number | null;
  duration_s: number | null;
  work_kj: number | null;
  curve: Curve | null;
  durability: Durability | null;
};

type SeriesRow = {
  id: string;
  t: number[] | null;
  power: (number | null)[] | null;
  speed: (number | null)[] | null;
};

/** Kortare än så når inget pass första nivån: ~10 kJ/kg, 30 minuter. */
const MIN_WORK_KJ = 500;
const MIN_RUN_S = 30 * 60;

export type DurabilitySources = Record<DurabilityAxis, DurabilitySource[]>;

/**
 * Passen sedan ett datum med sin durability: cykling med effekt på kJ-axeln,
 * löpning på minuter i rörelse.
 *
 * Utvilat bästa (nivå 0) tas ur bästa-kurvan, som finns för alla pass och är
 * räknad på sekundserien. Pass som lästes in innan durability räknades får
 * de djupare nivåerna ur den sparade serien, märkta som uppskattade – men
 * bara pass som är långa nog att nå första nivån, så att sidan inte hämtar
 * serien för varje kort pass.
 */
export async function listDurabilitySources(
  adeptId: string,
  since: string,
): Promise<DurabilitySources> {
  const out: DurabilitySources = { kJ: [], min: [] };
  if (!isSupabaseConfigured()) return out;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select(
      "id, sport, performed_on, moving_s, duration_s, work_kj:summary->workKj, curve:summary->curve, durability:summary->durability",
    )
    .eq("adept_id", adeptId)
    .in("sport", ["cykling", "löpning"])
    .gte("performed_on", since)
    .order("performed_on", { ascending: true });
  if (error) return out;
  const rows = (data ?? []) as unknown as Row[];

  // Grenen avgör axeln: löpning med effekt (Stryd) räknas i minuter.
  const axisOf = (r: Row): DurabilityAxis | null =>
    r.sport === "cykling"
      ? (r.curve?.power?.length ?? 0) > 0 || Number(r.work_kj ?? 0) > 0
        ? "kJ"
        : null
      : r.sport === "löpning"
        ? "min"
        : null;

  const missing = rows.filter((r) => {
    if (r.durability) return false;
    const axis = axisOf(r);
    if (axis === "kJ") return Number(r.work_kj ?? 0) >= MIN_WORK_KJ;
    if (axis === "min")
      return Number(r.moving_s ?? r.duration_s ?? 0) >= MIN_RUN_S;
    return false;
  });
  const estimated = new Map<string, Durability>();
  if (missing.length > 0) {
    const { data: series } = await supabase
      .from("activities")
      .select("id, t:streams->t, power:streams->power, speed:streams->speed")
      .in(
        "id",
        missing.map((r) => r.id),
      );
    for (const s of (series ?? []) as unknown as SeriesRow[]) {
      const row = missing.find((r) => r.id === s.id);
      if (!row || !s.t) continue;
      const axis = axisOf(row);
      const d =
        axis === "kJ" && s.power
          ? durabilityFromSeries(s.t, s.power, "kJ")
          : axis === "min" && s.speed
            ? durabilityFromSeries(
                s.t,
                // Serien sparas i km/h.
                s.speed.map((v) => (v === null ? null : v / 3.6)),
                "min",
              )
            : null;
      if (d) estimated.set(s.id, d);
    }
  }

  for (const r of rows) {
    const axis = axisOf(r);
    if (!axis) continue;
    const own = r.durability ?? estimated.get(r.id) ?? null;
    // Utvilat ur bästa-kurvan när den finns; pass lästa före kurvan får
    // även den nivån ur serien.
    const fromCurve = (axis === "kJ" ? r.curve?.power : r.curve?.speed) ?? [];
    const fresh: [number, number, number][] =
      fromCurve.length > 0
        ? DURABILITY_SPANS.flatMap((span) => {
            const hit = fromCurve.find(([s]) => s === span);
            return hit ? [[0, span, hit[1]] as [number, number, number]] : [];
          })
        : (own?.points ?? []).filter(([after]) => after === 0);
    if (fresh.length === 0 && !own) continue;
    const deeper = (own?.points ?? []).filter(([after]) => after > 0);
    out[axis].push({
      id: r.id,
      performed_on: r.performed_on,
      durability: { axis, points: [...fresh, ...deeper] },
      estimated: !r.durability && estimated.has(r.id),
    });
  }
  return out;
}
