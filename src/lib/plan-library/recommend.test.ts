import { describe, expect, it } from "vitest";

import { isUltra, recommendFocus, type RecommendInput } from "./recommend";

const today = "2026-11-01";
const base: RecommendInput = { diagnosis: null, vlamax: null, race: null, today };
const race = (name: string, distance: string | null, date: string, sport: "cykling" | "löpning" = "cykling") => ({
  name,
  distance,
  sport,
  race_date: date,
});
const focuses = (input: RecommendInput) => recommendFocus(input).map((s) => s.focus);

describe("recommendFocus", () => {
  it("börjar med grund och test utan test, och styrka när loppet är långt bort", () => {
    expect(focuses(base)).toEqual(["grund", "styrka"]);
    expect(recommendFocus(base)[0].reason).toMatch(/test/);
  });

  it("lyfter taket när tröskeln ligger högt mot VO2max och tiden räcker", () => {
    const out = recommendFocus({
      ...base,
      diagnosis: { verdict: "motor", pct: 88, label: "LT2" },
    });
    expect(out.map((s) => s.focus)).toEqual(["tak", "vo2max", "styrka"]);
    expect(out[0].reason).toContain("88 %");
  });

  it("väljer ett kort VO2max-block när loppet är för nära för en grundperiod", () => {
    expect(
      focuses({
        ...base,
        diagnosis: { verdict: "motor", pct: 87, label: "CP" },
        race: race("Tempo-SM", "40 km", "2027-01-05"),
      })[0],
    ).toBe("vo2max");
  });

  it("höjer tröskeln när utnyttjandet begränsar, och nämner hög VLamax", () => {
    const out = recommendFocus({
      ...base,
      diagnosis: { verdict: "utnyttjande", pct: 70, label: "LT2" },
      vlamax: 0.62,
    });
    expect(out[0].focus).toBe("troskel");
    expect(out[0].reason).toContain("0,62");
  });

  it("låter loppet avgöra vid balans", () => {
    const balans = { verdict: "balans" as const, pct: 80, label: "LT2" };
    expect(
      focuses({ ...base, diagnosis: balans, race: race("Kriterium", "kriterium", "2027-06-01") })[0],
    ).toBe("vo2max");
    expect(
      focuses({ ...base, diagnosis: balans, race: race("Gran fondo", "160 km", "2027-06-01") })[0],
    ).toBe("troskel");
    expect(focuses({ ...base, diagnosis: balans })[0]).toBe("tak");
  });

  it("flyttar kvaliteten mot loppet i den specifika perioden, oavsett test", () => {
    const motor = { verdict: "motor" as const, pct: 90, label: "LT2" };
    expect(
      focuses({ ...base, diagnosis: motor, race: race("Gran fondo", "160 km", "2026-12-10") }),
    ).toEqual(["durability", "troskel"]);
    expect(
      focuses({ ...base, race: race("Backlopp", "backlopp", "2026-12-10") })[0],
    ).toBe("vo2max");
    expect(
      focuses({ ...base, race: race("Vätternrundan", "315 km", "2026-12-10") }),
    ).toEqual(["ultra", "durability"]);
  });

  it("lägger till ultra och tröskel inför ett ultralopp längre fram med hög VLamax", () => {
    const out = focuses({
      ...base,
      diagnosis: { verdict: "motor", pct: 86, label: "LT2" },
      vlamax: 0.55,
      race: race("Vätternrundan", "315 km", "2027-03-15"),
    });
    expect(out).toEqual(["tak", "vo2max", "troskel"]);
  });

  it("ger aldrig samma fokus två gånger och högst tre", () => {
    const out = focuses({
      ...base,
      diagnosis: { verdict: "utnyttjande", pct: 68, label: "LT2" },
      vlamax: 0.7,
      race: race("Ultra 300", "300 km", "2027-08-01"),
    });
    expect(new Set(out).size).toBe(out.length);
    expect(out.length).toBeLessThanOrEqual(3);
  });
});

describe("isUltra", () => {
  it("känner igen ultralopp ur namn och distans", () => {
    expect(isUltra(race("Vätternrundan", null, today))).toBe(true);
    expect(isUltra(race("Lopp", "30 mil", today))).toBe(true);
    expect(isUltra(race("Gran fondo", "160 km", today))).toBe(false);
    expect(isUltra(race("Ultramaraton", "50 km", today, "löpning"))).toBe(true);
  });
});
