import { describe, expect, it } from "vitest";

import fixtures from "./sheet-fixtures.json";
import {
  inputFromParams,
  inputToParams,
  planWeeks,
  type PlannerDistance,
  type PlannerInput,
  type PlannerLevel,
  type WeekKind,
} from "./planner";

/**
 * Facit: arkets formler (Plan!B–D) återskapade rad för rad, för sex
 * kombinationer. Nyckeln är distans|nivå|veckor|långpass|volym.
 */
const SHEET_DISTANCE: Record<string, PlannerDistance> = {
  "5 km": "5K",
  "10 km": "10K",
  Halvmaraton: "HM",
  Maraton: "M",
  "Ultra 100 km": "U100",
};

const kindOf = (phase: string): WeekKind =>
  phase === "TÄVLING"
    ? "lopp"
    : phase === "PEAK"
      ? "topp"
      : phase.startsWith("Taper")
        ? "taper"
        : phase === "Avlastning"
          ? "avlastning"
          : phase === "Bas"
            ? "bas"
            : "bygg";

describe("planWeeks mot kalkylarket", () => {
  for (const [key, rows] of Object.entries(
    fixtures as unknown as Record<string, [number, string, number, number][]>,
  )) {
    it(key, () => {
      const [d, l, n, lr, vol] = key.split("|");
      const input: PlannerInput = {
        distance: SHEET_DISTANCE[d],
        level: Number(l) as PlannerLevel,
        weeks: Number(n),
        longRunKm: Number(lr),
        weeklyKm: Number(vol),
        deloadEvery: 3,
      };
      const r = planWeeks(input);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(
        r.plan.weeks.map((w) => [w.week, w.kind, w.longRunKm, w.volumeKm]),
      ).toEqual(
        rows.map(([w, phase, long, vol]) => [w, kindOf(phase), long, vol]),
      );
    });
  }
});

const base: PlannerInput = {
  distance: "M",
  level: 1,
  weeks: 16,
  longRunKm: 17,
  weeklyKm: 40,
  deloadEvery: 3,
};

describe("faser, test och nyckelpass", () => {
  it("lägger faserna längs blocken och testet veckan före den specifika delen", () => {
    const r = planWeeks(base);
    if (!r.ok) throw new Error(r.error);
    const phases = r.plan.weeks.map((w) => w.phase);
    // Fyra block à tre veckor före toppen (vecka 13): två grund, ett
    // uppbyggnad, ett specifikt.
    expect(phases.slice(0, 6)).toEqual(Array(6).fill("grund"));
    expect(phases.slice(6, 9)).toEqual(Array(3).fill("uppbyggnad"));
    expect(phases.slice(9, 13)).toEqual(Array(4).fill("specifik"));
    expect(phases.slice(13)).toEqual(["topp", "topp", "topp"]);
    const test = r.plan.weeks.find((w) => w.test);
    expect(test?.week).toBe(9);
    expect(test?.kind).toBe("avlastning");
    expect(test?.sessions[0]).toBe("10 km-test");
  });

  it("skriver långpasset sist och etiketterna för avlastning och taper", () => {
    const r = planWeeks(base);
    if (!r.ok) throw new Error(r.error);
    const w1 = r.plan.weeks[0];
    expect(w1.sessions).toEqual([
      "Backspurter",
      "Stegringar",
      "Långpass 17 km",
    ]);
    expect(r.plan.weeks[2].label).toBe("Avlastning");
    expect(r.plan.weeks[13].label).toBe("Taper 1");
    expect(r.plan.weeks[15].sessions).toEqual(["Kort aktivering", "Loppet"]);
    expect(r.plan.weeks[12].note?.text).toContain("tyngsta");
  });

  it("avlastar var fjärde vecka när det väljs", () => {
    const r = planWeeks({ ...base, deloadEvery: 4 });
    if (!r.ok) throw new Error(r.error);
    expect(
      r.plan.weeks.filter((w) => w.kind === "avlastning").map((w) => w.week),
    ).toEqual([4, 8, 12]);
  });

  it("varnar för långpass över 40 % och för brant ökning", () => {
    const r = planWeeks({ ...base, longRunKm: 25, weeklyKm: 26, weeks: 10 });
    if (!r.ok) throw new Error(r.error);
    expect(r.plan.weeks[0].longShare).toBeGreaterThan(0.4);
    const text = r.plan.warnings.join(" ");
    expect(text).toMatch(/över 40 % av veckan i \d+ av 10 veckor/);
    expect(text).toMatch(/16 veckor/);
    expect(text).toMatch(/i veckan/);
  });

  it("säger till när kombinationen eller veckorna inte går", () => {
    expect(planWeeks({ ...base, distance: "U160", level: 1 })).toEqual({
      ok: false,
      error: "Ultra 160 km finns bara på nivå 3.",
    });
    expect(planWeeks({ ...base, weeks: 6 }).ok).toBe(false);
  });
});

describe("adressen", () => {
  it("läser och skriver samma indata", () => {
    const input: PlannerInput = { ...base, deloadEvery: 4 };
    const params = Object.fromEntries(inputToParams(input));
    expect(inputFromParams(params)).toEqual(input);
  });

  it("faller tillbaka på standardvärden", () => {
    expect(inputFromParams({ distans: "U160", niva: "1", veckor: "" })).toEqual(
      {
        distance: "U160",
        level: 3,
        weeks: 16,
        longRunKm: 0,
        weeklyKm: 0,
        deloadEvery: 3,
      },
    );
  });
});
