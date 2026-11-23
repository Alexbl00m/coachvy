import { describe, expect, it } from "vitest";

import { dailyTss, pmcSeries, weekForm } from "./pmc";

describe("fitness, trötthet och form", () => {
  it("följer Banisters medelvärden med 42 och 7 dagar", () => {
    const done = new Map([["2026-11-01", 100]]);
    const [first, second] = pmcSeries({
      from: "2026-11-01",
      to: "2026-11-02",
      today: "2026-11-10",
      done,
      planned: new Map(),
    });
    expect(first.ctl).toBeCloseTo(100 / 42, 9);
    expect(first.atl).toBeCloseTo(100 / 7, 9);
    expect(first.tsb).toBeCloseTo(100 / 42 - 100 / 7, 9);
    expect(second.ctl).toBeCloseTo((100 / 42) * (41 / 42), 9);
  });

  it("närmar sig en jämn belastning", () => {
    const done = new Map<string, number>();
    const from = "2026-01-01";
    for (let i = 0; i < 365; i += 1) {
      const d = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
      done.set(d, 60);
    }
    const points = pmcSeries({
      from,
      to: "2026-12-31",
      today: "2027-01-01",
      done,
      planned: new Map(),
    });
    const last = points[points.length - 1];
    expect(last.ctl).toBeCloseTo(60, 1);
    expect(last.atl).toBeCloseTo(60, 6);
    expect(Math.abs(last.tsb)).toBeLessThan(0.1);
  });

  it("räknar planen från i dag, men det gjorda går först", () => {
    const points = pmcSeries({
      from: "2026-11-20",
      to: "2026-11-24",
      today: "2026-11-22",
      done: new Map([["2026-11-22", 40]]),
      planned: new Map([
        ["2026-11-21", 90],
        ["2026-11-22", 80],
        ["2026-11-23", 70],
      ]),
    });
    expect(points.map((p) => [p.tss, p.projected])).toEqual([
      [0, false],
      [0, false],
      [40, false],
      [70, true],
      [0, true],
    ]);
  });

  it("ger veckans form, rampen och om planen räknas", () => {
    const planned = new Map<string, number>();
    for (let i = 0; i < 7; i += 1)
      planned.set(`2026-11-${String(23 + i).padStart(2, "0")}`, 70);
    const points = pmcSeries({
      from: "2026-11-09",
      to: "2026-11-29",
      today: "2026-11-23",
      done: dailyTss([
        { date: "2026-11-17", tss: 60 },
        { date: "2026-11-17", tss: 20 },
        { date: "2026-11-20", tss: null },
      ]),
      planned,
    });
    const w48 = weekForm(points, "2026-11-23")!;
    const w47 = weekForm(points, "2026-11-16")!;
    expect(w47.projected).toBe(false);
    expect(w48.projected).toBe(true);
    expect(w48.ramp).toBeCloseTo(w48.ctl - w47.ctl, 9);
    expect(weekForm(points, "2026-11-02")).toBeNull();
    expect(points.find((p) => p.date === "2026-11-17")!.tss).toBe(80);
  });
});
