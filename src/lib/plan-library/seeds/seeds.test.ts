import { describe, expect, it } from "vitest";

import { checkSeed, LEVEL_KEYS, seedSql, weekHours } from "./build";
import { CYCLING_PLANS } from "./cycling";

describe("cykelplanerna", () => {
  it("har sju planer med var sitt fokus och unika adresser", () => {
    expect(CYCLING_PLANS).toHaveLength(7);
    expect(new Set(CYCLING_PLANS.map((p) => p.focus)).size).toBe(7);
    expect(new Set(CYCLING_PLANS.map((p) => p.slug)).size).toBe(7);
  });

  for (const plan of CYCLING_PLANS) {
    it(`${plan.title} går igenom kontrollerna`, () => {
      expect(checkSeed(plan)).toEqual([]);
    });
  }

  it("gör SQL av alla planer", () => {
    for (const plan of CYCLING_PLANS) {
      const sql = seedSql(plan, "'00000000-0000-0000-0000-000000000000'::uuid");
      expect(sql).toContain(plan.slug);
      expect(sql).toContain("'medlemmar'");
    }
  });

  it("har lättare avlastningsveckor än vanliga veckor", () => {
    for (const plan of CYCLING_PLANS) {
      const weeks = plan.phases.flatMap((p) => p.weeks);
      const normal = weeks.filter((w) => w.kind === "normal").map(weekHours);
      for (const w of weeks.filter((x) => x.kind === "avlastning")) {
        const h = weekHours(w);
        for (const k of LEVEL_KEYS) {
          const avg = normal.reduce((s, n) => s + n[k], 0) / normal.length;
          expect(h[k]).toBeLessThan(avg * 0.8);
        }
      }
    }
  });
});
