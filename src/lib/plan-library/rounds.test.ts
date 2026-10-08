import { describe, expect, it } from "vitest";

import { proposePeriodization } from "./periodization";
import {
  parseRounds,
  proposeRounds,
  roundOf,
  roundOptions,
  roundSpans,
  splitRounds,
} from "./rounds";
import { buildSchedule } from "./schedule";
import { PHASES, SESSIONS, WEEKS } from "./test-fixtures";

describe("varv", () => {
  it("delar jämnt, med de längre varven sist", () => {
    expect(splitRounds(24, 2)).toEqual([12, 12]);
    expect(splitRounds(25, 2)).toEqual([12, 13]);
    expect(splitRounds(38, 3)).toEqual([12, 13, 13]);
  });

  it("föreslår två varv om 12 när det är 24 veckor kvar och planen är 12–18", () => {
    expect(proposeRounds(24, 12, 18)).toEqual({ rounds: [12, 12], leadIn: 0 });
  });

  it("föreslår två varv om 18 med 36 veckor kvar", () => {
    expect(proposeRounds(36, 12, 18)).toEqual({ rounds: [18, 18], leadIn: 0 });
  });

  it("väntar hellre en vecka än kör ett varv till", () => {
    expect(proposeRounds(37, 12, 18)).toEqual({ rounds: [18, 18], leadIn: 1 });
  });

  it("kör ett varv när två inte ryms, och börjar senare", () => {
    expect(proposeRounds(20, 12, 18)).toEqual({ rounds: [18], leadIn: 2 });
    expect(proposeRounds(21, 12, 18)).toEqual({ rounds: [18], leadIn: 3 });
  });

  it("ryms planen inte alls blir det inget förslag", () => {
    expect(proposeRounds(10, 12, 18)).toBeNull();
    expect(roundOptions(10, 12, 18)).toEqual([]);
  });

  it("listar alla upplägg som ryms", () => {
    expect(roundOptions(30, 12, 18)).toEqual([
      { rounds: [18], leadIn: 12 },
      { rounds: [15, 15], leadIn: 0 },
    ]);
  });

  it("stannar vid tre varv", () => {
    expect(proposeRounds(60, 12, 18)).toEqual({
      rounds: [18, 18, 18],
      leadIn: 6,
    });
  });

  it("lägger varven som planveckor", () => {
    const spans = roundSpans([12, 13], 25);
    expect(spans).toEqual([
      { round: 1, weeks: 12, fromWeek: 1, toWeek: 12 },
      { round: 2, weeks: 13, fromWeek: 13, toWeek: 25 },
    ]);
    expect(roundOf(spans, 12).round).toBe(1);
    expect(roundOf(spans, 13).round).toBe(2);
    expect(roundSpans(null, 8)).toEqual([
      { round: 1, weeks: 8, fromWeek: 1, toWeek: 8 },
    ]);
  });

  it("läser varven ur databasen", () => {
    expect(parseRounds([12, 12])).toEqual([12, 12]);
    expect(parseRounds(null)).toBeNull();
    expect(parseRounds([])).toBeNull();
    expect(parseRounds([12, "x"])).toBeNull();
  });
});

describe("periodisering i varv", () => {
  const base = { phases: PHASES, weeks: WEEKS, minWeeks: 7, maxWeeks: 12 };

  it("kortar varje varv för sig och lägger loppet i det sista", () => {
    // 2026-10-07 är en onsdag; loppet en söndag 18 veckor senare.
    const p = proposePeriodization({
      ...base,
      goal: {
        mode: "lopp",
        raceDate: "2027-02-14",
        earliest: "2026-10-07",
        weekStart: 0,
      },
      rounds: [9, 9],
    });
    if (!p.ok) throw new Error(p.error);
    expect(p.length).toBe(18);
    expect(p.raceWeek).toBe(18);
    expect(p.rounds.map((r) => [r.fromWeek, r.toWeek])).toEqual([
      [1, 9],
      [10, 18],
    ]);
    // Varje varv kortas i grunden: 9 veckor är bas 3, bygg 3, spec 2, taper 1.
    expect(p.rounds[0].counts).toEqual({ bas: 3, bygg: 3, spec: 2, taper: 1 });
    expect(p.weekMap.slice(0, 9)).toEqual(p.weekMap.slice(9));
    expect(p.weekMap[0]).toBe("w4");
    expect(p.weekMap[8]).toBe("w12");
    expect(p.phases).toHaveLength(8);
    expect(p.notes.join(" ")).toContain("2 varv");
  });

  it("tar medlemmens egna veckor per varv", () => {
    const p = proposePeriodization({
      ...base,
      goal: { mode: "fritt", startDate: "2026-10-12" },
      rounds: [9, 9],
      roundCounts: [null, { bas: 4, bygg: 3, spec: 2, taper: 1 }],
    });
    if (!p.ok) throw new Error(p.error);
    expect(p.rounds.map((r) => r.weeks)).toEqual([9, 10]);
    expect(p.length).toBe(19);
  });

  it("säger ifrån när ett varv är för kort eller varven inte ryms", () => {
    const short = proposePeriodization({
      ...base,
      goal: { mode: "fritt", startDate: "2026-10-12" },
      rounds: [9, 5],
    });
    expect(short.ok).toBe(false);
    const late = proposePeriodization({
      ...base,
      goal: {
        mode: "lopp",
        raceDate: "2027-01-10",
        earliest: "2026-10-07",
        weekStart: 0,
      },
      rounds: [9, 9],
    });
    expect(late.ok).toBe(false);
  });

  it("säger när planen börjar senare än nästa vecka", () => {
    const p = proposePeriodization({
      ...base,
      goal: {
        mode: "lopp",
        raceDate: "2027-02-14",
        earliest: "2026-10-07",
        weekStart: 0,
      },
    });
    if (!p.ok) throw new Error(p.error);
    expect(p.length).toBe(12);
    expect(p.startDate).toBe("2026-11-23");
    expect(p.notes.join(" ")).toContain("börjar om 6 veckor");
  });

  it("märker varvets sista vecka som testlopp i schemat, utom i sista varvet", () => {
    const p = proposePeriodization({
      ...base,
      goal: { mode: "fritt", startDate: "2026-10-12" },
      rounds: [9, 9],
    });
    if (!p.ok) throw new Error(p.error);
    const weeks = buildSchedule({
      startDate: p.startDate,
      weekMap: p.weekMap,
      templateWeeks: WEEKS,
      sessions: SESSIONS,
      startLevelId: "A",
      changes: [],
      overrides: [],
      logs: [],
      rounds: [9, 9],
    });
    expect(weeks.filter((w) => w.roundEnd).map((w) => w.week)).toEqual([9]);
    expect(weeks[9].round).toBe(2);
  });
});
