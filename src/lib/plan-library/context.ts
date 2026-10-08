/**
 * Kontraktet mellan planen och AI-assistenten.
 *
 * Assistenten är rådgivande och ser bakåt. Den läser planen, nivåhistoriken
 * och vad som faktiskt genomförts (`planContext`, `planContextToText`), och
 * kan lämna ett förslag (`LevelSuggestion`) med motivering. Förslaget sparas
 * som det är och blir nivåbyten först när medlemmen – eller coachen – godkänt
 * det (`suggestionToChanges`). Ingenting här skriver om planen.
 *
 * Modulen är ren.
 */

import {
  levelForWeek,
  planStepwise,
  planSwitch,
  planTemporary,
} from "./levels";
import type { ReturnMode } from "./levels";
import type { PhaseSpan } from "./periodization";
import { summarizeWeek, type ScheduleWeek } from "./schedule";
import type { Level, LevelChange, PlannedChange } from "./types";

export type PlanContext = {
  title: string;
  startDate: string;
  weeks: number;
  currentWeek: number;
  race: { name: string | null; date: string } | null;
  levels: { id: string; key: string; name: string; rank: number }[];
  currentLevel: string;
  phases: PhaseSpan[];
  levelHistory: {
    week: number;
    from: string;
    to: string;
    kind: string;
    reason: string;
    source: string;
    revoked: boolean;
  }[];
  /** Veckorna fram till och med den nuvarande. */
  pastWeeks: {
    week: number;
    phase: string;
    level: string;
    planned: number;
    done: number;
    partial: number;
    skipped: number;
    plannedMinutes: number;
  }[];
};

export function planContext(input: {
  title: string;
  startDate: string;
  weeks: number;
  currentWeek: number;
  race: PlanContext["race"];
  levels: Level[];
  startLevelId: string;
  changes: LevelChange[];
  phases: PhaseSpan[];
  schedule: ScheduleWeek[];
}): PlanContext {
  const key = (id: string) => input.levels.find((l) => l.id === id)?.key ?? "?";
  const phaseName = (week: number) =>
    input.phases.find((p) => week >= p.fromWeek && week <= p.toWeek)?.name ??
    "";
  return {
    title: input.title,
    startDate: input.startDate,
    weeks: input.weeks,
    currentWeek: input.currentWeek,
    race: input.race,
    levels: input.levels.map(({ id, key, name, rank }) => ({
      id,
      key,
      name,
      rank,
    })),
    currentLevel: key(
      levelForWeek(input.startLevelId, input.changes, input.currentWeek),
    ),
    phases: input.phases,
    levelHistory: [...input.changes]
      .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""))
      .map((c) => ({
        week: c.effectiveWeek,
        from: key(c.fromLevelId),
        to: key(c.toLevelId),
        kind: c.kind,
        reason: c.reason,
        source: c.source,
        revoked: Boolean(c.revokedAt),
      })),
    pastWeeks: input.schedule
      .filter((w) => w.week <= input.currentWeek)
      .map((w) => {
        const s = summarizeWeek(w);
        return {
          week: w.week,
          phase: phaseName(w.week),
          level: key(w.levelId),
          planned: s.planned,
          done: s.done,
          partial: s.partial,
          skipped: s.skipped,
          plannedMinutes: Math.round(s.plannedSeconds / 60),
        };
      }),
  };
}

/** Planen i text, för assistentens underlag. */
export function planContextToText(ctx: PlanContext): string {
  const lines = [
    `Plan ur planbiblioteket: ${ctx.title}. Vecka ${ctx.currentWeek} av ${ctx.weeks}, start ${ctx.startDate}${
      ctx.race
        ? `, mot ${ctx.race.name ?? "loppet"} ${ctx.race.date}`
        : ", utan lopp"
    }.`,
    `Nivåer (högst först): ${[...ctx.levels]
      .sort((a, b) => b.rank - a.rank)
      .map((l) => `${l.key} ${l.name}`)
      .join(", ")}. Nuvarande nivå: ${ctx.currentLevel}.`,
    `Faser: ${ctx.phases
      .map((p) => `${p.name} v${p.fromWeek}–${p.toWeek}`)
      .join(", ")}.`,
  ];
  const history = ctx.levelHistory.filter((h) => !h.revoked);
  if (history.length > 0) {
    lines.push(
      `Nivåbyten: ${history
        .map(
          (h) =>
            `v${h.week} ${h.from}→${h.to} (${h.kind}, ${h.reason}, ${h.source})`,
        )
        .join("; ")}.`,
    );
  }
  if (ctx.pastWeeks.length > 0) {
    lines.push(
      "Genomfört per vecka (genomförda/delvis/hoppade av planerade):",
      ...ctx.pastWeeks.map(
        (w) =>
          `- v${w.week} ${w.phase}, nivå ${w.level}: ${w.done}/${w.partial}/${w.skipped} av ${w.planned}, ${w.plannedMinutes} min planerat`,
      ),
    );
  }
  lines.push(
    "Planen är statisk och ändras bara av medlemmen eller coachen. Föreslå gärna ett nivåbyte med motivering, men skriv det som ett förslag.",
  );
  return lines.join("\n");
}

/** Ett nivåförslag från assistenten, som det sparas i plan_ai_suggestions.payload. */
export type LevelSuggestion =
  | { kind: "byte"; toLevelId: string; effectiveWeek: number }
  | {
      kind: "stegvis";
      toLevelId: string;
      effectiveWeek: number;
      stepWeeks: number;
    }
  | {
      kind: "tillfällig";
      toLevelId: string;
      effectiveWeek: number;
      durationWeeks: number;
      returnMode: ReturnMode;
      stepWeeks?: number;
    };

/** Läser ett sparat förslag; null när det inte går att tolka. */
export function parseLevelSuggestion(
  payload: unknown,
  levels: Level[],
): LevelSuggestion | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const toLevelId = typeof p.toLevelId === "string" ? p.toLevelId : null;
  const week = Number(p.effectiveWeek);
  if (!toLevelId || !levels.some((l) => l.id === toLevelId)) return null;
  if (!Number.isInteger(week) || week < 1) return null;
  if (p.kind === "byte")
    return { kind: "byte", toLevelId, effectiveWeek: week };
  if (p.kind === "stegvis") {
    return {
      kind: "stegvis",
      toLevelId,
      effectiveWeek: week,
      stepWeeks: Math.max(1, Number(p.stepWeeks) || 2),
    };
  }
  if (p.kind === "tillfällig") {
    const modes: ReturnMode[] = ["tidigare", "en-under", "stegvis", "stanna"];
    return {
      kind: "tillfällig",
      toLevelId,
      effectiveWeek: week,
      durationWeeks: Math.max(1, Number(p.durationWeeks) || 1),
      returnMode: modes.includes(p.returnMode as ReturnMode)
        ? (p.returnMode as ReturnMode)
        : "tidigare",
      stepWeeks: Math.max(1, Number(p.stepWeeks) || 1),
    };
  }
  return null;
}

/** Vad ett godkänt förslag blir för byten. */
export function suggestionToChanges(
  suggestion: LevelSuggestion,
  input: {
    levels: Level[];
    startLevelId: string;
    changes: LevelChange[];
    totalWeeks: number;
  },
): PlannedChange[] {
  const week = Math.min(input.totalWeeks, suggestion.effectiveWeek);
  const from = levelForWeek(input.startLevelId, input.changes, week);
  if (suggestion.kind === "byte") {
    return planSwitch(from, suggestion.toLevelId, week);
  }
  if (suggestion.kind === "stegvis") {
    return planStepwise({
      levels: input.levels,
      fromLevelId: from,
      toLevelId: suggestion.toLevelId,
      startWeek: week,
      stepWeeks: suggestion.stepWeeks,
      totalWeeks: input.totalWeeks,
    });
  }
  return planTemporary({
    levels: input.levels,
    fromLevelId: from,
    toLevelId: suggestion.toLevelId,
    startWeek: week,
    durationWeeks: suggestion.durationWeeks,
    returnMode: suggestion.returnMode,
    stepWeeks: suggestion.stepWeeks,
    totalWeeks: input.totalWeeks,
  });
}
