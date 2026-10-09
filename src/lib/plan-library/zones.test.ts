import { describe, expect, it } from "vitest";

import { formatStructure, parseStructure } from "./structure";
import { ZONES, zoneAt, zoneByKey, zoneForRange } from "./zones";

/** Tempo (s/km) för en andel av maratonfart. */
const pace = (mpSecPerKm: number, fraction: number) => mpSecPerKm / fraction;
const mmss = (t: string) => {
  const [m, s] = t.split(":").map(Number);
  return m * 60 + s;
};

/**
 * Referens: publicerade tempotabeller med samma zoner, för en maratontid på
 * 2:40, 3:05 och 3:30 (snabbaste tempot först, som i tabellerna). Zonerna ska ligga inom ett par procent av
 * dem – de är en vägledning över hela fältet, inte en exakt tabell.
 */
const TABLES: Record<string, Record<string, [string, string]>> = {
  "2:40": {
    RK: ["4:36", "4:58"],
    LO: ["4:08", "4:36"],
    MT: ["3:44", "4:06"],
    S: ["3:36", "3:46"],
    I: ["3:15", "3:23"],
  },
  "3:05": {
    RK: ["5:17", "5:42"],
    LO: ["4:45", "5:17"],
    MT: ["4:17", "4:42"],
    S: ["4:08", "4:20"],
    I: ["3:44", "3:53"],
  },
  "3:30": {
    RK: ["5:57", "6:25"],
    LO: ["5:22", "5:57"],
    MT: ["4:51", "5:19"],
    S: ["4:40", "4:54"],
    I: ["4:13", "4:23"],
  },
};
const MARATHON_M = 42195;

describe("zoner", () => {
  it("har sex zoner och hittar dem på nyckel", () => {
    expect(ZONES.map((z) => z.key)).toEqual(["RK", "LO", "MT", "S", "I", "WK"]);
    expect(zoneByKey("lo")?.name).toBe("Lugn distans");
    expect(zoneByKey("X")).toBeUndefined();
  });

  it("ligger inom 2,5 % av de publicerade tabellerna", () => {
    for (const [time, zones] of Object.entries(TABLES)) {
      const [h, m] = time.split(":").map(Number);
      const mp = ((h * 3600 + m * 60) / MARATHON_M) * 1000;
      for (const [key, [fast, slow]] of Object.entries(zones)) {
        const zone = zoneByKey(key)!;
        expect(pace(mp, zone.low) / mmss(slow)).toBeGreaterThan(0.975);
        expect(pace(mp, zone.low) / mmss(slow)).toBeLessThan(1.025);
        expect(pace(mp, zone.high) / mmss(fast)).toBeGreaterThan(0.975);
        expect(pace(mp, zone.high) / mmss(fast)).toBeLessThan(1.025);
      }
    }
  });

  it("ordnar zonerna från långsamt till snabbt", () => {
    const sorted = ZONES.filter((z) => z.key !== "WK");
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i].low).toBeGreaterThan(sorted[i - 1].low);
      expect(sorted[i].high).toBeGreaterThan(sorted[i - 1].high);
    }
  });

  it("hittar zonen en fart ligger i", () => {
    expect(zoneAt(0.88)?.key).toBe("LO");
    expect(zoneAt(0.97)?.key).toBe("MT");
    expect(zoneAt(1.15)?.key).toBe("I");
    expect(zoneAt(1.3)).toBeNull();
    expect(zoneForRange(1, 1)?.key).toBe("WK");
    expect(zoneForRange(0.5, 0.6)).toBeNull();
  });
});

describe("zoner i strukturen", () => {
  it("läser @LO och @MT som mål", () => {
    const r = parseStructure("25 km @LO + 7 km @MT");
    if (!r.ok) throw new Error(r.error);
    expect(r.blocks).toHaveLength(2);
    const [a, b] = r.blocks.map((x) => (x.type === "steg" ? x.step : null));
    expect(a).toMatchObject({ distanceM: 25000, low: 0.83, high: 0.925 });
    expect(b).toMatchObject({ distanceM: 7000, low: 0.935, high: 1.025 });
    // Första steget är uppvärmning, det sista nedvarvning – som med procent.
    expect(a?.kind).toBe("uppvärmning");
    expect(b?.kind).toBe("nedvarvning");
  });

  it("gissar typen ur zonen när passet är ett enda steg", () => {
    const easy = parseStructure("18 km @LO");
    const hard = parseStructure("8 km @MT");
    if (!easy.ok || !hard.ok) throw new Error("fel");
    expect((easy.blocks[0] as { step: { kind: string } }).step.kind).toBe(
      "distans",
    );
    expect((hard.blocks[0] as { step: { kind: string } }).step.kind).toBe(
      "intervall",
    );
  });

  it("läser zoner i repetitioner och ger vilan typen vila", () => {
    const r = parseStructure("2 km @LO; 4x(3 km @MT + 1 km @LO); 2 km @LO");
    if (!r.ok) throw new Error(r.error);
    const rep = r.blocks[1];
    if (rep.type !== "repetition") throw new Error("ingen repetition");
    expect(rep.steps.map((s) => s.kind)).toEqual(["intervall", "vila"]);
  });

  it("skriver tillbaka zoner bara när det ska, och går runt", () => {
    const text = "2 km @LO; 3x(2 km @MT + 1 km @RK); 2 km @LO";
    const r = parseStructure(text);
    if (!r.ok) throw new Error(r.error);
    expect(formatStructure(r.blocks, { zones: true })).toBe(text);
    // Utan zoner blir det procent.
    expect(formatStructure(r.blocks)).toContain("%");
    expect(formatStructure(r.blocks)).not.toContain("@");
  });

  it("säger ifrån om en okänd zon", () => {
    const r = parseStructure("10 km @XX");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("finns inte");
  });
});
