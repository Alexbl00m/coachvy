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
  type AnalysisArgs,
  type Effort,
  type Metric,
  type SessionAnalysis,
} from "./analysis";
import { ftpZones } from "./zones";

/**
 * Samma som `analyseSession`, men med de protokoll som bara räknas på servern.
 * Allt som sparar eller visar ett testtillfälle på servern går hit.
 */
export function analyseSessionOnServer(args: AnalysisArgs): SessionAnalysis {
  if (args.protocol === "metabol-profil") {
    return metabolicProfile(
      args.efforts,
      args.weightKg,
      args.bodyFatPct ?? null,
      args.sex ?? null,
    );
  }
  return analyseSession(args);
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
 * modellen. Hela kedjan från rådata gav tröskeln 12–15 W och FatMax 3–9 W
 * lägre än profileringen på de rena testen. Det tredje testet hade en för lugnt
 * körd 6-minut, och det är den kontrollen längre ned till för.
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
      "Tröskel och FatMax räknas med Mader-modellen ur VO2max och VLamax. Jämfört med tre externa metabola profileringar av samma atleter hamnade tröskeln 12–15 W och FatMax 3–9 W lägre på rena test.",
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
