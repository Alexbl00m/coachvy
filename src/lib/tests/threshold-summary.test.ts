import { describe, expect, it } from "vitest";

import type { Trend } from "./progression";
import {
  analysisHeadline,
  changeBetween,
  latestOf,
  thresholdInsight,
} from "./threshold-summary";

const trend = (
  key: string,
  unit: string,
  points: [string, number][],
  higherIsBetter: boolean | null = true,
): Trend => ({
  id: key,
  key,
  label: `${key} – tröskel`,
  unit,
  higherIsBetter,
  points: points.map(([performedOn, value], i) => ({
    sessionId: `s${i}`,
    performedOn,
    value,
    protocol: "lactate_step",
  })),
});

describe("thresholdInsight", () => {
  it("säger hur många watt tröskeln flyttat sig", () => {
    const insight = thresholdInsight(
      [
        trend("LT2", "W", [
          ["2024-11-22", 306],
          ["2026-07-15", 336],
        ]),
      ],
      "cykling",
    );
    expect(insight?.title).toBe("Tröskeln har flyttat sig 30 watt.");
    expect(insight?.lead).toContain("från 306 W till 336 W på 20 månader");
    expect(insight?.lead).toContain("Räknat ur två tester, november 2024");
  });

  it("säger att tröskeln backat när värdet sjunkit", () => {
    const insight = thresholdInsight(
      [
        trend("LT2", "W", [
          ["2025-01-10", 320],
          ["2025-09-10", 305],
        ]),
      ],
      "cykling",
    );
    expect(insight?.title).toBe("Tröskeln har backat 15 watt.");
  });

  it("räknar löparens tröskel i sekunder per km", () => {
    // 4,166 m/s är 4:00 /km, 4,274 m/s ungefär 3:54 /km.
    const insight = thresholdInsight(
      [
        trend("LT2", "m/s", [
          ["2025-07-15", 1000 / 240],
          ["2026-07-15", 1000 / 234],
        ]),
      ],
      "löpning",
    );
    expect(insight?.title).toBe("Tröskeln är 6 sekunder snabbare per km.");
  });

  it("väntar på nästa test när det bara finns ett", () => {
    const insight = thresholdInsight(
      [trend("CP", "W", [["2026-08-12", 347]])],
      "cykling",
    );
    expect(insight?.title).toBe("CP ligger på 347 W.");
  });

  it("är null utan trösklar", () => {
    expect(thresholdInsight([], "cykling")).toBeNull();
  });
});

describe("changeBetween och latestOf", () => {
  it("visar tempots förändring med minus för snabbare", () => {
    const t = trend("CS", "m/s", [
      ["2025-01-01", 1000 / 236],
      ["2025-06-01", 1000 / 234],
    ]);
    const change = changeBetween(t, t.points[0], t.points[1], "löpning");
    expect(change?.text).toBe("−0:02");
    expect(change?.tone).toBe("good");
  });

  it("jämför med testet före, inte ett annat protokoll samma dag", () => {
    const t = trend("LT2", "W", [
      ["2025-01-01", 300],
      ["2025-06-01", 310],
      ["2025-06-01", 312],
    ]);
    const latest = latestOf(t, "cykling");
    expect(latest.previous?.performedOn).toBe("2025-01-01");
    expect(latest.change?.text).toBe("+12 W");
  });
});

describe("analysisHeadline", () => {
  it("kopplar ihop spurtkraft och tröskel", () => {
    const trends = [
      trend("LT2", "W", [
        ["2024-11-22", 306],
        ["2026-07-15", 336],
      ]),
      trend(
        "VLamax",
        "mmol/l/s",
        [
          ["2024-11-22", 0.26],
          ["2026-01-22", 0.6],
        ],
        null,
      ),
    ];
    expect(analysisHeadline(trends, "cykling")).toBe(
      "Mer spurtkraft, och tröskeln följer med.",
    );
  });

  it("säger att tröskeln går framåt utan VLamax", () => {
    expect(
      analysisHeadline(
        [
          trend("CS", "m/s", [
            ["2025-01-01", 4.0],
            ["2025-06-01", 4.2],
          ]),
        ],
        "löpning",
      ),
    ).toBe("Tröskeln går framåt.");
  });
});
