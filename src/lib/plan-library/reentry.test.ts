import { describe, expect, it } from "vitest";

import { suggestReentry } from "./reentry";
import { LEVELS } from "./test-fixtures";

const base = { levels: LEVELS, levelBeforeId: "A", week: 6, totalWeeks: 16 };

describe("återinträde", () => {
  it("fortsätter på samma nivå efter ett kort uppehåll", () => {
    const r = suggestReentry({ ...base, breakDays: 4, reason: "uppehåll" });
    expect(r.levelId).toBe("A");
    expect(r.changes).toEqual([]);
  });

  it("går en nivå ned en vecka efter en till två veckors uppehåll", () => {
    const r = suggestReentry({ ...base, breakDays: 10, reason: "uppehåll" });
    expect(r.changes).toEqual([
      { effectiveWeek: 6, fromLevelId: "A", toLevelId: "B", kind: "återstart" },
      { effectiveWeek: 7, fromLevelId: "B", toLevelId: "A", kind: "återgång" },
    ]);
  });

  it("börjar en nivå lägre efter sjukdom och trappar upp varannan vecka", () => {
    const r = suggestReentry({ ...base, breakDays: 18, reason: "sjukdom" });
    expect(r.levelId).toBe("C");
    expect(r.changes.map((c) => [c.effectiveWeek, c.toLevelId])).toEqual([
      [6, "C"],
      [8, "B"],
      [10, "A"],
    ]);
    expect(r.rationale.join(" ")).toMatch(/feberfri/);
  });

  it("börjar om på lägsta nivån efter en månad, och säger när planen tar slut före toppen", () => {
    const r = suggestReentry({
      ...base,
      breakDays: 60,
      reason: "uppehåll",
      week: 12,
    });
    expect(r.levelId).toBe("C");
    expect(r.changes.map((c) => [c.effectiveWeek, c.toLevelId])).toEqual([
      [12, "C"],
      [15, "B"],
    ]);
    expect(r.rationale.at(-1)).toMatch(/räcker till Mellan/);
  });
});
