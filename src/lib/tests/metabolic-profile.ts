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
import { predictVlamax, sprintPerFfm } from "@/lib/vlamax/model";
import { BUILT_IN_SAMPLES } from "@/lib/vlamax/reference";
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
  if (unit === "W") return (10.8 * peak) / weightKg + 7;
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

/**
 * En sprint och tre maxinsatser – ett batteri för metabol profilering.
 *
 * Kedjan är fyra steg, och varje steg går att pröva för sig:
 *
 * 1. CP och W′ ur 3, 6 och 12 minuter – den vanliga hyperbolen, inget nytt.
 * 2. VLamax ur sprinten per kilo fettfri massa, mot de sexton atleter i
 *    referensdatan där VLamax bestämts i en extern metabol profilering.
 * 3. VO2max ur 6-minuterseffekten med ACSM-ekvationen. Profileringens egen
 *    syreupptagskurva är ACSM-lik: den återger dess %VO2max vid tröskeln
 *    inom en procentenhet. Och dess effekt vid VO2max ligger på 6-minuten.
 * 4. Tröskel och FatMax ur Mader-modellen med de två talen ovan.
 *
 * Prövat mot tre externa profileringar: matad med deras egna VO2max och VLamax
 * gav steg 4 tröskeln 301/294/374 W mot deras 303/303/374, alltså stämmer
 * modellen. Hela kedjan från rådata, med varje atlet utelämnad ur
 * VLamax-referensdatan när hens egen VLamax skattades, gav tröskeln 6 och 17 W
 * lägre och FatMax +6 och −6 W mot profileringen på de två rena testen. Det
 * tredje hade en för lugnt körd 6-minut, och det är kontrollen längre ned till för.
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
        "Minst två av de längre insatserna (3, 6 och 12 minuter) behövs, med både tid och medeleffekt.",
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

  // --- 6-minuten: effekten vid VO2max --------------------------------------
  //
  // Den mest pacingkänsliga insatsen i batteriet. Går den för lugnt blir
  // VO2max för lågt, och det fortplantar sig till tröskeln. Kontrollen:
  // hyperbolen genom 3 och 12 minuter förutsäger 6-minuten, och på rena
  // test har den faktiska legat 12–16 W över. Under är ett tecken.
  const six = long
    .filter((e) => Math.abs(e.durationSeconds - 360) <= 45)
    .sort((a, b) => Math.abs(a.durationSeconds - 360) - Math.abs(b.durationSeconds - 360))[0];
  const shortest = long[0];
  const longest = long[long.length - 1];

  let mapPower: number;
  let mapMethod: string;
  if (six) {
    mapPower = six.intensity;
    mapMethod = `${sv1(six.durationSeconds / 60, six.durationSeconds % 60 === 0 ? 0 : 1)} min`;

    if (shortest !== six && longest !== six && shortest.durationSeconds < six.durationSeconds && longest.durationSeconds > six.durationSeconds) {
      const workShort = shortest.intensity * shortest.durationSeconds;
      const workLong = longest.intensity * longest.durationSeconds;
      const cp2 = (workLong - workShort) / (longest.durationSeconds - shortest.durationSeconds);
      const w2 = workShort - cp2 * shortest.durationSeconds;
      const expected = cp2 + w2 / six.durationSeconds;
      if (six.intensity < expected) {
        warnings.push(
          `6-minuten ligger ${Math.round(expected - six.intensity)} W under vad 3 och 12 minuter förutsäger (${Math.round(expected)} W). På rena test ligger den över, så den kördes troligen för lugnt. VO2max, tröskel och FatMax blir då för låga – kör om den om det går.`,
        );
      }
    }
  } else {
    // Utan en 6-minut får hyperbolen stå för den. En 5-minut direkt vore
    // närmare till hands men ger för hög effekt: VO2max-effekten i
    // referensprofileringarna ligger på 6-minuten, inte på den kortaste insatsen som når dit.
    mapPower = cp.criticalPower + (cp.wPrime * 1000) / 360;
    mapMethod = "CP + W′/360 s";
    warnings.push(
      `Ingen insats på 6 minuter. Effekten vid VO2max är tagen ur hyperbolen i stället (${Math.round(mapPower)} W), vilket gör VO2max och tröskeln något osäkrare.`,
    );
  }

  let vo2max: number | null = null;
  if (weightKg && weightKg > 0) {
    vo2max = (10.8 * mapPower) / weightKg + 7;
  } else {
    warnings.push("Vikt saknas – VO2max, tröskel och FatMax kräver den.");
  }

  // --- VLamax ur sprinten -------------------------------------------------
  let vlamax: number | null = null;
  let vlamaxMetric: Metric | null = null;
  if (!sprint) {
    warnings.push(
      "Ingen sprint under en minut. VLamax, och därmed tröskel och FatMax, kräver den.",
    );
  } else if (!(weightKg && weightKg > 0) || bodyFatPct === null || !(bodyFatPct > 0) || !sex) {
    warnings.push(
      "Kroppsfett och kön behövs för VLamax. VLamax är glykolytisk förmåga per muskelmassa, och utan fettfri massa finns ingen muskelmassa att räkna på.",
    );
  } else {
    const prediction = predictVlamax(BUILT_IN_SAMPLES, {
      sex,
      weightKg,
      bodyFatPct,
      sprintSeconds: sprint.durationSeconds,
      wattAvg: sprint.intensity,
    });
    if (prediction && prediction.value > 0) {
      vlamax = prediction.value;
      const perFfm = sprintPerFfm(sprint.intensity, weightKg, bodyFatPct);
      vlamaxMetric = metric("VLamax", "VLamax", prediction.value, "mmol/l/s", {
        method:
          prediction.outOfRange.length > 0
            ? "extrapolerad utanför referensdatan"
            : `${sv1(perFfm, 1)} W/kg fettfri massa`,
        isPrimary: true,
      });
      if (prediction.outOfRange.length > 0) {
        warnings.push(
          `VLamax är en extrapolation: ${prediction.outOfRange
            .map((o) => `${o.label.toLowerCase()} ${sv1(o.value, 1)} ${o.unit} mot ${sv1(o.min, 1)}–${sv1(o.max, 1)} i referensdatan`)
            .join(", ")}. Tröskel och FatMax vilar på den och är lika osäkra.`,
        );
      }
      warnings.push(
        `VLamax skattas ur ${prediction.sampleCount} referensatleter med känd VLamax. Typiskt fel på en ny atlet: ±${sv1(prediction.rmse, 2)} mmol/l/s.`,
      );
    }
  }

  // --- Tröskel och FatMax -------------------------------------------------
  let at: number | null = null;
  let fatMax: number | null = null;
  if (vo2max !== null && vlamax !== null && weightKg) {
    const profile = calculateMetabolicProfile({
      vo2max,
      vlamax,
      vo2maxPower: mapPower,
      weightKg,
    });
    at = profile.thresholds.anaerobicThreshold?.power ?? null;
    fatMax = profile.thresholds.fatMax?.power ?? null;
  }

  if (vo2max !== null) {
    metrics.push(
      metric("VO2max", "VO2max", vo2max, "ml/kg/min", {
        method: `ACSM på ${mapMethod}`,
        isPrimary: true,
      }),
    );
  }
  if (vlamaxMetric) metrics.push(vlamaxMetric);
  if (at !== null) {
    metrics.push(
      metric("AT", "Anaerob tröskel", at, "W", { method: "Mader", isPrimary: true }),
    );
  }
  if (fatMax !== null) {
    metrics.push(
      metric("FatMax", "FatMax", fatMax, "W", { method: "Mader", isPrimary: true }),
    );
  }
  // Två oberoende vägar till ungefär samma ställe: CP ur hyperbolen och
  // tröskeln ur modellen. De brukar ligga inom tio procent av varandra – på de
  // rena jämförelsetesten 2–5 %. Mycket större glapp betyder att VO2max eller
  // VLamax är fel, och oftast är det 6-minuten.
  if (at !== null && at < 0.88 * cp.criticalPower) {
    warnings.push(
      `Tröskeln hamnar på ${Math.round((at / cp.criticalPower) * 100)} % av CP. Två oberoende mått brukar ligga inom tio procent av varandra, så något i kedjan stämmer inte – oftast en för lugn 6-minut eller en sprint som inte var all-out.`,
    );
  }
  if (at !== null || fatMax !== null) {
    warnings.push(
      "Tröskel och FatMax räknas med Mader-modellen ur VO2max och VLamax. Jämfört med tre externa metabola profileringar av samma atleter hamnade tröskeln 6–17 W lägre och FatMax inom ±6 W på rena test.",
    );
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
