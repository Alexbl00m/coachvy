import { describe, expect, it } from "vitest";

import {
  parseLevelSuggestion,
  planContext,
  planContextToText,
  suggestionToChanges,
} from "./context";
import { proposePeriodization } from "./periodization";
import { buildSchedule } from "./schedule";
import { LEVELS, PHASES, SESSIONS, WEEKS } from "./test-fixtures";
import type { LevelChange } from "./types";

describe("AI-kontraktet", () => {
  const p = proposePeriodization({
    phases: PHASES,
    weeks: WEEKS,
    minWeeks: 7,
    maxWeeks: 12,
    goal: { mode: "fritt", startDate: "2026-10-12" },
    length: 8,
  });
  if (!p.ok) throw new Error(p.error);
  const changes: LevelChange[] = [
    {
      effectiveWeek: 2,
      fromLevelId: "A",
      toLevelId: "B",
      kind: "byte",
      reason: "arbete",
      source: "medlem",
      createdAt: "2026-10-15",
    },
  ];
  const schedule = buildSchedule({
    startDate: p.startDate,
    weekMap: p.weekMap,
    templateWeeks: WEEKS,
    sessions: SESSIONS,
    startLevelId: "A",
    changes,
    overrides: [],
    logs: [
      { sessionId: `${p.weekMap[0]}-int`, planWeek: 1, status: "genomförd" },
      { sessionId: `${p.weekMap[0]}-lang`, planWeek: 1, status: "hoppad" },
    ],
  });

  it("sammanfattar planen, historiken och det genomförda till och med i dag", () => {
    const ctx = planContext({
      title: "Maraton",
      startDate: p.startDate,
      weeks: p.length,
      currentWeek: 2,
      race: null,
      levels: LEVELS,
      startLevelId: "A",
      changes,
      phases: p.phases,
      schedule,
    });
    expect(ctx.currentLevel).toBe("B");
    expect(ctx.pastWeeks).toHaveLength(2);
    expect(ctx.pastWeeks[0]).toMatchObject({
      week: 1,
      level: "A",
      planned: 2,
      done: 1,
      skipped: 1,
    });
    const text = planContextToText(ctx);
    expect(text).toContain("Vecka 2 av 8");
    expect(text).toContain(
      "Nivåer (högst först): A Ambitiös, B Mellan, C Grund. Nuvarande nivå: B.",
    );
    expect(text).toContain("v2 A→B (byte, arbete, medlem)");
    expect(text).toContain("Föreslå gärna ett nivåbyte");
  });

  it("tolkar ett sparat förslag och avvisar det som inte går ihop", () => {
    expect(
      parseLevelSuggestion(
        { kind: "byte", toLevelId: "C", effectiveWeek: 3 },
        LEVELS,
      ),
    ).toEqual({
      kind: "byte",
      toLevelId: "C",
      effectiveWeek: 3,
    });
    expect(
      parseLevelSuggestion(
        { kind: "byte", toLevelId: "X", effectiveWeek: 3 },
        LEVELS,
      ),
    ).toBeNull();
    expect(
      parseLevelSuggestion(
        { kind: "okänd", toLevelId: "C", effectiveWeek: 3 },
        LEVELS,
      ),
    ).toBeNull();
    expect(parseLevelSuggestion(null, LEVELS)).toBeNull();
  });

  it("gör ett godkänt förslag till byten från nivån den veckan", () => {
    const s = parseLevelSuggestion(
      {
        kind: "tillfällig",
        toLevelId: "C",
        effectiveWeek: 4,
        durationWeeks: 1,
        returnMode: "tidigare",
      },
      LEVELS,
    )!;
    expect(
      suggestionToChanges(s, {
        levels: LEVELS,
        startLevelId: "A",
        changes,
        totalWeeks: 8,
      }),
    ).toEqual([
      {
        effectiveWeek: 4,
        fromLevelId: "B",
        toLevelId: "C",
        kind: "tillfällig",
      },
      { effectiveWeek: 5, fromLevelId: "C", toLevelId: "B", kind: "återgång" },
    ]);
  });
});
