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
      times: { "5K": 20 * 60 },
      source: "manuell",
      date: "2026-10-01",
    })!;
    expect(e.derived).toEqual(["10K", "HM", "M"]);
    // 20:00 på 5 km ger 3:11:49 på maraton.
    expect(raceTimeText(e.times.M)).toBe("3:11:49");
    expect(riegel(e.times.M, 42195, 5000)).toBeCloseTo(1200, 6);
  });

  it("räknar ur den närmaste angivna distansen", () => {
    // 5 km 20:00 och 10 km 45:00: halvmaran ur milen, inte ur 5 km.
    const e = completeEstimate({
      times: { "5K": 20 * 60, "10K": 45 * 60 },
      source: "manuell",
      date: "2026-10-01",
    })!;
    expect(e.derived).toEqual(["HM", "M"]);
    expect(e.times.HM).toBeCloseTo(riegel(2700, 10000, 21097.5), 6);
    expect(raceTimeText(e.times.HM)).toBe("1:39:17");
  });

  it("använder löparens egen exponent mellan två angivna tider", () => {
    // 10 km 45:00 och maraton 3:45:00 ger exponenten mellan dem.
    const e = completeEstimate({
      times: { "10K": 2700, M: 3.75 * 3600 },
      source: "manuell",
      date: "2026-10-01",
    })!;
    const own = Math.log(13500 / 2700) / Math.log(42195 / 10000);
    expect(e.times.HM).toBeCloseTo(2700 * (21097.5 / 10000) ** own, 6);
    // Längre än med 1,06, eftersom maratontiden är svagare än milen.
    expect(e.times.HM).toBeGreaterThan(riegel(2700, 10000, 21097.5));
    // Utanför de angivna: 1,06 från den närmaste.
    expect(e.times["5K"]).toBeCloseTo(riegel(2700, 10000, 5000), 6);
  });

  it("tar båda när båda finns, och ingenting utan tid", () => {
    const both = completeEstimate({
      times: { "5K": 1200, M: 3.5 * 3600 },
      source: "manuell",
      date: "2026-10-01",
    })!;
    expect(both.derived).toEqual(["10K", "HM"]);
    expect(both.times.M).toBe(12600);
    expect(
      completeEstimate({ times: {}, source: "manuell", date: "2026-10-01" }),
    ).toBeNull();
  });

  it("tar halvmaraton och maraton ur den egna kurvan bara med en lång insats", () => {
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
    expect(short.times["5K"]).toBeCloseTo(1200, 6);
    expect(short.times["10K"]).toBeCloseTo(scale * 10000 ** exponent, 6);
    expect(short.derived).toEqual(["HM", "M"]);
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
    expect(long.derived).toEqual([]);
    expect(long.times.M).toBeGreaterThan(short.times.M);
  });

  it("väljer den nyaste, och den inskrivna samma dag", () => {
    const test = completeEstimate({
      times: { "5K": 1200 },
      source: "test",
      date: "2026-10-01",
    });
    const manual = completeEstimate({
      times: { "5K": 1180 },
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
    times: { "5K": 20 * 60, M: 3 * 3600 + 15 * 60 },
    source: "manuell",
    date: "2026-10-01",
  });
  const refs = referenceSpeeds(estimate, { cs: 4.3 });

  it("ger loppfarterna i m/s", () => {
    expect(refs["5K"]).toBeCloseTo(5000 / 1200, 9);
    expect(refs.MP).toBeCloseTo(42195 / 11700, 9);
    expect(refs["10K"]).toBeGreaterThan(refs.MP!);
    expect(refs.HM).toBeGreaterThan(refs.MP!);
    expect(refs.CS).toBe(4.3);
    expect(refs.LT2).toBeUndefined();
  });

  it("räknar zonerna ur loppfarten i en halvmaratonplan", () => {
    const half = completeEstimate({
      times: { HM: 1.75 * 3600 },
      source: "manuell",
      date: "2026-10-01",
    });
    const r = referenceSpeeds(half, {}, 21097.5);
    expect(r.HM).toBeCloseTo(21097.5 / 6300, 9);
    // @HM i en halvmaratonplan är exakt halvmaratonfarten: 4:59/km.
    const paced = pacedBlocks(blocks("10 km @HM"), r.MP, "MP");
    expect(paced[0].steps[0].zone).toBe("HM");
    expect(paced[0].steps[0].pace).toBe("4:59/km");
    // Ett spann mellan två zoner.
    const span = pacedBlocks(blocks("2 km @HM-10K"), r.MP, "MP");
    expect(span[0].steps[0].zone).toBe("HM-10K");
    expect(span[0].steps[0].pace).toMatch(/^4:4\d–4:59\/km$/);
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

  it("ger zonen och ett tempospann för pass i zoner", () => {
    // Maraton på 3:15:00 är 4:37/km, 3,61 m/s.
    const mp = 42195 / (3 * 3600 + 15 * 60);
    const paced = pacedBlocks(blocks("10 km @LO + 5 km @MT"), mp, "MP");
    expect(paced[0].steps[0].zone).toBe("LO");
    expect(paced[1].steps[0].zone).toBe("MT");
    // LO är 83–92,5 % av maratonfart: ungefär 5:00–5:34/km.
    expect(paced[0].steps[0].pace).toMatch(/^5:0\d–5:3\d\/km$/);
    // Samma procent mot en annan bas är ingen zon.
    expect(
      pacedBlocks(blocks("10 km @LO"), mp, "5K")[0].steps[0].zone,
    ).toBeNull();
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
