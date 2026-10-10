import { describe, expect, it } from "vitest";

import { formatStructure, parseStructure, structureSeconds } from "./structure";

describe("strukturen som text", () => {
  it("tolkar uppvärmning, repetition och nedvarvning", () => {
    const r = parseStructure(
      "15 min 65%; 5x(4 min 105% + 2 min 60%); 10 min 60%",
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.blocks).toEqual([
      {
        type: "steg",
        step: {
          kind: "uppvärmning",
          label: "",
          durationSeconds: 900,
          distanceM: null,
          low: 0.65,
          high: 0.65,
        },
      },
      {
        type: "repetition",
        times: 5,
        steps: [
          {
            kind: "intervall",
            label: "",
            durationSeconds: 240,
            distanceM: null,
            low: 1.05,
            high: 1.05,
          },
          {
            kind: "vila",
            label: "",
            durationSeconds: 120,
            distanceM: null,
            low: 0.6,
            high: 0.6,
          },
        ],
      },
      {
        type: "steg",
        step: {
          kind: "nedvarvning",
          label: "",
          durationSeconds: 600,
          distanceM: null,
          low: 0.6,
          high: 0.6,
        },
      },
    ]);
    expect(structureSeconds(r.blocks)).toBe(900 + 5 * 360 + 600);
  });

  it("tolkar distanser, spann, klockslag, decimaler och etiketter", () => {
    const r = parseStructure(
      "2 km 75-80%\n8x(400 m 105% + 1:30 50% vila)\n1,5 km 70% Lugnt",
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.blocks[0]).toMatchObject({
      step: { distanceM: 2000, low: 0.75, high: 0.8, kind: "uppvärmning" },
    });
    expect(r.blocks[1]).toMatchObject({
      times: 8,
      steps: [
        { distanceM: 400, kind: "intervall" },
        { durationSeconds: 90, kind: "vila" },
      ],
    });
    expect(r.blocks[2]).toMatchObject({
      step: { distanceM: 1500, label: "Lugnt", kind: "nedvarvning" },
    });
    expect(structureSeconds(r.blocks)).toBeNull();
  });

  it("gissar distans och intervall för ensamma steg, och tar en uttalad typ", () => {
    const one = parseStructure("60 min 70%");
    expect(one.ok && one.blocks[0]).toMatchObject({
      step: { kind: "distans" },
    });
    const tempo = parseStructure(
      "10 min 60%; 20 min 95%; 20 min 88% distans; 10 min 60%",
    );
    expect(
      tempo.ok && tempo.blocks.map((b) => b.type === "steg" && b.step.kind),
    ).toEqual(["uppvärmning", "intervall", "distans", "nedvarvning"]);
  });

  it("säger vad som är fel", () => {
    expect(parseStructure("")).toEqual({
      ok: false,
      error: "Strukturen är tom.",
    });
    expect(parseStructure("lugnt 70%")).toMatchObject({
      ok: false,
      error: expect.stringMatching(/saknar längd/),
    });
    expect(parseStructure("10 min")).toMatchObject({
      ok: false,
      error: expect.stringMatching(/saknar mål/),
    });
    expect(parseStructure("10 min 400%")).toMatchObject({
      ok: false,
      error: expect.stringMatching(/20 och 250/),
    });
    expect(parseStructure("80x(1 min 100%)")).toMatchObject({
      ok: false,
      error: expect.stringMatching(/1–50/),
    });
    expect(parseStructure("5x 4 min 105%)")).toMatchObject({ ok: false });
  });

  it("skriver tillbaka samma rad, och tolkar den till samma block", () => {
    for (const text of [
      "15 min 65%; 5x(4 min 105% + 2 min 60%); 10 min 60%",
      "2 km 75-80%; 8x(400 m 105% + 1:30 50%); 1,5 km 70% Lugnt",
      "10 min 60%; 20 min 95%; 20 min 92% distans; 10 min 60%",
      "1 h 70%",
    ]) {
      const first = parseStructure(text);
      if (!first.ok) throw new Error(first.error);
      expect(formatStructure(first.blocks)).toBe(text);
      const again = parseStructure(formatStructure(first.blocks));
      expect(again.ok && again.blocks).toEqual(first.blocks);
    }
  });
});

describe("loppfarter och spann", () => {
  it("läser @HM, @10K och ett spann mellan två zoner", () => {
    const r = parseStructure(
      "3 km @LO; 3x(2 km @HM-10K + 2 min @RK); 10 min @HM",
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const rep = r.blocks[1];
    expect(rep.type).toBe("repetition");
    if (rep.type !== "repetition") return;
    expect(rep.steps[0].low).toBeCloseTo(1.0425, 9);
    expect(rep.steps[0].high).toBeCloseTo(1.0902, 9);
    expect(rep.steps[0].kind).toBe("intervall");
    expect(rep.steps[1].kind).toBe("vila");
    const last = r.blocks[2];
    expect(last.type === "steg" && last.step.low).toBeCloseTo(1.0425, 9);
    expect(formatStructure(r.blocks, { zones: true })).toBe(
      "3 km @LO; 3x(2 km @HM-10K + 2 min @RK); 10 min @HM",
    );
  });

  it("säger vilka zoner som finns när en saknas", () => {
    const r = parseStructure("10 min @XX");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("@XX finns inte");
    expect(r.error).toContain("10K");
  });
});
