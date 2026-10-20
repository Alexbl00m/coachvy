import { describe, expect, it } from "vitest";

import {
  cleanEntries,
  entryText,
  estimatedMax,
  matchExercise,
  parseStrengthText,
  sessionsPerWeek,
  strengthProgress,
  strengthToPrompt,
  type StrengthEntry,
} from "./strength";

describe("parseStrengthText", () => {
  it("läser en kommentar som den skrivs i TrainingPeaks", () => {
    const rows = parseStrengthText(
      "FB 4x8 50 kg, RM 4x8 70 kg, BS 5x5 45  kg. Lats, armhävningar, vadlyft och Deadbugg",
    );
    expect(rows.map((r) => [r.name, r.sets, r.reps, r.weightKg])).toEqual([
      ["Frontböj", 4, 8, 50],
      ["Rumänsk marklyft", 4, 8, 70],
      ["Bulgarisk splitböj", 5, 5, 45],
      ["Latsdrag", null, null, null],
      ["Armhävningar", null, null, null],
      ["Vadpress", null, null, null],
      ["Dead bug", null, null, null],
    ]);
  });

  it("klarar decimaler, per ben, RPE och rader", () => {
    const rows = parseStrengthText(
      "Utfall bakåt 3×8/ben 12,5 kg @ RPE 6\nKnäböj 5x5 82.5 kg\nPallof-press 2x12",
    );
    expect(
      rows.map((r) => [r.key, r.sets, r.reps, r.weightKg, r.perSide]),
    ).toEqual([
      ["utfall", 3, 8, 12.5, true],
      ["knabo", 5, 5, 82.5, false],
      ["pallof", 2, 12, null, false],
    ]);
  });

  it("behåller en okänd övning med adeptens namn", () => {
    const [row] = parseStrengthText("kettlebell swing 3x15 16 kg");
    expect(row.key).toBe("egen:kettlebell swing");
    expect(row.name).toBe("Kettlebell swing");
  });
});

describe("matchExercise", () => {
  it("låter inte en kort förkortning träffa mitt i ett ord", () => {
    expect(matchExercise("armhävningar").key).toBe("armhav");
    expect(matchExercise("sittande rodd el. bandrodd").key).toBe("rodd");
  });
});

describe("cleanEntries", () => {
  it("låter namnet avgöra och kapar orimliga tal", () => {
    expect(
      cleanEntries([
        { key: "bulgarisk", name: "Knäböj", sets: 4, reps: 6, weightKg: 70 },
        { name: "  ", sets: 3 },
        { name: "Planka", sets: 99, reps: 1, weightKg: -5 },
      ]),
    ).toEqual([
      {
        key: "knabo",
        name: "Knäböj",
        sets: 4,
        reps: 6,
        weightKg: 70,
        perSide: false,
      },
      {
        key: "planka",
        name: "Planka",
        sets: null,
        reps: 1,
        weightKg: null,
        perSide: false,
      },
    ]);
  });
});

const entry = (
  key: string,
  name: string,
  sets: number,
  reps: number,
  weightKg: number | null,
): StrengthEntry => ({
  key,
  name,
  sets,
  reps,
  weightKg,
  perSide: false,
});

describe("progression", () => {
  const sessions = [
    {
      performed_on: "2026-08-31",
      exercises: [
        entry("frontbo", "Frontböj", 3, 10, 40),
        entry("deadbug", "Dead bug", 3, 8, null),
      ],
    },
    {
      performed_on: "2026-09-28",
      exercises: [entry("frontbo", "Frontböj", 4, 8, 45)],
    },
    {
      performed_on: "2026-10-19",
      exercises: [
        entry("frontbo", "Frontböj", 4, 8, 50),
        entry("rumansk", "Rumänsk marklyft", 4, 8, 70),
      ],
    },
  ];

  it("räknar skattat 1RM och förändringen per övning", () => {
    expect(estimatedMax(50, 8)).toBeCloseTo(63.33, 2);
    const [front] = strengthProgress(sessions, "2026-10-20");
    expect(front.name).toBe("Frontböj");
    expect(front.points).toHaveLength(3);
    // 40 kg × 10 ≈ 53,3 → 50 kg × 8 ≈ 63,3
    expect(front.changePct).toBeCloseTo(18.75, 1);
    expect(entryText(front.latest)).toBe("4×8 · 50 kg");
  });

  it("räknar pass per vecka", () => {
    expect(sessionsPerWeek(sessions, "2026-10-20", 8)).toEqual([
      1, 0, 0, 0, 1, 0, 0, 1,
    ]);
  });

  it("skriver styrkan till AI-coachen", () => {
    const text = strengthToPrompt(sessions, "2026-10-20");
    expect(text).toContain("3 pass de senaste åtta veckorna");
    expect(text).toContain(
      "Frontböj: 4×8 · 50 kg (19 okt), från 3×10 · 40 kg (31 aug), skattat 1RM +19 %",
    );
    expect(text).toContain("Utan vikt: Dead bug");
    expect(strengthToPrompt([], "2026-10-20")).toBeNull();
  });
});
