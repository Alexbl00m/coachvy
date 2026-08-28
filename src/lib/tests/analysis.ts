/**
 * Räknar ut vad ett testtillfälle gav.
 *
 * Varje protokoll har sin egen beräkning, men alla returnerar samma form:
 * en lista värden och en lista zoner. Det gör att listor, grafer och
 * jämförelser kan behandla alla testtyper lika.
 *
 * Rådatan sparas, så när en modell förbättras kan gamla test räknas om.
 */

import {
  calculateCriticalPower,
  isError,
  type PowerTest,
} from "@/lib/calculators/critical-power";
import {
  analyseLactateTest,
  summariseThresholds,
  type IntensityUnit,
  type LactateStep,
  type Sport,
} from "@/lib/calculators/lactate";
import { linearFit } from "@/lib/calculators/regression";
import { protocolByKey, type ProtocolKey } from "./protocols";
import {
  criticalSpeedZones,
  ftpZones,
  thresholdZones,
  type ZoneRow,
} from "./zones";

export type Effort = {
  ordinal: number;
  intensity: number | null;
  durationSeconds: number | null;
  distanceM: number | null;
  lactate: number | null;
  heartRate: number | null;
};

export type Metric = {
  key: string;
  label: string;
  value: number;
  unit: string;
  method?: string;
  isPrimary: boolean;
};

export type SessionAnalysis = {
  metrics: Metric[];
  zones: ZoneRow[];
  /** Enheten zonerna redovisas i. */
  zoneUnit: string;
  warnings: string[];
};

export type AnalysisArgs = {
  protocol: ProtocolKey;
  sport: Sport;
  unit: IntensityUnit;
  efforts: Effort[];
  weightKg: number | null;
};

const metric = (
  key: string,
  label: string,
  value: number,
  unit: string,
  options: { method?: string; isPrimary?: boolean } = {},
): Metric => ({
  key,
  label,
  value: Math.round(value * 1000) / 1000,
  unit,
  method: options.method,
  isPrimary: options.isPrimary ?? false,
});

/**
 * Critical speed och D' ur tidtagna distanser.
 *
 * Den linjära formen av den hyperboliska modellen: d = CS·t + D'. En rät linje
 * genom (tid, sträcka) ger CS som lutning och D' som skärning.
 */
function criticalSpeedFromDistances(
  points: { seconds: number; metres: number }[],
): { cs: number; dPrime: number; rSquared: number | null } | null {
  const valid = points.filter((p) => p.seconds > 0 && p.metres > 0);
  if (valid.length < 2) return null;

  const seconds = valid.map((p) => p.seconds);
  const metres = valid.map((p) => p.metres);
  if (Math.min(...seconds) === Math.max(...seconds)) return null;

  const fit = linearFit(seconds, metres);
  if (!fit || !(fit.slope > 0)) return null;

  let rSquared: number | null = null;
  if (valid.length > 2) {
    const mean = metres.reduce((a, b) => a + b, 0) / metres.length;
    const ssTot = metres.reduce((s, v) => s + (v - mean) ** 2, 0);
    const ssRes = metres.reduce(
      (s, v, i) => s + (v - (fit.intercept + fit.slope * seconds[i])) ** 2,
      0,
    );
    rSquared = ssTot > 0 ? 1 - ssRes / ssTot : null;
  }

  return { cs: fit.slope, dPrime: fit.intercept, rSquared };
}

/** m/s till testtillfällets enhet. */
const toUnit = (metresPerSecond: number, unit: IntensityUnit) =>
  unit === "km/h" ? metresPerSecond * 3.6 : metresPerSecond;

/** Testtillfällets enhet till m/s. */
const toMetresPerSecond = (value: number, unit: IntensityUnit) =>
  unit === "km/h" ? value / 3.6 : value;

export function analyseSession(args: AnalysisArgs): SessionAnalysis {
  const { protocol, sport, unit, efforts, weightKg } = args;
  const spec = protocolByKey(protocol);
  const warnings: string[] = [];

  if (!spec) {
    return { metrics: [], zones: [], zoneUnit: unit, warnings: ["Okänt protokoll."] };
  }

  // -------------------------------------------------------------------------
  // Laktatstegtest
  // -------------------------------------------------------------------------
  if (protocol === "laktat-steg") {
    const steps: LactateStep[] = efforts
      .filter((e) => e.intensity !== null && e.lactate !== null)
      .map((e) => ({
        intensity: e.intensity as number,
        lactate: e.lactate as number,
        heartRate: e.heartRate,
      }));

    const analysis = analyseLactateTest({
      steps,
      sport,
      fit: "3:e gradens polynom",
      includeBaseline: true,
      methods: ["Log-log", "OBLA", "Bsln+", "Dmax", "LTP", "LTratio"],
      loglogRestrainer: 1,
      unit,
    });

    if (!analysis) {
      return {
        metrics: [],
        zones: [],
        zoneUnit: unit,
        warnings: ["Minst fyra steg med belastning och laktat krävs."],
      };
    }

    const summary = summariseThresholds(analysis.results);
    const metrics: Metric[] = [];

    if (summary.lt1 !== null) {
      metrics.push(
        metric("LT1", "LT1 – aerob tröskel", summary.lt1, unit, {
          method: `median av ${summary.lt1Methods.length} metoder`,
          isPrimary: true,
        }),
      );
    }
    if (summary.lt2 !== null) {
      metrics.push(
        metric("LT2", "LT2 – anaerob tröskel", summary.lt2, unit, {
          method: `median av ${summary.lt2Methods.length} metoder`,
          isPrimary: true,
        }),
      );
    }

    // Varje enskild metod sparas också, så att en coach som föredrar OBLA 4,0
    // eller ModDmax kan följa just den över tid.
    for (const row of analysis.results) {
      if (row.intensity === null) continue;
      const key = row.method.startsWith("OBLA") || row.method.startsWith("Bsln")
        ? "LT2"
        : row.category === "Log-log" || row.method === "LTP1" || row.method === "LTratio"
          ? "LT1"
          : "LT2";
      metrics.push(
        metric(`${key}:${row.method}`, row.method, row.intensity, unit, {
          method: row.method,
        }),
      );
    }

    if (weightKg && weightKg > 0 && unit === "W" && summary.lt2 !== null) {
      metrics.push(
        metric("LT2_per_kg", "LT2 per kg", summary.lt2 / weightKg, "W/kg"),
      );
    }

    return {
      metrics,
      zones: summary.lt2 !== null ? thresholdZones(summary.lt2) : [],
      zoneUnit: unit,
      warnings: analysis.warnings,
    };
  }

  // -------------------------------------------------------------------------
  // Critical power
  // -------------------------------------------------------------------------
  if (protocol === "critical-power") {
    const tests: PowerTest[] = efforts
      .filter((e) => e.intensity !== null && e.durationSeconds !== null)
      .map((e) => ({
        minutes: (e.durationSeconds as number) / 60,
        watts: e.intensity as number,
      }));

    const result = calculateCriticalPower(tests, weightKg);
    if (isError(result)) {
      return { metrics: [], zones: [], zoneUnit: unit, warnings: [result.error] };
    }

    const metrics: Metric[] = [
      metric("CP", "Critical power", result.criticalPower, "W", { isPrimary: true }),
      metric("W_prime", "W′ – anaerob kapacitet", result.wPrime, "kJ", { isPrimary: true }),
      metric("FTP", "FTP", result.ftp, "W", { method: "0,95 × CP" }),
    ];
    if (result.vo2max !== null) {
      metrics.push(metric("VO2max", "VO2max (skattad)", result.vo2max, "ml/kg/min"));
    }
    if (weightKg && weightKg > 0) {
      metrics.push(
        metric("CP_per_kg", "CP per kg", result.criticalPower / weightKg, "W/kg"),
      );
    }
    const profile = anaerobicProfile(result.criticalPower, result.wPrime * 1000);
    if (profile) {
      metrics.push(
        metric("W_prime_CP", "W′/CP", profile.ratio, "J/W", {
          method: profile.label,
        }),
      );
      warnings.push(`${profile.label}: ${profile.reading}`);
    }
    if (result.goodnessOfFit !== null) {
      metrics.push(metric("R2", "Anpassning", result.goodnessOfFit, "%"));
    } else {
      warnings.push(
        "Två insatser definierar linjen exakt – det finns ingen anpassningsgrad att rapportera. Lägg till en tredje för att se hur väl modellen håller.",
      );
    }

    return { metrics, zones: ftpZones(result.ftp), zoneUnit: "W", warnings };
  }

  // -------------------------------------------------------------------------
  // FTP 20 minuter
  // -------------------------------------------------------------------------
  if (protocol === "ftp-20") {
    const effort = efforts.find(
      (e) => e.intensity !== null && e.intensity > 0,
    );
    if (!effort || effort.intensity === null) {
      return {
        metrics: [],
        zones: [],
        zoneUnit: "W",
        warnings: ["Ange medeleffekten för intervallet."],
      };
    }

    const duration = effort.durationSeconds ?? 1200;
    if (Math.abs(duration - 1200) > 60) {
      warnings.push(
        `Intervallet är ${Math.round(duration / 60)} minuter, inte 20. Faktorn 0,95 är kalibrerad för just 20 minuter, så värdet blir en grov skattning.`,
      );
    }

    const ftp = effort.intensity * 0.95;
    const metrics: Metric[] = [
      metric("FTP", "FTP", ftp, "W", { method: "0,95 × 20 min", isPrimary: true }),
      metric("P20", "Medeleffekt 20 min", effort.intensity, "W"),
    ];
    if (weightKg && weightKg > 0) {
      metrics.push(metric("FTP_per_kg", "FTP per kg", ftp / weightKg, "W/kg"));
    }

    warnings.push(
      "Ett 20-minuterstest ger inget mått på anaerob kapacitet. Behöver du W′ krävs minst två insatser av olika längd.",
    );

    return { metrics, zones: ftpZones(ftp), zoneUnit: "W", warnings };
  }

  // -------------------------------------------------------------------------
  // Enkelinsatsprotokoll på cykel: 5 min, 6 min, ramp
  //
  // Alla tre skattar CP ur ett enda tal via en publicerad faktor. Faktorerna
  // är befolkningssnitt, inte atletens egen kurva, så de sätts aldrig som
  // primärvärde utan en varning om vad det betyder.
  // -------------------------------------------------------------------------
  if (protocol === "cp-5min" || protocol === "cp-6min" || protocol === "cp-ramp") {
    const effort = efforts.find((e) => e.intensity !== null && e.intensity > 0);
    if (!effort || effort.intensity === null) {
      return {
        metrics: [],
        zones: [],
        zoneUnit: "W",
        warnings: ["Ange effekten för insatsen."],
      };
    }

    const power = effort.intensity;
    const settings = {
      "cp-5min": { factor: 0.8, seconds: 300, label: "80 % av 5 min", source: "Pettitt m.fl. (2019)" },
      "cp-6min": { factor: 0.825, seconds: 360, label: "82,5 % av 6 min", source: "Vautier m.fl. (1995)" },
      "cp-ramp": { factor: 0.75, seconds: 0, label: "75 % av toppeffekten", source: "Díaz m.fl. (2018)" },
    }[protocol];

    const cp = power * settings.factor;
    const metrics: Metric[] = [
      metric("CP", "Critical power", cp, "W", {
        method: settings.label,
        isPrimary: true,
      }),
      metric("FTP", "FTP", cp * 0.95, "W", { method: "0,95 × CP" }),
      metric("P_test", "Effekt i testet", power, "W"),
    ];

    // W' bara där det faktiskt går att härleda: överskottsarbetet över CP
    // under insatsen. Ramptestet har ingen sådan insats – belastningen steg
    // hela tiden – så där finns inget W' att räkna fram.
    if (settings.seconds > 0) {
      const wPrime = (power - cp) * settings.seconds;
      if (wPrime > 0) {
        metrics.push(
          metric("W_prime", "W′ – anaerob kapacitet", wPrime / 1000, "kJ", {
            method: `(P − CP) × ${settings.seconds} s`,
            isPrimary: true,
          }),
        );
      }
    } else {
      warnings.push(
        "Ramptestet ger ingen anaerob kapacitet. Originalkalkylatorn satte W′ till 20 kJ plus 100 J per kilo kroppsvikt, alltså ett tal som bara berodde på hur mycket atleten vägde och inte alls på hur testet gick. Det är utelämnat här.",
      );
    }

    if (weightKg && weightKg > 0) {
      metrics.push(metric("CP_per_kg", "CP per kg", cp / weightKg, "W/kg"));
      metrics.push(
        metric("VO2max", "VO2max (skattad)", (10.8 * cp) / weightKg + 7, "ml/kg/min"),
      );
    }

    warnings.push(
      `CP räknas som ${settings.label} enligt ${settings.source}. Faktorn är ett snitt över en testgrupp – en enskild atlet kan ligga flera procent åt endera hållet. Ett test med två eller tre insatser ger atletens egen kurva i stället för gruppens.`,
    );

    return { metrics, zones: ftpZones(cp * 0.95), zoneUnit: "W", warnings };
  }

  // -------------------------------------------------------------------------
  // 3 min all-out på cykel
  // -------------------------------------------------------------------------
  if (protocol === "cp-3min") {
    const sorted = [...efforts]
      .filter((e) => e.intensity !== null && e.durationSeconds !== null)
      .sort((a, b) => (a.durationSeconds as number) - (b.durationSeconds as number));

    const tail = sorted.find((e) => Math.abs((e.durationSeconds as number) - 30) < 15);
    const whole = sorted.find((e) => (e.durationSeconds as number) >= 150);

    if (!tail || !whole) {
      return {
        metrics: [],
        zones: [],
        zoneUnit: "W",
        warnings: [
          "Två rader krävs: medeleffekten under sista 30 sekunderna, och medeleffekten för hela testet (180 s).",
        ],
      };
    }

    // Vanhatalo m.fl. (2007): CP är effekten i slutet, W' arbetet över den.
    const cp = tail.intensity as number;
    const wPrime = ((whole.intensity as number) - cp) * (whole.durationSeconds as number);

    const metrics: Metric[] = [
      metric("CP", "Critical power", cp, "W", {
        method: "sista 30 s",
        isPrimary: true,
      }),
    ];

    if (wPrime > 0) {
      metrics.push(
        metric("W_prime", "W′ – anaerob kapacitet", wPrime / 1000, "kJ", {
          method: "(medeleffekt − CP) × 180 s",
          isPrimary: true,
        }),
      );
    } else {
      warnings.push(
        "Medeleffekten för hela testet ligger inte över slutvärdet, vilket betyder att insatsen inte var maximal från start. W′ går inte att räkna fram.",
      );
    }

    metrics.push(metric("FTP", "FTP", cp * 0.95, "W", { method: "0,95 × CP" }));
    if (weightKg && weightKg > 0) {
      metrics.push(metric("CP_per_kg", "CP per kg", cp / weightKg, "W/kg"));
    }

    warnings.push(
      "Testet förutsätter att atleten går ut maximalt från första sekunden och aldrig fördelar krafterna. Den som sparar sig får ett för högt CP.",
    );

    return { metrics, zones: ftpZones(cp * 0.95), zoneUnit: "W", warnings };
  }

  // -------------------------------------------------------------------------
  // Critical speed – tidtagna distanser, 3/5-minuters och simning
  // -------------------------------------------------------------------------
  if (
    protocol === "critical-speed" ||
    protocol === "cs-3-5min" ||
    protocol === "cs-simning"
  ) {
    const points = efforts
      .filter((e) => e.durationSeconds !== null && e.distanceM !== null)
      .map((e) => ({
        seconds: e.durationSeconds as number,
        metres: e.distanceM as number,
      }));

    const result = criticalSpeedFromDistances(points);
    if (!result) {
      return {
        metrics: [],
        zones: [],
        zoneUnit: unit,
        warnings: [
          "Minst två insatser med olika längd och både tid och sträcka krävs.",
        ],
      };
    }
    if (!(result.dPrime > 0)) {
      warnings.push(
        "D′ blir noll eller negativt, vilket betyder att den kortare insatsen inte var tillräckligt mycket hårdare än den längre. Kontrollera att båda var maximala.",
      );
    }

    const csInUnit = toUnit(result.cs, unit);
    const metrics: Metric[] = [
      metric("CS", "Critical speed", csInUnit, unit, { isPrimary: true }),
      metric("D_prime", "D′ – anaerob kapacitet", result.dPrime, "m", {
        isPrimary: true,
      }),
    ];
    if (result.rSquared !== null) {
      metrics.push(metric("R2", "Anpassning", result.rSquared * 100, "%"));
    } else {
      warnings.push(
        "Två insatser definierar linjen exakt – det finns ingen anpassningsgrad att rapportera.",
      );
    }

    const shortest = Math.min(...points.map((p) => p.seconds));
    const longest = Math.max(...points.map((p) => p.seconds));
    if (shortest < 120 || longest > 1200) {
      warnings.push(
        "Modellen gäller ungefär 2–15 minuter. Insatser utanför det spannet drar CS åt fel håll.",
      );
    }

    return {
      metrics,
      zones: criticalSpeedZones(csInUnit),
      zoneUnit: unit,
      warnings,
    };
  }

  // -------------------------------------------------------------------------
  // Critical speed – 3 min all-out
  // -------------------------------------------------------------------------
  if (protocol === "cs-3min") {
    // Varje rad är ett delintervall av testet: hur långt atleten kom under en
    // viss tid. CS är farten i slutet, D′ är sträckan som ligger över den.
    const splits = efforts
      .filter((e) => e.durationSeconds !== null && e.distanceM !== null)
      .map((e) => ({
        seconds: e.durationSeconds as number,
        metres: e.distanceM as number,
      }))
      .sort((a, b) => a.seconds - b.seconds);

    if (splits.length < 4) {
      return {
        metrics: [],
        zones: [],
        zoneUnit: unit,
        warnings: [
          "Dela upp testet i minst fyra delintervall, till exempel var 30:e sekund, med sträckan för varje.",
        ],
      };
    }

    const total = splits[splits.length - 1];
    if (Math.abs(total.seconds - 180) > 15) {
      warnings.push(
        `Testet är ${Math.round(total.seconds)} sekunder långt. Protokollet förutsätter 180.`,
      );
    }

    // CS = medelfarten under sista 30 sekunderna.
    const tailStart = total.seconds - 30;
    let before = splits[0];
    for (const s of splits) if (s.seconds <= tailStart) before = s;
    const tailSeconds = total.seconds - before.seconds;
    if (!(tailSeconds > 0)) {
      return {
        metrics: [],
        zones: [],
        zoneUnit: unit,
        warnings: ["Delintervallen räcker inte för att mäta de sista 30 sekunderna."],
      };
    }
    const cs = (total.metres - before.metres) / tailSeconds;

    // D′ = sträckan över CS, alltså summan av (fart − CS) · tid över alla
    // delintervall. Originalappen räknade (maxfart − slutfart) · 180, som är
    // rektangeln runt kurvan i stället för arean under den, och överskattar
    // därför D′ systematiskt.
    let dPrime = 0;
    let previous = { seconds: 0, metres: 0 };
    let peak = 0;
    for (const s of splits) {
      const dt = s.seconds - previous.seconds;
      if (dt > 0) {
        const speed = (s.metres - previous.metres) / dt;
        peak = Math.max(peak, speed);
        dPrime += Math.max(speed - cs, 0) * dt;
      }
      previous = s;
    }

    const csInUnit = toUnit(cs, unit);
    const metrics: Metric[] = [
      metric("CS", "Critical speed", csInUnit, unit, {
        method: "sista 30 s",
        isPrimary: true,
      }),
      metric("D_prime", "D′ – anaerob kapacitet", dPrime, "m", {
        method: "sträcka över CS",
        isPrimary: true,
      }),
      metric("v_peak", "Högsta delfart", toUnit(peak, unit), unit),
    ];

    if (tailSeconds > 45) {
      warnings.push(
        `Sista delintervallet är ${Math.round(tailSeconds)} sekunder. Ju grövre indelning, desto osäkrare blir CS – 15–30 sekunders intervall ger bäst svar.`,
      );
    }

    return {
      metrics,
      zones: criticalSpeedZones(csInUnit),
      zoneUnit: unit,
      warnings,
    };
  }

  return { metrics: [], zones: [], zoneUnit: unit, warnings: ["Okänt protokoll."] };
}

/**
 * Loppprognos ur CS och D′.
 *
 * Den linjära modellen är d = CS·t + D′, alltså t = (d − D′) / CS. Originalets
 * kalkylator räknade `t = d/CS − D′/CS²`, vilket är samma sak dividerat med
 * ytterligare ett CS i den anaeroba termen. För CS 4,0 m/s och D′ 200 m på
 * 5 km blir skillnaden 37 sekunder.
 *
 * Modellen gäller ungefär 2–15 minuter, så prognoser utanför det spannet
 * markeras i stället för att presenteras som svar.
 */
export function racePredictions(
  criticalSpeedMs: number,
  dPrimeM: number,
  distances: { label: string; metres: number }[],
): { label: string; metres: number; seconds: number; beyondModel: boolean }[] {
  if (!(criticalSpeedMs > 0)) return [];

  return distances.flatMap(({ label, metres }) => {
    const seconds = (metres - dPrimeM) / criticalSpeedMs;
    if (!(seconds > 0)) return [];
    return [{ label, metres, seconds, beyondModel: seconds < 120 || seconds > 900 }];
  });
}

export { toMetresPerSecond, toUnit };

/**
 * Kvoten W′/CP och vad den säger om atletens profil.
 *
 * Måttet är hur stor den anaeroba reserven är i förhållande till den aeroba
 * effekten: hur många joule över CP atleten har per watt CP. Det är ett rent
 * förhållande mellan två mätta storheter, och därför jämförbart mellan
 * atleter på ett sätt som varken CP eller W′ är var för sig.
 *
 * En hög kvot betyder att mycket av kapaciteten ligger över tröskeln – en
 * sprinttyp som vinner på att kunna gå över CP ofta och länge. En låg kvot
 * betyder motsatsen: en diesel vars styrka sitter i själva tröskeln.
 *
 * Här står medvetet ingen träningsrekommendation. Originalappen valde mellan
 * tre färdiga punktlistor efter CP/kg – samma råd till alla i ett brett spann,
 * utan att titta på W′, atletens gren eller vad hen faktiskt tränar. Vad den
 * här atleten ska göra åt sin profil är coachens jobb, inte en tabells.
 */
export function anaerobicProfile(
  criticalPower: number,
  wPrimeJoules: number,
): { ratio: number; label: string; reading: string } | null {
  if (!(criticalPower > 0) || !(wPrimeJoules > 0)) return null;

  const ratio = wPrimeJoules / criticalPower;

  // Gränserna nedan är beskrivande, inte normerande: de delar in kvoten i tre
  // band så att en förändring över tid går att sätta ord på. De säger inget
  // om hur bra atleten är.
  if (ratio < 55) {
    return {
      ratio,
      label: "Aerob profil",
      reading:
        "Liten anaerob reserv i förhållande till tröskeln. Styrkan sitter i att hålla hög effekt länge, inte i att gå över den.",
    };
  }
  if (ratio > 85) {
    return {
      ratio,
      label: "Anaerob profil",
      reading:
        "Stor anaerob reserv i förhållande till tröskeln. Tål upprepade insatser över CP, men tappar mer på långa jämna belastningar.",
    };
  }
  return {
    ratio,
    label: "Jämn profil",
    reading:
      "Anaerob reserv och tröskel står i ungefär samma förhållande som hos de flesta uthållighetsatleter.",
  };
}
