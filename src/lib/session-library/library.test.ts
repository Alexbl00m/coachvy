import { describe, expect, it } from "vitest";

import { parseStructure } from "@/lib/plan-library/structure";
import type { WorkoutBlock } from "@/lib/workouts/schema";

import {
  amountText,
  blockTotals,
  educationText,
  fromWorkout,
  levelOf,
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
  adaptations: "",
  fueling: "",
  timing: "",
  phases: ["uppbyggnad", "okänd"],
  basis: "MP",
  structure: "3 km @LO; 4x(2 km @HM-10K + 2 min @RK); 2 km @LO",
  levels: [],
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

describe("nivåer", () => {
  const cycling: LibraryInput = {
    ...base,
    sport: "cykling",
    basis: "FTP",
    structure: "",
    levels: [
      {
        key: "A",
        structure: "15 min 60%; 5x(4 min 115% + 3 min 50%); 10 min 50%",
      },
      {
        key: "B",
        structure: "15 min 60%; 4x(4 min 115% + 3 min 50%); 10 min 50%",
      },
      {
        key: "C",
        structure: "15 min 60%; 3x(4 min 115% + 3 min 50%); 10 min 50%",
      },
    ],
  };

  it("tolkar varje nivå och gör nivå B till passets rad", () => {
    const r = validateLibraryInput(cycling);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.levels.map((l) => l.key)).toEqual(["A", "B", "C"]);
    expect(r.value.structure).toBe(cycling.levels[1].structure);
    const rep = r.value.levels[0].blocks[1];
    expect(rep.type === "repetition" && rep.times).toBe(5);
  });

  it("kräver alla tre nivåerna och säger vilken som är fel", () => {
    const missing = validateLibraryInput({
      ...cycling,
      levels: cycling.levels.slice(0, 2),
    });
    expect(missing).toEqual({
      ok: false,
      error: expect.stringContaining("nivå C"),
    });
    const broken = validateLibraryInput({
      ...cycling,
      levels: [
        cycling.levels[0],
        { key: "B", structure: "4x(4 min)" },
        cycling.levels[2],
      ],
    });
    expect(broken).toEqual({
      ok: false,
      error: expect.stringContaining("nivå B"),
    });
  });

  it("ger adepten passet på vald nivå, och nivå B annars", () => {
    const r = validateLibraryInput(cycling);
    if (!r.ok) throw new Error(r.error);
    const pass = {
      ...r.value,
      title: "VO₂max 4 min",
      sport: "cykling" as const,
    };
    const target = {
      sport: "cykling" as const,
      basis: "FTP" as const,
      reference: 300,
    };
    const a = toAdeptWorkout(pass, target, {}, "A");
    const plain = toAdeptWorkout(pass, target);
    const times = (w: typeof a) =>
      w.ok && w.workout.blocks[1].type === "repetition"
        ? w.workout.blocks[1].times
        : null;
    expect(times(a)).toBe(5);
    expect(times(plain)).toBe(4);
    expect(a.ok && a.workout.summary).toContain("nivå A");
    expect(levelOf(pass, "C").structure).toBe(cycling.levels[2].structure);
  });
});

describe("educationText", () => {
  it("skriver en rubrik per ifyllt stycke, i läsordning", () => {
    const text = educationText({
      purpose: "Höjer VO₂max.",
      description: "Jämnt tryck.",
      adaptations: "",
      fueling: "60 g kolhydrater i timmen.",
      timing: "",
      progression: "Ett drag till.",
    });
    expect(text).toBe(
      "Syfte\nHöjer VO₂max.\n\nUtförande\nJämnt tryck.\n\nEnergi\n60 g kolhydrater i timmen.\n\nSå byggs det på\nEtt drag till.",
    );
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
    kind: "Kvalitet",
    intensity: "Tröskel",
    basis: "MP" as const,
    structure: "10 min @LO; 3x(2 km @HM + 2 min @RK)",
    blocks: blocksOf("10 min @LO; 3x(2 km @HM + 2 min @RK)"),
    levels: [],
    purpose: "Höjer tröskeln.",
    description: "Jämnt.",
    progression: "Ett drag till.",
    adaptations: "",
    fueling: "",
    timing: "",
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
    const own = {
      ...pass,
      basis: "CS" as const,
      blocks: blocksOf("3x(5 min 95% + 1 min 60%)"),
    };
    const r = toAdeptWorkout(own, {
      sport: "löpning",
      basis: "CS",
      reference: 4.2,
    });
    expect(r.ok && r.workout.blocks).toEqual(own.blocks);
    expect(r.ok && r.note).toBeNull();
  });

  it("vägrar fel gren och saknad formuppskattning", () => {
    expect(
      toAdeptWorkout(pass, { sport: "cykling", basis: "FTP", reference: 250 })
        .ok,
    ).toBe(false);
    const r = toAdeptWorkout(
      pass,
      { sport: "löpning", basis: "CS", reference: 4 },
      {},
    );
    expect(r).toEqual({
      ok: false,
      error: expect.stringContaining("formuppskattning"),
    });
  });

  it("vägrar när adepten saknar tröskel", () => {
    expect(
      toAdeptWorkout(
        pass,
        { sport: "löpning", basis: null, reference: null },
        { MP: 3.6 },
      ).ok,
    ).toBe(false);
  });
});

describe("fromWorkout", () => {
  it("skriver passbyggarens pass som en rad som går att läsa tillbaka", () => {
    const blocks = blocksOf(
      "15 min 65%; 4x(8 min 95% + 2 min 60%); 10 min 60%",
    );
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
