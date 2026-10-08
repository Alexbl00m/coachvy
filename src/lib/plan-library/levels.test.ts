import { describe, expect, it } from "vitest";

import {
  effectiveWeek,
  levelForWeek,
  levelTimeline,
  planStepwise,
  planSwitch,
  planTemporary,
  scenarioTarget,
  SCENARIOS,
  shiftLevel,
  supersededBy,
} from "./levels";
import { LEVELS } from "./test-fixtures";
import type { LevelChange } from "./types";

const change = (
  c: Partial<LevelChange> & Pick<LevelChange, "effectiveWeek" | "toLevelId">,
): LevelChange => ({
  fromLevelId: "A",
  kind: "byte",
  reason: "eget val",
  source: "medlem",
  ...c,
});

describe("nivå per vecka", () => {
  it("följer startnivån tills ett byte gäller", () => {
    const changes = [change({ effectiveWeek: 3, toLevelId: "B" })];
    expect(levelTimeline("A", changes, 5)).toEqual(["A", "A", "B", "B", "B"]);
  });

  it("hoppar över återkallade byten", () => {
    const changes = [
      change({ effectiveWeek: 3, toLevelId: "B", revokedAt: "2026-10-01" }),
    ];
    expect(levelForWeek("A", changes, 4)).toBe("A");
  });

  it("låter det senast gjorda bytet vinna samma vecka", () => {
    const changes = [
      change({ effectiveWeek: 3, toLevelId: "C", createdAt: "2026-10-02" }),
      change({ effectiveWeek: 3, toLevelId: "B", createdAt: "2026-10-01" }),
    ];
    expect(levelForWeek("A", changes, 3)).toBe("C");
  });
});

describe("när ett byte gäller", () => {
  it("är nästa vecka som standard, aldrig före den här och aldrig efter planen", () => {
    expect(effectiveWeek(4, 12)).toBe(5);
    expect(effectiveWeek(4, 12, "nu")).toBe(4);
    expect(effectiveWeek(4, 12, 2)).toBe(4);
    expect(effectiveWeek(12, 12)).toBe(12);
    expect(effectiveWeek(4, 12, 9)).toBe(9);
  });

  it("pekar ut planerade byten som ett nytt byte gör inaktuella", () => {
    const changes = [
      change({ id: "x", effectiveWeek: 2, toLevelId: "B" }),
      change({ id: "y", effectiveWeek: 6, toLevelId: "C" }),
      change({ id: "z", effectiveWeek: 9, toLevelId: "B" }),
    ];
    expect(supersededBy(changes, 6, 4).map((c) => c.id)).toEqual(["y", "z"]);
  });
});

describe("byten", () => {
  it("rör sig en nivå i taget och stannar vid kanterna", () => {
    expect(shiftLevel(LEVELS, "A", 1)?.id).toBe("B");
    expect(shiftLevel(LEVELS, "C", 1)?.id).toBe("C");
    expect(shiftLevel(LEVELS, "C", -5)?.id).toBe("A");
  });

  it("gör inget byte till samma nivå", () => {
    expect(planSwitch("B", "B", 3)).toEqual([]);
  });

  it("går stegvis från A till C i steg om fyra veckor", () => {
    expect(
      planStepwise({
        levels: LEVELS,
        fromLevelId: "A",
        toLevelId: "C",
        startWeek: 5,
        stepWeeks: 4,
        totalWeeks: 16,
      }),
    ).toEqual([
      { effectiveWeek: 5, fromLevelId: "A", toLevelId: "B", kind: "stegvis" },
      { effectiveWeek: 9, fromLevelId: "B", toLevelId: "C", kind: "stegvis" },
    ]);
  });

  it("går stegvis uppåt också, och tar inte med steg efter planen", () => {
    expect(
      planStepwise({
        levels: LEVELS,
        fromLevelId: "C",
        toLevelId: "A",
        startWeek: 10,
        stepWeeks: 3,
        totalWeeks: 12,
      }),
    ).toEqual([
      { effectiveWeek: 10, fromLevelId: "C", toLevelId: "B", kind: "stegvis" },
    ]);
  });
});

describe("tillfällig sänkning", () => {
  const trip = {
    levels: LEVELS,
    fromLevelId: "A",
    toLevelId: "C",
    startWeek: 5,
    durationWeeks: 2,
    totalWeeks: 12,
  };

  it("går tillbaka till tidigare nivå efter resan", () => {
    expect(planTemporary({ ...trip, returnMode: "tidigare" })).toEqual([
      {
        effectiveWeek: 5,
        fromLevelId: "A",
        toLevelId: "C",
        kind: "tillfällig",
      },
      { effectiveWeek: 7, fromLevelId: "C", toLevelId: "A", kind: "återgång" },
    ]);
  });

  it("går tillbaka till en nivå under den tidigare", () => {
    expect(planTemporary({ ...trip, returnMode: "en-under" })[1]).toEqual({
      effectiveWeek: 7,
      fromLevelId: "C",
      toLevelId: "B",
      kind: "återgång",
    });
  });

  it("går stegvis tillbaka", () => {
    expect(
      planTemporary({ ...trip, returnMode: "stegvis", stepWeeks: 2 }).slice(1),
    ).toEqual([
      { effectiveWeek: 7, fromLevelId: "C", toLevelId: "B", kind: "återgång" },
      { effectiveWeek: 9, fromLevelId: "B", toLevelId: "A", kind: "återgång" },
    ]);
  });

  it("stannar på den sänkta nivån när medlemmen vill det", () => {
    expect(planTemporary({ ...trip, returnMode: "stanna" })).toHaveLength(1);
  });

  it("hoppar över återgången när planen tar slut först", () => {
    expect(
      planTemporary({ ...trip, startWeek: 11, returnMode: "tidigare" }),
    ).toHaveLength(1);
  });

  it("har scenarier med förval, till exempel resa till lägsta nivån", () => {
    const resa = SCENARIOS.find((s) => s.reason === "resa")!;
    expect(scenarioTarget(LEVELS, "A", resa).id).toBe("C");
    const arbete = SCENARIOS.find((s) => s.reason === "arbete")!;
    expect(scenarioTarget(LEVELS, "A", arbete).id).toBe("B");
  });
});
