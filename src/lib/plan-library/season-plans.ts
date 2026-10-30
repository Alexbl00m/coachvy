import "server-only";

import type { PlanForSeason } from "@/lib/season/plan-season";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

import { spansFromWeekMap } from "./periodization";

/**
 * Planerna som formar säsongen, med faserna och deras datum: den pågående,
 * de i kö och de som gått till slut. En avbruten plan formar ingen säsong.
 * Utan adept: alla planer den inloggade ser.
 */
export async function listPlansForSeason(
  adeptId: string | null,
): Promise<PlanForSeason[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  let query = supabase
    .from("plan_instances")
    .select("id, adept_id, title, start_date, weeks, week_map, version_id")
    .in("status", ["aktiv", "kommande", "avslutad"]);
  if (adeptId) query = query.eq("adept_id", adeptId);
  const { data: instances, error } = await query;
  if (error || !instances?.length) return [];

  const versions = [...new Set(instances.map((i) => i.version_id))];
  const [{ data: phases }, { data: weeks }] = await Promise.all([
    supabase
      .from("plan_template_phases")
      .select("id, version_id, name, season_phase")
      .in("version_id", versions),
    supabase
      .from("plan_template_weeks")
      .select("id, version_id, phase_id")
      .in("version_id", versions),
  ]);

  return instances.map((i) => ({
    id: i.id,
    adept_id: i.adept_id,
    title: i.title,
    start_date: i.start_date,
    weeks: i.weeks,
    spans: spansFromWeekMap({
      startDate: i.start_date,
      weekMap: i.week_map as string[],
      weeks: (weeks ?? [])
        .filter((w) => w.version_id === i.version_id)
        .map((w) => ({ id: w.id, phaseId: w.phase_id })),
      phases: (phases ?? [])
        .filter((p) => p.version_id === i.version_id)
        .map((p) => ({ id: p.id, name: p.name, seasonPhase: p.season_phase })),
    }),
  }));
}
