"use server";

import { revalidatePath } from "next/cache";

import { requireCoach } from "@/lib/auth/session";
import type { Sport } from "@/lib/calculators/lactate";
import { loadRunningFitness } from "@/lib/plan-library/fitness";
import { routes } from "@/lib/routes";
import { toAdeptWorkout } from "@/lib/session-library/library";
import { saveLibrarySession } from "@/lib/session-library/actions";
import { todayIso } from "@/lib/season/season";
import { createClient } from "@/lib/supabase/server";
import type { AiPlanDraftRow, TrainingBlockRow } from "@/lib/types/database";
import { saveWorkout } from "@/lib/workouts/actions";
import { contextForAdept } from "@/lib/workouts/generate";

import { libraryInputOf, newSessionInput, parseDraft } from "./draft";
import { periodConflicts } from "./queries";
import { checkForAdept, type ToolContext } from "./tools";

export type ApplyResult =
  | { ok: true; workouts: number; periods: number; library: number }
  | { ok: false; error: string; conflicts?: string[] };

type Applied = NonNullable<AiPlanDraftRow["applied"]>;

/** Det ur ett bibliotekspass som passet på adepten byggs av. */
type PassBase = Omit<
  Parameters<typeof toAdeptWorkout>[0],
  "blocks" | "levels"
> &
  Partial<Pick<Parameters<typeof toAdeptWorkout>[0], "blocks" | "levels">>;

function refresh(adeptId: string) {
  revalidatePath(routes.aiCoach);
  revalidatePath(routes.calendar);
  revalidatePath(routes.dashboard);
  revalidatePath(`${routes.adepts}/${adeptId}`, "layout");
}

async function loadDraft(draftId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_plan_drafts")
    .select("*")
    .eq("id", draftId)
    .maybeSingle();
  return (data ?? null) as AiPlanDraftRow | null;
}

/**
 * Lägger in ett planförslag i adeptens kalender, när coachen godkänt det.
 *
 * Förslaget kontrolleras igen mot dagens bibliotek. Perioderna skapas –
 * krockar de med perioder som redan finns stannar inläggningen, om inte
 * coachen valt att ersätta dem. Nya pass sparas i coachens bibliotek, och
 * varje pass läggs på adepten omräknat mot adeptens tröskel i passets gren,
 * med veckans dos. Det som skapades sparas på förslaget så att det går
 * att ångra.
 */
export async function applyPlanDraft(input: {
  draftId: string;
  replacePeriods: boolean;
}): Promise<ApplyResult> {
  const user = await requireCoach();
  const row = await loadDraft(input.draftId);
  if (!row) return { ok: false, error: "Förslaget finns inte." };
  if (row.status !== "förslag") {
    return { ok: false, error: "Förslaget är redan inlagt eller ersatt." };
  }
  const parsed = parseDraft(row.plan);
  if (!parsed.ok) return { ok: false, error: parsed.errors.join(" ") };
  const draft = parsed.draft;

  const ctx: ToolContext = {
    adeptId: row.adept_id,
    conversationId: row.conversation_id,
    userId: user.id,
    cache: {},
  };
  const check = await checkForAdept(draft, ctx);
  if (check.errors.length > 0) {
    return {
      ok: false,
      error: `Förslaget går inte att lägga in längre: ${check.errors.join(" ")} Be AI:n om ett nytt.`,
    };
  }

  // Trösklarna i varje gren passen räknas mot, innan något skrivs.
  const sports = [...new Set(check.sessions.map((s) => s.sport))];
  const contexts = new Map<
    Sport,
    NonNullable<Awaited<ReturnType<typeof contextForAdept>>>
  >();
  for (const sport of sports) {
    const context = await contextForAdept(row.adept_id, sport);
    if (!context?.reference || !(context.reference > 0)) {
      return {
        ok: false,
        error: `Adepten saknar en tröskel i ${sport} att räkna passen mot. Lägg in ett test i ${sport} först.`,
      };
    }
    contexts.set(sport, context);
  }
  const speeds = sports.includes("löpning")
    ? (await loadRunningFitness(row.adept_id)).refs
    : {};

  const conflicts = await periodConflicts(row.adept_id, draft);
  if (conflicts.length > 0 && !input.replacePeriods) {
    return {
      ok: false,
      error: "Perioderna krockar med perioder som redan finns.",
      conflicts: conflicts.map(
        (b) => `${b.name ?? b.phase} ${b.starts_on} – ${b.ends_on}`,
      ),
    };
  }

  const supabase = await createClient();
  const applied: Applied = {
    blocks: [],
    workouts: [],
    library: [],
    replaced: [],
  };

  // Perioderna: de som krockar ersätts, och sparas för att kunna ångras.
  if (conflicts.length > 0) {
    const { error } = await supabase
      .from("training_blocks")
      .delete()
      .in(
        "id",
        conflicts.map((b) => b.id),
      );
    if (error)
      return {
        ok: false,
        error: `Kunde inte ersätta perioderna: ${error.message}`,
      };
    applied.replaced = conflicts;
  }
  if (draft.periods.length > 0) {
    const { data, error } = await supabase
      .from("training_blocks")
      .insert(
        draft.periods.map((p) => ({
          adept_id: row.adept_id,
          phase: p.phase,
          name: p.name,
          starts_on: p.starts_on,
          ends_on: p.ends_on,
          focus: p.focus || null,
          created_by: user.id,
        })),
      )
      .select("id");
    if (error)
      return {
        ok: false,
        error: `Kunde inte skapa perioderna: ${error.message}`,
      };
    applied.blocks = (data ?? []).map((b) => b.id);
  }

  // Passen formaten bygger på: bibliotekets, eller de nya som sparas i
  // coachens bibliotek så att de finns till nästa gång.
  const library = ctx.cache.library ?? [];
  const passes = new Map<string, PassBase>();
  for (const format of draft.formats) {
    if (format.library_id) {
      const lib = library.find((l) => l.id === format.library_id);
      if (lib) passes.set(format.key, lib);
      continue;
    }
    if (!format.new_session) continue;
    const input = libraryInputOf(format.new_session);
    const valid = newSessionInput(format.new_session);
    if (!valid.ok) continue;
    const saved = await saveLibrarySession(input);
    if (!saved.ok) {
      await undoApplied(row.adept_id, applied);
      return {
        ok: false,
        error: `Kunde inte spara ${input.title} i biblioteket: ${saved.error}`,
      };
    }
    applied.library.push(saved.id);
    passes.set(format.key, { ...valid.value, levels: [] });
  }

  // Passen på adepten, omräknade mot adeptens tröskel med veckans dos.
  for (const session of check.sessions) {
    const pass = passes.get(session.format);
    const context = contexts.get(session.sport);
    if (!pass || !context) continue;
    const converted = toAdeptWorkout(
      { ...pass, blocks: session.blocks, levels: [] },
      {
        sport: context.sport,
        basis: context.basis,
        reference: context.reference,
      },
      speeds,
      null,
    );
    if (!converted.ok) {
      await undoApplied(row.adept_id, applied);
      return {
        ok: false,
        error: `${session.date} ${session.title}: ${converted.error}`,
      };
    }
    const workout = {
      ...converted.workout,
      summary: [session.note, converted.workout.summary]
        .filter(Boolean)
        .join(" · "),
    };
    const saved = await saveWorkout({
      adeptId: row.adept_id,
      workout,
      reference: context.reference ?? 0,
      critical: context.balance?.critical ?? null,
      reserve: context.balance?.reserve ?? null,
      prompt: null,
      scheduledFor: session.date,
    });
    if (!saved.ok) {
      await undoApplied(row.adept_id, applied);
      return {
        ok: false,
        error: `${session.date} ${session.title}: ${saved.error}`,
      };
    }
    applied.workouts.push(saved.id);
    if (session.testProtocol) {
      await supabase
        .from("workouts")
        .update({ test_protocol: session.testProtocol })
        .eq("id", saved.id);
    }
  }

  await supabase
    .from("ai_plan_drafts")
    .update({
      status: "inlagd",
      applied,
      applied_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  refresh(row.adept_id);
  return {
    ok: true,
    workouts: applied.workouts.length,
    periods: applied.blocks.length,
    library: applied.library.length,
  };
}

/**
 * Tar bort det en inläggning skapade och lägger tillbaka perioderna den
 * ersatte, med sina gamla id:n. Med `from` ligger pass före det datumet
 * kvar – de har redan passerat och kan ha kopplats till ett genomfört pass.
 */
async function undoApplied(
  adeptId: string,
  applied: Applied,
  from: string | null = null,
): Promise<number> {
  const supabase = await createClient();
  let kept = 0;
  if (applied.workouts.length > 0) {
    let remove = supabase
      .from("workouts")
      .delete()
      .eq("adept_id", adeptId)
      .in("id", applied.workouts);
    if (from) remove = remove.gte("scheduled_for", from);
    const { data } = await remove.select("id");
    kept = applied.workouts.length - (data?.length ?? 0);
  }
  if (applied.blocks.length > 0) {
    await supabase
      .from("training_blocks")
      .delete()
      .eq("adept_id", adeptId)
      .in("id", applied.blocks);
  }
  const replaced = (applied.replaced ?? []) as TrainingBlockRow[];
  if (replaced.length > 0) {
    await supabase.from("training_blocks").insert(
      replaced.map((b) => ({
        id: b.id,
        adept_id: b.adept_id,
        phase: b.phase,
        name: b.name,
        starts_on: b.starts_on,
        ends_on: b.ends_on,
        focus: b.focus,
        created_by: b.created_by,
      })),
    );
  }
  return kept;
}

/**
 * Ångrar en inläggning: passen och perioderna den skapade tas bort, och de
 * perioder den ersatte kommer tillbaka. Pass som redan har passerat ligger
 * kvar. Nya pass i biblioteket ligger också kvar – de är coachens nu.
 * Förslaget går att lägga in igen.
 */
export async function undoPlanDraft(
  draftId: string,
): Promise<{ ok: true; kept: number } | { ok: false; error: string }> {
  await requireCoach();
  const row = await loadDraft(draftId);
  if (!row || row.status !== "inlagd" || !row.applied) {
    return { ok: false, error: "Förslaget är inte inlagt." };
  }
  const kept = await undoApplied(row.adept_id, row.applied, todayIso());
  const supabase = await createClient();
  await supabase
    .from("ai_plan_drafts")
    .update({ status: "förslag", applied: null, applied_at: null })
    .eq("id", row.id);
  refresh(row.adept_id);
  return { ok: true, kept };
}

/** Lägger förslaget åt sidan utan att något läggs in. */
export async function discardPlanDraft(
  draftId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireCoach();
  const row = await loadDraft(draftId);
  if (!row || row.status !== "förslag") {
    return { ok: false, error: "Förslaget går inte att förkasta." };
  }
  const supabase = await createClient();
  await supabase
    .from("ai_plan_drafts")
    .update({ status: "förkastad" })
    .eq("id", row.id);
  refresh(row.adept_id);
  return { ok: true };
}
