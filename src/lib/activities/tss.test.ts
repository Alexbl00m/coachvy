import { describe, expect, it } from "vitest";

import { activityTss, thresholdsOn, type TssInput } from "./tss";

const base: TssInput = {
  sport: "löpning",
  moving_s: 3600,
  duration_s: 3700,
  distance_m: 12000,
  tss: null,
  intensity_factor: null,
  avg_speed: 12,
  avg_hr: null,
  hr_zones: null,
};
const none = { runSpeed: null, css: null, lthr: null };

describe("TSS för genomförda pass", () => {
  it("tar TSS ur filen när passet hade effekt", () => {
    expect(
      activityTss(
        { ...base, sport: "cykling", tss: 84, intensity_factor: 0.8 },
        none,
      ),
    ).toEqual({ tss: 84, kind: "TSS", intensityFactor: 0.8 });
  });

  it("räknar rTSS på normaliserad fart, annars snittfarten", () => {
    const t = { ...none, runSpeed: 15 / 3.6 };
    const avg = activityTss(base, t)!;
    expect(avg.kind).toBe("rTSS");
    expect(avg.intensityFactor).toBeCloseTo(0.8, 6);
    expect(avg.tss).toBeCloseTo(64, 6);
    expect(
      activityTss({ ...base, normalized_speed: 13.5 }, t)!.tss,
    ).toBeCloseTo(81, 6);
  });

  it("räknar sTSS med IF i kubik", () => {
    const swim = activityTss(
      {
        ...base,
        sport: "simning",
        moving_s: 1800,
        distance_m: 2000,
        avg_speed: null,
      },
      { ...none, css: 1.25 },
    )!;
    const ifactor = 2000 / 1800 / 1.25;
    expect(swim.kind).toBe("sTSS");
    expect(swim.tss).toBeCloseTo(0.5 * ifactor ** 3 * 100, 6);
  });

  it("räknar hrTSS ur tiden i pulszoner, annars snittpulsen", () => {
    const t = { ...none, lthr: 170 };
    const zones = activityTss(
      {
        ...base,
        sport: "cykling",
        avg_speed: null,
        hr_zones: [
          { zone: "Z2", seconds: 3600 },
          { zone: "Z4", seconds: 1800 },
        ],
      },
      t,
    )!;
    expect(zones.kind).toBe("hrTSS");
    expect(zones.tss).toBeCloseTo(0.65 ** 2 * 100 + 0.5 * 0.95 ** 2 * 100, 6);
    // 150/170 = 0,88: Z2.
    const avg = activityTss(
      { ...base, sport: "annat", avg_speed: null, avg_hr: 150 },
      t,
    )!;
    expect(avg.tss).toBeCloseTo(0.65 ** 2 * 100, 6);
  });

  it("ger null utan tid eller tröskel", () => {
    expect(activityTss(base, none)).toBeNull();
    expect(
      activityTss(
        { ...base, moving_s: null, duration_s: null },
        { ...none, runSpeed: 4 },
      ),
    ).toBeNull();
  });
});

describe("trösklarna en dag", () => {
  const candidates = [
    {
      performedOn: "2024-05-15",
      sport: "löpning",
      label: "CS",
      metrics: [{ key: "CS", value: 15.3, unit: "km/h" }],
    },
    {
      performedOn: "2026-07-15",
      sport: "löpning",
      label: "Laktat",
      metrics: [{ key: "LT2", value: 15.38, unit: "km/h" }],
    },
    {
      performedOn: "2024-05-15",
      sport: "löpning",
      label: "5 km",
      metrics: [{ key: "LTHR", value: 162.5, unit: "slag/min" }],
    },
    {
      performedOn: "2025-01-10",
      sport: "simning",
      label: "CSS",
      metrics: [{ key: "CS", value: 1.3, unit: "m/s" }],
    },
  ];
  it("tar det senaste före dagen: CS nedräknad, sedan LT2", () => {
    expect(thresholdsOn(candidates, "2025-06-01").runSpeed).toBeCloseTo(
      (15.3 / 3.6) * 0.95,
      6,
    );
    expect(thresholdsOn(candidates, "2026-11-01").runSpeed).toBeCloseTo(
      15.38 / 3.6,
      6,
    );
    expect(thresholdsOn(candidates, "2026-11-01").css).toBe(1.3);
    expect(thresholdsOn(candidates, "2026-11-01").lthr).toBe(162.5);
  });
});
