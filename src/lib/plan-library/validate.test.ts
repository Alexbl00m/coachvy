import { describe, expect, it } from "vitest";

import { LEVELS, PHASES, SESSIONS, WEEKS } from "./test-fixtures";
import { validateVersion } from "./validate";

describe("kontroll före publicering", () => {
  it("godkänner en hel mall", () => {
    expect(
      validateVersion({
        levels: LEVELS,
        phases: PHASES,
        weeks: WEEKS,
        sessions: SESSIONS,
        minWeeks: 7,
      }),
    ).toEqual([]);
  });

  it("hittar för kort kortaste längd, tomma faser och veckor och nivåer utan pass", () => {
    const issues = validateVersion({
      levels: LEVELS,
      phases: [
        ...PHASES,
        {
          id: "x",
          position: 5,
          name: "Vila",
          minWeeks: 1,
          trimOrder: null,
          seasonPhase: "vila",
        },
      ],
      weeks: WEEKS,
      sessions: SESSIONS.filter((s) => s.weekId !== "w2").map((s) => ({
        ...s,
        variants: s.variants.filter((v) => v.levelId !== "C"),
      })),
      minWeeks: 6,
    });
    expect(issues.map((i) => i.text)).toEqual([
      "Vila saknar veckor.",
      "Faserna kan inte kortas till 6 veckor – kortast går 7. Höj kortaste längd eller låt fler veckor kortas.",
      "En vecka saknar pass (vecka 2).",
      "Grund har inga pass.",
    ]);
  });
});
