import { describe, expect, it } from "vitest";

import type { Effort } from "./analysis";
import { analyseSession } from "./analysis";
import { assessLsct, lsctMetrics, type LsctResult } from "./lsct";

const effort = (
  ordinal: number,
  intensity: number | null,
  heartRate: number | null,
  rpe: number | null = null,
  durationSeconds: number | null = null,
): Effort => ({
  ordinal,
  intensity,
  durationSeconds,
  distanceM: null,
  lactate: null,
  heartRate,
  rpe,
});

const test = [
  effort(0, 140, 112, 2, 40),
  effort(1, 230, 150, 4, 45),
  effort(2, 290, 169, 6, 50),
  effort(3, null, 128),
];

describe("lsctMetrics", () => {
  it("räknar effekt, återhämtning, RPE och tid till 90 %", () => {
    const { metrics, warnings } = lsctMetrics(test);
    const value = (key: string) => metrics.find((m) => m.key === key)?.value;
    expect(value("LSCT_W3")).toBe(290);
    expect(value("LSCT_HRR")).toBe(41);
    expect(value("LSCT_RPE2")).toBe(4);
    expect(value("LSCT_T90")).toBe(50);
    expect(value("LSCT_W_per_HR3")).toBeCloseTo(1.716, 3);
    expect(warnings).toEqual([]);
  });

  it("varnar när det tar över en minut att nå 90 %", () => {
    const slow = [...test.slice(0, 2), effort(2, 290, 169, 6, 75), test[3]];
    expect(lsctMetrics(slow).warnings[0]).toContain("75 s till 90 %");
  });

  it("läser raderna ur sin plats, så att ett tomt steg inte flyttar vilan", () => {
    const { metrics } = lsctMetrics([test[1], test[2], test[3]]);
    expect(metrics.find((m) => m.key === "LSCT_HRR")?.value).toBe(41);
    expect(metrics.some((m) => m.key === "LSCT_W1")).toBe(false);
  });

  it("går genom analyseSession utan zoner", () => {
    const a = analyseSession({
      protocol: "lsct",
      sport: "cykling",
      unit: "W",
      efforts: test,
      weightKg: 75,
    });
    expect(a.zones).toEqual([]);
    expect(a.metrics.filter((m) => m.isPrimary).map((m) => m.key)).toEqual([
      "LSCT_W3",
      "LSCT_HRR",
    ]);
  });
});

describe("assessLsct", () => {
  const week = (i: number, values: LsctResult["values"]): LsctResult => ({
    sessionId: `s${i}`,
    performedOn: `2026-09-${String(1 + i * 7).padStart(2, "0")}`,
    values,
  });
  const baseline = [
    week(0, { LSCT_W3: 288, LSCT_HRR: 40, LSCT_RPE2: 4, LSCT_T90: 45 }),
    week(1, { LSCT_W3: 291, LSCT_HRR: 41, LSCT_RPE2: 4, LSCT_T90: 48 }),
    week(2, { LSCT_W3: 290, LSCT_HRR: 39, LSCT_RPE2: 4, LSCT_T90: 50 }),
  ];

  it("väntar på en baslinje", () => {
    const now = week(1, { LSCT_W3: 290, LSCT_HRR: 40 });
    const a = assessLsct(now, [baseline[0], now]);
    expect(a.verdict).toBe("baslinje");
    expect(a.baseline).toBe(1);
  });

  it("är normal inom normen", () => {
    const now = week(3, {
      LSCT_W3: 292,
      LSCT_HRR: 41,
      LSCT_RPE2: 4,
      LSCT_T90: 47,
    });
    const a = assessLsct(now, [...baseline, now]);
    expect(a.verdict).toBe("normal");
  });

  it("räknar ett ensamt effektlyft som bättre form", () => {
    const now = week(3, {
      LSCT_W3: 310,
      LSCT_HRR: 41,
      LSCT_RPE2: 4,
      LSCT_T90: 47,
    });
    const a = assessLsct(now, [...baseline, now]);
    expect(a.verdict).toBe("normal");
    expect(a.signals.find((s) => s.key === "effekt")?.state).toBe("up");
  });

  it("föreslår lugnt när flera signaler avviker", () => {
    const now = week(3, {
      LSCT_W3: 310,
      LSCT_HRR: 30,
      LSCT_RPE2: 5,
      LSCT_T90: 70,
    });
    const a = assessLsct(now, [...baseline, now]);
    expect(a.verdict).toBe("vila");
    expect(a.warnings).toBe(4);
  });

  it("bevakar en ensam avvikelse", () => {
    const now = week(3, {
      LSCT_W3: 290,
      LSCT_HRR: 40,
      LSCT_RPE2: 5,
      LSCT_T90: 47,
    });
    const a = assessLsct(now, [...baseline, now]);
    expect(a.verdict).toBe("bevaka");
  });
});
