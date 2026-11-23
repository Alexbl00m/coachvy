import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { sprintLactateVlamax } from "@/lib/metabolic";
import { vlamaxFromSprintLactate } from "./lactate";

describe("VLamax ur sprintlaktat i kalkylen", () => {
  const sprint = (durationSec: number) => ({
    bodyMass: 75,
    bodyFatPct: 13,
    sex: "male" as const,
    sprint: { durationSec, power: 900 },
    efforts: [],
  });

  it("räknar som den kalibrerade modellen", () => {
    for (const [peak, rest, seconds] of [
      [8.8, null, 20],
      [10, 1.5, 15],
      [6, 0.8, 30],
    ] as const) {
      expect(vlamaxFromSprintLactate(peak, rest, seconds)).toBeCloseTo(
        sprintLactateVlamax({ ...sprint(seconds), sprintLactate: { peak, rest } })!,
        10,
      );
    }
  });

  it("avvisar värden som inte går att räkna på", () => {
    expect(vlamaxFromSprintLactate(1.5, null, 20)).toBeNull();
    expect(vlamaxFromSprintLactate(40, null, 20)).toBeNull();
    expect(vlamaxFromSprintLactate(5, 6, 20)).toBeNull();
    expect(vlamaxFromSprintLactate(8, null, 4)).toBeNull();
  });
});
