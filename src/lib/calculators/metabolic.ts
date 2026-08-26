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
};

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
    return { points: [], thresholds: { anaerobicThreshold: null, fatMax: null } };
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
      power: Number(power.toFixed(1)),
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
    return { anaerobicThreshold: null, fatMax: null };
  }

  // Tröskeln: första punkten där produktionen passerar förbränningen.
  const atIndex = points.findIndex(
    (p) => p.lactateProduction > p.lactateCombustion,
  );
  const anaerobicThreshold = atIndex >= 0 ? points[atIndex] : null;

  // FatMax söks bara under tröskeln — ovanför den är fettbidraget på väg ned.
  const belowThreshold = points.slice(0, atIndex >= 0 ? atIndex + 1 : undefined);
  const fatMax = belowThreshold.reduce<MetabolicPoint | null>(
    (best, point) =>
      best === null || point.fatPerHour > best.fatPerHour ? point : best,
    null,
  );

  return { anaerobicThreshold, fatMax };
}
