import { describe, expect, it } from "vitest";

import { blockTotals } from "../library";
import { CYCLING_ATLAS } from "./cycling";
import { atlasRows, atlasStatements } from "./seed";

const rows = atlasRows();

/** Passets tid i sekunder; cykelpassen anges alltid i tid. */
const seconds = (blocks: Parameters<typeof blockTotals>[0]) =>
  blockTotals(blocks).seconds;

/** Högsta mål i passet, som andel av FTP. */
const peak = (blocks: Parameters<typeof blockTotals>[0]) =>
  Math.max(
    ...blocks.flatMap((b) =>
      (b.type === "steg" ? [b.step] : b.steps).map((s) => s.high),
    ),
  );

describe("cykelatlasen", () => {
  it("har atlasens 43 pass och kraftpasset, med unika namn", () => {
    expect(rows).toHaveLength(44);
    expect(new Set(rows.map((r) => r.title)).size).toBe(44);
    const byZone = (zone: string) =>
      rows.filter((r) => r.intensity.startsWith(zone)).length;
    expect([byZone("Z1"), byZone("Z2"), byZone("Z4"), byZone("Z5")]).toEqual([
      3, 3, 4, 30,
    ]);
    // Tre tempopass och kraftpasset, vars huvuddel ligger i tempo.
    expect(byZone("Z3")).toBe(4);
  });

  it("tolkar alla nivåer, i tid och mot FTP", () => {
    for (const row of rows) {
      expect(row.basis).toBe("FTP");
      expect(row.levels.map((l) => l.key)).toEqual(["A", "B", "C"]);
      for (const level of row.levels) {
        expect(blockTotals(level.blocks).metres, row.title).toBe(0);
      }
    }
  });

  it("har mest arbete på nivå A och minst på nivå C", () => {
    for (const row of rows) {
      const [a, b, c] = row.levels.map((l) => seconds(l.blocks));
      expect(a, row.title).toBeGreaterThan(b);
      expect(b, row.title).toBeGreaterThan(c);
    }
  });

  it("håller intensiteten i zonen passet säger", () => {
    for (const row of rows) {
      const top = Math.max(...row.levels.map((l) => peak(l.blocks)));
      if (row.intensity.startsWith("Z1"))
        expect(top, row.title).toBeLessThanOrEqual(0.55);
      if (row.intensity.startsWith("Z2"))
        expect(top, row.title).toBeLessThanOrEqual(0.75);
      if (row.intensity.startsWith("Z4"))
        expect(top, row.title).toBeGreaterThanOrEqual(0.9);
      if (row.intensity.startsWith("Z5"))
        expect(top, row.title).toBeGreaterThan(1);
    }
  });

  it("förklarar varje pass för den som tränar", () => {
    for (const input of CYCLING_ATLAS) {
      for (const field of [
        "purpose",
        "description",
        "adaptations",
        "fueling",
        "timing",
        "progression",
      ] as const) {
        expect(
          input[field].trim().length,
          `${input.title}: ${field}`,
        ).toBeGreaterThan(40);
      }
      expect(input.phases.length, input.title).toBeGreaterThan(0);
      expect(input.shared).toBe(true);
    }
  });
});

describe("atlasStatements", () => {
  it("gör en insert per pass som hoppar över ett pass som redan finns", () => {
    const statements = atlasStatements(
      "'00000000-0000-0000-0000-000000000000'",
    );
    expect(statements).toHaveLength(44);
    expect(statements[0]).toContain("not exists");
    expect(statements[0]).toContain("now() - interval '0 seconds'");
    expect(statements[43]).toContain("now() - interval '43 seconds'");
  });

  it("dubblar apostrofer i texten", () => {
    const [statement] = atlasStatements("null", [
      { ...rows[0], title: "Alex's pass" },
    ]);
    expect(statement).toContain("'Alex''s pass'");
  });
});
