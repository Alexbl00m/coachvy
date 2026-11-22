import { describe, expect, it } from "vitest";

import { addLoad, emptyTotals, hoursText, loadLine, workoutLoad } from "./load";
import type { TargetBasis, WorkoutBlock, WorkoutStep } from "./schema";

const step = (
  kind: WorkoutStep["kind"],
  fraction: number,
  seconds: number | null,
  metres: number | null = null,
): WorkoutStep => ({
  kind,
  label: "",
  durationSeconds: seconds,
  distanceM: metres,
  low: fraction,
  high: fraction,
});
const one = (s: WorkoutStep): WorkoutBlock => ({ type: "steg", step: s });
const pass = (
  sport: "cykling" | "löpning" | "simning",
  basis: TargetBasis,
  blocks: WorkoutBlock[],
) => ({ sport, basis, blocks });

describe("TSS för ett planerat pass", () => {
  it("ger 100 för en timme på FTP", () => {
    const load = workoutLoad(
      pass("cykling", "FTP", [one(step("distans", 1, 3600))]),
      250,
    )!;
    expect(load.tss).toBeCloseTo(100, 5);
    expect(load.intensityFactor).toBeCloseTo(1, 5);
    expect(load.normalizedPower).toBeCloseTo(250, 5);
    expect(load.kj).toBeCloseTo(900, 5);
    expect(load.kind).toBe("TSS");
  });

  it("räknar CP som 5 % över FTP", () => {
    const load = workoutLoad(
      pass("cykling", "CP", [one(step("distans", 1, 3600))]),
      300,
    )!;
    expect(load.intensityFactor).toBeCloseTo(1 / 0.95, 4);
    expect(load.tss).toBeCloseTo(110.8, 1);
    expect(load.normalizedPower).toBeCloseTo(300, 4);
  });

  it("väger intervaller tyngre än medelintensiteten", () => {
    const blocks: WorkoutBlock[] = [
      one(step("uppvärmning", 0.6, 600)),
      {
        type: "repetition",
        times: 5,
        steps: [step("intervall", 1.2, 180), step("vila", 0.5, 180)],
      },
      one(step("nedvarvning", 0.5, 600)),
    ];
    const load = workoutLoad(pass("cykling", "FTP", blocks), 250)!;
    const hours = load.seconds / 3600;
    const mean =
      (0.6 * 600 + 5 * (1.2 * 180 + 0.5 * 180) + 0.5 * 600) / load.seconds;
    expect(load.seconds).toBe(3000);
    expect(load.intensityFactor).toBeGreaterThan(mean);
    expect(load.tss).toBeGreaterThan(hours * mean ** 2 * 100);
    expect(load.normalizedPower!).toBeGreaterThan(mean * 250);
  });

  it("räknar rTSS mot tröskelfarten i löpning", () => {
    const load = workoutLoad(
      pass("löpning", "CS", [one(step("distans", 0.75, 3600))]),
      4,
    )!;
    expect(load.kind).toBe("rTSS");
    expect(load.intensityFactor).toBeCloseTo(0.75 / 0.95, 4);
    expect(load.tss).toBeCloseTo(62.3, 1);
    expect(load.metres).toBeCloseTo(10800, 5);
    expect(load.normalizedPower).toBeNull();
    expect(load.kj).toBeNull();
  });

  it("ger maratonfart en IF kring 0,92", () => {
    const load = workoutLoad(
      pass("löpning", "MP", [one(step("distans", 1, 3600))]),
      null,
    )!;
    expect(load.intensityFactor).toBeCloseTo(0.923, 3);
  });

  it("räknar steg i meter när referensen finns, och säger till när den saknas", () => {
    const blocks = [
      one(step("uppvärmning", 0.7, 600)),
      one(step("intervall", 1, null, 2000)),
    ];
    const withRef = workoutLoad(pass("löpning", "CS", blocks), 5)!;
    expect(withRef.seconds).toBeCloseTo(1000, 5);
    expect(withRef.partial).toBe(false);
    const without = workoutLoad(pass("löpning", "CS", blocks), null)!;
    expect(without.seconds).toBe(600);
    expect(without.partial).toBe(true);
    expect(without.metres).toBeNull();
  });

  it("räknar sTSS i simning utan vilan vid kanten, IF i kubik", () => {
    const blocks: WorkoutBlock[] = [
      one(step("uppvärmning", 0.85, null, 200)),
      {
        type: "repetition",
        times: 10,
        steps: [step("intervall", 1, null, 100), step("vila", 0, 15)],
      },
    ];
    const load = workoutLoad(pass("simning", "CSS", blocks), 1.25)!;
    const moving = 200 / (0.85 * 1.25) + 1000 / 1.25;
    const ifactor = (0.85 * (200 / (0.85 * 1.25)) + 800) / moving;
    expect(load.kind).toBe("sTSS");
    expect(load.intensityFactor).toBeCloseTo(ifactor, 5);
    expect(load.tss).toBeCloseTo((moving / 3600) * ifactor ** 3 * 100, 5);
    expect(load.seconds).toBeCloseTo(moving + 150, 5);
    expect(load.metres).toBeCloseTo(1200, 5);
  });

  it("ger null för ett pass utan tid", () => {
    expect(
      workoutLoad(pass("cykling", "FTP", [one(step("distans", 1, null))]), 250),
    ).toBeNull();
  });
});

describe("summor och text", () => {
  it("lägger ihop pass, sträcka per gren och pass utan TSS", () => {
    let t = emptyTotals();
    t = addLoad(t, { sport: "cykling", seconds: 3600, tss: 80, kj: 900 });
    t = addLoad(t, { sport: "löpning", seconds: 2400, tss: 40, metres: 8000 });
    t = addLoad(t, { sport: "annat", seconds: 1800, tss: null });
    expect(t).toEqual({
      sessions: 3,
      seconds: 7800,
      tss: 120,
      withoutTss: 1,
      kj: 900,
      metres: { löpning: 8000 },
    });
  });

  it("skriver tid och mått", () => {
    expect(hoursText(34200)).toBe("9:30 h");
    expect(hoursText(2700)).toBe("45 min");
    const load = workoutLoad(
      pass("cykling", "FTP", [one(step("distans", 0.75, 7200))]),
      280,
    )!;
    expect(loadLine(load)).toBe("TSS 113 · IF 0,75 · NP 210 W · 1 512 kJ");
  });
});

describe("referens ur passets längd", () => {
  it("ger stegen i meter den tid som återstår", async () => {
    const { impliedReference } = await import("./load");
    const blocks: WorkoutBlock[] = [
      one(step("uppvärmning", 0.8, 600)),
      one(step("intervall", 1, null, 3000)),
    ];
    // 3 km på referensen tar 900 s när passet är 25 min: referensen 3,33 m/s.
    expect(impliedReference({ sport: "löpning", blocks }, 1500)).toBeCloseTo(
      3000 / 900,
      6,
    );
    expect(impliedReference({ sport: "löpning", blocks }, 500)).toBeNull();
    expect(impliedReference({ sport: "cykling", blocks }, 1500)).toBeNull();
  });
});
