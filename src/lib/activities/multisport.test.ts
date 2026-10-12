import { describe, expect, it } from "vitest";

import {
  isUnsplitCopy,
  kindOf,
  legName,
  overlapShare,
  partLabels,
  sameSession,
  type MultisportPart,
} from "./multisport";

const parts: MultisportPart[] = [
  {
    kind: "gren",
    sport: "simning",
    startedAt: "2026-08-22T06:59:15Z",
    seconds: 1802,
    distanceM: 1843,
  },
  {
    kind: "växling",
    sport: null,
    startedAt: "2026-08-22T07:29:18Z",
    seconds: 127,
    distanceM: 222,
  },
  {
    kind: "gren",
    sport: "cykling",
    startedAt: "2026-08-22T07:31:25Z",
    seconds: 7606,
    distanceM: 85694,
  },
  {
    kind: "växling",
    sport: null,
    startedAt: "2026-08-22T09:38:11Z",
    seconds: 111,
    distanceM: 380,
  },
  {
    kind: "gren",
    sport: "löpning",
    startedAt: "2026-08-22T09:40:01Z",
    seconds: 5056,
    distanceM: 19605,
  },
];

describe("multisport", () => {
  it("känner igen triathlon och duathlon", () => {
    expect(kindOf(["simning", "cykling", "löpning"])).toBe("triathlon");
    expect(kindOf(["löpning", "cykling", "löpning"])).toBe("duathlon");
    expect(kindOf(["simning", "löpning"])).toBe("multisport");
  });

  it("numrerar växlingarna och namnger grenarna", () => {
    expect(partLabels(parts)).toEqual(["Sim", "T1", "Cykel", "T2", "Löpning"]);
    expect(legName("Sala Silverman", "cykling")).toBe("Sala Silverman · cykel");
  });

  it("ser cykeldatorns pass som samma gren som klockans cykeldel", () => {
    const watch = { startedAt: "2026-08-22T07:31:25Z", seconds: 7606 };
    const edge = { startedAt: "2026-08-22T07:30:40Z", seconds: 7613 };
    expect(overlapShare(watch, edge)).toBeGreaterThan(0.99);
    expect(sameSession(watch, edge)).toBe(true);
    const run = { startedAt: "2026-08-22T09:40:01Z", seconds: 5056 };
    expect(sameSession(edge, run)).toBe(false);
  });

  it("känner igen en tidigare import av hela filen som ett pass", () => {
    const summary = { totalS: 14702, parts };
    expect(
      isUnsplitCopy(
        { startedAt: "2026-08-22T06:59:15Z", seconds: 14702, multisport: null },
        summary,
      ),
    ).toBe(true);
    // Simdelen själv, eller en redan delad gren, är inte en odelad kopia.
    expect(
      isUnsplitCopy(
        { startedAt: "2026-08-22T06:59:15Z", seconds: 1802, multisport: null },
        summary,
      ),
    ).toBe(false);
    expect(
      isUnsplitCopy(
        {
          startedAt: "2026-08-22T06:59:15Z",
          seconds: 14702,
          multisport: { id: "x" },
        },
        summary,
      ),
    ).toBe(false);
  });
});
