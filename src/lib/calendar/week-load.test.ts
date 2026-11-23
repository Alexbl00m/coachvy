import { describe, expect, it } from "vitest";

import type { CalendarWorkout } from "./queries";
import { weekLoad } from "./week-load";

const workout = (
  date: string,
  extra: Partial<CalendarWorkout>,
): CalendarWorkout => ({
  id: date,
  adeptId: "astrid",
  adeptName: "Astrid",
  date,
  title: "Pass",
  sport: "cykling",
  duration: null,
  summary: null,
  profile: [],
  ...extra,
});

const load = (tss: number, seconds: number, kj: number | null = null) => ({
  seconds,
  tss,
  intensityFactor: 0.8,
  kind: "TSS" as const,
  normalizedPower: null,
  kj,
  metres: null,
  partial: false,
});

describe("veckans belastning", () => {
  it("summerar plan och genomfört för adepten i veckan", () => {
    const week = weekLoad(
      "2026-11-16",
      [
        workout("2026-11-17", { load: load(90, 3600, 800), goal: "hög" }),
        workout("2026-11-18", { load: load(60, 5400, 1000), goal: "lugn" }),
        // Styrka: tid men ingen TSS.
        workout("2026-11-18", { sport: "annat", seconds: 2700 }),
        // Annan vecka och annan adept räknas inte.
        workout("2026-11-23", { load: load(50, 3600), goal: "lugn" }),
        workout("2026-11-19", { adeptId: "love", load: load(50, 3600) }),
      ],
      [
        {
          adept_id: "astrid",
          performed_on: "2026-11-17",
          sport: "cykling",
          moving_s: 3500,
          duration_s: 3700,
          distance_m: 32000,
          work_kj: 780,
          load: { tss: 84, kind: "TSS", intensityFactor: 0.8 },
        },
        {
          adept_id: "astrid",
          performed_on: "2026-11-19",
          sport: "löpning",
          moving_s: null,
          duration_s: 2400,
          distance_m: 8000,
          work_kj: null,
          load: null,
        },
      ],
      "astrid",
    );
    expect(week.planned).toEqual({
      sessions: 3,
      seconds: 11700,
      tss: 150,
      withoutTss: 1,
      kj: 1800,
      metres: {},
    });
    expect(week.done).toEqual({
      sessions: 2,
      seconds: 5900,
      tss: 84,
      withoutTss: 1,
      kj: 780,
      metres: { löpning: 8000 },
    });
    expect(week.goals).toEqual({ lugn: 1, medel: 0, hög: 1, total: 2 });
  });
});
