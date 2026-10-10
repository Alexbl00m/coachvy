import { describe, expect, it } from "vitest";

import { parseStructure } from "@/lib/plan-library/structure";
import type { WorkoutBlock } from "@/lib/workouts/schema";

import {
  amountText,
  blockTotals,
  fromWorkout,
  toAdeptWorkout,
  validateLibraryInput,
  type LibraryInput,
} from "./library";

const base: LibraryInput = {
  title: "Tröskeldrag",
  sport: "löpning",
  kind: "Kvalitet",
  intensity: "Tröskel",
  purpose: "Höjer tröskeln.",
  description: "Ansträngt men hållbart.",
  progression: "Ett drag till varje vecka.",
  phases: ["uppbyggnad", "okänd"],
  basis: "MP",
  structure: "3 km @LO; 4x(2 km @HM-10K + 2 min @RK); 2 km @LO",
  shared: false,
};

const blocksOf = (text: string): WorkoutBlock[] => {
  const r = parseStructure(text);
  if (!r.ok) throw new Error(r.error);
  return r.blocks;
};

describe("validateLibraryInput", () => {
  it("tolkar raden och behåller bara kända faser", () => {
    const r = validateLibraryInput(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.phases).toEqual(["uppbyggnad"]);
    expect(r.value.blocks).toHaveLength(3);
  });

  it("kräver maratonfart som bas för zoner", () => {
    const r = validateLibraryInput({ ...base, basis: "CS" });
    expect(r).toEqual({
      ok: false,
      error: expect.stringContaining("Maratonfart"),
    });
  });

  it("säger vad som är fel i raden", () => {
    const r = validateLibraryInput({ ...base, structure: "3 km @XX" });
    expect(r.ok).toBe(false);
  });

  it("avvisar en bas som inte hör till grenen", () => {
    const r = validateLibraryInput({
      ...base,
      sport: "cykling",
      basis: "MP",
      structure: "20 min 65%",
    });
    expect(r.ok).toBe(false);
  });

  it("kräver namn och struktur", () => {
    expect(validateLibraryInput({ ...base, title: "  " }).ok).toBe(false);
    expect(validateLibraryInput({ ...base, structure: "" }).ok).toBe(false);
  });
});

describe("blockTotals och amountText", () => {
  it("summerar meter och sekunder var för sig", () => {
    const blocks = blocksOf("3 km @LO; 5x(1000 m @HM + 400 m @MT); 10 min @RK");
    expect(blockTotals(blocks)).toEqual({ seconds: 600, metres: 10000 });
    expect(amountText(blocks)).toBe("10 km + 10 min");
  });

  it("skriver timmar för långa pass i tid", () => {
    expect(amountText(blocksOf("15 min 65%; 3x(15 min 95% + 5 min 60%)"))).toBe(
      "1 h 15 min",
    );
  });
});

describe("toAdeptWorkout", () => {
  const pass = {
    title: "Tröskeldrag",
    sport: "löpning" as const,
    basis: "MP" as const,
    blocks: blocksOf("10 min @LO; 3x(2 km @HM + 2 min @RK)"),
    purpose: "Höjer tröskeln.",
    description: "Jämnt.",
    progression: "Ett drag till.",
  };

  it("räknar om zoner mot adeptens CS ur formuppskattningen", () => {
    const r = toAdeptWorkout(
      pass,
      { sport: "löpning", basis: "CS", reference: 4.0 },
      { MP: 3.6 },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.workout.basis).toBe("CS");
    // @HM är 1,0425 × MP = 3,753 m/s, alltså 93,8 % av CS 4,0.
    const rep = r.workout.blocks[1];
    expect(rep.type).toBe("repetition");
    if (rep.type !== "repetition") return;
    expect(rep.steps[0].low * 4.0).toBeCloseTo(1.0425 * 3.6, 2);
    expect(r.note).toContain("CS");
    expect(r.workout.rationale).toContain("Så byggs det på");
  });

  it("lämnar procenten orörda när basen är densamma", () => {
    const own = { ...pass, basis: "CS" as const, blocks: blocksOf("3x(5 min 95% + 1 min 60%)") };
    const r = toAdeptWorkout(own, { sport: "löpning", basis: "CS", reference: 4.2 });
    expect(r.ok && r.workout.blocks).toEqual(own.blocks);
    expect(r.ok && r.note).toBeNull();
  });

  it("vägrar fel gren och saknad formuppskattning", () => {
    expect(
      toAdeptWorkout(pass, { sport: "cykling", basis: "FTP", reference: 250 }).ok,
    ).toBe(false);
    const r = toAdeptWorkout(pass, { sport: "löpning", basis: "CS", reference: 4 }, {});
    expect(r).toEqual({ ok: false, error: expect.stringContaining("formuppskattning") });
  });

  it("vägrar när adepten saknar tröskel", () => {
    expect(
      toAdeptWorkout(pass, { sport: "löpning", basis: null, reference: null }, { MP: 3.6 }).ok,
    ).toBe(false);
  });
});

describe("fromWorkout", () => {
  it("skriver passbyggarens pass som en rad som går att läsa tillbaka", () => {
    const blocks = blocksOf("15 min 65%; 4x(8 min 95% + 2 min 60%); 10 min 60%");
    const input = fromWorkout({
      title: "Tröskel",
      sport: "cykling",
      summary: "Fyra drag.",
      rationale: "Tröskeln.",
      basis: "FTP",
      blocks,
    });
    expect(input.purpose).toBe("Tröskeln.");
    const again = validateLibraryInput(input);
    expect(again.ok && again.value.blocks).toEqual(blocks);
  });
});
