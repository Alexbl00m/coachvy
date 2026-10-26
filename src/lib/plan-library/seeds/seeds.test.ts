import { describe, expect, it } from "vitest";

import { checkSeed, LEVEL_KEYS, seedSql, weekHours } from "./build";
import { CYCLING_PLANS } from "./cycling";
import { RUNNING_PLANS } from "./running";

const ALL = [...CYCLING_PLANS, ...RUNNING_PLANS];

describe("de färdiga planerna", () => {
  it("har sju planer med var sitt fokus och unika adresser", () => {
    expect(CYCLING_PLANS).toHaveLength(7);
    expect(new Set(CYCLING_PLANS.map((p) => p.focus)).size).toBe(7);
    expect(new Set(CYCLING_PLANS.map((p) => p.slug)).size).toBe(7);
  });

  it("har unika adresser i alla planer", () => {
    expect(new Set(ALL.map((p) => p.slug)).size).toBe(ALL.length);
  });

  for (const plan of ALL) {
    it(`${plan.title} går igenom kontrollerna`, () => {
      expect(checkSeed(plan)).toEqual([]);
    });
  }

  it("gör SQL av alla planer", () => {
    for (const plan of ALL) {
      const sql = seedSql(plan, "'00000000-0000-0000-0000-000000000000'::uuid");
      expect(sql).toContain(plan.slug);
      expect(sql).toContain("'medlemmar'");
    }
  });

  it("har lättare avlastningsveckor än vanliga veckor", () => {
    for (const plan of ALL) {
      const weeks = plan.phases.flatMap((p) => p.weeks);
      const normal = weeks.filter((w) => w.kind === "normal").map(weekHours);
      // Övergången har bara lätta veckor, och inget att jämföra med.
      if (normal.length === 0) continue;
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
