import { describe, expect, it } from "vitest";

import { assessFit, TEMPLATES, verdictFor } from "./templates";

const road = TEMPLATES["landsväg"].bands;
const legs = { thighMm: 430, shankMm: 440 };
const values = (knee: number | null) => ({
  knee,
  trunk: 45,
  elbow: 20,
  shoulder: 88,
  hip: 70,
});

describe("verdictFor", () => {
  it("grönt i bandet, gult inom 2,5°, rött utanför", () => {
    expect(verdictFor(35, road.knee)).toBe("grön");
    expect(verdictFor(42, road.knee)).toBe("gul");
    expect(verdictFor(42.6, road.knee)).toBe("röd");
    expect(verdictFor(27.6, road.knee)).toBe("gul");
    expect(verdictFor(27.4, road.knee)).toBe("röd");
  });
});

describe("assessFit", () => {
  it("färg och text följer samma gräns: inget sadelförslag utan rött", () => {
    for (const knee of [31, 39.9, 41, 42.4, 28]) {
      const a = assessFit(values(knee), road, legs);
      expect(a.knee.verdict).not.toBe("röd");
      expect(a.saddleMm).toBeNull();
      expect(a.sentence).not.toMatch(/Höj|Sänk/);
    }
  });

  it("räknar sadelflytten ur cosinussatsen när knät är rött", () => {
    const a = assessFit(values(46), road, legs);
    expect(a.knee.verdict).toBe("röd");
    expect(a.knee.label).toBe("sadeln för låg");
    // Från 46° till 35°: drygt två mm per grad, uppåt.
    expect(a.saddleMm).toBeGreaterThan(22);
    expect(a.saddleMm).toBeLessThan(30);
    expect(a.sentence).toMatch(/^Höj sadeln cirka \d+ mm/);
    expect(a.mmPerDegree).toBeCloseTo(2.6, 0);
  });

  it("sänker sadeln när benet är för sträckt", () => {
    const a = assessFit(values(24), road, legs);
    expect(a.knee.label).toBe("sadeln för hög");
    expect(a.saddleMm).toBeLessThan(0);
    expect(a.sentence).toMatch(/^Sänk/);
  });

  it("säger rakt ut att sadeln passar", () => {
    expect(assessFit(values(35), road, legs).sentence).toMatch(
      /^Sadelhöjden passar/,
    );
  });

  it("bedömer inte axel och höft", () => {
    const a = assessFit(values(35), road, legs);
    expect(a.shoulder.verdict).toBeNull();
    expect(a.shoulder.label).toBe("ingen bedömning");
    expect(a.hip.verdict).toBeNull();
  });

  it("säger när knät inte gick att mäta", () => {
    const a = assessFit(values(null), road, legs);
    expect(a.knee.label).toBe("inte mätbart");
    expect(a.sentence).toContain("gick inte att mäta");
  });

  it("räknar med standardben när inga egna finns, och säger det", () => {
    expect(
      assessFit(values(46), road, { thighMm: null, shankMm: null }).legSource,
    ).toBe("standard");
  });
});
