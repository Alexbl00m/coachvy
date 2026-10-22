import { describe, expect, it } from "vitest";

import type { WorkoutBlock, WorkoutStep } from "./schema";
import { profileSeconds, workText } from "./summary";

const step = (
  kind: WorkoutStep["kind"],
  low: number,
  seconds: number | null,
  distanceM: number | null = null,
): WorkoutStep => ({
  kind,
  label: "",
  durationSeconds: seconds,
  distanceM,
  low,
  high: low,
});

describe("workText", () => {
  it("skriver repetitionens arbete som 3×5 min", () => {
    const blocks: WorkoutBlock[] = [
      { type: "steg", step: step("uppvärmning", 0.75, null, 2000) },
      {
        type: "repetition",
        times: 3,
        steps: [step("intervall", 1.05, 300), step("vila", 0.8, 120)],
      },
    ];
    expect(workText(blocks)).toBe("3×5 min");
  });

  it("tar det hårdaste steget när inget är märkt som intervall", () => {
    const blocks: WorkoutBlock[] = [
      {
        type: "repetition",
        times: 8,
        steps: [step("vila", 0.6, null, 200), step("distans", 1.1, null, 400)],
      },
    ];
    expect(workText(blocks)).toBe("8×400 m");
  });

  it("är null för ett pass utan repetition", () => {
    expect(
      workText([{ type: "steg", step: step("distans", 0.75, 2700) }]),
    ).toBeNull();
  });
});

describe("profileSeconds", () => {
  it("summerar blockens tid", () => {
    expect(
      profileSeconds([
        { seconds: 600, percent: 60, zone: 1 },
        { seconds: 300, percent: 100, zone: 4 },
      ]),
    ).toBe(900);
  });
});
