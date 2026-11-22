/**
 * Kalibrerad steady state-motor enligt Mader & Heck (1986).
 *
 * Simulerar över syreupptaget i steady state och räknar för varje punkt:
 * - ADP = √(Ks1·VO2 / (VO2max − VO2))
 * - Brutto laktatbildning vLass = 60·VLaMax / (1 + Ks2/ADP³) + basal bildning
 * - Möjlig laktatförbränning LaComb = 0,01576 / VolRel · VO2
 * - Syrebehov = VO2 + vLass·VolRel·5,5 och effekt = behov · kg / 12,5
 * - Kolhydrater ur bruttoflödet, fett ur pyruvatbristen under tröskeln
 */
import { MODEL_CONSTANTS, ModelConstants } from "./constants";

export interface EngineInput {
  /** Kroppsmassa, kg */
  bodyMass: number;
  /** ml/kg/min */
  vo2max: number;
  /** mmol/L/s */
  vlamax: number;
  /** Laktatens fördelningsvolym, L/kg */
  volRel: number;
}

export interface EnginePoint {
  power: number;
  vo2: number;
  demand: number;
  vlass: number;
  lacomb: number;
  net: number;
  /** Laktat i steady state, mmol/L. Bara definierat under tröskeln */
  lactate: number | null;
  choGh: number;
  fatGh: number;
  fatKcalH: number;
  energyKcalH: number;
}

export interface ThresholdMarker {
  power: number;
  vo2: number;
  demand: number;
  /** Syrebehovet vid tröskeln i procent av VO2max */
  pctVo2max: number;
  choGh: number;
}

export interface FatMaxMarker {
  power: number;
  fatGh: number;
  fatKcalH: number;
}

export interface EngineResult {
  input: EngineInput;
  points: EnginePoint[];
  /** Anaerob tröskel (MLSS): bildning = möjlig förbränning */
  at: ThresholdMarker | null;
  fatMax: FatMaxMarker | null;
  /** Effekt där kolhydratförbränningen når 90 g/h */
  carbMax: number | null;
  /** Effekt vid 2 respektive 4 mmol/L laktat i steady state */
  lt2: number | null;
  lt4: number | null;
  /** Aerob effekt vid VO2max (utan glykolysens bidrag) */
  map: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Effekt där en stigande kurva passerar ett målvärde, med start från ett visst index */
const crossing = (
  points: EnginePoint[],
  value: (p: EnginePoint) => number | null,
  target: number,
  from = 0,
  to = points.length
): number | null => {
  for (let i = Math.max(from, 1); i < to; i++) {
    const a = value(points[i - 1]);
    const b = value(points[i]);
    if (a === null || b === null) continue;
    if (a < target && b >= target) {
      return lerp(points[i - 1].power, points[i].power, (target - a) / (b - a));
    }
  }
  return null;
};

export const runEngine = (
  input: EngineInput,
  { resolution = 1200, constants = MODEL_CONSTANTS as ModelConstants } = {}
): EngineResult => {
  const { bodyMass, vo2max, vlamax, volRel } = input;
  const c = constants;
  // g/h kolhydrat per mmol/L/min glykolytiskt flöde
  const choPerFlux = ((volRel * bodyMass * 60) / 1000 / 2) * c.glycogenMolarMass;
  const vStart = 1;
  const vEnd = vo2max * 0.9995;

  const points: EnginePoint[] = [];
  for (let i = 0; i <= resolution; i++) {
    const vo2 = vStart + ((vEnd - vStart) * i) / resolution;
    const adp = Math.sqrt((c.ks1 * vo2) / (vo2max - vo2));
    const vlass = (60 * vlamax) / (1 + c.ks2 / adp ** 3) + c.basalLactate;
    const lacomb = (c.lactatePerO2 / volRel) * vo2;
    const demand = vo2 + vlass * volRel * c.o2PerLactate;
    points.push({
      power: (demand * bodyMass) / c.o2PerWatt,
      vo2,
      demand,
      vlass,
      lacomb,
      net: vlass - lacomb,
      lactate: null,
      choGh: vlass * choPerFlux,
      fatGh: 0,
      fatKcalH: 0,
      energyKcalH: 0,
    });
  }

  // Tröskeln: första stället där nettot blir positivt efter området med pyruvatbrist.
  // Vid mycket låg intensitet överstiger den basala bildningen förbränningen och ska inte räknas.
  const firstLack = points.findIndex((p) => p.net < 0);
  let atIndex = points.length;
  let at: ThresholdMarker | null = null;
  if (firstLack >= 0) {
    const j = points.findIndex((p, i) => i > firstLack && p.net >= 0);
    if (j > 0) {
      atIndex = j;
      const a = points[j - 1];
      const b = points[j];
      const t = a.net / (a.net - b.net);
      const demand = lerp(a.demand, b.demand, t);
      at = {
        power: lerp(a.power, b.power, t),
        vo2: lerp(a.vo2, b.vo2, t),
        demand,
        pctVo2max: (100 * demand) / vo2max,
        choGh: lerp(a.choGh, b.choGh, t),
      };
    }
  }

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const below = firstLack >= 0 && i >= firstLack && i < atIndex && p.net < 0;
    if (below) {
      p.lactate = Math.sqrt((c.kel * p.vlass) / (p.lacomb - p.vlass));
      p.fatKcalH = -p.net * choPerFlux * c.kcalPerGramCho;
      p.fatGh = p.fatKcalH / c.kcalPerGramFat;
    }
    p.energyKcalH = p.choGh * c.kcalPerGramCho + p.fatKcalH;
  }

  // FatMax: största fettförbränningen under tröskeln, förfinad med en parabel genom grannpunkterna
  let fatMax: FatMaxMarker | null = null;
  let best = -1;
  for (let i = 0; i < points.length; i++) {
    if (points[i].fatKcalH > (best >= 0 ? points[best].fatKcalH : 0)) best = i;
  }
  if (best > 0 && best < points.length - 1) {
    const [a, b, d] = [points[best - 1], points[best], points[best + 1]];
    const denom = a.fatKcalH - 2 * b.fatKcalH + d.fatKcalH;
    const shift = denom !== 0 ? (0.5 * (a.fatKcalH - d.fatKcalH)) / denom : 0;
    const t = Math.max(-1, Math.min(1, shift));
    const power = t >= 0 ? lerp(b.power, d.power, t) : lerp(b.power, a.power, -t);
    const fatKcalH = b.fatKcalH - 0.25 * (a.fatKcalH - d.fatKcalH) * t;
    fatMax = { power, fatKcalH, fatGh: fatKcalH / c.kcalPerGramFat };
  }

  // Laktatkurvan är U-formad vid mycket låg effekt; trösklarna söks på den stigande delen
  let lowest = -1;
  for (let i = 0; i < atIndex && i < points.length; i++) {
    const la = points[i].lactate;
    if (la !== null && (lowest < 0 || la < (points[lowest].lactate as number))) lowest = i;
  }
  const lactateOf = (p: EnginePoint) => p.lactate;

  return {
    input,
    points,
    at,
    fatMax,
    carbMax: crossing(points, (p) => p.choGh, c.carbMaxGramsPerHour),
    lt2: lowest >= 0 ? crossing(points, lactateOf, 2, lowest, atIndex) : null,
    lt4: lowest >= 0 ? crossing(points, lactateOf, 4, lowest, atIndex) : null,
    map: (vo2max * bodyMass) / c.o2PerWatt,
  };
};

/** Värdet av en storhet vid en given effekt, linjärt interpolerat */
export const valueAtPower = (
  result: EngineResult,
  power: number,
  key: keyof Omit<EnginePoint, "lactate">
): number | null => {
  const pts = result.points;
  if (power < pts[0].power || power > pts[pts.length - 1].power) return null;
  let lo = 0;
  let hi = pts.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].power <= power) lo = mid;
    else hi = mid;
  }
  const t = (power - pts[lo].power) / (pts[hi].power - pts[lo].power || 1);
  return lerp(pts[lo][key] as number, pts[hi][key] as number, t);
};

/** Glykolysens maximala effekt (VLaMax uttryckt i watt), används som markör i regressionen */
export const glycolyticPower = (
  vlamax: number,
  volRel: number,
  bodyMass: number,
  constants: ModelConstants = MODEL_CONSTANTS
) => (60 * vlamax * volRel * constants.o2PerLactate * bodyMass) / constants.o2PerWatt;

/** Aerob effekt vid VO2max */
export const aerobicPower = (vo2max: number, bodyMass: number, constants: ModelConstants = MODEL_CONSTANTS) =>
  (vo2max * bodyMass) / constants.o2PerWatt;
