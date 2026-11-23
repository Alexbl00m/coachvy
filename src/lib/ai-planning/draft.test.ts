import { describe, expect, it } from "vitest";

import { parseStructure } from "@/lib/plan-library/structure";
import { toAdeptWorkout } from "@/lib/session-library/library";

import {
  changedVariables,
  checkDraft,
  newSessionInput,
  parseDraft,
  shapeOf,
  type LibraryRef,
  type PlanDraft,
} from "./draft";

const blocks = (text: string) => {
  const parsed = parseStructure(text);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.blocks;
};

const lib = (
  id: string,
  title: string,
  structure: string,
  kind = "Kvalitet",
): LibraryRef => ({
  id,
  title,
  sport: "cykling",
  kind,
  intensity: "",
  basis: "FTP",
  blocks: blocks(structure),
  levels: [],
});

const library = new Map(
  [
    lib(
      "torque",
      "Torque",
      "15 min 65%; 4x(5 min 90% + 3 min 53%); 15 min 60%",
    ),
    lib(
      "hog",
      "8-minutare",
      "20 min 65%; 3x(8 min 110% + 3 min 50%); 15 min 55%",
    ),
    lib(
      "vo2",
      "30/15",
      "20 min 65%; 13x(30 s 120% + 15 s 50%); 3 min 50%; 13x(30 s 120% + 15 s 50%); 15 min 55%",
    ),
    lib(
      "sweet",
      "Sweet spot",
      "15 min 65%; 3x(12 min 90% + 4 min 55%); 10 min 55%",
    ),
    lib("z2", "Distans", "90 min 65%", "Distans"),
  ].map((l) => [l.id, l]),
);

const base: PlanDraft = {
  title: "Uppbyggnad 1",
  idea: "Torque och 8-minutare i fyra veckor.",
  periods: [],
  formats: [
    {
      key: "torque",
      library_id: "torque",
      new_session: null,
      test_protocol: null,
    },
    { key: "hog", library_id: "hog", new_session: null, test_protocol: null },
    { key: "z2", library_id: "z2", new_session: null, test_protocol: null },
  ],
  sessions: [],
};
const ctx = { today: "2026-11-23", library };
const s = (date: string, format: string, structure: string | null = null) => ({
  date,
  format,
  structure,
  level: null,
  note: null,
});

describe("planförslagets tolkning", () => {
  it("kräver titel, idé och giltiga datum", () => {
    const bad = parseDraft({
      title: "",
      sessions: [{ date: "23 nov", format: "x" }],
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.errors.join(" ")).toContain("title");
      expect(bad.errors.join(" ")).toContain("idea");
      expect(bad.errors.join(" ")).toContain("sessions[0].date");
    }
    const good = parseDraft({
      title: "Block",
      idea: "Idé",
      formats: [{ key: "torque", library_id: "torque" }],
      sessions: [{ date: "2026-11-24", format: "torque", level: "Z" }],
    });
    expect(good.ok && good.draft.sessions[0]).toEqual({
      date: "2026-11-24",
      format: "torque",
      structure: null,
      level: null,
      note: null,
    });
  });
});

describe("planförslaget mot biblioteket och filosofin", () => {
  it("löser upp passen med veckans dos och räknar veckorna", () => {
    const check = checkDraft(
      {
        ...base,
        sessions: [
          s("2026-11-24", "hog"),
          s("2026-11-26", "torque"),
          s("2026-11-28", "z2", "3 h 65%"),
          s(
            "2026-12-01",
            "hog",
            "20 min 65%; 4x(8 min 110% + 3 min 50%); 15 min 55%",
          ),
          s(
            "2026-12-03",
            "torque",
            "15 min 65%; 5x(5 min 90% + 3 min 53%); 15 min 60%",
          ),
        ],
      },
      ctx,
    );
    expect(check.errors).toEqual([]);
    expect(check.warnings).toEqual([]);
    expect(check.weeks.map((w) => [w.week, w.sessions.length])).toEqual([
      [48, 3],
      [49, 2],
    ]);
    expect(check.sessions[2].load?.seconds).toBe(3 * 3600);
    expect(check.weeks[0].goals).toMatchObject({ lugn: 1, medel: 1, hög: 1 });
    expect(check.weeks[1].tss).toBeGreaterThan(0);
  });

  it("varnar när ett format byter mer än en variabel", () => {
    const check = checkDraft(
      {
        ...base,
        sessions: [
          s("2026-11-24", "hog"),
          s(
            "2026-12-01",
            "hog",
            "20 min 65%; 8x(3 min 120% + 2 min 50%); 15 min 55%",
          ),
        ],
      },
      ctx,
    );
    expect(check.warnings.join(" ")).toContain("ändrar 4 variabler");
    expect(
      changedVariables(
        shapeOf(blocks("4x(5 min 90% + 3 min 53%)"))!,
        shapeOf(blocks("5x(5 min 90% + 3 min 53%)"))!,
      ),
    ).toEqual(["repetitioner 4→5"]);
    // Två serier 30/15 är två repetitionsblock med samma arbete.
    expect(
      shapeOf(
        blocks(
          "20 min 65%; 13x(30 s 120% + 15 s 50%); 3 min 50%; 13x(30 s 120% + 15 s 50%); 15 min 55%",
        ),
      ),
    ).toMatchObject({ kind: "intervall", series: 2, reps: 13, work: 30 });
  });

  it("varnar för fler än två kvalitetsformat i ett block", () => {
    const check = checkDraft(
      {
        ...base,
        formats: [
          ...base.formats,
          {
            key: "vo2",
            library_id: "vo2",
            new_session: null,
            test_protocol: null,
          },
        ],
        sessions: [
          s("2026-11-24", "hog"),
          s("2026-11-26", "torque"),
          s("2026-11-28", "vo2"),
        ],
      },
      ctx,
    );
    expect(check.warnings.join(" ")).toContain("3 kvalitetsformat");
  });

  it("stoppar okända pass, datum bakåt, överlappande perioder och trasiga passrader", () => {
    const check = checkDraft(
      {
        ...base,
        periods: [
          {
            name: "A",
            phase: "grund",
            starts_on: "2026-11-23",
            ends_on: "2026-12-20",
            focus: "",
          },
          {
            name: "B",
            phase: "uppbyggnad",
            starts_on: "2026-12-14",
            ends_on: "2027-01-10",
            focus: "",
          },
        ],
        formats: [
          ...base.formats,
          {
            key: "okänt",
            library_id: "finns-inte",
            new_session: null,
            test_protocol: null,
          },
        ],
        sessions: [
          s("2026-11-20", "hog"),
          s("2026-11-24", "saknas"),
          s("2026-11-25", "torque", "4x(5 min hårt)"),
        ],
      },
      ctx,
    );
    const text = check.errors.join(" | ");
    expect(text).toContain("överlappar");
    expect(text).toContain("finns-inte");
    expect(text).toContain("före i dag");
    expect(text).toContain("saknas");
    expect(text).toContain("2026-11-25");
  });

  it("tar ett nytt pass när biblioteket saknar det, och prövar det som i biblioteket", () => {
    const ok = checkDraft(
      {
        ...base,
        formats: [
          {
            key: "overunder",
            library_id: null,
            new_session: {
              title: "Över–under 3 × 10",
              sport: "cykling",
              kind: "Kvalitet",
              intensity: "Tröskel",
              purpose: "Tåla ryck nära tröskeln.",
              description: "",
              progression: "Fler block, sedan längre block.",
              basis: "FTP",
              structure:
                "15 min 65%; 3x(2 min 95% + 1 min 105% + 2 min 95% + 1 min 105% + 4 min 55%); 10 min 55%",
            },
            test_protocol: null,
          },
        ],
        sessions: [s("2026-11-24", "overunder")],
      },
      ctx,
    );
    expect(ok.errors).toEqual([]);
    expect(ok.sessions[0]).toMatchObject({
      isNew: true,
      libraryId: null,
      title: "Över–under 3 × 10",
    });
  });

  it("jämför fördelningen med fasens riktmärken och varnar för stora belastningssprång", () => {
    const sweet = {
      key: "sweet",
      library_id: "sweet",
      new_session: null,
      test_protocol: null,
    };
    const check = checkDraft(
      {
        ...base,
        formats: [...base.formats, sweet],
        periods: [
          {
            name: "Grund 2",
            phase: "grund",
            starts_on: "2026-11-23",
            ends_on: "2026-12-13",
            focus: "",
          },
        ],
        sessions: [
          s("2026-11-24", "z2"),
          s("2026-11-25", "sweet"),
          s("2026-11-27", "z2"),
          s("2026-12-01", "sweet"),
          s("2026-12-02", "sweet"),
          s("2026-12-03", "sweet"),
          s("2026-12-04", "z2", "4 h 65%"),
          s("2026-12-05", "z2", "4 h 65%"),
        ],
      },
      ctx,
    );
    const text = check.warnings.join(" | ");
    expect(text).toContain("Grund 2: 50 % medel");
    expect(text).toContain("Vecka 49 ökar planerad TSS");
  });

  it("räknar om veckans dos mot adeptens tröskel när planen läggs in", () => {
    const check = checkDraft(
      {
        ...base,
        sessions: [
          s(
            "2026-12-01",
            "hog",
            "20 min 65%; 4x(8 min 110% + 3 min 50%); 15 min 55%",
          ),
        ],
      },
      ctx,
    );
    const session = check.sessions[0];
    const valid = newSessionInput({
      title: session.title,
      sport: "cykling",
      kind: "Kvalitet",
      intensity: "VO2max",
      purpose: "",
      description: "",
      progression: "",
      basis: "FTP",
      structure: "20 min 65%; 3x(8 min 110% + 3 min 50%); 15 min 55%",
    });
    expect(valid.ok).toBe(true);
    if (!valid.ok) return;
    const converted = toAdeptWorkout(
      { ...valid.value, blocks: session.blocks, levels: [] },
      { sport: "cykling", basis: "FTP", reference: 300 },
      {},
      null,
    );
    expect(converted.ok).toBe(true);
    if (!converted.ok) return;
    // Veckans dos, fyra repetitioner, inte bibliotekets tre.
    expect(converted.workout.blocks).toEqual(session.blocks);
    expect(converted.workout.summary).toContain("Kvalitet");
  });

  it("håller simpassens rad och räknar den mot adeptens CSS", () => {
    const text = "400 m CSS+15; 12x(100 m CSS+4-6 + 20 s vila); 200 m CSS+20";
    const swimLib = new Map([
      [
        "css",
        {
          id: "css",
          title: "CSS Climber – Base",
          sport: "simning" as const,
          kind: "Kvalitet",
          intensity: "",
          basis: "CSS" as const,
          blocks: blocks(text),
          structure: text,
          levels: [],
        },
      ],
    ]);
    const check = checkDraft(
      {
        ...base,
        formats: [
          {
            key: "css",
            library_id: "css",
            new_session: null,
            test_protocol: null,
          },
        ],
        sessions: [
          s("2026-11-24", "css"),
          s(
            "2026-12-01",
            "css",
            "400 m CSS+15; 14x(100 m CSS+4-6 + 20 s vila); 200 m CSS+20",
          ),
        ],
      },
      {
        today: "2026-11-23",
        library: swimLib,
        speeds: { CSS: 1.25 },
        swim: { css: 80, im: null, half: null },
      },
    );
    expect(check.errors).toEqual([]);
    expect(check.sessions[0].structure).toBe(text);
    const set = check.sessions[0].blocks[1];
    if (set.type !== "repetition") throw new Error();
    expect(set.steps[0].high).toBeCloseTo(80 / 84);
    expect(check.sessions[1].load?.seconds).toBeGreaterThan(0);
    expect(check.warnings.join(" ")).not.toContain("variabler");
  });
});
