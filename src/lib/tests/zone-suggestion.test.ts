import { describe, expect, it } from "vitest";

import type { ProfileSource } from "@/lib/activities/profile";
import { pickEfforts, suggestZones, type ZoneReview } from "./zone-suggestion";

const SPANS = [60, 120, 180, 240, 300, 420, 600, 900, 1200, 1800];

/** Ett pass vars kurva följer CP och W′ exakt: P = CP + W′/t. */
const ride = (
  date: string,
  cp: number,
  wPrime: number,
  id = date,
): ProfileSource => ({
  id,
  name: `Pass ${date}`,
  sport: "cykling",
  performed_on: date,
  curve: { power: SPANS.map((t) => [t, cp + wPrime / t]), speed: [] },
  best: null,
});

const today = "2026-10-21";

const base = {
  sport: "cykling" as const,
  today,
  previous: 300,
  testedOn: "2026-08-12",
  reviews: [] as ZoneReview[],
};

describe("pickEfforts", () => {
  it("väljer de förvalda längderna på 3–20 minuter", () => {
    const efforts = pickEfforts(
      SPANS.map((span) => ({
        span,
        value: 300,
        activityId: "a",
        date: today,
        name: "a",
        support: 1,
      })),
    );
    expect(efforts.map((e) => e.span)).toEqual([180, 300, 420, 600, 900, 1200]);
  });
});

describe("suggestZones", () => {
  it("föreslår när träningen efter testet ger tydligt högre CP", () => {
    const s = suggestZones({
      ...base,
      sources: [ride("2026-10-01", 320, 20000)],
    });
    expect(s).not.toBeNull();
    expect(s!.critical).toBeCloseTo(320);
    expect(s!.reserve).toBeCloseTo(20000);
    expect(s!.changePct).toBeCloseTo(6.67, 1);
    expect(s!.efforts).toHaveLength(6);
  });

  it("föreslår inget under tre procent", () => {
    expect(
      suggestZones({ ...base, sources: [ride("2026-10-01", 307, 20000)] }),
    ).toBeNull();
  });

  it("föreslår aldrig att sänka", () => {
    expect(
      suggestZones({ ...base, sources: [ride("2026-10-01", 270, 20000)] }),
    ).toBeNull();
  });

  it("kräver insatser efter testet", () => {
    expect(
      suggestZones({ ...base, sources: [ride("2026-08-01", 320, 20000)] }),
    ).toBeNull();
  });

  it("ser bara 90 dagar bakåt", () => {
    expect(
      suggestZones({
        ...base,
        testedOn: "2026-05-01",
        sources: [ride("2026-06-01", 320, 20000)],
      }),
    ).toBeNull();
  });

  it("föreslår inget utan test att jämföra med", () => {
    expect(
      suggestZones({
        ...base,
        previous: null,
        testedOn: null,
        sources: [ride("2026-10-01", 320, 20000)],
      }),
    ).toBeNull();
  });

  it("föreslår inget när W′ hamnar orimligt", () => {
    // Bara lugna pass: platt kurva, W′ nära noll.
    expect(
      suggestZones({ ...base, sources: [ride("2026-10-01", 320, 500)] }),
    ).toBeNull();
  });

  it("ett avvisat förslag kommer inte tillbaka förrän träningen visar mer", () => {
    const sources = [ride("2026-10-01", 320, 20000)];
    const reviews: ZoneReview[] = [
      {
        sport: "cykling",
        decision: "avvisad",
        proposed_critical: 319,
        created_at: "2026-10-05T10:00:00Z",
      },
    ];
    expect(suggestZones({ ...base, sources, reviews })).toBeNull();
    // Ett nytt bästa som lyfter CP över avvisningen ger ett nytt förslag.
    expect(
      suggestZones({
        ...base,
        reviews,
        sources: [...sources, ride("2026-10-15", 335, 20000)],
      })?.critical,
    ).toBeCloseTo(335);
  });

  it("en avvisning före ett nytt test räknas inte", () => {
    expect(
      suggestZones({
        ...base,
        testedOn: "2026-09-01",
        sources: [ride("2026-10-01", 320, 20000)],
        reviews: [
          {
            sport: "cykling",
            decision: "avvisad",
            proposed_critical: 330,
            created_at: "2026-08-20T10:00:00Z",
          },
        ],
      }),
    ).not.toBeNull();
  });

  it("räknar löpningens CS i m/s", () => {
    const run: ProfileSource = {
      id: "r",
      name: "Löpning",
      sport: "löpning",
      performed_on: "2026-10-01",
      curve: { power: [], speed: SPANS.map((t) => [t, 4.4 + 200 / t]) },
      best: null,
    };
    const s = suggestZones({
      ...base,
      sport: "löpning",
      previous: 4.2,
      sources: [run],
    });
    expect(s?.critical).toBeCloseTo(4.4);
    expect(s?.reserve).toBeCloseTo(200);
  });
});
