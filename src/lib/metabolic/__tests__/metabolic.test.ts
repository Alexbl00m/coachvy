import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  analyzeRemoteTest,
  analyzeStepTest,
  assessQuality,
  curveBand,
  estimateProfile,
  fitVlamaxToStepTest,
  estimateUncertainty,
  fitCriticalPower,
  lactateDistributionVolume,
  metabolicZones,
  RemoteTestInput,
  runEngine,
  sprintLactateVlamax,
  validateInput,
} from "..";

/**
 * Referensfall ur tre INSCYD-rapporter (cykel), avidentifierade.
 * A och C är gjorda med 2021 års version, B med 2020 års. Värdena i `ref` är rapporternas.
 */
const REF = {
  A: {
    input: {
      bodyMass: 77,
      bodyFatPct: 12,
      sex: "male",
      sprint: { durationSec: 20, power: 776 },
      efforts: [
        { durationSec: 184, power: 443 },
        { durationSec: 359, power: 393 },
        { durationSec: 714, power: 348 },
      ],
    } as RemoteTestInput,
    ref: { vo2max: 4872 / 77, vlamax: 0.5455, volRel: 0.4915, at: 303, atPct: 77.7, fatMax: 198, fatKcal: 454, carbMaxWkg: 2.8 },
  },
  B: {
    ref: { bodyMass: 78, vo2max: 4537 / 78, vlamax: 0.369, volRel: 0.4811, at: 303, atPct: 83.6, fatMax: 205, fatKcal: 499, carbMaxWkg: 2.9 },
  },
  C: {
    input: {
      bodyMass: 85,
      bodyFatPct: 12,
      sex: "male",
      sprint: { durationSec: 17, power: 1047 },
      efforts: [
        { durationSec: 178, power: 529 },
        { durationSec: 359, power: 451 },
        { durationSec: 719, power: 433 },
      ],
      weights: { aerobic: 1, glycolytic: 1, threshold: 5 },
    } as RemoteTestInput,
    ref: { vo2max: 5974 / 85, vlamax: 0.595, volRel: 0.49, at: 374, atPct: 78.3, fatMax: 245, fatKcal: 569, carbMaxWkg: 2.9 },
  },
};

describe("kroppssammansättning", () => {
  it("ger samma fördelningsvolym som referensrapporterna för män", () => {
    expect(lactateDistributionVolume("male", 12)).toBeCloseTo(0.4913, 3);
    expect(lactateDistributionVolume("male", 14)).toBeCloseTo(0.4813, 3);
  });
});

describe("steady state-motorn", () => {
  const cases = [
    { name: "A", bodyMass: 77, ...REF.A.ref },
    { name: "B", ...REF.B.ref },
    { name: "C", bodyMass: 85, ...REF.C.ref },
  ];
  for (const c of cases) {
    it(`återger rapportens markörer för ${c.name}`, () => {
      const r = runEngine({ bodyMass: c.bodyMass, vo2max: c.vo2max, vlamax: c.vlamax, volRel: c.volRel });
      expect(r.at?.power).toBeGreaterThan(c.at - 2);
      expect(r.at?.power).toBeLessThan(c.at + 2);
      expect(r.at?.pctVo2max).toBeCloseTo(c.atPct, 0);
      expect(Math.abs((r.fatMax?.power ?? 0) - c.fatMax)).toBeLessThan(3);
      expect(Math.abs((r.fatMax?.fatKcalH ?? 0) - c.fatKcal) / c.fatKcal).toBeLessThan(0.015);
      expect(Math.abs((r.carbMax ?? 0) / c.bodyMass - c.carbMaxWkg)).toBeLessThan(0.06);
    });
  }

  it("ger stigande effekt och laktat bara under tröskeln", () => {
    const r = runEngine({ bodyMass: 77, vo2max: 63, vlamax: 0.5, volRel: 0.49 });
    for (let i = 1; i < r.points.length; i++) expect(r.points[i].power).toBeGreaterThan(r.points[i - 1].power);
    const above = r.points.filter((p) => p.power > (r.at?.power ?? 0) + 1);
    expect(above.every((p) => p.lactate === null && p.fatGh === 0)).toBe(true);
    expect(r.lt2).toBeLessThan(r.lt4 as number);
    expect(r.lt4).toBeLessThan(r.at?.power as number);
  });

  it("sänker tröskeln när VLaMax ökar", () => {
    const low = runEngine({ bodyMass: 77, vo2max: 63, vlamax: 0.35, volRel: 0.49 }).at?.power as number;
    const high = runEngine({ bodyMass: 77, vo2max: 63, vlamax: 0.65, volRel: 0.49 }).at?.power as number;
    expect(high).toBeLessThan(low - 20);
  });
});

describe("critical power", () => {
  it("återskapar CP och W′ ur exakta data", () => {
    const fit = fitCriticalPower([180, 360, 720].map((t) => ({ durationSec: t, power: 300 + 24000 / t })));
    expect(fit?.cp).toBeCloseTo(300, 6);
    expect(fit?.wPrime).toBeCloseTo(24000, 3);
    expect(fit?.residuals.every((r) => Math.abs(r.deviationPct) < 1e-9)).toBe(true);
  });
});

describe("distanstestet", () => {
  it("återger referens A ur bara effekttesterna", () => {
    const est = estimateProfile(REF.A.input);
    expect(est).not.toBeNull();
    expect(est?.vo2max).toBeCloseTo(REF.A.ref.vo2max, 0);
    expect(Math.abs((est?.vlamax ?? 0) - REF.A.ref.vlamax)).toBeLessThan(0.015);
    expect(Math.abs((est?.engine.at?.power ?? 0) - REF.A.ref.at)).toBeLessThan(3);
    expect(Math.abs((est?.engine.fatMax?.power ?? 0) - REF.A.ref.fatMax)).toBeLessThan(4);
  });

  it("återger referens C med tränarens vikter", () => {
    const est = estimateProfile(REF.C.input);
    expect(Math.abs((est?.vo2max ?? 0) - REF.C.ref.vo2max)).toBeLessThan(0.8);
    expect(Math.abs((est?.vlamax ?? 0) - REF.C.ref.vlamax)).toBeLessThan(0.015);
    expect(Math.abs((est?.engine.at?.power ?? 0) - REF.C.ref.at)).toBeLessThan(4);
    expect(Math.abs((est?.engine.fatMax?.power ?? 0) - REF.C.ref.fatMax)).toBeLessThan(4);
  });

  it("låter tröskeltestet styra mer när det viktas upp", () => {
    const even = estimateProfile({ ...REF.C.input, weights: { aerobic: 1, glycolytic: 1, threshold: 1 } });
    const heavy = estimateProfile(REF.C.input);
    expect((heavy?.engine.at?.power ?? 0) - (even?.engine.at?.power ?? 0)).toBeGreaterThan(10);
  });

  it("flaggar referens C:s motstridiga tester", () => {
    const input = { ...REF.C.input, weights: { aerobic: 1, glycolytic: 1, threshold: 1 } };
    const flags = assessQuality(input, estimateProfile(input)!);
    expect(flags.some((f) => f.code === "markers")).toBe(true);
    expect(flags.some((f) => f.code.startsWith("cp-residual"))).toBe(true);
  });

  it("ger rimlig osäkerhet", () => {
    const est = estimateProfile(REF.A.input)!;
    const u = estimateUncertainty(REF.A.input, est, { bodyFatMethod: "caliper" });
    expect(u.at).toBeGreaterThan(2);
    expect(u.at).toBeLessThan(20);
    expect(u.vo2max).toBeGreaterThan(0.3);
    expect(u.vo2max).toBeLessThan(4);
  });

  it("ger zoner i stigande ordning", () => {
    const zones = metabolicZones(estimateProfile(REF.A.input)!.engine);
    expect(zones).toHaveLength(6);
    for (let i = 1; i < zones.length; i++) expect(zones[i].lower).toBeGreaterThan(zones[i - 1].lower);
  });

  it("stoppar felaktig indata", () => {
    const bad = { ...REF.A.input, efforts: [{ durationSec: 180, power: 300 }, { durationSec: 720, power: 340 }] };
    expect(validateInput(bad).some((f) => f.code === "order")).toBe(true);
    expect(validateInput(REF.A.input)).toHaveLength(0);
  });
});

describe("hela analysen och osäkerhetsbanden", () => {
  it("ger samma osäkerhet som estimateUncertainty och en variant per felkälla", () => {
    const result = analyzeRemoteTest(REF.A.input, { bodyFatMethod: "caliper" });
    expect(result.ok).toBe(true);
    if (result.ok === false) return;
    // wattmätare, sprint, tre längre test, vikt och kroppsfett
    expect(result.variants).toHaveLength(7);
    const direct = estimateUncertainty(REF.A.input, result.estimate, { bodyFatMethod: "caliper" });
    expect(result.spread.at).toBeCloseTo(direct.at, 6);
    expect(result.zones).toHaveLength(6);
  });

  it("stoppar ogiltig indata", () => {
    const result = analyzeRemoteTest({ ...REF.A.input, bodyMass: 0 });
    expect(result.ok).toBe(false);
  });

  it("ger band som omsluter kurvan och öppnar sig vid tröskeln", () => {
    const result = analyzeRemoteTest(REF.A.input);
    if (result.ok === false) throw new Error("analysen misslyckades");
    const engines = result.variants.map((v) => v.engine);
    const powers = Array.from({ length: 60 }, (_, i) => 100 + i * 5);
    const cho = curveBand(result.estimate.engine, engines, "choGh", powers);
    expect(cho.every((b) => b.low <= b.value && b.value <= b.high)).toBe(true);
    expect(cho.some((b) => b.high - b.low > 1)).toBe(true);
    const at = result.estimate.engine.at?.power as number;
    for (const direction of ["vertical", "horizontal"] as const) {
      const lactate = curveBand(result.estimate.engine, engines, "lactate", powers, { cap: 12, direction });
      expect(lactate.every((b) => b.power < at)).toBe(true);
      expect(lactate.every((b) => b.low <= b.value + 1e-9 && b.value <= b.high + 1e-9)).toBe(true);
      expect(lactate.some((b) => b.open && b.high === 12)).toBe(true);
      expect(lactate.filter((b) => b.power < at - 40).every((b) => !b.open)).toBe(true);
    }
    // Vågrätt band: övre gränsen stiger utan hack mot tröskeln
    const horizontal = curveBand(result.estimate.engine, engines, "lactate", powers, { cap: 12, direction: "horizontal" });
    const rising = horizontal.filter((b) => b.power > 150);
    for (let i = 1; i < rising.length; i++) expect(rising[i].low).toBeGreaterThanOrEqual(rising[i - 1].low - 1e-9);
  });
});

/**
 * Referens D: samma atlet i labb (stegtest med 4-minuterssteg, 89 kg, Ergonizer) och i fält
 * 14 månader senare (3 och 12 min, 85 kg, ingen sprint). Labbets VO2max är uppskattad, 4,87 L/min.
 * Ergonizer: modifierad D-max 300 W, 4 mmol/L 299,9 W.
 */
const REF_D = {
  field: {
    bodyMass: 85,
    bodyFatPct: 10,
    sex: "male",
    sprint: null,
    efforts: [
      { durationSec: 182, power: 443 },
      { durationSec: 721, power: 353 },
    ],
  } as RemoteTestInput,
  // Sista steget (370 W) hölls bara 2 av 4 minuter och är utelämnat
  steps: [
    [160, 0.8], [180, 0.8], [200, 1.1], [220, 1.4], [240, 1.9], [260, 2.4],
    [280, 3.0], [300, 3.9], [320, 6.2], [340, 8.2], [360, 12.0],
  ].map(([power, lactate]) => ({ power, lactate })),
  lab: { bodyMass: 89, vo2maxAbs: 4.87, modDmax: 300, obla4: 299.9 },
};

describe("referens D: fälttest utan sprint mot labbets stegtest", () => {
  const est = estimateProfile(REF_D.field)!;

  it("klarar sig utan sprint och flaggar det", () => {
    expect(validateInput(REF_D.field)).toHaveLength(0);
    expect(est).not.toBeNull();
    expect(est.markers.map((m) => m.key).sort()).toEqual(["aerobic", "threshold"]);
    expect(assessQuality(REF_D.field, est).some((f) => f.code === "no-sprint")).toBe(true);
  });

  it("ger samma VO2max i L/min som labbets uppskattning", () => {
    expect(Math.abs((est.vo2max * REF_D.field.bodyMass) / 1000 - REF_D.lab.vo2maxAbs)).toBeLessThan(0.2);
  });

  it("räknar D-max som Ergonizer", () => {
    const a = analyzeStepTest(REF_D.steps)!;
    expect(Math.abs((a.modDmax as number) - REF_D.lab.modDmax)).toBeLessThan(8);
    expect(Math.abs((a.obla4 as number) - REF_D.lab.obla4)).toBeLessThan(4);
  });

  it("pekar på samma profil som labbets laktatkurva", () => {
    const fit = fitVlamaxToStepTest(REF_D.steps, {
      bodyMass: REF_D.lab.bodyMass,
      vo2max: (REF_D.lab.vo2maxAbs * 1000) / REF_D.lab.bodyMass,
      volRel: est.volRel,
    })!;
    expect(fit.rmsLactate).toBeLessThan(0.5);
    expect(Math.abs(fit.vlamax - est.vlamax)).toBeLessThan(0.06);
    expect(Math.abs((fit.engine.at?.power as number) - (est.engine.at?.power as number))).toBeLessThan(10);
    // Modellens 4 mmol i steady state mot stegtestets 4 mmol
    expect(Math.abs((est.engine.lt4 as number) - REF_D.lab.obla4)).toBeLessThan(10);
  });

  it("stoppar för få test utan sprint", () => {
    const tooFew = { ...REF_D.field, efforts: [{ durationSec: 600, power: 360 }, { durationSec: 1200, power: 330 }] };
    expect(validateInput(tooFew).some((f) => f.code === "no-sprint-no-aerobic")).toBe(true);
  });
});

/**
 * Referens E: samma atlet som A, labb 2,5 månader före distanstestet. VO2max uppmätt med
 * gasanalys (4 983 ml/min vid 78,5 kg), stegtest med 3-minuterssteg och +40 W.
 * Labbets AT angavs till 300 W.
 */
const REF_E = {
  steps: [[80, 1.37], [120, 1.38], [160, 1.27], [200, 1.6], [240, 1.97], [280, 3.01], [320, 5.13]].map(
    ([power, lactate]) => ({ power, lactate })
  ),
  lab: { bodyMass: 78.5, vo2maxAbs: 4.983, at: 300 },
};

describe("referens E: distanstest mot uppmätt VO2max och stegtest", () => {
  const est = estimateProfile(REF.A.input)!;

  it("ger VO2max nära den uppmätta i L/min", () => {
    expect(Math.abs((est.vo2max * REF.A.input.bodyMass) / 1000 - REF_E.lab.vo2maxAbs)).toBeLessThan(0.15);
  });

  it("pekar på samma VLaMax och AT som labbets laktatkurva", () => {
    const fit = fitVlamaxToStepTest(REF_E.steps, {
      bodyMass: REF_E.lab.bodyMass,
      vo2max: (REF_E.lab.vo2maxAbs * 1000) / REF_E.lab.bodyMass,
      volRel: est.volRel,
    })!;
    expect(fit.rmsLactate).toBeLessThan(0.35);
    expect(Math.abs(fit.vlamax - est.vlamax)).toBeLessThan(0.06);
    expect(Math.abs((fit.engine.at?.power as number) - (est.engine.at?.power as number))).toBeLessThan(6);
    expect(Math.abs((est.engine.at?.power as number) - REF_E.lab.at)).toBeLessThan(8);
  });

  it("hittar labbets 4 mmol-tröskel", () => {
    expect(Math.abs((analyzeStepTest(REF_E.steps)?.obla4 as number) - REF_E.lab.at)).toBeLessThan(4);
  });
});

/**
 * Referens F: stark sprint (19 s, 12,3 W/kg) och tre längre test som stämmer med varandra, mot två
 * stegtest hos samma labb 7 och 11 månader före. CP och labbet pekar på samma tröskel, sprinten
 * på högre VLaMax. Ett labb två år tidigare mätte VO2max 6,08 L/min men 58 ml/kg/min vid 307 W,
 * alltså 14,9 ml O2/min/W mot modellens 12,5, så VO2max jämförs inte här.
 */
const REF_F = {
  field: {
    bodyMass: 81,
    bodyFatPct: 10,
    sex: "male",
    sprint: { durationSec: 19, power: 995 },
    efforts: [
      { durationSec: 179, power: 465 },
      { durationSec: 299, power: 421 },
      { durationSec: 719, power: 368 },
    ],
  } as RemoteTestInput,
  steps: [[230, 1.37], [260, 1.44], [290, 2.11], [320, 3.49], [350, 6.4]].map(([power, lactate]) => ({ power, lactate })),
  stepsEarlier: [[230, 1.05], [260, 1.33], [290, 2.0], [320, 3.53], [350, 6.56]].map(([power, lactate]) => ({
    power,
    lactate,
  })),
  lab: { bodyMass: 80 },
};

describe("referens F: stark sprint mot labbets stegtest", () => {
  const est = estimateProfile(REF_F.field)!;
  const withoutSprint = estimateProfile({ ...REF_F.field, sprint: null })!;
  const lab = analyzeStepTest(REF_F.steps)!;

  it("pekar ut sprinten när de längre testerna stämmer med varandra", () => {
    const flags = assessQuality(REF_F.field, est);
    expect(flags.find((f) => f.code === "sprint-conflict")?.message).toContain("högre VLaMax");
    expect(flags.some((f) => f.code === "markers")).toBe(false);
    // En svag sprint flaggas åt andra hållet
    const weak = { ...REF_F.field, sprint: { durationSec: 19, power: 650 } };
    expect(assessQuality(weak, estimateProfile(weak)!).find((f) => f.code === "sprint-conflict")?.message).toContain(
      "lägre VLaMax"
    );
    // Med bara två längre test går det inte att se vilket test som avviker
    const two = { ...REF_F.field, efforts: [REF_F.field.efforts[0], REF_F.field.efforts[2]] };
    expect(assessQuality(two, estimateProfile(two)!).some((f) => f.code === "sprint-conflict")).toBe(false);
  });

  it("stämmer med labbets laktatkurva utan sprinten", () => {
    const fit = fitVlamaxToStepTest(REF_F.steps, {
      bodyMass: REF_F.lab.bodyMass,
      vo2max: (withoutSprint.vo2max * REF_F.field.bodyMass) / REF_F.lab.bodyMass,
      volRel: withoutSprint.volRel,
    })!;
    expect(fit.rmsLactate).toBeLessThan(0.2);
    expect(Math.abs(fit.vlamax - withoutSprint.vlamax)).toBeLessThan(0.08);
    expect(est.vlamax - fit.vlamax).toBeGreaterThan(0.2);
    expect(Math.abs((withoutSprint.engine.at?.power as number) - (lab.obla4 as number))).toBeLessThan(8);
  });

  it("litar på uppmätt sprintlaktat i stället för sprintens watt", () => {
    // 7,7 mmol/L efter 19 s: (7,7 − 1,0) / (19 − 3,5) = 0,43, samma som labbets laktatkurva
    const input = { ...REF_F.field, sprintLactate: { peak: 7.7 } };
    expect(sprintLactateVlamax(input)).toBeCloseTo(0.432, 3);
    expect(sprintLactateVlamax({ ...input, sprintLactate: { peak: 7.7, rest: 1.5 } })).toBeCloseTo(0.4, 3);
    const e = estimateProfile(input)!;
    expect(Math.abs(e.vlamax - withoutSprint.vlamax)).toBeLessThan(0.06);
    expect(assessQuality(input, e).some((f) => f.code === "sprint-conflict")).toBe(false);
    expect(validateInput(input)).toHaveLength(0);
    expect(validateInput({ ...input, sprint: null }).some((f) => f.code === "sprint-lactate-no-sprint")).toBe(true);
    expect(validateInput({ ...input, sprintLactate: { peak: 40 } }).some((f) => f.code === "sprint-lactate")).toBe(true);
  });

  it("räknar utan en sprint under 15 s och säger det", () => {
    const short = { ...REF_F.field, sprint: { durationSec: 10, power: 1200 } };
    const e = estimateProfile(short)!;
    expect(e.vlamax).toBeCloseTo(withoutSprint.vlamax, 3);
    expect(e.markers.some((m) => m.key === "glycolytic")).toBe(false);
    const flags = assessQuality(short, e);
    expect(flags.some((f) => f.code === "short-sprint")).toBe(true);
    expect(flags.some((f) => f.code === "no-sprint")).toBe(false);
    // Med uppmätt laktat går även en kort sprint att använda
    const withLactate = estimateProfile({ ...short, sprintLactate: { peak: 4 } })!;
    expect(withLactate.markers.some((m) => m.key === "glycolytic")).toBe(true);
  });

  it("har CP 0–10 % över labbets modifierade D-max", () => {
    const ratio = (est.cp?.cp as number) / (lab.modDmax as number);
    expect(ratio).toBeGreaterThan(1);
    expect(ratio).toBeLessThan(1.1);
  });

  it("ger samma tröskel i två stegtest med fyra månaders mellanrum", () => {
    const earlier = analyzeStepTest(REF_F.stepsEarlier)!;
    expect(Math.abs((earlier.modDmax as number) - (lab.modDmax as number))).toBeLessThan(3);
    expect(Math.abs((earlier.obla4 as number) - (lab.obla4 as number))).toBeLessThan(3);
  });
});

describe("stegtest", () => {
  it("hittar D-max, modifierad D-max och 4 mmol i rimlig ordning", () => {
    const steps = [100, 140, 180, 220, 260, 300, 340, 380].map((power) => ({
      power,
      lactate: 1 + 0.4 * Math.exp((power - 200) / 60),
    }));
    const a = analyzeStepTest(steps)!;
    expect(a.dmax).not.toBeNull();
    expect(a.modDmax).not.toBeNull();
    expect(a.obla4).toBeGreaterThan(300);
    expect(a.obla4).toBeLessThan(345);
    expect(a.modDmax as number).toBeGreaterThan(a.dmax as number);
    expect(a.modDmax as number).toBeLessThan(380);
  });
});
