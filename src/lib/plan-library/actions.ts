"use server";

import { revalidatePath } from "next/cache";

import { isMember } from "@/lib/auth/membership";
import { requireSessionUser } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { saveRace } from "@/lib/season/actions";
import { addDays, todayIso } from "@/lib/season/season";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/plan-library.generated";

import {
  parseLevelSuggestion,
  suggestionToChanges,
  type LevelSuggestion,
} from "./context";
import {
  effectiveWeek,
  historyKept,
  levelForWeek,
  planStepwise,
  planSwitch,
  planTemporary,
  supersededBy,
  type ReturnMode,
} from "./levels";
import { parseRaceTime } from "./paces";
import { proposePeriodization } from "./periodization";
import { loadPlanView } from "./plan-view";
import { loadVersion } from "./queries";
import { suggestReentry } from "./reentry";
import type { ChangeReason, PlannedChange } from "./types";

/**
 * Medlemmens åtgärder i planbiblioteket. RLS avgör vem som får: adepten
 * själv och adeptens coach, så länge adepten är medlem.
 */

export type PlanResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

const fail = (error: string): PlanResult => ({ ok: false, error });

const dbError = (error: { message?: string; code?: string }) =>
  error.code === "42501" ||
  error.code === "23514" ||
  error.code === "23505" ||
  error.code === "P0001"
    ? fail(error.message ?? "Det gick inte.")
    : fail(`Det gick inte att spara: ${error.message ?? "okänt fel"}.`);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function refreshPlan() {
  revalidatePath(routes.myPlan);
  revalidatePath(routes.planLibrary, "layout");
  revalidatePath(routes.calendar);
  revalidatePath(routes.dashboard);
}

export type StartPlanInput = {
  versionId: string;
  goal:
    | {
        mode: "lopp";
        raceId: string | null;
        /** Ett nytt lopp, som läggs in i säsongsplanen som A-lopp. */
        newRace: { name: string; date: string } | null;
        weekStart: number;
      }
    | { mode: "fritt"; startDate: string };
  length: number;
  counts: Record<string, number> | null;
  levelId: string;
  /** Varvens längd när planen går i varv. Null: ett varv. */
  rounds?: number[] | null;
  /** Medlemmens egna veckor per fas i varje varv. */
  roundCounts?: (Record<string, number> | null)[] | null;
  /** Nivån i varje varv; det första är `levelId`. */
  roundLevels?: string[] | null;
  /** Vad tempona räknas ur. Standard: formuppskattningen. */
  paceMode?: "form" | "mål";
  /** Måltiden för maraton, som "3:15:00", när tempona räknas ur målet. */
  goalTime?: string;
};

/** Läser en måltid för maraton. Ger ett fel i text eller sekunderna. */
function readGoalTime(text: string | undefined): number | string {
  const seconds = text?.trim() ? parseRaceTime(text) : null;
  if (seconds === null) {
    return "Skriv måltiden som timmar, minuter och sekunder, till exempel 3:15:00.";
  }
  if (seconds < 2 * 3600 || seconds > 8 * 3600) {
    return "Måltiden för ett maraton ska ligga mellan 2 och 8 timmar.";
  }
  return seconds;
}

/**
 * Startar en plan: periodiseringen räknas om här med samma funktion som
 * förslaget, så att det som sparas är det medlemmen såg.
 */
export async function startPlan(input: StartPlanInput): Promise<PlanResult> {
  const user = await requireSessionUser();
  const adept = user.adept;
  if (user.profile?.role !== "adept" || !adept) {
    return fail("Planer startas av medlemmen själv.");
  }
  if (!isMember(user)) return fail("Planbiblioteket ingår i medlemskapet.");

  const content = await loadVersion(input.versionId);
  if (!content || content.version.status !== "publicerad") {
    return fail("Planen finns inte längre i biblioteket. Ladda om sidan.");
  }
  const { version, domain } = content;
  if (!domain.levels.some((l) => l.id === input.levelId)) {
    return fail("Välj en nivå.");
  }
  const rounds =
    input.rounds && input.rounds.length > 1
      ? input.rounds.map(Math.round)
      : null;
  if (rounds && rounds.length > 3) return fail("Högst tre varv.");
  const roundLevels = rounds
    ? rounds.map((_, i) =>
        i === 0 ? input.levelId : (input.roundLevels?.[i] ?? input.levelId),
      )
    : [input.levelId];
  if (!roundLevels.every((id) => domain.levels.some((l) => l.id === id))) {
    return fail("Välj en nivå för varje varv.");
  }

  const paceMode = input.paceMode === "mål" ? "mål" : "form";
  let goalSeconds: number | null = null;
  if (paceMode === "mål") {
    const goal = readGoalTime(input.goalTime);
    if (typeof goal === "string") return fail(goal);
    goalSeconds = goal;
  }

  const today = todayIso();
  const supabase = await createClient();
  let raceId: string | null = null;
  let raceDate: string | null = null;

  if (input.goal.mode === "lopp") {
    if (input.goal.newRace) {
      const { name, date } = input.goal.newRace;
      if (!ISO_DATE.test(date)) return fail("Välj loppets datum.");
      const saved = await saveRace({
        adeptId: adept.id,
        name,
        raceDate: date,
        sport: null,
        distance: null,
        priority: "A",
        target: null,
        note: null,
      });
      if (!saved.ok) return fail(saved.error);
      raceId = saved.id;
      raceDate = date;
    } else if (input.goal.raceId) {
      const { data: race } = await supabase
        .from("adept_races")
        .select("id, race_date")
        .eq("id", input.goal.raceId)
        .eq("adept_id", adept.id)
        .maybeSingle();
      if (!race) return fail("Loppet hittades inte.");
      raceId = race.id;
      raceDate = race.race_date;
    } else {
      return fail("Välj ett lopp.");
    }
  } else if (!ISO_DATE.test(input.goal.startDate)) {
    return fail("Välj ett startdatum.");
  } else if (input.goal.startDate < addDays(today, -6)) {
    return fail("Planen kan inte börja mer än en vecka bakåt i tiden.");
  }

  const proposal = proposePeriodization({
    phases: domain.phases,
    weeks: domain.weeks,
    minWeeks: version.min_weeks,
    maxWeeks: version.max_weeks,
    goal:
      input.goal.mode === "lopp"
        ? {
            mode: "lopp",
            raceDate: raceDate!,
            earliest: today,
            weekStart: Math.max(
              0,
              Math.min(6, Math.round(input.goal.weekStart)),
            ),
          }
        : { mode: "fritt", startDate: input.goal.startDate },
    length: input.length,
    counts: input.counts ?? undefined,
    rounds: rounds ?? undefined,
    roundCounts: rounds ? (input.roundCounts ?? undefined) : undefined,
  });
  if (!proposal.ok) return fail(proposal.error);

  const { data, error } = await supabase
    .from("plan_instances")
    .insert({
      adept_id: adept.id,
      template_id: version.template_id,
      version_id: version.id,
      title: version.title,
      start_date: proposal.startDate,
      weeks: proposal.length,
      goal_mode: input.goal.mode,
      race_id: raceId,
      race_date: raceDate,
      start_level_id: input.levelId,
      week_map: proposal.weekMap,
      rounds: rounds ? proposal.rounds.map((r) => r.weeks) : null,
      pace_mode: paceMode,
      goal_seconds: goalSeconds,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return dbError(error);

  // Nivån i varje varv: ett byte där varvet börjar, som vilket byte som
  // helst – det syns i historiken och går att ändra.
  const switches = proposal.rounds.flatMap((round, i) =>
    i > 0 && roundLevels[i] !== roundLevels[i - 1]
      ? [
          {
            instance_id: data.id,
            adept_id: adept.id,
            effective_week: round.fromWeek,
            from_level_id: roundLevels[i - 1],
            to_level_id: roundLevels[i],
            kind: "byte" as const,
            reason: "eget val" as const,
            source: "medlem" as const,
            note: `Varv ${round.round}`,
            group_id: crypto.randomUUID(),
            created_by: user.id,
          },
        ]
      : [],
  );
  if (switches.length > 0) {
    const { error: sError } = await supabase
      .from("plan_level_changes")
      .insert(switches);
    if (sError) return dbError(sError);
  }

  refreshPlan();
  return { ok: true, id: data.id };
}

// ---------------------------------------------------------------------------
// I en startad plan
// ---------------------------------------------------------------------------

type Ctx = {
  userId: string;
  source: "medlem" | "coach";
  view: NonNullable<Awaited<ReturnType<typeof loadPlanView>>>;
  supabase: Awaited<ReturnType<typeof createClient>>;
};

/** Planen och vem som ändrar den. RLS stoppar den som inte får. */
async function context(instanceId: string): Promise<Ctx | PlanResult> {
  const user = await requireSessionUser();
  const view = await loadPlanView(instanceId, todayIso());
  if (!view) return fail("Planen hittades inte.");
  if (view.instance.status !== "aktiv") {
    return fail("Planen är avslutad och kan inte ändras.");
  }
  const supabase = await createClient();
  const { data: canEdit } = await supabase.rpc("can_edit_plan", {
    adept: view.instance.adept_id,
  });
  if (!canEdit) {
    return fail(
      "Planen är skrivskyddad – den ingår i medlemskapet, som inte är aktivt just nu.",
    );
  }
  const isCoach = user.profile?.role === "coach";
  return {
    userId: user.id,
    source: isCoach ? "coach" : "medlem",
    view,
    supabase,
  };
}

const isCtx = (c: Ctx | PlanResult): c is Ctx => "view" in c;

/** Sparar planerade byten som en grupp, och återkallar dem de ersätter. */
async function writeChanges(
  ctx: Ctx,
  changes: PlannedChange[],
  meta: {
    reason: ChangeReason;
    note: string | null;
    source?: "medlem" | "coach" | "ai";
  },
): Promise<PlanResult & { groupId?: string }> {
  if (changes.length === 0) return fail("Det blir ingen ändring av nivån.");
  const { view, supabase } = ctx;
  const first = Math.min(...changes.map((c) => c.effectiveWeek));
  const superseded = supersededBy(view.history, first, view.currentWeek);
  if (superseded.length > 0) {
    const { error } = await supabase
      .from("plan_level_changes")
      .update({ revoked_at: new Date().toISOString(), revoked_by: ctx.userId })
      .in(
        "id",
        superseded.map((c) => c.id),
      );
    if (error) return dbError(error);
  }
  const groupId = crypto.randomUUID();
  const { error } = await supabase.from("plan_level_changes").insert(
    changes.map((c) => ({
      instance_id: view.instance.id,
      adept_id: view.instance.adept_id,
      effective_week: c.effectiveWeek,
      from_level_id: c.fromLevelId,
      to_level_id: c.toLevelId,
      kind: c.kind,
      reason: meta.reason,
      source: meta.source ?? ctx.source,
      note: meta.note,
      group_id: groupId,
      created_by: ctx.userId,
    })),
  );
  if (error) return dbError(error);
  return { ok: true, groupId };
}

export type ChangeLevelInput = {
  instanceId: string;
  mode: "byte" | "stegvis" | "tillfällig";
  toLevelId: string;
  /** Planveckan bytet gäller från. */
  week: number;
  stepWeeks: number;
  durationWeeks: number;
  returnMode: ReturnMode;
  reason: ChangeReason;
  note: string;
};

export async function changeLevel(
  input: ChangeLevelInput,
): Promise<PlanResult> {
  const ctx = await context(input.instanceId);
  if (!isCtx(ctx)) return ctx;
  const { view } = ctx;
  if (!view.levels.some((l) => l.id === input.toLevelId)) {
    return fail("Välj en nivå.");
  }
  const total = view.instance.weeks;
  const week = effectiveWeek(view.currentWeek, total, input.week);
  const from = levelForWeek(
    view.instance.start_level_id,
    historyKept(view.history, week, view.currentWeek),
    week,
  );
  const changes =
    input.mode === "byte"
      ? planSwitch(from, input.toLevelId, week)
      : input.mode === "stegvis"
        ? planStepwise({
            levels: view.levels,
            fromLevelId: from,
            toLevelId: input.toLevelId,
            startWeek: week,
            stepWeeks: input.stepWeeks,
            totalWeeks: total,
          })
        : planTemporary({
            levels: view.levels,
            fromLevelId: from,
            toLevelId: input.toLevelId,
            startWeek: week,
            durationWeeks: input.durationWeeks,
            returnMode: input.returnMode,
            stepWeeks: input.stepWeeks,
            totalWeeks: total,
          });
  const result = await writeChanges(ctx, changes, {
    reason: input.reason,
    note: input.note.trim().slice(0, 500) || null,
  });
  if (result.ok) refreshPlan();
  return result.ok ? { ok: true } : result;
}

/** Återkallar ett planerat byte och de senare i samma grupp. */
export async function revokeChange(input: {
  instanceId: string;
  changeId: string;
}): Promise<PlanResult> {
  const ctx = await context(input.instanceId);
  if (!isCtx(ctx)) return ctx;
  const change = ctx.view.history.find((c) => c.id === input.changeId);
  if (!change || change.revokedAt) return fail("Bytet finns inte.");
  if (change.effectiveWeek <= ctx.view.currentWeek) {
    return fail(
      "Ett byte som redan gäller återkallas inte – byt nivå igen i stället.",
    );
  }
  const ids = ctx.view.history
    .filter(
      (c) =>
        !c.revokedAt &&
        c.effectiveWeek >= change.effectiveWeek &&
        (c.id === change.id ||
          (change.groupId && c.groupId === change.groupId)),
    )
    .map((c) => c.id);
  const { error } = await ctx.supabase
    .from("plan_level_changes")
    .update({ revoked_at: new Date().toISOString(), revoked_by: ctx.userId })
    .in("id", ids);
  if (error) return dbError(error);
  refreshPlan();
  return { ok: true };
}

/** Återstart efter ett uppehåll: förslaget, godkänt av medlemmen. */
export async function restartAfterBreak(input: {
  instanceId: string;
  breakDays: number;
  reason: ChangeReason;
}): Promise<PlanResult> {
  const ctx = await context(input.instanceId);
  if (!isCtx(ctx)) return ctx;
  const { view } = ctx;
  const week = view.currentWeek;
  const suggestion = suggestReentry({
    levels: view.levels,
    levelBeforeId: levelForWeek(
      view.instance.start_level_id,
      view.history,
      week,
    ),
    breakDays: Math.max(0, Math.round(input.breakDays)),
    reason: input.reason,
    week,
    totalWeeks: view.instance.weeks,
  });
  if (suggestion.changes.length === 0) {
    return fail(
      "Förslaget är att fortsätta på samma nivå – ingenting att ändra.",
    );
  }
  const result = await writeChanges(ctx, suggestion.changes, {
    reason: input.reason,
    note: suggestion.rationale.join(" "),
  });
  if (result.ok) refreshPlan();
  return result.ok ? { ok: true } : result;
}

/**
 * Skjuter planen framåt efter ett uppehåll – bara utan lopp, där datumet
 * inte ligger fast. Passens flyttade datum följer inte med.
 */
export async function shiftPlan(input: {
  instanceId: string;
  weeks: number;
}): Promise<PlanResult> {
  const ctx = await context(input.instanceId);
  if (!isCtx(ctx)) return ctx;
  const { instance } = ctx.view;
  if (instance.goal_mode !== "fritt") {
    return fail("Planen räknas mot ett lopp och kan inte flyttas.");
  }
  const weeks = Math.round(input.weeks);
  if (weeks < 1 || weeks > 26) return fail("Flytta planen 1–26 veckor.");
  const { error } = await ctx.supabase
    .from("plan_instances")
    .update({ start_date: addDays(instance.start_date, weeks * 7) })
    .eq("id", instance.id);
  if (error) return dbError(error);
  refreshPlan();
  return { ok: true };
}

export async function endPlan(input: {
  instanceId: string;
  status: "avslutad" | "avbruten";
}): Promise<PlanResult> {
  const ctx = await context(input.instanceId);
  if (!isCtx(ctx)) return ctx;
  const { error } = await ctx.supabase
    .from("plan_instances")
    .update({ status: input.status })
    .eq("id", input.instanceId);
  if (error) return dbError(error);
  refreshPlan();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Passen
// ---------------------------------------------------------------------------

type SessionRef = { instanceId: string; sessionId: string; week: number };

function findSession(ctx: Ctx, ref: SessionRef) {
  return ctx.view.schedule
    .find((w) => w.week === ref.week)
    ?.sessions.find((s) => s.session.id === ref.sessionId);
}

async function setOverride(
  ctx: Ctx,
  ref: SessionRef,
  value: {
    action: "flytta" | "ersätt" | "stryk";
    movedTo?: string;
    workoutId?: string;
  } | null,
): Promise<PlanResult> {
  const { supabase, view } = ctx;
  if (value === null) {
    const { error } = await supabase
      .from("plan_session_overrides")
      .delete()
      .eq("instance_id", view.instance.id)
      .eq("session_id", ref.sessionId)
      .eq("plan_week", ref.week);
    return error ? dbError(error) : { ok: true };
  }
  const { error } = await supabase.from("plan_session_overrides").upsert(
    {
      instance_id: view.instance.id,
      adept_id: view.instance.adept_id,
      session_id: ref.sessionId,
      plan_week: ref.week,
      action: value.action,
      moved_to: value.movedTo ?? null,
      workout_id: value.workoutId ?? null,
      created_by: ctx.userId,
    },
    { onConflict: "instance_id,session_id,plan_week" },
  );
  return error ? dbError(error) : { ok: true };
}

/** Flyttar ett pass till ett annat datum; till sin egen dag igen tar bort flytten. */
export async function moveSession(
  input: SessionRef & { date: string },
): Promise<PlanResult> {
  const ctx = await context(input.instanceId);
  if (!isCtx(ctx)) return ctx;
  const s = findSession(ctx, input);
  if (!s) return fail("Passet finns inte i planen.");
  if (!ISO_DATE.test(input.date)) return fail("Välj ett datum.");
  const result = await setOverride(
    ctx,
    input,
    input.date === s.plannedDate
      ? null
      : { action: "flytta", movedTo: input.date },
  );
  if (result.ok) refreshPlan();
  return result;
}

/** Byter dag på två pass. */
export async function swapSessions(input: {
  instanceId: string;
  a: { sessionId: string; week: number };
  b: { sessionId: string; week: number };
}): Promise<PlanResult> {
  const ctx = await context(input.instanceId);
  if (!isCtx(ctx)) return ctx;
  const a = findSession(ctx, { ...input.a, instanceId: input.instanceId });
  const b = findSession(ctx, { ...input.b, instanceId: input.instanceId });
  if (!a || !b || !a.date || !b.date) {
    return fail("Båda passen behöver ett datum för att byta plats.");
  }
  for (const [s, date] of [
    [a, b.date],
    [b, a.date],
  ] as const) {
    const result = await setOverride(
      ctx,
      { instanceId: input.instanceId, sessionId: s.session.id, week: s.week },
      date === s.plannedDate ? null : { action: "flytta", movedTo: date },
    );
    if (!result.ok) return result;
  }
  refreshPlan();
  return { ok: true };
}

/** Stryker ett pass, ersätter det med ett eget, eller återställer det. */
export async function setSessionState(
  input: SessionRef & {
    state: "original" | "struken" | "ersatt";
    workoutId?: string;
  },
): Promise<PlanResult> {
  const ctx = await context(input.instanceId);
  if (!isCtx(ctx)) return ctx;
  if (!findSession(ctx, input)) return fail("Passet finns inte i planen.");
  if (input.state === "ersatt") {
    if (!input.workoutId) return fail("Välj ett eget pass.");
    const { data } = await ctx.supabase
      .from("workouts")
      .select("id")
      .eq("id", input.workoutId)
      .eq("adept_id", ctx.view.instance.adept_id)
      .maybeSingle();
    if (!data) return fail("Passet hittades inte bland dina pass.");
  }
  const result = await setOverride(
    ctx,
    input,
    input.state === "original"
      ? null
      : input.state === "struken"
        ? { action: "stryk" }
        : { action: "ersätt", workoutId: input.workoutId },
  );
  if (result.ok) refreshPlan();
  return result;
}

/** Genomfört, delvis eller hoppat över – eller inget, för att ångra. */
export async function logSession(
  input: SessionRef & {
    status: "genomförd" | "delvis" | "hoppad" | null;
    rpe: number | null;
    note: string;
  },
): Promise<PlanResult> {
  const ctx = await context(input.instanceId);
  if (!isCtx(ctx)) return ctx;
  if (!findSession(ctx, input)) return fail("Passet finns inte i planen.");
  const { supabase, view } = ctx;
  const { error } =
    input.status === null
      ? await supabase
          .from("plan_session_logs")
          .delete()
          .eq("instance_id", view.instance.id)
          .eq("session_id", input.sessionId)
          .eq("plan_week", input.week)
      : await supabase.from("plan_session_logs").upsert(
          {
            instance_id: view.instance.id,
            adept_id: view.instance.adept_id,
            session_id: input.sessionId,
            plan_week: input.week,
            status: input.status,
            rpe:
              input.rpe === null
                ? null
                : Math.min(10, Math.max(1, Math.round(input.rpe))),
            note: input.note.trim().slice(0, 1000) || null,
            logged_by: ctx.userId,
          },
          { onConflict: "instance_id,session_id,plan_week" },
        );
  if (error) return dbError(error);
  refreshPlan();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// AI-förslag
// ---------------------------------------------------------------------------

/**
 * Godkänner eller avvisar ett förslag. Ett godkänt nivåförslag blir byten
 * med källan AI – först nu, och bara för att någon klickade.
 */
export async function decideSuggestion(input: {
  instanceId: string;
  suggestionId: string;
  accept: boolean;
}): Promise<PlanResult> {
  const ctx = await context(input.instanceId);
  if (!isCtx(ctx)) return ctx;
  const { view, supabase } = ctx;
  const row = view.suggestions.find((s) => s.id === input.suggestionId);
  if (!row || row.status !== "föreslagen") {
    return fail("Förslaget är redan besvarat.");
  }
  let groupId: string | null = null;
  if (input.accept) {
    const suggestion = parseLevelSuggestion(row.payload, view.levels);
    if (!suggestion) return fail("Förslaget går inte att tolka.");
    if (suggestion.effectiveWeek < view.currentWeek) {
      return fail("Förslaget gällde en vecka som redan varit.");
    }
    const changes = suggestionToChanges(suggestion, {
      levels: view.levels,
      startLevelId: view.instance.start_level_id,
      changes: historyKept(
        view.history,
        suggestion.effectiveWeek,
        view.currentWeek,
      ),
      totalWeeks: view.instance.weeks,
    });
    const result = await writeChanges(ctx, changes, {
      reason: "form",
      note: row.rationale.slice(0, 500),
      source: "ai",
    });
    if (!result.ok) return result;
    groupId = result.groupId ?? null;
  }
  const { error } = await supabase
    .from("plan_ai_suggestions")
    .update({
      status: input.accept ? "accepterad" : "avvisad",
      decided_at: new Date().toISOString(),
      decided_by: ctx.userId,
      level_change_group: groupId,
    })
    .eq("id", row.id);
  if (error) return dbError(error);
  refreshPlan();
  return { ok: true };
}

/**
 * API-kontraktet för AI-assistenten: ett förslag sparas som det är, med
 * motivering, och ändrar ingenting förrän medlemmen eller coachen godkänt
 * det (decideSuggestion).
 */
export async function proposeLevelChange(input: {
  instanceId: string;
  suggestion: LevelSuggestion;
  rationale: string;
}): Promise<PlanResult> {
  const ctx = await context(input.instanceId);
  if (!isCtx(ctx)) return ctx;
  const parsed = parseLevelSuggestion(input.suggestion, ctx.view.levels);
  if (!parsed)
    return fail("Förslaget pekar på en nivå som inte finns i planen.");
  const rationale = input.rationale.trim().slice(0, 2000);
  if (!rationale) return fail("Ett förslag behöver en motivering.");
  const { data, error } = await ctx.supabase
    .from("plan_ai_suggestions")
    .insert({
      instance_id: ctx.view.instance.id,
      adept_id: ctx.view.instance.adept_id,
      kind: "nivåbyte",
      payload: parsed as unknown as Json,
      rationale,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return dbError(error);
  refreshPlan();
  return { ok: true, id: data.id };
}

// ---------------------------------------------------------------------------
// Formuppskattningen
// ---------------------------------------------------------------------------

/**
 * En ny formuppskattning: en 5 km-tid, en maratontid eller båda, som tider
 * ("19:45", "3:15:00"). Den blir den gällande tills ett nyare test eller en
 * nyare tid kommer – tempona i planen följer med.
 */
export async function saveFitnessEstimate(input: {
  adeptId: string;
  fiveK: string;
  marathon: string;
  note: string;
}): Promise<PlanResult> {
  const user = await requireSessionUser();
  const fiveK = input.fiveK.trim() ? parseRaceTime(input.fiveK) : null;
  const marathon = input.marathon.trim() ? parseRaceTime(input.marathon) : null;
  if (input.fiveK.trim() && fiveK === null) {
    return fail(
      "Skriv 5 km-tiden som minuter och sekunder, till exempel 19:45.",
    );
  }
  if (input.marathon.trim() && marathon === null) {
    return fail(
      "Skriv maratontiden som timmar, minuter och sekunder, till exempel 3:15:00.",
    );
  }
  if (fiveK === null && marathon === null) {
    return fail("Ange en 5 km-tid eller en maratontid.");
  }
  // Rimlighet: världsrekorden och en promenad sätter gränserna.
  if (fiveK !== null && (fiveK < 12 * 60 || fiveK > 90 * 60)) {
    return fail("5 km-tiden ska ligga mellan 12 och 90 minuter.");
  }
  if (marathon !== null && (marathon < 2 * 3600 || marathon > 8 * 3600)) {
    return fail("Maratontiden ska ligga mellan 2 och 8 timmar.");
  }
  const supabase = await createClient();
  const { error } = await supabase.from("fitness_estimates").insert({
    adept_id: input.adeptId,
    five_k_seconds: fiveK,
    marathon_seconds: marathon,
    note: input.note.trim().slice(0, 300) || null,
    created_by: user.id,
  });
  if (error) return dbError(error);
  refreshPlan();
  revalidatePath(`${routes.adepts}/${input.adeptId}/plan`);
  return { ok: true };
}

export async function deleteFitnessEstimate(input: {
  adeptId: string;
  id: string;
}): Promise<PlanResult> {
  await requireSessionUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("fitness_estimates")
    .delete()
    .eq("id", input.id);
  if (error) return dbError(error);
  refreshPlan();
  revalidatePath(`${routes.adepts}/${input.adeptId}/plan`);
  return { ok: true };
}

/**
 * Vad tempona räknas ur: formuppskattningen eller en måltid. Procenten i
 * passen ändras inte – bara tempona.
 */
export async function setPaceSource(input: {
  instanceId: string;
  mode: "form" | "mål";
  goalTime?: string;
}): Promise<PlanResult> {
  const ctx = await context(input.instanceId);
  if (!isCtx(ctx)) return ctx;
  let goalSeconds: number | null = null;
  if (input.mode === "mål") {
    const goal = readGoalTime(input.goalTime);
    if (typeof goal === "string") return fail(goal);
    goalSeconds = goal;
  }
  const { error } = await ctx.supabase
    .from("plan_instances")
    .update({
      pace_mode: input.mode === "mål" ? "mål" : "form",
      goal_seconds: input.mode === "mål" ? goalSeconds : null,
    })
    .eq("id", input.instanceId);
  if (error) return dbError(error);
  refreshPlan();
  revalidatePath(`${routes.adepts}/${ctx.view.instance.adept_id}/plan`);
  return { ok: true };
}
