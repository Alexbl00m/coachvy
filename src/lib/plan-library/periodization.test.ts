import { describe, expect, it } from "vitest";

import {
  nextWeekStart,
  phaseBounds,
  planWeekOf,
  proposePeriodization,
  trimCounts,
  weekStartOn,
} from "./periodization";
import { PHASES, WEEKS } from "./test-fixtures";

const base = { phases: PHASES, weeks: WEEKS, minWeeks: 7, maxWeeks: 12 };

describe("veckostarter", () => {
  it("hittar veckans första dag och nästa veckostart", () => {
    // 2026-10-07 är en onsdag.
    expect(weekStartOn("2026-10-07", 0)).toBe("2026-10-05");
    expect(nextWeekStart("2026-10-07", 0)).toBe("2026-10-12");
    expect(nextWeekStart("2026-10-12", 0)).toBe("2026-10-12");
    // Veckor som börjar på söndag.
    expect(weekStartOn("2026-10-07", 6)).toBe("2026-10-04");
  });

  it("räknar planveckan för ett datum", () => {
    expect(planWeekOf("2026-10-12", "2026-10-12")).toBe(1);
    expect(planWeekOf("2026-10-12", "2026-10-18")).toBe(1);
    expect(planWeekOf("2026-10-12", "2026-10-19")).toBe(2);
    expect(planWeekOf("2026-10-12", "2026-10-11")).toBe(0);
  });
});

describe("kortning", () => {
  it("ger varje fas gränser, och faser som inte kortas sin fulla längd", () => {
    expect(phaseBounds(PHASES, WEEKS)).toEqual({
      bas: { min: 2, max: 6 },
      bygg: { min: 2, max: 3 },
      spec: { min: 2, max: 2 },
      taper: { min: 1, max: 1 },
    });
  });

  it("kortar grunden först, sedan uppbyggnaden, aldrig specifik fas och taper", () => {
    expect(trimCounts(PHASES, WEEKS, 10)).toEqual({
      bas: 4,
      bygg: 3,
      spec: 2,
      taper: 1,
    });
    expect(trimCounts(PHASES, WEEKS, 7)).toEqual({
      bas: 2,
      bygg: 2,
      spec: 2,
      taper: 1,
    });
    expect(trimCounts(PHASES, WEEKS, 6)).toBeNull();
  });
});

describe("med lopp", () => {
  const goal = (raceDate: string) => ({
    mode: "lopp" as const,
    raceDate,
    earliest: "2026-10-07",
    weekStart: 0,
  });

  it("räknar bakåt från loppveckan och lägger loppet i sista veckan", () => {
    const p = proposePeriodization({ ...base, goal: goal("2027-01-03") });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.length).toBe(12);
    expect(p.startDate).toBe("2026-10-12");
    expect(p.endDate).toBe("2027-01-03");
    expect(p.raceWeek).toBe(12);
    expect(p.weekMap).toEqual(WEEKS.map((w) => w.id));
    expect(p.notes[0]).toBe("Loppet ligger i vecka 12, en söndag.");
  });

  it("kortar från grundfasens början när tiden inte räcker", () => {
    const p = proposePeriodization({ ...base, goal: goal("2026-12-20") });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.length).toBe(10);
    expect(p.startDate).toBe("2026-10-12");
    // Grunden behåller sina sista fyra veckor; resten är orört.
    expect(p.weekMap).toEqual([
      "w3",
      "w4",
      "w5",
      "w6",
      "w7",
      "w8",
      "w9",
      "w10",
      "w11",
      "w12",
    ]);
    expect(
      p.phases.map((s) => [s.phaseId, s.weeks, s.fromWeek, s.toWeek]),
    ).toEqual([
      ["bas", 4, 1, 4],
      ["bygg", 3, 5, 7],
      ["spec", 2, 8, 9],
      ["taper", 1, 10, 10],
    ]);
    expect(p.phases[3].startsOn).toBe("2026-12-14");
    expect(p.notes).toContain("Bas är 4 veckor, 2 kortare än i full längd.");
  });

  it("väljer en kortare längd och flyttar starten framåt", () => {
    const p = proposePeriodization({
      ...base,
      goal: goal("2027-01-03"),
      length: 8,
    });
    expect(p.ok && p.startDate).toBe("2026-11-09");
    expect(p.ok && p.weekMap.length).toBe(8);
  });

  it("säger ifrån när loppet ligger för nära", () => {
    const p = proposePeriodization({ ...base, goal: goal("2026-11-15") });
    expect(p.ok).toBe(false);
    if (p.ok) return;
    expect(p.error).toMatch(/5 veckor kvar.*minst 7/);
  });

  it("säger ifrån när loppet redan varit", () => {
    const p = proposePeriodization({ ...base, goal: goal("2026-10-01") });
    expect(p).toEqual({ ok: false, error: "Loppet har redan varit." });
  });

  it("tar medlemmens egna veckor per fas och flyttar starten efter dem", () => {
    const p = proposePeriodization({
      ...base,
      goal: goal("2027-01-03"),
      counts: { bas: 3, bygg: 3, spec: 2, taper: 1 },
    });
    expect(p.ok && p.length).toBe(9);
    expect(p.ok && p.startDate).toBe("2026-11-02");
  });

  it("stoppar egna veckor utanför fasens gränser", () => {
    const p = proposePeriodization({
      ...base,
      goal: goal("2027-01-03"),
      counts: { bas: 6, bygg: 3, spec: 1, taper: 1 },
    });
    expect(p).toEqual({
      ok: false,
      error: "Specifik har 2 veckor och kortas inte.",
    });
  });
});

describe("utan lopp", () => {
  it("räknar framåt från startdatumet", () => {
    const p = proposePeriodization({
      ...base,
      goal: { mode: "fritt", startDate: "2026-10-08" },
      length: 9,
    });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.startDate).toBe("2026-10-08");
    expect(p.endDate).toBe("2026-12-09");
    expect(p.raceWeek).toBeNull();
    expect(p.weekMap[0]).toBe("w4");
  });

  it("stoppar en längd under mallens minsta", () => {
    const p = proposePeriodization({
      ...base,
      goal: { mode: "fritt", startDate: "2026-10-08" },
      counts: { bas: 2, bygg: 2, spec: 2, taper: 1 },
      minWeeks: 8,
    });
    expect(p).toEqual({
      ok: false,
      error: "Planen ska vara 8–12 veckor, inte 7.",
    });
  });
});
