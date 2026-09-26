/**
 * Metabol profil enligt Mader-modellen.
 *
 * Laktatproduktionen beskrivs med Michaelis-Menten-kinetik på ADP, och
 * laktatförbränningen som en linjär funktion av syreupptaget. Där de två
 * kurvorna korsar varandra ligger den anaeroba tröskeln: under den hinner
 * kroppen förbränna allt laktat som bildas, över den ackumuleras det.
 *
 * Portad från metabolic-insights-dashboard (`src/utils/calculateMetabolicData.ts`
 * och `src/utils/runningMetabolicCalculator.ts`), som bygger på:
 *
 * - Mader & Heck (1986), A Theory of the Metabolic Origin of "Anaerobic
 *   Threshold". Int J Sports Med 07(S1), S45–S65.
 * - Mader (2003), Glycolysis and oxidative phosphorylation as a function of
 *   cytosolic phosphorylation state and power output of the muscle cell.
 * - Hauser et al. (2014), Comparison of calculated and experimental power in
 *   maximal lactate-steady state during cycling.
 */

export const MADER_DEFAULTS = {
  /** ADP-kinetik (Mader & Heck 1986). */
  ks1: 0.0631,
  /** Laktatproduktion (Mader & Heck 1986). */
  ks2: 1.331,
  /** 1 ml syre oxiderar 0,01576 mmol laktat. */
  laCombConstant: 0.01576,
  /** Laktatets fördelningsvolym, 40 % av kroppsmassan (Hauser 2014). */
  volRel: 0.4,
} as const;

export type MaderConstants = {
  ks1: number;
  ks2: number;
  laCombConstant: number;
  volRel: number;
};

export type MetabolicInput = {
  /** ml/kg/min. */
  vo2max: number;
  /** mmol/l/s. */
  vlamax: number;
  /** Effekt vid VO2max, i watt. */
  vo2maxPower: number;
  /** Kroppsvikt i kg — behövs för substratomsättningen. */
  weightKg: number;
  maxHeartRate?: number | null;
};

export type MetabolicPoint = {
  power: number;
  percentOfMax: number;
  vo2: number;
  /** Laktatproduktion, mmol/l/min. */
  lactateProduction: number;
  /** Laktatförbränning, mmol/l/min. */
  lactateCombustion: number;
  /** Nettoackumulering; noll under tröskeln. */
  lactateNet: number;
  /** Kolhydratförbrukning, g/h. */
  carbsPerHour: number;
  /** Fettförbrukning, g/h. */
  fatPerHour: number;
  heartRate: number | null;
};

export type MetabolicThresholds = {
  /** Anaerob tröskel: där netto-laktat vänder positivt. */
  anaerobicThreshold: MetabolicPoint | null;
  /** FatMax: högsta fettförbrukning under tröskeln. */
  fatMax: MetabolicPoint | null;
  /**
   * CarbMax: första punkten där kolhydratförbrukningen når
   * `CARB_MAX_GRAMS_PER_HOUR`. Ovanför den förbränns kolhydrater fortare än
   * de går att fylla på under ett lopp.
   */
  carbMax: MetabolicPoint | null;
};

/**
 * Ungefär det tak för kolhydratintag under arbete som idrottsnutritionen
 * räknar med när flera sockerarter kombineras (glukos plus fruktos). Vissa
 * tränar magen högre, så gränsen är en riktlinje och inte en fysiologisk konstant.
 */
export const CARB_MAX_GRAMS_PER_HOUR = 90;

export type MetabolicProfile = {
  points: MetabolicPoint[];
  thresholds: MetabolicThresholds;
};

/** Molmassa för en glykosylenhet, g/mol. */
const GRAMS_PER_MOL_GLYCOSYL = 162.14;
/** Två laktat bildas per glukosenhet. */
const LACTATE_PER_GLUCOSE = 2;
const KCAL_PER_G_FAT = 9.5;
/** Energiutbyte per liter syre vid fettoxidation, kcal. */
const KCAL_PER_LITRE_O2_FAT = 4.65;

export function calculateMetabolicProfile(
  input: MetabolicInput,
  constants: MaderConstants = MADER_DEFAULTS,
): MetabolicProfile {
  const { vo2max, vlamax, vo2maxPower, weightKg, maxHeartRate } = input;
  const { ks1, ks2, laCombConstant, volRel } = constants;

  if (!(vo2max > 0) || !(vo2maxPower > 0) || !(weightKg > 0)) {
    return {
      points: [],
      thresholds: { anaerobicThreshold: null, fatMax: null, carbMax: null },
    };
  }

  const steps = 200;
  const points: MetabolicPoint[] = [];

  for (let i = 1; i <= steps; i++) {
    const power = (i * vo2maxPower) / steps;
    const vo2 = (power / vo2maxPower) * vo2max;

    // Nära VO2max går nämnaren mot noll; klamras för att undvika oändligheter.
    const headroom = Math.max(vo2max - vo2, 1e-9);
    const adp = Math.sqrt((ks1 * vo2) / headroom);

    // vLass = 60 · VLamax / (1 + Ks2/ADP³) — faktorn 60 ger mmol/l/min.
    const lactateProduction =
      vlamax > 0 ? (60 * vlamax) / (1 + ks2 / adp ** 3) : 0;

    const lactateCombustion = (laCombConstant / volRel) * vo2;
    const net = lactateProduction - lactateCombustion;

    // Laktat som förbränns motsvarar pyruvat som inte gick till fettoxidation.
    const spareCombustion = Math.max(lactateCombustion - lactateProduction, 0);

    const litresDistribution = volRel * weightKg;
    // mmol/l/min · l · 60 = mmol/h → mol/h → mol glukos/h → g/h
    const carbsPerHour =
      (lactateProduction * litresDistribution * 60) /
      1000 /
      LACTATE_PER_GLUCOSE *
      GRAMS_PER_MOL_GLYCOSYL;

    // Det laktat som inte behövde förbrännas motsvarar syre som gick till
    // fettoxidation i stället.
    const fatPerHour =
      ((spareCombustion * litresDistribution) / laCombConstant) *
      (KCAL_PER_LITRE_O2_FAT / KCAL_PER_G_FAT) *
      60 /
      1000;

    const heartRate = maxHeartRate
      ? Math.round(
          Math.max(
            60,
            Math.min(maxHeartRate, 60 + (maxHeartRate - 60) * (vo2 / vo2max)),
          ),
        )
      : null;

    const point: MetabolicPoint = {
      // Två decimaler: i löpning är intensiteten m/s, och en decimal vore
      // 0,1 m/s – drygt tjugo sekunder per kilometer vid tröskelfart.
      power: Number(power.toFixed(2)),
      percentOfMax: Number(((power / vo2maxPower) * 100).toFixed(1)),
      vo2: Number(vo2.toFixed(2)),
      lactateProduction: Number(lactateProduction.toFixed(3)),
      lactateCombustion: Number(lactateCombustion.toFixed(3)),
      lactateNet: Number(Math.max(net, 0).toFixed(3)),
      carbsPerHour: Number(Math.max(carbsPerHour, 0).toFixed(1)),
      fatPerHour: Number(Math.max(fatPerHour, 0).toFixed(1)),
      heartRate,
    };

    if (Object.values(point).every((v) => v === null || Number.isFinite(v))) {
      points.push(point);
    }
  }

  return { points, thresholds: findThresholds(points) };
}

function findThresholds(points: MetabolicPoint[]): MetabolicThresholds {
  if (points.length === 0) {
    return { anaerobicThreshold: null, fatMax: null, carbMax: null };
  }

  // Tröskeln: första punkten där produktionen passerar förbränningen.
  const atIndex = points.findIndex(
    (p) => p.lactateProduction > p.lactateCombustion,
  );
  const anaerobicThreshold = atIndex >= 0 ? points[atIndex] : null;

  // FatMax söks bara under tröskeln — ovanför den är fettbidraget på väg ned.
  const belowThreshold = points.slice(0, atIndex >= 0 ? atIndex + 1 : undefined);
  //
  // Fettkurvan är platt i toppen, och med 0,1 g/h avrundning blir flera
  // punkter lika höga. Att ta den första gav alltid den lägsta intensiteten på
  // platån – 0,05 m/s för långsamt i löpning. Mitten av platån ligger närmast
  // den verkliga toppen.
  const peakFat = Math.max(...belowThreshold.map((p) => p.fatPerHour));
  const plateau = belowThreshold.filter((p) => p.fatPerHour === peakFat);
  const fatMax = plateau.length > 0 ? plateau[Math.floor((plateau.length - 1) / 2)] : null;

  const carbMax =
    points.find((p) => p.carbsPerHour >= CARB_MAX_GRAMS_PER_HOUR) ?? null;

  return { anaerobicThreshold, fatMax, carbMax };
}

// ---------------------------------------------------------------------------
// Löpning
// ---------------------------------------------------------------------------

export type RunningInput = {
  /** ml/kg/min. */
  vo2max: number;
  /** mmol/l/s – ett löpvärde, inte ett från cykel. */
  vlamax: number;
  /**
   * Löpekonomi: syrekostnaden per kilometer, ml/kg/km. Tränade löpare ligger
   * ofta runt 190–220, men spridningen mellan löpare på samma fart är stor.
   */
  runningEconomy: number;
  weightKg: number;
  maxHeartRate?: number | null;
};

/** Farten vid VO2max, m/s: den fart där syrekostnaden når VO2max. */
export function speedAtVo2max(vo2max: number, runningEconomy: number): number {
  if (!(vo2max > 0) || !(runningEconomy > 0)) return 0;
  // ml/kg/min delat med ml/kg/m ger m/min.
  return vo2max / (runningEconomy / 1000) / 60;
}

/**
 * Löpekonomi ur ett mätvärde: syreupptaget vid en submaximal fart under
 * tröskeln, till exempel från ett löpbandstest med gasanalys.
 */
export function runningEconomyFrom(vo2: number, speedKmh: number): number {
  if (!(vo2 > 0) || !(speedKmh > 0)) return 0;
  const metresPerMinute = (speedKmh * 1000) / 60;
  return (vo2 / metresPerMinute) * 1000;
}

/**
 * Metabol profil för löpning.
 *
 * Samma modell som på cykel. Det enda som skiljer är hur syreupptaget
 * översätts till belastning: på cykel kostar en watt nästan lika mycket syre
 * för alla, i löpning avgör löpekonomin hur fort en viss syremängd bär. Med
 * farten vid VO2max som ände på skalan blir resten exakt samma räkning, och
 * punkternas `power` är fart i m/s.
 *
 * Portad från metabolic-quest (`src/utils/metabolicCalculations.ts`), med två
 * rättelser:
 *
 * - Farten räknades där ur syreupptaget plus det laktat som *bildas*, vid
 *   varje intensitet. Under tröskeln förbränns det laktatet och dess syre
 *   finns redan i syreupptaget – det räknades alltså två gånger. Med
 *   standardvärdena gav det tröskeln 3,70 m/s (4:30/km) i stället för 3,40
 *   (4:54/km). Här översätts bara syreupptaget, som på cykel.
 * - Fettförbränningen räknades ur absolutbeloppet av nettolaktatet och steg
 *   därför igen ovanför tröskeln. Den klamras till noll där, som på cykel.
 */
export function calculateRunningProfile(
  input: RunningInput,
  constants: MaderConstants = MADER_DEFAULTS,
): MetabolicProfile {
  return calculateMetabolicProfile(
    {
      vo2max: input.vo2max,
      vlamax: input.vlamax,
      vo2maxPower: speedAtVo2max(input.vo2max, input.runningEconomy),
      weightKg: input.weightKg,
      maxHeartRate: input.maxHeartRate,
    },
    constants,
  );
}

/** m/s till "4:54". */
export function paceFromSpeed(metresPerSecond: number): string {
  if (!(metresPerSecond > 0)) return "–";
  const secondsPerKm = Math.round(1000 / metresPerSecond);
  return `${Math.floor(secondsPerKm / 60)}:${String(secondsPerKm % 60).padStart(2, "0")}`;
}
