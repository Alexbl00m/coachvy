import "server-only";

/**
 * Metabol profil: sprint plus 3, 6 och 12 minuter.
 *
 * Ligger i en egen modul som bara får importeras på servern. VLamax-modellen
 * och referensdatan är det som gör protokollet värt att betala för, och
 * `import "server-only"` gör att bygget stoppar om en klientkomponent någonsin
 * försöker dra in den. Webbläsaren får resultatet, aldrig beräkningen.
 */

import { calculateCriticalPower, isError } from "@/lib/calculators/critical-power";
import { calculateMetabolicProfile } from "@/lib/calculators/metabolic";
import {
  analyzeRemoteTest,
  CP_EFFORT_RANGE,
  fitVlamaxToStepTest,
  lactateDistributionVolume,
} from "@/lib/metabolic";
import {
  analyseSession,
  anaerobicProfile,
  metric,
  peakLabel,
  type AnalysisArgs,
  type Effort,
  type Metric,
  type SessionAnalysis,
} from "./analysis";
import { ftpZones } from "./zones";
import { vo2maxFromRampPeak } from "./vo2max";

/**
 * Samma som `analyseSession`, men med det som bara räknas på servern.
 * Allt som sparar eller visar ett testtillfälle på servern går hit.
 *
 * `members` avgör om medlemsdelarna räknas: VLamax ur ett stegtest. Själva
 * protokollet "metabol profil" är helt och hållet en medlemsfunktion och
 * spärras innan det når hit.
 */
export function analyseSessionOnServer(
  args: AnalysisArgs,
  options: { members?: boolean } = {},
): SessionAnalysis {
  if (args.protocol === "metabol-profil") {
    return metabolicProfile(
      args.efforts,
      args.weightKg,
      args.bodyFatPct ?? null,
      args.sex ?? null,
    );
  }
  const base = analyseSession(args);
  if (args.protocol === "laktat-steg" && options.members) {
    return withStepTestProfile(args, base);
  }
  return base;
}

// ---------------------------------------------------------------------------
// VLamax ur ett stegtest
// ---------------------------------------------------------------------------

const sv = (n: number, digits: number) => n.toFixed(digits).replace(".", ",");

/** Mader-tröskeln för en VLamax, med toppen som skalans ände. */
function thresholdAt(vo2max: number, vlamax: number, peak: number, weightKg: number) {
  return (
    calculateMetabolicProfile({ vo2max, vlamax, vo2maxPower: peak, weightKg }).thresholds
      .anaerobicThreshold?.power ?? null
  );
}

/**
 * Den VLamax som lägger Mader-tröskeln på `target`.
 *
 * Tröskeln sjunker när VLamax stiger, så en halveringssökning räcker. Null när
 * målet ligger utanför vad någon rimlig VLamax kan ge – oftast för att toppen
 * inte var all-out och tröskeln därför hamnar nära den.
 */
function solveVlamax(target: number, vo2max: number, peak: number, weightKg: number) {
  const LOW = 0.03;
  const HIGH = 1.5;
  // Ingen tröskel alls betyder att den ligger ovanför toppen: vid mycket låg
  // VLamax hinner produktionen aldrig ikapp förbränningen. Det räknas som en
  // tröskel högre än målet, inte som ett fel.
  const above = (vlamax: number) => {
    const at = thresholdAt(vo2max, vlamax, peak, weightKg);
    return at === null || at > target;
  };
  if (!above(LOW) || above(HIGH)) return null;

  let lo = LOW;
  let hi = HIGH;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (above(mid)) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** VO2max ur toppen när den inte är uppmätt: ACSM:s ekvationer. */
function estimateVo2max(
  peak: number,
  unit: AnalysisArgs["unit"],
  weightKg: number,
): number | null {
  // Rampens topp: Hawley & Noakes är framtagen just ur den. ACSM, som är
  // gjord för stabilt arbete, hamnar lägre – mot ett uppmätt 77,0 gav den
  // 71,3 och Hawley & Noakes 73,4.
  if (unit === "W") return vo2maxFromRampPeak(peak, weightKg);
  // Löpning på plan mark: 0,2 ml/kg/min per m/min plus vila.
  const metresPerMinute = unit === "km/h" ? (peak * 1000) / 60 : peak * 60;
  return 0.2 * metresPerMinute + 3.5;
}

/**
 * VLamax, FatMax och CarbMax ur ett laktatstegtest med all-out-slut.
 *
 * Mader-modellen ger en tröskel ur VO2max och VLamax. Här går räkningen åt
 * andra hållet: tröskeln är uppmätt (ModDmax), toppen också (Vmax eller Wmax),
 * och frågan är vilken VLamax som får modellens tröskel att hamna där. Med
 * VLamax på plats ger samma modell FatMax och CarbMax.
 *
 * Det modellen egentligen bestämmer är VLamax i förhållande till VO2max – ett
 * lägre VO2max ger en proportionellt lägre VLamax för samma tröskel. Ett
 * uppmätt VO2max gör därför siffran säkrare; utan det skattas VO2max ur toppen.
 *
 * Prövat på ett löpbandstest med fjorton steg och rapportens VO2max 55,4: med
 * Dmax som ankare gav metoden 0,27 mot rapportens 0,26. Med ModDmax, som är
 * coachens val av tröskel och det som används här, 0,18. Ett test räcker inte
 * för att säga vilket ankare som stämmer bäst, och därför visas båda.
 */
/**
 * VLamax ur ett stegtest på cykel: den VLamax som får den kalibrerade
 * modellens laktatkurva att stämma med stegtestets laktat upp till 4,5 mmol/l.
 *
 * Hela kurvan i stället för en tröskelpunkt. Att låsa modellens tröskel på
 * ModDmax gjorde VLamax mycket känslig för var ModDmax hamnade: med 40 W-steg
 * gav ett test 0,84 mot 0,55–0,59 ur extern profilering, sprintlaktat och
 * distanstestet. Kurvan gav 0,61, och 0,42 mot 0,43 på ett andra test.
 *
 * Tröskel och FatMax ur kurvan är robusta (±5 W när VO2max varieras ±10 %),
 * men VLamax följer VO2max: samma kurva med 10 % högre VO2max kräver en
 * klart högre VLamax. Spannet visas därför alltid.
 */
function withCyclingCurveFit(
  args: AnalysisArgs,
  base: SessionAnalysis,
  {
    vo2max,
    measured,
    weightKg,
    volRel,
    modDmax,
  }: { vo2max: number; measured: number | null; weightKg: number; volRel: number; modDmax: number },
): SessionAnalysis {
  const points = args.efforts.flatMap((e) =>
    e.intensity !== null && e.intensity > 0 && e.lactate !== null
      ? [{ power: e.intensity, lactate: e.lactate }]
      : [],
  );
  const fitAt = (vo2: number) =>
    fitVlamaxToStepTest(points, { bodyMass: weightKg, vo2max: vo2, volRel });
  const fit = fitAt(vo2max);
  if (!fit) {
    return {
      ...base,
      warnings: [
        ...base.warnings,
        "VLamax ur testet kräver minst tre steg med laktat upp till 4,5 mmol/l.",
      ],
    };
  }

  // Känslighet: VO2max varieras ±3 % när det är uppmätt, ±10 % när det är skattat.
  const vo2Spread = measured ? 0.03 : 0.1;
  const range = [fitAt(vo2max * (1 - vo2Spread)), fitAt(vo2max * (1 + vo2Spread))].filter(
    (f) => f !== null,
  );
  const vlas = [fit.vlamax, ...range.map((f) => f.vlamax)];
  const ats = [fit, ...range].flatMap((f) => (f.engine.at ? [f.engine.at.power] : []));
  const { at, fatMax, carbMax } = fit.engine;

  const metrics: Metric[] = [
    ...base.metrics.filter((m) => !(m.key === "VO2max" && measured === null)),
    metric("VLamax", "VLamax", fit.vlamax, "mmol/l/s", {
      method: `ur laktatkurvan, ${sv(Math.min(...vlas), 2)}–${sv(Math.max(...vlas), 2)}`,
      isPrimary: true,
    }),
  ];
  if (fatMax) {
    metrics.push(
      metric("FatMax", "FatMax", fatMax.power, args.unit, { method: "Mader", isPrimary: true }),
      metric("Fat_g_h", "Fett vid FatMax", fatMax.fatGh, "g/h"),
    );
  }
  if (carbMax) {
    metrics.push(metric("CarbMax", "CarbMax 90 g/h", carbMax, args.unit, { method: "Mader" }));
  }
  if (at) {
    metrics.push(metric("CHO_at_LT2", "Kolhydrat vid tröskeln", at.choGh, "g/h"));
  }
  if (measured === null) {
    metrics.push(
      metric("VO2max", "VO2max (skattad)", vo2max, "ml/kg/min", {
        method: `Hawley & Noakes på ${peakLabel(args.unit)}`,
      }),
    );
  }

  const warnings = [
    ...base.warnings,
    `VLamax är den som får modellens laktatkurva att stämma med stegtestets laktat upp till 4,5 mmol/l (avvikelse ${sv(fit.rmsLactate, 2)} mmol/l). Spann ${sv(Math.min(...vlas), 2)}–${sv(Math.max(...vlas), 2)} när ${measured ? "det uppmätta VO2max varieras ±3 %" : "det skattade VO2max varieras ±10 %"}.${at ? ` Modellens tröskel hamnar på ${sv(at.power, 0)} W (${sv(Math.min(...ats), 0)}–${sv(Math.max(...ats), 0)} W), ModDmax på ${sv(modDmax, 0)} W.` : ""}`,
  ];
  if (args.bodyFatPct == null || !args.sex) {
    warnings.push(
      "Stegtestet sparas utan kroppsfett och kön, så laktatets fördelningsvolym räknas för en man med 15 % kroppsfett. Det påverkar VLamax och bränslet i g/h något, inte tröskeln.",
    );
  }
  if (measured === null) {
    warnings.push(
      `VO2max är skattat ur ${peakLabel(args.unit)} (${sv(vo2max, 1)} ml/kg/min). Tröskel och FatMax ur kurvan påverkas bara några watt av det, men VLamax följer VO2max. Ett uppmätt VO2max – ett VO2max-test som slut på testet – gör VLamax säker.`,
    );
  }
  return { ...base, metrics, warnings };
}

function withStepTestProfile(args: AnalysisArgs, base: SessionAnalysis): SessionAnalysis {
  const peak = args.finish?.peakIntensity ?? null;
  const weightKg = args.weightKg;
  const modDmax = base.metrics.find((m) => m.key === "LT2:ModDmax")?.value ?? null;
  const dmax = base.metrics.find((m) => m.key === "LT2:Dmax")?.value ?? null;
  const pmax = base.metrics.find((m) => m.key === "Pmax")?.value ?? null;

  if (args.sport === "simning") return base;
  if (peak === null || pmax === null || modDmax === null || !(weightKg && weightKg > 0)) {
    const missing = [
      peak === null || pmax === null ? `${peakLabel(args.unit)} från ett all-out-slut` : null,
      modDmax === null ? "en ModDmax-tröskel" : null,
      !(weightKg && weightKg > 0) ? "vikt" : null,
    ].filter(Boolean);
    return {
      ...base,
      warnings: [
        ...base.warnings,
        `VLamax ur testet kräver ${missing.join(", ")}.`,
      ],
    };
  }

  const measured = args.finish?.vo2max ?? null;
  const vo2max = measured ?? estimateVo2max(peak, args.unit, weightKg);
  if (vo2max === null || !(vo2max > 0)) return base;

  const volRel = profileVolRel(args.protocol, args.unit, args.sex ?? null, args.bodyFatPct ?? null);
  if (volRel !== null) {
    return withCyclingCurveFit(args, base, { vo2max, measured, weightKg, volRel, modDmax });
  }

  const vlamax = solveVlamax(modDmax, vo2max, peak, weightKg);
  if (vlamax === null) {
    return {
      ...base,
      warnings: [
        ...base.warnings,
        `Modellen når inte ModDmax (${sv(modDmax, 1)}) med någon rimlig VLamax när toppen är ${sv(peak, 1)}. Oftast betyder det att slutet inte var all-out, så att tröskeln hamnar för nära toppen.`,
      ],
    };
  }

  // Känslighet: det som inte är uppmätt varieras, och spannet visas.
  const vo2Spread = measured ? 0.03 : 0.1;
  const candidates = [
    solveVlamax(modDmax, vo2max * (1 - vo2Spread), peak, weightKg),
    solveVlamax(modDmax, vo2max * (1 + vo2Spread), peak, weightKg),
    solveVlamax(modDmax, vo2max, peak * 0.98, weightKg),
    solveVlamax(modDmax, vo2max, peak * 1.02, weightKg),
  ].filter((v): v is number => v !== null);
  const low = Math.min(vlamax, ...candidates);
  const high = Math.max(vlamax, ...candidates);
  const viaDmax = dmax !== null ? solveVlamax(dmax, vo2max, peak, weightKg) : null;

  const profile = calculateMetabolicProfile({
    vo2max,
    vlamax,
    vo2maxPower: peak,
    weightKg,
  });
  const { fatMax, carbMax, anaerobicThreshold } = profile.thresholds;

  const metrics: Metric[] = [
    ...base.metrics.filter((m) => !(m.key === "VO2max" && measured === null)),
    metric("VLamax", "VLamax", vlamax, "mmol/l/s", {
      method: `ur ModDmax och ${peakLabel(args.unit)}`,
      isPrimary: true,
    }),
  ];
  if (fatMax) {
    metrics.push(
      metric("FatMax", "FatMax", fatMax.power, args.unit, { method: "Mader", isPrimary: true }),
      metric("Fat_g_h", "Fett vid FatMax", fatMax.fatPerHour, "g/h"),
    );
  }
  if (carbMax) {
    metrics.push(metric("CarbMax", "CarbMax 90 g/h", carbMax.power, args.unit, { method: "Mader" }));
  }
  if (anaerobicThreshold) {
    metrics.push(
      metric("CHO_at_LT2", "Kolhydrat vid tröskeln", anaerobicThreshold.carbsPerHour, "g/h"),
    );
  }
  if (measured === null) {
    metrics.push(
      metric("VO2max", "VO2max (skattad)", vo2max, "ml/kg/min", {
        method: `ACSM på ${peakLabel(args.unit)}`,
      }),
    );
  }

  const warnings = [
    ...base.warnings,
    `VLamax är den som får Mader-modellens tröskel att hamna på ModDmax, med ${peakLabel(args.unit)} som toppen. Spann ${sv(low, 2)}–${sv(high, 2)} när ${measured ? "det uppmätta VO2max varieras ±3 %" : "det skattade VO2max varieras ±10 %"} och ${peakLabel(args.unit)} ±2 %.${viaDmax !== null ? ` Med Dmax som ankare i stället: ${sv(viaDmax, 2)}.` : ""}`,
  ];
  if (measured === null) {
    warnings.push(
      `VO2max är skattat ur ${peakLabel(args.unit)} (${sv(vo2max, 1)} ml/kg/min). Det modellen bestämmer är VLamax i förhållande till VO2max, så ett uppmätt VO2max – ett VO2max-test som slut på testet – gör VLamax säkrare.`,
    );
  }

  return { ...base, metrics, warnings };
}

const sv1 = (n: number, digits = 0) => n.toFixed(digits).replace(".", ",");

const toModelSex = (sex: "man" | "kvinna") => (sex === "kvinna" ? "female" : "male");

/**
 * Laktatets fördelningsvolym för de cykeltester som räknas med den kalibrerade
 * modellen, så att kurvan ritas med samma modell som nyckeltalen. Stegtestet
 * sparas utan kroppsfett och kön och räknas då som en man med 15 %. Null för
 * löpning och för andra protokoll, som ritas med den äldre kurvan.
 */
export function profileVolRel(
  protocol: string,
  unit: string,
  sex: "man" | "kvinna" | null,
  bodyFatPct: number | null,
): number | null {
  const known = sex !== null && bodyFatPct !== null && bodyFatPct > 0;
  if (protocol === "metabol-profil") {
    return known ? lactateDistributionVolume(toModelSex(sex), bodyFatPct) : null;
  }
  if (protocol === "laktat-steg" && unit === "W") {
    return known
      ? lactateDistributionVolume(toModelSex(sex), bodyFatPct)
      : lactateDistributionVolume("male", 15);
  }
  return null;
}

/**
 * En sprint och tre maxinsatser – ett batteri för metabol profilering.
 *
 * CP och W′ kommer ur hyperbolen genom de längre insatserna. VO2max och
 * VLamax skattas av den kalibrerade modellen i `@/lib/metabolic`, som väger
 * ihop sprinten, 3-minuten och CP, och tröskel och FatMax följer ur dem.
 * Kalibrering och validering står i `src/lib/metabolic/README.md`.
 */
export function metabolicProfile(
  efforts: Effort[],
  weightKg: number | null,
  bodyFatPct: number | null,
  sex: "man" | "kvinna" | null,
): SessionAnalysis {
  const warnings: string[] = [];
  const done = efforts.filter(
    (e) =>
      e.intensity !== null &&
      e.intensity > 0 &&
      e.durationSeconds !== null &&
      e.durationSeconds > 0,
  ) as (Effort & { intensity: number; durationSeconds: number })[];

  // Sprinten är allt under en minut; ur den räknas bara VLamax. Den ingår
  // inte i CP – hyperbolen gäller ungefär 2–15 minuter, och en 20-sekunders
  // insats drar W′ uppåt och CP nedåt.
  const sprint = done
    .filter((e) => e.durationSeconds < 60)
    .sort((a, b) => Math.abs(a.durationSeconds - 20) - Math.abs(b.durationSeconds - 20))[0];
  const long = done
    .filter((e) => e.durationSeconds >= 120)
    .sort((a, b) => a.durationSeconds - b.durationSeconds);

  if (long.length < 2) {
    return {
      metrics: [],
      zones: [],
      zoneUnit: "W",
      warnings: [
        "Minst två av de längre insatserna (3, 6 och 12 minuter) behövs, med tid och medeleffekt för varje.",
      ],
    };
  }

  if (done.some((e) => e.durationSeconds >= 60 && e.durationSeconds < 120)) {
    warnings.push(
      "Insatser mellan en och två minuter används inte: för långa för VLamax-modellen, som bygger på 17–23 sekunders sprinter, och för korta för hyperbolen.",
    );
  }
  if (long[long.length - 1].durationSeconds > 900) {
    warnings.push(
      "Hyperbolen gäller ungefär 2–15 minuter. En längre insats drar CP nedåt – 12 minuter är tänkt som den längsta.",
    );
  }

  const cp = calculateCriticalPower(
    long.map((e) => ({ minutes: e.durationSeconds / 60, watts: e.intensity })),
    weightKg,
  );
  if (isError(cp)) {
    return { metrics: [], zones: [], zoneUnit: "W", warnings: [cp.error] };
  }

  const metrics: Metric[] = [];
  // Utan metod, så att passbyggaren hittar CP och W′ här precis som i det
  // vanliga CP-testet.
  const cpMetrics: Metric[] = [
    metric("CP", "Critical power", cp.criticalPower, "W"),
    metric("W_prime", "W′ – anaerob kapacitet", cp.wPrime, "kJ"),
    metric("FTP", "FTP", cp.criticalPower * 0.95, "W", { method: "0,95 × CP" }),
  ];

  // --- VO2max, VLamax, tröskel och FatMax ----------------------------------
  //
  // Den kalibrerade modellen i `@/lib/metabolic`: sprinten, 3-minuten och CP
  // vägs ihop till VO2max och VLamax, och flaggorna säger när testen pekar åt
  // olika håll eller när ett av dem avviker från hyperbolen.
  let at: number | null = null;
  if (!(weightKg && weightKg > 0) || bodyFatPct === null || !(bodyFatPct > 0) || !sex) {
    warnings.push(
      "Vikt, kroppsfett och kön behövs för VO2max, VLamax, tröskel och FatMax. Laktatets fördelningsvolym räknas ur kroppsfettet.",
    );
  } else {
    const sprintOk = sprint && sprint.durationSeconds >= 5 && sprint.durationSeconds <= 35;
    if (sprint && !sprintOk) {
      warnings.push("Sprinten används inte: den ska vara 5–35 sekunder, helst 15–20.");
    }
    const result = analyzeRemoteTest({
      bodyMass: weightKg,
      bodyFatPct,
      sex: toModelSex(sex),
      sprint: sprintOk ? { durationSec: sprint.durationSeconds, power: sprint.intensity } : null,
      sprintLactate: sprintOk && sprint.lactate ? { peak: sprint.lactate } : null,
      efforts: long
        .filter((e) => e.durationSeconds <= CP_EFFORT_RANGE.max)
        .map((e) => ({ durationSec: e.durationSeconds, power: e.intensity })),
    });
    if (!result.ok) {
      warnings.push(...result.errors.map((f) => `${f.title}. ${f.message}`));
    } else {
      const { estimate, spread } = result;
      const engine = estimate.engine;
      at = engine.at?.power ?? null;
      metrics.push(
        metric("VO2max", "VO2max", estimate.vo2max, "ml/kg/min", {
          method: `ur effekttesterna, ±${sv1(spread.vo2max, 1)}`,
          isPrimary: true,
          spread: spread.vo2max,
        }),
        metric("VLamax", "VLamax", estimate.vlamax, "mmol/l/s", {
          method: `${sprintOk && sprint.lactate ? "ur sprintlaktat, " : ""}±${sv1(spread.vlamax, 2)}`,
          isPrimary: true,
          spread: spread.vlamax,
        }),
      );
      if (engine.at) {
        metrics.push(
          metric("AT", "Anaerob tröskel", engine.at.power, "W", {
            method: `troligen ${sv1(engine.at.power - spread.at)}–${sv1(engine.at.power + spread.at)} W`,
            isPrimary: true,
            spread: spread.at,
          }),
        );
      }
      if (engine.fatMax) {
        metrics.push(
          metric("FatMax", "FatMax", engine.fatMax.power, "W", {
            method: `troligen ${sv1(engine.fatMax.power - spread.fatMax)}–${sv1(engine.fatMax.power + spread.fatMax)} W`,
            isPrimary: true,
            spread: spread.fatMax,
          }),
        );
      }
      warnings.push(
        ...result.flags.map((f) => `${f.title}. ${f.message}`),
        "VO2max, VLamax, tröskel och FatMax är modellskattningar ur effekttesterna, med ± för normala mätfel. Modellen är kalibrerad mot tre externa metabola profileringar och kontrollerad mot laktattester.",
      );
    }
  }

  metrics.push(...cpMetrics);
  if (weightKg && weightKg > 0) {
    metrics.push(metric("CP_per_kg", "CP per kg", cp.criticalPower / weightKg, "W/kg"));
    if (at !== null) {
      metrics.push(metric("AT_per_kg", "Tröskel per kg", at / weightKg, "W/kg"));
    }
  }
  if (sprint) {
    metrics.push(
      metric("P_sprint", "Sprint", sprint.intensity, "W", {
        method: `${Math.round(sprint.durationSeconds)} s`,
      }),
    );
  }

  const ratio = anaerobicProfile(cp.criticalPower, cp.wPrime * 1000);
  if (ratio) {
    metrics.push(metric("W_prime_CP", "W′/CP", ratio.ratio, "J/W", { method: ratio.label }));
  }
  if (cp.goodnessOfFit !== null) {
    metrics.push(metric("R2", "Anpassning", cp.goodnessOfFit, "%"));
  }

  return {
    metrics,
    zones: ftpZones(cp.criticalPower * 0.95),
    zoneUnit: "W",
    warnings,
  };
}
