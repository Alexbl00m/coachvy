import { describe, expect, it } from "vitest";

import type { WorkoutBlock, WorkoutStep } from "@/lib/workouts/schema";

import {
  blockDistribution,
  distributionNotes,
  doneDistribution,
  mainZone,
  phaseTarget,
  raceDemand,
  sessionGoal,
} from "./distribution";
import { seasonToPrompt } from "./season";

const step = (
  kind: WorkoutStep["kind"],
  seconds: number | null,
  low: number,
  high = low,
  distanceM: number | null = null,
): WorkoutStep => ({
  kind,
  label: "",
  durationSeconds: seconds,
  distanceM,
  low,
  high,
});
const single = (s: WorkoutStep): WorkoutBlock => ({ type: "steg", step: s });
const reps = (times: number, steps: WorkoutStep[]): WorkoutBlock => ({
  type: "repetition",
  times,
  steps,
});

describe("sessionGoal", () => {
  it("räknar ett VO2max-pass som högt trots mest lugn tid", () => {
    const blocks = [
      single(step("uppvärmning", 1200, 0.6)),
      reps(5, [step("intervall", 240, 1.15), step("vila", 180, 0.5)]),
      single(step("distans", 3600, 0.65)),
      single(step("nedvarvning", 600, 0.5)),
    ];
    expect(sessionGoal({ basis: "FTP", blocks }, 300)).toBe("hög");
  });

  it("räknar tröskelintervaller som medel", () => {
    const blocks = [
      single(step("uppvärmning", 900, 0.6)),
      reps(3, [step("intervall", 720, 0.98), step("vila", 240, 0.55)]),
    ];
    expect(sessionGoal({ basis: "FTP", blocks }, 300)).toBe("medel");
  });

  it("låter stegringar i uppvärmningen vara – distanspasset är lugnt", () => {
    const blocks = [
      reps(4, [step("uppvärmning", 20, 1.4), step("uppvärmning", 40, 0.6)]),
      single(step("distans", 4800, 0.7)),
    ];
    expect(sessionGoal({ basis: "FTP", blocks }, 300)).toBe("lugn");
  });

  it("räknar stegringar efter distansen som ett lugnt pass, backsprinter som högt", () => {
    const strides = [
      single(step("distans", 2400, 0.78)),
      reps(6, [step("intervall", 20, 1.22), step("vila", 40, 0.8)]),
    ];
    expect(sessionGoal({ basis: "CS", blocks: strides }, 4)).toBe("lugn");
    const hills = [
      single(step("uppvärmning", 900, 0.8)),
      reps(8, [step("intervall", 10, 1.3), step("vila", 120, 0.7)]),
      single(step("nedvarvning", 600, 0.8)),
    ];
    expect(sessionGoal({ basis: "CS", blocks: hills }, 4)).toBe("hög");
  });

  it("räknar ett långpass i maratonfart på distanssteg i meter", () => {
    // Löpning mot maratonfart: 3 km lugnt och 15 km i 98 % av MP.
    const blocks = [
      single(step("distans", null, 0.85, 0.85, 3000)),
      single(step("distans", null, 0.98, 0.98, 15000)),
    ];
    expect(sessionGoal({ basis: "MP", blocks }, 3.9)).toBe("medel");
  });

  it("ger null för ett pass utan huvuddel", () => {
    const blocks = [single(step("uppvärmning", 600, 0.6))];
    expect(sessionGoal({ basis: "FTP", blocks }, 300)).toBeNull();
  });
});

describe("raceDemand", () => {
  it("känner igen långa, mellan och korta lopp", () => {
    expect(
      raceDemand({ sport: "triathlon", distance: "70.3", name: "Jönköping" }),
    ).toBe("lång");
    expect(
      raceDemand({
        sport: "löpning",
        distance: "21,1 km",
        name: "Göteborgsvarvet",
      }),
    ).toBe("lång");
    expect(
      raceDemand({
        sport: "triathlon",
        distance: "Olympisk",
        name: "Stockholm",
      }),
    ).toBe("mellan");
    expect(
      raceDemand({ sport: "cykling", distance: "40 km", name: "Tempo-SM" }),
    ).toBe("mellan");
    expect(
      raceDemand({
        sport: "löpning",
        distance: "10 km",
        name: "Midnattsloppet",
      }),
    ).toBe("kort");
    expect(
      raceDemand({
        sport: "cykling",
        distance: null,
        name: "Kriterium Tranås",
      }),
    ).toBe("kort");
    expect(
      raceDemand({ sport: "annat", distance: null, name: "Klubbloppet" }),
    ).toBeNull();
    expect(
      raceDemand({ sport: null, distance: null, name: "Testhalvmara" }),
    ).toBe("lång");
  });
});

describe("phaseTarget och distributionNotes", () => {
  const grund = { phase: "grund" as const, focus: null };

  it("säger till när grunden får för mycket mellanintensitet", () => {
    const counts = { lugn: 6, medel: 3, hög: 1, total: 10 };
    const notes = distributionNotes(counts, phaseTarget(grund, null));
    expect(notes).toEqual([
      "Lugnt 60 % – under riktmärket 80 %.",
      "Medel 30 % – över riktmärket 10 %.",
    ]);
  });

  it("är tyst inom riktmärket och när passen är för få", () => {
    const target = phaseTarget(grund, null);
    expect(
      distributionNotes({ lugn: 8, medel: 1, hög: 1, total: 10 }, target),
    ).toEqual([]);
    expect(
      distributionNotes({ lugn: 1, medel: 3, hög: 0, total: 4 }, target),
    ).toEqual([]);
  });

  it("väljer riktmärke efter blockets fokus och tävlingens karaktär", () => {
    expect(
      phaseTarget({ phase: "uppbyggnad", focus: "VO2max, 4×8" }, null).model,
    ).toBe("VO₂max-block");
    expect(
      phaseTarget({ phase: "uppbyggnad", focus: "Tröskel" }, null).model,
    ).toBe("Tröskelblock");
    expect(
      phaseTarget({ phase: "specifik", focus: null }, "lång").bands?.medel,
    ).toEqual({ min: 0.15, max: 0.25 });
    expect(
      phaseTarget({ phase: "specifik", focus: null }, "kort").bands?.hög,
    ).toEqual({ min: 0.15, max: 0.2 });
    expect(phaseTarget({ phase: "topp", focus: null }, null).bands).toBeNull();
  });

  it("räknar bara passen inom perioden", () => {
    const counts = blockDistribution(
      { starts_on: "2026-11-02", ends_on: "2026-11-08" },
      [
        { date: "2026-11-01", goal: "hög" },
        { date: "2026-11-02", goal: "lugn" },
        { date: "2026-11-05", goal: "medel" },
        { date: "2026-11-08", goal: null },
      ],
    );
    expect(counts).toEqual({ lugn: 1, medel: 1, hög: 0, total: 2 });
  });
});

describe("seasonToPrompt", () => {
  it("tar med periodens riktmärke och de inplanerade passen", () => {
    const prompt = seasonToPrompt(
      [],
      [
        {
          phase: "grund",
          starts_on: "2026-11-02",
          ends_on: "2026-12-27",
          focus: null,
        },
      ],
      "2026-11-10",
      [
        { date: "2026-11-03", goal: "lugn" },
        { date: "2026-11-04", goal: "hög" },
      ],
    );
    expect(prompt).toContain("Intensitet i perioden: polariserad");
    expect(prompt).toContain("1 lugna, 0 medel, 1 höga");
  });
});

describe("doneDistribution", () => {
  it("räknar genomförda pass i perioden, tävlingar och oklassade för sig", () => {
    const block = { starts_on: "2026-10-01", ends_on: "2026-10-31" };
    const result = doneDistribution(block, [
      { date: "2026-10-02", goal: "lugn", isRace: false },
      { date: "2026-10-03", goal: "hög", isRace: false },
      { date: "2026-10-04", goal: null, isRace: false },
      { date: "2026-10-05", goal: "hög", isRace: true },
      { date: "2026-11-01", goal: "lugn", isRace: false },
    ]);
    expect(result.counts).toEqual({ lugn: 1, medel: 0, hög: 1, total: 2 });
    expect(result.races).toBe(1);
    expect(result.unclassified).toBe(1);
  });
});

describe("mainZone", () => {
  it("ger tröskelzonen för ett tröskelpass, inte uppvärmningens", () => {
    const blocks = [
      single(step("uppvärmning", 900, 0.6)),
      reps(3, [step("intervall", 300, 1.0), step("vila", 120, 0.55)]),
      single(step("nedvarvning", 600, 0.6)),
    ];
    expect(mainZone({ basis: "FTP", blocks }, 300)).toBe(4);
  });

  it("ger distanszonen för ett distanspass med stegringar", () => {
    const blocks = [
      single(step("distans", 3000, 0.7)),
      reps(6, [step("intervall", 20, 1.3), step("vila", 60, 0.5)]),
    ];
    expect(mainZone({ basis: "FTP", blocks }, 300)).toBe(2);
  });

  it("saknar zon när passet bara är uppvärmning och vila", () => {
    const blocks = [single(step("uppvärmning", 600, 0.6))];
    expect(mainZone({ basis: "FTP", blocks }, 300)).toBeNull();
  });
});
