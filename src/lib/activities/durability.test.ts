import { describe, expect, it } from "vitest";

import {
  durabilityFromSeries,
  durabilityProfile,
  durabilityReading,
  levelsFor,
  type DurabilitySource,
} from "./durability";

/** En sekundserie: effekten per sekund ur en funktion av tiden. */
const ride = (seconds: number, power: (s: number) => number) => {
  const t = Array.from({ length: seconds + 1 }, (_, i) => i);
  return { t, power: t.map(power) };
};

describe("durabilityFromSeries", () => {
  it("räknar bästa efter utfört arbete, inte bästa i hela passet", () => {
    // 200 W i två timmar (1 440 kJ), sedan 20 min på 300 W.
    const { t, power } = ride(7200 + 1200, (s) => (s < 7200 ? 200 : 300));
    const d = durabilityFromSeries(t, power, "kJ")!;
    const at = (after: number, span: number) =>
      d.points.find((p) => p[0] === after && p[1] === span)?.[2];
    // Utvilad är det bästa i passet: de avslutande 20 minuterna.
    expect(at(0, 1200)).toBeCloseTo(300);
    // Efter 1 250 kJ börjar fortfarande samma insats.
    expect(at(1250, 1200)).toBeCloseTo(300);
    // Efter 1 500 kJ har 20-minutersinsatsen redan börjat: den räknas inte.
    expect(at(1500, 1200)).toBeUndefined();
    expect(at(1500, 300)).toBeCloseTo(300);
  });

  it("visar tappet när den sena insatsen är svagare", () => {
    // 5 min på 400 W först, en timme på 200 W, sedan 5 min på 340 W.
    const { t, power } = ride(600 + 3600, (s) =>
      s < 300 ? 400 : s < 3900 ? 200 : 340,
    );
    const d = durabilityFromSeries(t, power, "kJ")!;
    const at = (after: number) =>
      d.points.find((p) => p[0] === after && p[1] === 300)?.[2];
    expect(at(0)).toBeCloseTo(400);
    expect(at(500)).toBeCloseTo(340);
  });

  it("räknar löpningen i minuter i rörelse och tål en nedsamplad serie", () => {
    // Var tionde sekund i 70 min: 3 m/s, med 10 min stopp i mitten.
    const t = Array.from({ length: 421 }, (_, i) => i * 10);
    const speed = t.map((s) => (s >= 1800 && s < 2400 ? 0 : 3));
    const d = durabilityFromSeries(t, speed, "min")!;
    const steps = [...new Set(d.points.map((p) => p[0]))];
    // 60 minuter i rörelse: steg till och med 45 (stoppet räknas inte).
    expect(steps).toContain(45);
    expect(steps).not.toContain(60);
    expect(d.points.find((p) => p[0] === 0 && p[1] === 300)?.[2]).toBeCloseTo(
      3,
    );
  });

  it("ger null utan serie", () => {
    expect(durabilityFromSeries([0], [200], "kJ")).toBeNull();
  });
});

describe("levelsFor", () => {
  it("räknar kJ/kg om till steget på eller över nivån", () => {
    const { unit, levels } = levelsFor("kJ", 75);
    expect(unit).toBe("kJ/kg");
    // 20 kJ/kg × 75 kg = 1 500 kJ; 10 kJ/kg = 750 kJ.
    expect(levels.find((l) => l.level === 20)?.after).toBe(1500);
    expect(levels.find((l) => l.level === 10)?.after).toBe(750);
    // 30 kJ/kg = 2 250 kJ.
    expect(levels.find((l) => l.level === 30)?.after).toBe(2250);
  });

  it("visar kJ utan vikt", () => {
    expect(levelsFor("kJ", null).unit).toBe("kJ");
  });
});

describe("durabilityProfile och durabilityReading", () => {
  const source = (
    id: string,
    date: string,
    points: [number, number, number][],
  ): DurabilitySource => ({
    id,
    performed_on: date,
    durability: { axis: "kJ", points },
  });

  const now = durabilityProfile(
    [
      source("a", "2026-10-01", [
        [0, 1200, 300],
        [750, 1200, 290],
        [1500, 1200, 270],
        [0, 300, 360],
        [1500, 300, 340],
      ]),
      source("b", "2026-10-08", [
        [0, 1200, 310],
        [750, 1200, 280],
      ]),
    ],
    "kJ",
    75,
  );

  it("tar det bästa på varje nivå och räknar passen som nådde den", () => {
    const level10 = now.levels.find((l) => l.level === 10)!;
    expect(level10.best[1200]?.value).toBe(290);
    expect(level10.support).toBe(2);
    expect(now.levels[0].best[1200]?.id).toBe("b");
    expect(now.levels.find((l) => l.level === 20)!.support).toBe(1);
  });

  it("säger tappet, var det passerar 5 % och hur tunt underlaget är", () => {
    const text = durabilityReading(now, null, (v) => `${v} W`).join(" ");
    expect(text).toContain(
      "Bästa 20 min: 310 W utvilad, 270 W efter 20 kJ/kg (87 %)",
    );
    expect(text).toContain("tappet passerar 5 % efter 10 kJ/kg");
    expect(text).toContain("Bara ett pass nådde 20 kJ/kg.");
  });

  it("jämför med perioden före", () => {
    const before = durabilityProfile(
      [
        source("c", "2026-07-01", [
          [0, 1200, 300],
          [1500, 1200, 240],
        ]),
      ],
      "kJ",
      75,
    );
    const text = durabilityReading(now, before, (v) => `${v} W`).join(" ");
    expect(text).toContain(
      "Efter 20 kJ/kg håller 20 min bättre än perioden före: 87 % mot 80 %",
    );
  });
});
