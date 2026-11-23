import { describe, expect, it } from "vitest";

import { suggestedPasses, testName, testTag } from "./test-passes";

describe("pass som del av ett test", () => {
  const passes = [
    { id: "a", sport: "cykling", performed_on: "2026-11-17" },
    { id: "b", sport: "cykling", performed_on: "2026-11-18" },
    { id: "c", sport: "cykling", performed_on: "2026-11-20" },
    { id: "d", sport: "löpning", performed_on: "2026-11-20" },
    { id: "e", sport: "cykling", performed_on: "2026-11-22" },
  ];

  it("föreslår passen de dagar insatserna gjordes, i samma gren", () => {
    // Tobias metabola profil: sprint och 3 min tisdag, 6 min fredag, 12 min söndag.
    const session = {
      sport: "cykling",
      performed_on: "2026-11-22",
      effortDates: ["2026-11-17", "2026-11-17", "2026-11-20", null],
    };
    expect(
      suggestedPasses(session, passes, new Set()).map((p) => p.id),
    ).toEqual(["a", "c", "e"]);
    expect(
      suggestedPasses(session, passes, new Set(["a"])).map((p) => p.id),
    ).toEqual(["c", "e"]);
  });

  it("namnger testen", () => {
    expect(testName("metabol-profil")).toBe("Metabol profil");
    expect(testName("okänt")).toBe("okänt");
    expect(
      testTag(["critical-power", "metabol-profil", "critical-power"]),
    ).toBe("Test · Critical power, Metabol profil");
    expect(testTag([])).toBeNull();
  });
});
