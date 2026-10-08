import { describe, expect, it } from "vitest";

import {
  blocksMetres,
  completeEstimate,
  currentEstimate,
  estimateFromProfile,
  pacedBlocks,
  parseRaceTime,
  raceTimeText,
  referenceSpeeds,
  riegel,
} from "./paces";
import { parseStructure } from "./structure";

const blocks = (text: string) => {
  const r = parseStructure(text);
  if (!r.ok) throw new Error(r.error);
  return r.blocks;
};

describe("formuppskattning", () => {
  it("räknar maraton ur 5 km med Riegel 1,06", () => {
    const e = completeEstimate({
      fiveKSeconds: 20 * 60,
      source: "manuell",
      date: "2026-10-01",
    })!;
    expect(e.derived).toBe("MP");
    // 20:00 på 5 km ger 3:11:49 på maraton.
    expect(raceTimeText(e.marathonSeconds)).toBe("3:11:49");
    expect(riegel(e.marathonSeconds, 42195, 5000)).toBeCloseTo(1200, 6);
  });

  it("räknar 5 km ur maraton, och tar båda när båda finns", () => {
    expect(
      completeEstimate({
        marathonSeconds: 3 * 3600,
        source: "manuell",
        date: "2026-10-01",
      })!.derived,
    ).toBe("5K");
    const both = completeEstimate({
      fiveKSeconds: 1200,
      marathonSeconds: 3.5 * 3600,
      source: "manuell",
      date: "2026-10-01",
    })!;
    expect(both.derived).toBeNull();
    expect(both.marathonSeconds).toBe(12600);
    expect(
      completeEstimate({ source: "manuell", date: "2026-10-01" }),
    ).toBeNull();
  });

  it("tar maraton ur den egna kurvan bara med en lång insats", () => {
    // T = a·D^1,08, kalibrerad så att 5 km tar 20 min.
    const exponent = 1.08;
    const scale = 1200 / 5000 ** exponent;
    const short = estimateFromProfile({
      scale,
      exponent,
      individual: true,
      used: [
        { performedOn: "2026-09-01", seconds: 600 },
        { performedOn: "2026-09-20", seconds: 1200 },
      ],
    })!;
    expect(short.fiveKSeconds).toBeCloseTo(1200, 6);
    expect(short.derived).toBe("MP");
    expect(short.date).toBe("2026-09-20");
    const long = estimateFromProfile({
      scale,
      exponent,
      individual: true,
      used: [
        { performedOn: "2026-09-01", seconds: 1200 },
        { performedOn: "2026-09-20", seconds: 3000 },
      ],
    })!;
    expect(long.derived).toBeNull();
    expect(long.marathonSeconds).toBeGreaterThan(short.marathonSeconds);
  });

  it("väljer den nyaste, och den inskrivna samma dag", () => {
    const test = completeEstimate({
      fiveKSeconds: 1200,
      source: "test",
      date: "2026-10-01",
    });
    const manual = completeEstimate({
      fiveKSeconds: 1180,
      source: "manuell",
      date: "2026-09-01",
    });
    expect(currentEstimate(test, manual)?.source).toBe("test");
    const sameDay = { ...manual!, date: "2026-10-01" };
    expect(currentEstimate(test, sameDay)?.source).toBe("manuell");
    expect(currentEstimate(null, undefined)).toBeNull();
  });
});

describe("tempon", () => {
  const estimate = completeEstimate({
    fiveKSeconds: 20 * 60,
    marathonSeconds: 3 * 3600 + 15 * 60,
    source: "manuell",
    date: "2026-10-01",
  });
  const refs = referenceSpeeds(estimate, { cs: 4.3 });

  it("ger 5 km-fart och maratonfart i m/s", () => {
    expect(refs["5K"]).toBeCloseTo(5000 / 1200, 9);
    expect(refs.MP).toBeCloseTo(42195 / 11700, 9);
    expect(refs.CS).toBe(4.3);
    expect(refs.LT2).toBeUndefined();
  });

  it("sätter tempo på varje steg, med procenten kvar", () => {
    const paced = pacedBlocks(
      blocks("15 min 70%; 5x(1 km 105% + 2 min 65%)"),
      refs["5K"],
    );
    expect(paced).toHaveLength(2);
    expect(paced[0].steps[0].percent).toBe("70 %");
    // 70 % av 4:00/km är 5:43/km.
    expect(paced[0].steps[0].pace).toBe("5:43/km");
    expect(paced[1].times).toBe(5);
    expect(paced[1].steps[0].amount).toBe("1 km");
    expect(paced[1].steps[0].pace).toBe("3:49/km");
  });

  it("visar procenten utan tempo när referensen saknas", () => {
    const paced = pacedBlocks(blocks("30 min 80-85%"), undefined);
    expect(paced[0].steps[0].pace).toBeNull();
    expect(paced[0].steps[0].percent).toBe("80–85 %");
  });

  it("räknar passets sträcka med löparens tempon", () => {
    // 60 min i 100 % av 4 m/s är 14,4 km.
    expect(blocksMetres(blocks("60 min 100%"), 4)).toBeCloseTo(14400, 6);
    expect(blocksMetres(blocks("60 min 100%"), null)).toBeNull();
  });
});

describe("tider", () => {
  it("läser och skriver lopptider", () => {
    expect(parseRaceTime("18:30")).toBe(1110);
    expect(parseRaceTime("3:12:05")).toBe(11525);
    expect(parseRaceTime("3.12.05")).toBe(11525);
    expect(parseRaceTime("18")).toBeNull();
    expect(parseRaceTime("18:75")).toBeNull();
    expect(parseRaceTime("abc")).toBeNull();
    expect(raceTimeText(1110)).toBe("18:30");
    expect(raceTimeText(11525)).toBe("3:12:05");
  });
});
