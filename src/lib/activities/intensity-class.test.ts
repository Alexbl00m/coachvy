import { describe, expect, it } from "vitest";

import { classifyActivity, effectiveGoal } from "./intensity-class";

const zones = (seconds: number[]) =>
  seconds.map((s, i) => ({ zone: `Z${i + 1}`, seconds: s }));

const ride = (power: number[], above = 0) => ({
  movingS: power.reduce((a, b) => a + b, 0),
  elapsedS: power.reduce((a, b) => a + b, 0),
  powerZones: zones(power),
  hrZones: null,
  aboveCriticalS: above,
});

describe("classifyActivity", () => {
  it("VO₂max-pass är högt fast det mest är uppvärmning och vila", () => {
    // 90 min: 5 × 4 min i Z5, resten lugnt.
    const c = classifyActivity(
      ride([1800, 2400, 300, 0, 1200, 0, 0], 1100),
      "cykling",
    );
    expect(c?.goal).toBe("hög");
    expect(c?.reason).toBe("20 min i effektzon 5 och uppåt");
  });

  it("distanspass med några stegringar är lugnt", () => {
    // 3 h lugnt med 4 min i Z5 och 10 min i Z3.
    const c = classifyActivity(
      ride([3600, 6400, 600, 0, 180, 60, 0], 240),
      "cykling",
    );
    expect(c?.goal).toBe("lugn");
    expect(c?.reason).toContain("4 min över LT2");
  });

  it("tröskelpass är medel", () => {
    // 3 × 12 min i Z4, 75 min totalt.
    const c = classifyActivity(
      ride([900, 1440, 300, 2160, 0, 0, 0]),
      "cykling",
    );
    expect(c?.goal).toBe("medel");
    expect(c?.reason).toBe("41 min mellan trösklarna (effektzon 3–4)");
  });

  it("ett långpass med lite tid över CP blir inte högt", () => {
    // 4 h med 10 min över CP: under 6 % av passet.
    const c = classifyActivity(
      ride([4000, 9800, 400, 0, 200, 0, 0], 600),
      "cykling",
    );
    expect(c?.goal).toBe("lugn");
  });

  it("använder pulsen med lägre gräns när effekt saknas", () => {
    const c = classifyActivity(
      {
        movingS: 3600,
        elapsedS: 3600,
        powerZones: null,
        hrZones: zones([1200, 1500, 300, 240, 420]),
        aboveCriticalS: null,
      },
      "löpning",
    );
    expect(c?.goal).toBe("hög");
    expect(c?.reason).toBe("7 min i pulszon 5");
  });

  it("räknar tid över CS i löpning", () => {
    const c = classifyActivity(
      {
        movingS: 3000,
        elapsedS: 3000,
        powerZones: null,
        hrZones: null,
        aboveCriticalS: 900,
      },
      "löpning",
    );
    expect(c?.reason).toBe("15 min över CS");
  });

  it("klassar inte simning eller pass utan underlag", () => {
    expect(classifyActivity(ride([600, 600, 0, 0, 0]), "simning")).toBeNull();
    expect(
      classifyActivity(
        {
          movingS: 3600,
          elapsedS: 3600,
          powerZones: null,
          hrZones: null,
          aboveCriticalS: null,
        },
        "cykling",
      ),
    ).toBeNull();
  });
});

describe("effectiveGoal", () => {
  const automatic = {
    goal: "lugn" as const,
    reason: "huvudsakligen under LT1",
  };

  it("coachens klassning går före", () => {
    expect(
      effectiveGoal({ coach: "hög", summary: "medel", automatic }),
    ).toEqual({ goal: "hög", source: "coach", reason: null });
  });

  it("sedan AI-sammanfattningens, sist den automatiska", () => {
    expect(
      effectiveGoal({ coach: null, summary: "högt", automatic })?.source,
    ).toBe("sammanfattning");
    expect(effectiveGoal({ coach: null, summary: null, automatic })).toEqual({
      goal: "lugn",
      source: "automatisk",
      reason: "huvudsakligen under LT1",
    });
    expect(
      effectiveGoal({ coach: null, summary: null, automatic: null }),
    ).toBeNull();
  });
});
