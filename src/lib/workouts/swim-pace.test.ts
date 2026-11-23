import { describe, expect, it } from "vitest";

import { parseStructure } from "@/lib/plan-library/structure";
import {
  toAdeptWorkout,
  validateLibraryInput,
} from "@/lib/session-library/library";

import {
  basisMismatch,
  hasSwimTargets,
  parseSwimPace,
  parseSwimTarget,
  swimPaceText,
} from "./swim-pace";

const paces = { css: 100, im: 108, half: 105 };

describe("simfart i passraden", () => {
  it("läser CSS plus sekunder som andel av CSS-farten", () => {
    const t = parseSwimTarget(" CSS+8-15", paces);
    expect(t).toMatchObject({ fastestOffset: 8 });
    if (!t || typeof t === "string") throw new Error();
    expect(t.high).toBeCloseTo(100 / 108);
    expect(t.low).toBeCloseTo(100 / 115);
    const around = parseSwimTarget("CSS-1-+3", paces);
    if (!around || typeof around === "string") throw new Error();
    expect(around.high).toBeCloseTo(100 / 99);
    expect(around.low).toBeCloseTo(100 / 103);
    expect(parseSwimTarget("CSS", paces)).toMatchObject({ low: 1, high: 1 });
  });

  it("läser tävlingsfarten och kräver att adepten har den", () => {
    const im = parseSwimTarget("@IM-2", paces);
    if (!im || typeof im === "string") throw new Error();
    expect(im.low).toBeCloseTo(100 / 106);
    expect(
      parseSwimTarget("@703", { css: 100, im: null, half: null }),
    ).toContain("70.3");
    expect(parseSwimTarget("65%", paces)).toBeNull();
  });

  it("delar inte på plustecknet i CSS+8, men på + mellan stegen", () => {
    const parsed = parseStructure(
      "400 m CSS+15; 8x(200 m CSS+8-15 + 20 s vila); 4x(100 m @IM + 100 m @IM-2 + 15 s vila); 200 m CSS+20",
      { swim: paces },
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const [, set, race] = parsed.blocks;
    expect(set).toMatchObject({ type: "repetition", times: 8 });
    if (set.type !== "repetition" || race.type !== "repetition")
      throw new Error();
    expect(set.steps.map((s) => s.kind)).toEqual(["intervall", "vila"]);
    expect(set.steps[1]).toMatchObject({ durationSeconds: 20, kind: "vila" });
    // Båda sträckorna i serien simmas; bara vilan är vila.
    expect(race.steps.map((s) => s.kind)).toEqual([
      "intervall",
      "intervall",
      "vila",
    ]);
    // Utan mellanslag är plus fortfarande en avskiljare i vanliga pass.
    const plain = parseStructure("5 min 90%+3 min 50%");
    expect(plain.ok && plain.blocks.length).toBe(2);
  });

  it("räknar om ett bibliotekspass mot adeptens egen CSS", () => {
    const input = validateLibraryInput({
      title: "CSS Climber – Base",
      sport: "simning",
      kind: "Kvalitet",
      intensity: "Tröskel",
      purpose: "",
      description: "",
      progression: "",
      adaptations: "",
      fueling: "",
      timing: "",
      phases: [],
      basis: "CSS",
      structure: "400 m CSS+15; 12x(100 m CSS+4-6 + 20 s vila); 200 m CSS+20",
      levels: [],
    });
    expect(input.ok).toBe(true);
    if (!input.ok) return;
    const fast = toAdeptWorkout(
      { ...input.value, levels: [] },
      { sport: "simning", basis: "CSS", reference: 100 / 80 },
      {},
      null,
    );
    const slow = toAdeptWorkout(
      { ...input.value, levels: [] },
      { sport: "simning", basis: "CSS", reference: 100 / 130 },
      {},
      null,
    );
    if (!fast.ok || !slow.ok) throw new Error();
    const pick = (w: typeof fast.workout) => {
      const b = w.blocks[1];
      if (b.type !== "repetition") throw new Error();
      return b.steps[0];
    };
    // Samma tillägg är en större andel för den snabba simmaren.
    expect(pick(fast.workout).high).toBeCloseTo(80 / 84);
    expect(pick(slow.workout).high).toBeCloseTo(130 / 134);
    // @IM utan inskriven tävlingsfart går inte att lägga på adepten.
    const race = toAdeptWorkout(
      { ...input.value, structure: "10x(200 m @IM + 20 s vila)", levels: [] },
      { sport: "simning", basis: "CSS", reference: 1 },
      {},
      null,
    );
    expect(race.ok).toBe(false);
  });

  it("kräver CSS som bas för simfart och tolkar fart som tid", () => {
    expect(basisMismatch("8x(200 m CSS+8)", "MP")).toContain("CSS");
    expect(basisMismatch("10x(200 m @IM + 20 s vila)", "CSS")).toBeNull();
    expect(basisMismatch("2 km @LO", "CSS")).toContain("maratonfart");
    expect(hasSwimTargets("12x(100 m CSS+4)")).toBe(true);
    expect(hasSwimTargets("10 min 65%")).toBe(false);
    expect(parseSwimPace("1:52")).toBe(112);
    expect(parseSwimPace("105")).toBe(105);
    expect(parseSwimPace("9:99")).toBeNull();
    expect(swimPaceText(112)).toBe("1:52");
  });
});

describe("tävlingsfarten ur simtestet", () => {
  it("räknar farten till 1 900 och 3 800 m ur simmarens egen kurva", async () => {
    const { swimRacePaces, swimPredictions } = await import("@/lib/tests/swim");
    const points = [
      { metres: 200, seconds: 150 },
      { metres: 400, seconds: 320 },
    ];
    const paces = swimRacePaces(points);
    const rows = swimPredictions(points, null, null);
    const im = rows.find((r) => r.metres === 3800)!;
    expect(paces.im).toBeCloseTo((im.own / 3800) * 100);
    // Längre lopp, långsammare fart.
    expect(paces.im!).toBeGreaterThan(paces.half!);
    // CSS är 85 s/100 m; Ironmanfarten är långsammare än CSS.
    expect(paces.im!).toBeGreaterThan(85);
    expect(swimRacePaces([])).toEqual({ im: null, half: null });
  });
});
