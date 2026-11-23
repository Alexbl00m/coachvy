import { describe, expect, it } from "vitest";

import { blockTotals } from "../library";
import { CYCLING_ATLAS } from "./cycling";
import { RUNNING_ATLAS } from "./running";
import { SWIMMING_ATLAS } from "./swimming";
import { atlasRows, atlasStatements, SESSION_ATLAS } from "./seed";

const rows = atlasRows(CYCLING_ATLAS);
const runs = atlasRows(RUNNING_ATLAS);
const swims = atlasRows(SWIMMING_ATLAS);

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
  it("har atlasens 43 pass, kraftpasset, åtta proffs- och 70.3-pass och LSCT, med unika namn", () => {
    expect(rows).toHaveLength(53);
    expect(new Set(rows.map((r) => r.title)).size).toBe(53);
    const byZone = (zone: string) =>
      rows.filter((r) => r.intensity.startsWith(zone)).length;
    expect([byZone("Z1"), byZone("Z2"), byZone("Z4"), byZone("Z5")]).toEqual([
      3, 5, 6, 32,
    ]);
    // Tre tempopass, kraftpasset, vars huvuddel ligger i tempo, och 5 × 10 min.
    expect(byZone("Z3")).toBe(5);
    // Pogačars pass är kraft och sprint, inte en zon.
    expect(rows.filter((r) => r.intensity === "Kraft och sprint")).toHaveLength(
      1,
    );
    // LSCT styrs på puls och hör inte till någon zon.
    expect(rows.filter((r) => r.kind === "Test")).toHaveLength(1);
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
    for (const input of SESSION_ATLAS) {
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
    }
  });
});

describe("löppassen", () => {
  /** Högsta fart i passets egna steg, utan uppvärmning och stegringar. */
  const top = (blocks: Parameters<typeof blockTotals>[0]) =>
    Math.max(
      ...blocks.flatMap((b) =>
        (b.type === "steg" ? [b.step] : b.steps)
          .filter((s) => s.kind !== "uppvärmning" && s.label !== "stegring")
          .map((s) => s.high),
      ),
    );

  it("har 37 pass med unika namn, mot maratonfart", () => {
    expect(runs).toHaveLength(37);
    expect(new Set(runs.map((r) => r.title)).size).toBe(37);
    for (const row of runs) {
      expect(row.sport).toBe("löpning");
      expect(row.basis).toBe("MP");
      expect(row.levels.map((l) => l.key)).toEqual(["A", "B", "C"]);
    }
  });

  it("har mest på nivå A och minst på nivå C, i tid eller sträcka", () => {
    for (const row of runs) {
      const [a, b, c] = row.levels.map((l) => blockTotals(l.blocks));
      for (const [more, less] of [
        [a, b],
        [b, c],
      ]) {
        expect(more.seconds, row.title).toBeGreaterThanOrEqual(less.seconds);
        expect(more.metres, row.title).toBeGreaterThanOrEqual(less.metres);
        expect(
          more.seconds > less.seconds || more.metres > less.metres,
          row.title,
        ).toBe(true);
      }
    }
  });

  it("håller farten i zonen passet säger", () => {
    for (const row of runs) {
      const fastest = Math.max(...row.levels.map((l) => top(l.blocks)));
      if (row.intensity.startsWith("Z1"))
        expect(fastest, row.title).toBeLessThanOrEqual(0.83);
      if (row.intensity.startsWith("Z3"))
        expect(fastest, row.title).toBeLessThanOrEqual(1.025);
      if (row.intensity === "Z4 Tröskel") {
        expect(fastest, row.title).toBeGreaterThanOrEqual(1.01);
        expect(fastest, row.title).toBeLessThanOrEqual(1.065);
      }
      if (row.intensity.startsWith("Z5"))
        expect(fastest, row.title).toBeGreaterThanOrEqual(1.125);
    }
  });
});

describe("simpassen", () => {
  /**
   * Totaldistanserna ur simsystemets reviderade tabell, nivå 1–4, som här
   * heter D, C, B och A.
   */
  const METRES: Record<string, [number, number, number, number]> = {
    "Smooth Criminal – Base": [2700, 3100, 3300, 3300],
    "CSS Climber – Base": [2200, 2600, 2800, 2800],
    "Aerobic Builder – Base": [2600, 3000, 3400, 3800],
    "Threshold Tango – Base": [2600, 3000, 3200, 3000],
    "Red Mist – Base": [2200, 2500, 2800, 3100],
    "Power Flow – Base": [1800, 2000, 2200, 2400],
    "Long Distance – Base": [2500, 3000, 3500, 4000],
    "Open Water Groove – Base": [1800, 2000, 2200, 2400],
    "Smooth Criminal – Build": [3100, 3500, 3500, 3900],
    "CSS Climber – Build": [2600, 3000, 3200, 3400],
    "Aerobic Builder – Build": [3000, 3400, 3800, 4200],
    "Threshold Tango – Build": [2800, 3400, 3700, 4000],
    "Red Mist – Build": [2200, 2600, 3000, 3000],
    "Power Flow – Build": [2500, 2800, 3100, 3400],
    "Long Distance – Build": [2800, 3400, 4000, 4600],
    "Open Water Groove – Build": [2000, 2200, 2400, 2600],
    "Smooth Criminal – Race": [2700, 3100, 3300, 3500],
    "CSS Climber – Race": [2200, 2600, 2800, 3000],
    "Aerobic Builder – Race": [2600, 3000, 3400, 3800],
    "Threshold Tango – Race": [2200, 2600, 2800, 3000],
    "Red Mist – Race": [2200, 2600, 3000, 3400],
    "Power Flow – Race": [2200, 2500, 2800, 3100],
    "Long Distance – Race": [2200, 2800, 3400, 4000],
    "Open Water Groove – Race": [1800, 2000, 2200, 2400],
  };

  it("har de 24 varianterna, CSS-testet och passen för avlastning och toppning, mot CSS", () => {
    expect(swims).toHaveLength(28);
    expect(new Set(swims.map((r) => r.title)).size).toBe(28);
    for (const row of swims) {
      expect(row.sport).toBe("simning");
      expect(row.basis).toBe("CSS");
    }
    expect(swims.filter((r) => r.kind === "Test")).toHaveLength(1);
  });

  it("har simsystemets distanser på varje nivå, A–D", () => {
    for (const [title, [d, c, b, a]] of Object.entries(METRES)) {
      const row = swims.find((r) => r.title === title);
      expect(row, title).toBeDefined();
      expect(row!.levels.map((l) => l.key)).toEqual(["A", "B", "C", "D"]);
      expect(
        row!.levels.map((l) => blockTotals(l.blocks).metres),
        title,
      ).toEqual([a, b, c, d]);
    }
  });

  it("räknar testet, avlastningen och aktiveringen till sina längder", () => {
    const metres = (title: string) =>
      blockTotals(swims.find((r) => r.title === title)!.blocks).metres;
    expect(metres("CSS-test 400 + 200 m")).toBe(1500);
    expect(metres("Tävlingsfart – aktivering")).toBe(1800);
    expect(metres("Teknikaktivering")).toBe(1200);
    const recovery = swims.find(
      (r) => r.title === "Teknik och flyt – återhämtning",
    )!;
    expect(recovery.levels.map((l) => blockTotals(l.blocks).metres)).toEqual([
      2400, 2200, 2000, 1800,
    ]);
  });

  it("kräver aldrig fart under CSS i CSS Climber Build", () => {
    const row = swims.find((r) => r.title === "CSS Climber – Build")!;
    for (const level of row.levels) {
      const top = Math.max(
        ...level.blocks.flatMap((b) =>
          (b.type === "steg" ? [b.step] : b.steps).map((s) => s.high),
        ),
      );
      expect(top, level.key).toBeLessThanOrEqual(1);
    }
  });

  it("står Race-passen i Ironmanfart", () => {
    for (const row of swims.filter((r) => r.title.endsWith("– Race"))) {
      expect(row.structure, row.title).toContain("@IM");
    }
  });
});

describe("atlasStatements", () => {
  it("gör en insert per pass som hoppar över ett pass som redan finns", () => {
    const statements = atlasStatements(
      "'00000000-0000-0000-0000-000000000000'",
    );
    expect(statements).toHaveLength(118);
    expect(statements[0]).toContain("not exists");
    // Samma namn finns i båda grenarna, så grenen ingår i jämförelsen.
    expect(statements[0]).toContain("and s.sport = 'cykling'");
    expect(statements[0]).toContain("now() - interval '0 seconds'");
    expect(statements[88]).toContain("now() - interval '88 seconds'");
    // Atlasen delas med alla coacher, som förut.
    expect(statements[0]).toContain("insert into public.library_shares");
    expect(statements[0]).toContain("'coacher'");
  });

  it("dubblar apostrofer i texten", () => {
    const [statement] = atlasStatements("null", [
      { ...rows[0], title: "Alex's pass" },
    ]);
    expect(statement).toContain("'Alex''s pass'");
  });
});
