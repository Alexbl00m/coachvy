import { describe, expect, it } from "vitest";

import { analyseClip, median } from "./chain";
import { hipToPedal, mmPerDegree, saddleChange } from "./geometry";
import { seeded, syntheticCycle } from "./synthetic";

const TRUTH = 35;

/** Fyra fall: två bildfrekvenser och två kadenser, 24 körningar var. */
const CASES = [
  { fps: 30, rpm: 70 },
  { fps: 30, rpm: 95 },
  { fps: 60, rpm: 70 },
  { fps: 60, rpm: 95 },
];

function runCase(fps: number, rpm: number, runs = 24) {
  const random = seeded(fps * 1000 + rpm);
  const errors: number[] = [];
  for (let k = 0; k < runs; k += 1) {
    const frames = syntheticCycle({
      fps,
      rpm,
      seconds: 20,
      // Slumpat fasläge: dödläget hamnar ibland på en bild, ibland mellan.
      phase: random() * 2 * Math.PI,
      noisePx: 2,
      random,
    });
    const result = analyseClip(frames, fps);
    errors.push((result.kneeFlexBdc ?? NaN) - TRUTH);
  }
  const abs = errors.map(Math.abs);
  return {
    mean: abs.reduce((a, b) => a + b, 0) / abs.length,
    bias: errors.reduce((a, b) => a + b, 0) / errors.length,
    worst: Math.max(...abs),
  };
}

describe("mätkedjan mot en konstgjord trampcykel med 35° i nedre dödläget", () => {
  it("utan brus: inom en halv grad – parabeln över ett kvarts varv ger en liten känd överskattning", () => {
    for (const { fps, rpm } of CASES) {
      const result = analyseClip(
        syntheticCycle({ fps, rpm, seconds: 20 }),
        fps,
      );
      const error = (result.kneeFlexBdc as number) - TRUTH;
      // Knäkurvan är något plattare i botten än en parabel: vertex hamnar
      // några tiondels grader för högt. Känt och redovisat, inte brus.
      expect(error).toBeGreaterThanOrEqual(0);
      expect(error).toBeLessThan(0.5);
      expect(result.cadenceRpm).toBeCloseTo(rpm, 0);
    }
  });

  it("med brus och slumpat fasläge: medelfel under en halv grad i alla fyra fallen", () => {
    const table = CASES.map(({ fps, rpm }) => ({
      fall: `${fps} B/s, ${rpm} rpm`,
      ...runCase(fps, rpm),
    }));
    console.table(
      table.map((r) => ({
        fall: r.fall,
        "medelfel °": r.mean.toFixed(2),
        "snedvridning °": r.bias.toFixed(2),
        "sämsta °": r.worst.toFixed(2),
      })),
    );
    for (const r of table) {
      expect(r.mean).toBeLessThan(0.5);
      expect(r.worst).toBeLessThan(1.5);
    }
  });

  it("ett median över ett band runt dödläget hade legat fel – det är därför vertex används", () => {
    const fps = 60;
    const frames = syntheticCycle({ fps, rpm: 90, seconds: 20 });
    const result = analyseClip(frames, fps);
    // Median över ±1/8 varv runt varje dödläge: alltid över minimum.
    const band = Math.round((result.periodFrames as number) / 8);
    const medians = result.bdc.map((b) => {
      const at = Math.round(b.at);
      const values: number[] = [];
      for (let j = at - band; j <= at + band; j += 1) {
        const v = result.series.knee[j];
        if (v !== null && v !== undefined) values.push(v);
      }
      return median(values) as number;
    });
    const bandValue = median(medians) as number;
    expect(bandValue - TRUTH).toBeGreaterThan(2);
    expect(Math.abs((result.kneeFlexBdc as number) - TRUTH)).toBeLessThan(0.5);
  });

  it("räknar inte bilderna där adepten kliver på, av eller står bredvid", () => {
    const fps = 30;
    const frames = syntheticCycle({
      fps,
      rpm: 85,
      seconds: 20,
      standingS: 2.5,
      noisePx: 1,
      random: seeded(7),
    });
    const result = analyseClip(frames, fps);
    // Stående är benet nästan rakt (böjning ~5°); det får inte vinna.
    expect(Math.abs((result.kneeFlexBdc as number) - TRUTH)).toBeLessThan(0.6);
    const standingFrames = Math.round(2.5 * fps);
    expect(result.pedalling.slice(0, standingFrames).some(Boolean)).toBe(false);
  });

  it("räknar skalan ur vevlängden och millimeter per grad ur benlängderna", () => {
    const fps = 60;
    const result = analyseClip(
      syntheticCycle({ fps, rpm: 90, seconds: 20 }),
      fps,
    );
    expect(result.scale.thighMm).toBeCloseTo(430, -1);
    expect(result.scale.shankMm).toBeCloseTo(440, -1);
    // Runt 2,3 mm per grad med de här benen.
    expect(result.scale.mmPerDegree).toBeCloseTo(2.28, 1);
  });

  it("mäter bålens lutning och armbågens böjning", () => {
    const result = analyseClip(
      syntheticCycle({ fps: 30, rpm: 90, seconds: 15 }),
      30,
    );
    expect(result.trunk).toBeCloseTo(45, 0);
    expect(result.elbow).toBeGreaterThan(0);
  });
});

describe("kontrollen av inspelningen", () => {
  it("godkänner en ren sidovy", () => {
    const result = analyseClip(
      syntheticCycle({ fps: 30, rpm: 90, seconds: 15 }),
      30,
    );
    expect(result.check.problems).toEqual([]);
  });

  it("säger till när klippet är för kort", () => {
    const result = analyseClip(
      syntheticCycle({ fps: 30, rpm: 90, seconds: 8 }),
      30,
    );
    expect(result.check.durationOk).toBe(false);
  });

  it("säger till när kameran stått snett", () => {
    const frames = syntheticCycle({ fps: 30, rpm: 90, seconds: 15 }).map(
      (f) =>
        f && {
          ...f,
          right: {
            ...f.right,
            // Den bortre axeln syns, långt från den närmre.
            shoulder: {
              ...f.right.shoulder,
              x: f.right.shoulder.x + 200,
              c: 0.8,
            },
          },
        },
    );
    const result = analyseClip(frames, 30);
    expect(result.check.sideOk).toBe(false);
    expect(result.check.problems.join(" ")).toContain("snett");
  });
});

describe("cosinussatsen", () => {
  it("ger runt 2,3 mm per grad vid 35° med 430/440 mm", () => {
    expect(mmPerDegree(430, 440, 35)).toBeCloseTo(2.28, 2);
  });

  it("räknar sadelflytten exakt, inte per grad", () => {
    // Från 45° till 35° böjning: benet sträcks, sadeln upp.
    const up = saddleChange(430, 440, 45, 35);
    expect(up).toBeGreaterThan(20);
    expect(up).toBeLessThan(30);
    expect(hipToPedal(430, 440, 0)).toBeCloseTo(870, 6);
  });
});
