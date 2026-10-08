import { describe, expect, it } from "vitest";

import {
  buildSchedule,
  currentPlanWeek,
  sessionsOn,
  summarizeWeek,
  weekByDay,
} from "./schedule";
import { SESSIONS, WEEKS } from "./test-fixtures";
import type { LevelChange } from "./types";

const input = {
  startDate: "2026-10-12",
  weekMap: ["w3", "w4", "w5"],
  templateWeeks: WEEKS,
  sessions: SESSIONS,
  startLevelId: "A",
  changes: [] as LevelChange[],
  overrides: [],
  logs: [],
};

describe("schemat", () => {
  it("lägger mallens pass på planens datum", () => {
    const s = buildSchedule(input);
    expect(s).toHaveLength(3);
    expect(s[0]).toMatchObject({
      week: 1,
      startsOn: "2026-10-12",
      endsOn: "2026-10-18",
      templateWeekId: "w3",
      levelId: "A",
    });
    expect(s[0].sessions.map((x) => [x.session.title, x.plannedDate])).toEqual([
      ["Intervaller", "2026-10-13"],
      ["Långpass", "2026-10-18"],
    ]);
  });

  it("byter variant från veckan ett nivåbyte gäller, och tar bort pass nivån saknar", () => {
    const s = buildSchedule({
      ...input,
      changes: [
        {
          effectiveWeek: 2,
          fromLevelId: "A",
          toLevelId: "C",
          kind: "byte",
          reason: "resa",
          source: "medlem",
        },
      ],
    });
    expect(s[0].sessions).toHaveLength(2);
    expect(s[1].levelId).toBe("C");
    expect(
      s[1].sessions.map((x) => [x.session.title, x.variant.durationS]),
    ).toEqual([["Långpass", 3600]]);
  });

  it("håller isär originalet och flytten, och struket och ersatt", () => {
    const s = buildSchedule({
      ...input,
      overrides: [
        {
          sessionId: "w3-int",
          planWeek: 1,
          action: "flytta",
          movedTo: "2026-10-15",
          workoutId: null,
        },
        {
          sessionId: "w3-lang",
          planWeek: 1,
          action: "stryk",
          movedTo: null,
          workoutId: null,
        },
        {
          sessionId: "w4-int",
          planWeek: 2,
          action: "ersätt",
          movedTo: null,
          workoutId: "egen",
        },
      ],
      logs: [{ sessionId: "w3-int", planWeek: 1, status: "genomförd" }],
    });
    const [moved, struck] = s[0].sessions;
    expect(moved).toMatchObject({
      state: "flyttad",
      plannedDate: "2026-10-13",
      date: "2026-10-15",
    });
    expect(moved.log?.status).toBe("genomförd");
    expect(struck.state).toBe("struken");
    expect(s[1].sessions[0].state).toBe("ersatt");

    expect(sessionsOn(s, "2026-10-15").map((x) => x.key)).toEqual(["1:w3-int"]);
    expect(sessionsOn(s, "2026-10-13")).toEqual([]);
    expect(sessionsOn(s, "2026-10-18")).toEqual([]);

    const days = weekByDay(s[0]);
    expect(days.days[3].sessions.map((x) => x.key)).toEqual(["1:w3-int"]);

    expect(summarizeWeek(s[0])).toEqual({
      planned: 1,
      done: 1,
      partial: 0,
      skipped: 0,
      open: 0,
      plannedSeconds: 4200,
      byDiscipline: { löpning: 4200 },
    });
    // Det ersatta passet räknas, men inte med mallens tid.
    expect(summarizeWeek(s[1]).plannedSeconds).toBe(7200);
  });

  it("begränsar veckan i dag till planen", () => {
    expect(currentPlanWeek("2026-10-12", 3, "2026-10-01")).toBe(1);
    expect(currentPlanWeek("2026-10-12", 3, "2026-10-20")).toBe(2);
    expect(currentPlanWeek("2026-10-12", 3, "2027-01-01")).toBe(3);
  });
});
