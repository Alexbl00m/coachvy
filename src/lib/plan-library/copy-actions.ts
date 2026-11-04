"use server";

import { revalidatePath } from "next/cache";

import type { Sport } from "@/lib/calculators/lactate";
import { routes } from "@/lib/routes";
import { todayIso } from "@/lib/season/season";
import { toAdeptWorkout } from "@/lib/session-library/library";
import { createClient } from "@/lib/supabase/server";
import { saveWorkout } from "@/lib/workouts/actions";
import { requireWorkoutAuthor } from "@/lib/workouts/access";
import { contextForAdept } from "@/lib/workouts/generate";
import type { WorkoutBlock } from "@/lib/workouts/schema";

import { loadRunningFitness } from "./fitness";
import { loadPlanView } from "./plan-view";

export type CopyResult =
  | { ok: true; id: string; note: string | null }
  | { ok: false; error: string };

/**
 * Lägger ett pass ur en plan i biblioteket i adeptens kalender, som ett
 * eget pass: planen som verktygslåda. Passet räknas om mot adeptens
 * tröskel i passets gren, som ett pass ur passbiblioteket, och följer
 * sedan inte planen. Det ändras i passbyggaren som vilket pass som helst.
 */
export async function copyPlanSession(input: {
  sessionId: string;
  levelId: string;
  adeptId: string;
  date: string;
}): Promise<CopyResult> {
  const access = await requireWorkoutAuthor(input.adeptId);
  if (!access.ok) return access;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date))
    return { ok: false, error: "Välj ett datum." };

  const supabase = await createClient();
  const [{ data: session }, { data: variant }] = await Promise.all([
    supabase
      .from("plan_template_sessions")
      .select("id, discipline, type, title, description")
      .eq("id", input.sessionId)
      .maybeSingle(),
    supabase
      .from("plan_template_session_variants")
      .select("description, zone, basis, blocks")
      .eq("session_id", input.sessionId)
      .eq("level_id", input.levelId)
      .maybeSingle(),
  ]);
  if (!session || !variant) {
    return { ok: false, error: "Passet finns inte i planen i den nivån." };
  }
  const { data: discipline } = await supabase
    .from("disciplines")
    .select("structure_sport")
    .eq("key", session.discipline)
    .maybeSingle();
  const sport = discipline?.structure_sport as Sport | null | undefined;
  const blocks = (variant.blocks ?? []) as WorkoutBlock[];
  if (!sport || !variant.basis || blocks.length === 0) {
    return {
      ok: false,
      error:
        "Passet har ingen struktur att räkna om. Styrkepass läggs in under Styrka.",
    };
  }

  const context = await contextForAdept(input.adeptId, sport);
  if (!context) return { ok: false, error: "Adepten hittades inte." };
  if (!(context.reference !== null && context.reference > 0)) {
    return {
      ok: false,
      error: `Adepten saknar en tröskel i ${sport} att räkna passet mot. Lägg in ett test i ${sport} först.`,
    };
  }
  // Löpplanerna står i loppfart; formuppskattningen räknar om dem.
  const speeds =
    sport === "löpning" && variant.basis !== context.basis
      ? (await loadRunningFitness(input.adeptId)).refs
      : {};
  const converted = toAdeptWorkout(
    {
      title: session.title,
      sport,
      kind: session.type ?? "Pass",
      intensity: variant.zone ?? "",
      basis: variant.basis,
      structure: "",
      blocks,
      levels: [],
      purpose: session.description ?? "",
      description: variant.description ?? "",
      progression: "",
      adaptations: "",
      fueling: "",
      timing: "",
    },
    {
      sport: context.sport,
      basis: context.basis,
      reference: context.reference,
    },
    speeds,
    null,
  );
  if (!converted.ok) return converted;

  const saved = await saveWorkout({
    adeptId: input.adeptId,
    workout: converted.workout,
    reference: context.reference,
    critical: context.balance?.critical ?? null,
    reserve: context.balance?.reserve ?? null,
    prompt: null,
    scheduledFor: input.date,
  });
  if (!saved.ok) return saved;

  revalidatePath(routes.calendar);
  revalidatePath(routes.dashboard);
  return { ok: true, id: saved.id, note: converted.note };
}

/**
 * Kopierar ett pass i en startad plan till en dag, som ett eget pass i den
 * nivå adepten har den veckan. Planen rörs inte.
 */
export async function copyScheduledPlanSession(input: {
  instanceId: string;
  sessionId: string;
  week: number;
  adeptId: string;
  date: string;
}): Promise<CopyResult> {
  const view = await loadPlanView(input.instanceId, todayIso());
  if (!view || view.instance.adept_id !== input.adeptId) {
    return { ok: false, error: "Planen hittades inte." };
  }
  const scheduled = view.schedule
    .find((w) => w.week === input.week)
    ?.sessions.find((s) => s.session.id === input.sessionId);
  if (!scheduled) return { ok: false, error: "Passet finns inte i planen." };
  return copyPlanSession({
    sessionId: input.sessionId,
    levelId: scheduled.levelId,
    adeptId: input.adeptId,
    date: input.date,
  });
}
