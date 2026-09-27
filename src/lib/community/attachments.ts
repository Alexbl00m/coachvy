import "server-only";

import { protocolByKey } from "@/lib/tests/protocols";
import { formatDuration, type WorkoutBlock, type WorkoutStep } from "@/lib/workouts/schema";
import type { CommunityAttachment } from "@/lib/types/database";
import { createClient } from "@/lib/supabase/server";

const SPORT: Record<string, string> = { cykling: "Cykel", löpning: "Löpning", simning: "Simning" };

const pct = (step: WorkoutStep, basis: string) => {
  const low = Math.round(step.low * 100);
  const high = Math.round(step.high * 100);
  return `${low === high ? low : `${low}–${high}`} % ${basis}`;
};

const length = (step: WorkoutStep) =>
  step.durationSeconds
    ? formatDuration(step.durationSeconds)
    : step.distanceM
      ? `${step.distanceM} m`
      : "";

const stepText = (step: WorkoutStep, basis: string) =>
  [length(step), step.label || step.kind, pct(step, basis)].filter(Boolean).join(" ");

/**
 * Ett pass som ögonblicksbild.
 *
 * Målen står i procent av tröskeln, inte i atletens watt eller tempo. Då går
 * passet att använda för vem som helst, och det säger ingenting om den atlet
 * det byggdes för. Raden läses med den inloggades rättigheter: den som inte
 * får se passet får null.
 */
export async function workoutAttachment(id: string): Promise<CommunityAttachment | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workouts")
    .select("title, sport, summary, basis, blocks")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  const blocks = (data.blocks ?? []) as WorkoutBlock[];
  const lines = blocks.slice(0, 20).map((block) =>
    block.type === "steg"
      ? { label: block.step.kind, value: stepText(block.step, data.basis) }
      : {
          label: `${block.times} ×`,
          value: block.steps.map((s) => stepText(s, data.basis)).join(" · "),
        },
  );

  return {
    kind: "workout",
    title: data.title,
    subtitle: [SPORT[data.sport] ?? data.sport, data.summary].filter(Boolean).join(" · "),
    lines,
  };
}

/**
 * Ett testresultat som ögonblicksbild – bara adeptens eget.
 *
 * Coachen ser sina adepters tester, men att lägga ut dem för hela communityn
 * är adeptens beslut, inte coachens.
 */
export async function testAttachment(
  id: string,
  profileId: string,
): Promise<CommunityAttachment | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("test_sessions")
    .select("protocol, sport, performed_on, adept_id, test_metrics(key, value, unit, method, is_primary)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  const { data: owner } = await supabase
    .from("adepts")
    .select("profile_id")
    .eq("id", data.adept_id)
    .maybeSingle();
  if (!owner || owner.profile_id !== profileId) return null;

  const metrics = (data.test_metrics ?? []) as unknown as {
    key: string;
    value: number;
    unit: string;
    method: string | null;
    is_primary: boolean;
  }[];
  const digits = (unit: string) =>
    ["W", "%", "ml/kg/min", "g/h"].includes(unit) ? 0 : unit === "mmol/l/s" ? 2 : 1;

  return {
    kind: "test",
    title: protocolByKey(data.protocol)?.label ?? data.protocol,
    subtitle: [SPORT[data.sport] ?? data.sport, data.performed_on].join(" · "),
    lines: metrics
      .filter((m) => m.is_primary)
      .map((m) => ({
        label: m.key.replace("_prime", "′"),
        value: `${Number(m.value).toFixed(digits(m.unit)).replace(".", ",")} ${m.unit}`,
      })),
  };
}
