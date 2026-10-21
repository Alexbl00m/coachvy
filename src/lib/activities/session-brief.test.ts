import { describe, expect, it } from "vitest";

import type { Summary } from "./analysis";
import { loadTrend } from "./load";
import { sessionBrief, type BriefInput } from "./session-brief";

const SPANS = [60, 300, 1200, 3600];

const summary = (over: Partial<Summary> = {}): Summary =>
  ({
    elapsedS: 5400,
    movingS: 5300,
    distanceM: 45000,
    ascentM: 320,
    avgSpeed: 30,
    maxSpeed: 55,
    avgPower: 210,
    maxPower: 700,
    normalizedPower: 245,
    workKj: 1130,
    variabilityIndex: 1.17,
    intensityFactor: 0.82,
    tss: 101,
    avgHr: 148,
    maxHr: 178,
    avgCadence: 88,
    decouplingPct: 3.4,
    halvesPct: -1.2,
    balanceMin: null,
    aboveCriticalS: 960,
    aboveCriticalWork: 24000,
    strain: 1.2,
    best: [{ span: 300, label: "5 min", value: 340, at: 1200, model: 330 }],
    powerZones: [
      { zone: "Z1 Återhämtning", seconds: 1000 },
      { zone: "Z2 Uthållighet", seconds: 3000 },
      { zone: "Z5 VO2max", seconds: 1300 },
    ],
    hrZones: null,
    splits: [],
    insights: ["Fem intervaller över CP med jämn effekt."],
    curve: { power: SPANS.map((t) => [t, 300 + 20000 / t]), speed: [] },
    ...over,
  }) as Summary;

const base = (over: Partial<BriefInput> = {}): BriefInput => ({
  activity: {
    id: "a1",
    name: "5 × 4 min",
    sport: "cykling",
    performed_on: "2026-10-20",
    is_race: false,
    note: null,
    summary: summary(),
    reference: {
      ftp: 300,
      ftpSource: null,
      cp: 310,
      wPrime: 20000,
      cs: null,
      dPrime: null,
      lthr: 165,
      testedOn: "2026-09-01",
    },
    laps: [
      { seconds: 240, distanceM: 2400, power: 360, hr: 168 },
      { seconds: 240, distanceM: 2400, power: 355, hr: 171 },
    ],
  },
  strain: { value: 1.2, estimated: false },
  race: null,
  planned: [
    {
      title: "VO₂max 5 × 4 min",
      sport: "cykling",
      duration: "1:30:00",
      summary: "5 × 4 min på 105–110 % av CP",
    },
  ],
  checkin: {
    session_rpe: 8,
    duration_minutes: 90,
    sleep: 4,
    fatigue: 3,
    soreness: 4,
    stress: 4,
    note: null,
  },
  block: { phase: "Uppbyggnad", name: "VO₂max-block", focus: "VO₂max" },
  nextRace: { name: "Vätternrundan", race_date: "2027-06-12", priority: "A" },
  trend: null,
  earlier: [
    {
      performed_on: "2026-10-13",
      name: "5 × 4 min",
      seconds: 5400,
      distance_m: 44000,
      normalized_power: 240,
      intensity_factor: 0.8,
      avg_speed: 29,
      avg_hr: 150,
      decoupling: 4.1,
    },
  ],
  before90: [
    {
      id: "b1",
      name: "Tidigare",
      sport: "cykling",
      performed_on: "2026-09-15",
      curve: { power: SPANS.map((t) => [t, 290 + 20000 / t]), speed: [] },
      best: null,
    },
  ],
  ...over,
});

describe("sessionBrief", () => {
  it("tar med passet, testvärdena, planen, perioden och de tidigare passen", () => {
    const text = sessionBrief(base());
    expect(text).toContain('cykling, 2026-10-20, "5 × 4 min"');
    expect(text).toContain("CP 310 W, W′ 20,0 kJ");
    expect(text).toContain("NP 245 W");
    expect(text).toContain("strain 1,20 W′");
    expect(text).toContain("VO₂max 5 × 4 min (cykling, 1:30:00)");
    expect(text).toContain("sessions-RPE 8");
    expect(text).toContain('Uppbyggnad ("VO₂max-block"), fokus: VO₂max');
    expect(text).toContain("Vätternrundan, 2027-06-12 (A-lopp)");
    expect(text).toContain('2026-10-13 "5 × 4 min": 1:30:00');
    expect(text).toContain("- 1: 4:00, 360 W, puls 168");
  });

  it("säger nytt bästa mot de 90 dagarna före", () => {
    const text = sessionBrief(base());
    expect(text).toMatch(/5 min: 367 W mot bästa 357 W .*nytt bästa/);
  });

  it("säger rakt ut när plan, incheckning och period saknas", () => {
    const text = sessionBrief(
      base({ planned: [], checkin: null, block: null, nextRace: null }),
    );
    expect(text).toContain("Inget pass låg i kalendern den dagen.");
    expect(text).toContain("Ingen incheckning samma dag.");
    expect(text).toContain("Ingen period i säsongsplanen den dagen.");
  });

  it("märker uppskattad strain", () => {
    expect(
      sessionBrief(base({ strain: { value: 0.4, estimated: true } })),
    ).toContain("uppskattad ur nedsamplad serie");
  });

  it("tar med veckans belastning", () => {
    const trend = loadTrend(
      [
        {
          id: "x",
          sport: "cykling",
          performed_on: "2026-10-19",
          seconds: 7200,
          kj: null,
          km: null,
          strain: 1,
        },
      ],
      "2026-10-20",
    );
    expect(sessionBrief(base({ trend }))).toContain(
      "Belastningen de sju dagarna till och med passet:",
    );
  });

  it("skriver löpning i tempo", () => {
    const text = sessionBrief(
      base({
        activity: {
          ...base().activity,
          sport: "löpning",
          summary: summary({
            normalizedPower: null,
            avgPower: null,
            intensityFactor: null,
            avgSpeed: 12,
            best: [],
            curve: { power: [], speed: [] },
          }),
          reference: {
            ftp: null,
            ftpSource: null,
            cp: null,
            wPrime: null,
            cs: 4,
            dPrime: 200,
            lthr: null,
            testedOn: "2026-09-01",
          },
          laps: [],
        },
        earlier: [],
        before90: [],
      }),
    );
    expect(text).toContain("tempo 5:00 /km");
    expect(text).toContain("CS 4:10 /km, D′ 200 m");
    expect(text).not.toContain("NP");
  });
});

describe("sessionBrief med durability", () => {
  it("tar med bästa efter utfört arbete", () => {
    const input = base();
    input.activity.summary.durability = {
      axis: "kJ",
      points: [
        [0, 1200, 300],
        [1000, 1200, 285],
        [2000, 1200, 270],
        [0, 300, 360],
      ],
    };
    const text = sessionBrief(input);
    expect(text).toContain("utfört arbete (durability)");
    expect(text).toContain(
      "20 min: 0 kJ: 300 W, 1000 kJ: 285 W, 2000 kJ: 270 W",
    );
    expect(text).not.toContain("5 min: 0 kJ");
  });
});
