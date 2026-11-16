/**
 * Från maximala effekttester till VO2max och VLaMax, utan laktatmätning.
 *
 * Tre markörer får varsitt värde ur testerna och ur modellen:
 * - aerob: testvärde = VO2max-testets effekt minus glykolysens bidrag; modellvärde = MAP
 * - glykolytisk: testvärde = sprintens effekt minus det aeroba bidraget; modellvärde = VLaMax i watt
 * - tröskel: testvärde = andel av CP; modellvärde = AT ur motorn
 * VO2max och VLaMax väljs så att modellvärdena ligger närmast testvärdena (viktad minsta kvadrat).
 */
import {
  BODY_FAT_METHOD_SD,
  BodyFatMethod,
  DEFAULT_ERROR_MODEL,
  DEFAULT_WEIGHTS,
  INVERSION_CONSTANTS,
  MODEL_CONSTANTS,
} from "./constants";
import { aerobicPower, EngineResult, glycolyticPower, runEngine } from "./engine";
import { CriticalPowerFit, Effort, fitCriticalPower } from "./criticalPower";
import { lactateDistributionVolume, Sex } from "./bodyComposition";
import { nelderMead } from "./optimize";

export interface MarkerWeights {
  aerobic: number;
  glycolytic: number;
  threshold: number;
}

export type MarkerKey = keyof MarkerWeights;

export interface RemoteTestInput {
  /** kg */
  bodyMass: number;
  /** procent */
  bodyFatPct: number;
  sex: Sex;
  /** Maximal sprint, 10–30 s. Valfri men ger säkrare VLaMax */
  sprint?: Effort | null;
  /** Laktat efter sprinten, mmol/L. Ger VLaMax direkt i stället för ur sprintens watt */
  sprintLactate?: { peak: number; rest?: number | null } | null;
  /** Maximala insatser på 2–20 min, till exempel 3, 6 och 12 min */
  efforts: Effort[];
  weights?: Partial<MarkerWeights>;
  /** Fördelningsvolym (L/kg) om den är känd, annars räknas den ur kroppsfett */
  volRelOverride?: number | null;
}

export interface MarkerFit {
  key: MarkerKey;
  /** Modellens värde, W */
  model: number;
  /** Testernas värde, W */
  test: number;
  sigmaRel: number;
  weight: number;
  /** Modell minus test, i procent av testvärdet */
  deviationPct: number;
}

export interface ProfileEstimate {
  vo2max: number;
  vlamax: number;
  volRel: number;
  cp: CriticalPowerFit | null;
  aerobicTest: Effort | null;
  engine: EngineResult;
  markers: MarkerFit[];
  objective: number;
  converged: boolean;
}

export const AEROBIC_TEST_RANGE = { min: 120, max: 420, ideal: 180 } as const;
export const CP_EFFORT_RANGE = { min: 120, max: 1500 } as const;

/** VO2max-testet: insatsen närmast 3 minuter inom 2–7 min */
export const pickAerobicTest = (efforts: Effort[]): Effort | null => {
  const candidates = efforts.filter(
    (e) => e.durationSec >= AEROBIC_TEST_RANGE.min && e.durationSec <= AEROBIC_TEST_RANGE.max && e.power > 0
  );
  if (!candidates.length) return null;
  return candidates.reduce((a, b) =>
    Math.abs(b.durationSec - AEROBIC_TEST_RANGE.ideal) < Math.abs(a.durationSec - AEROBIC_TEST_RANGE.ideal) ? b : a
  );
};

/** Kortaste sprint vars watt går att räkna på: kalibreringen bygger på sprintar runt 17–20 s */
export const MIN_SPRINT_SECONDS = 15;

/** Sprinten om den är ifylld, annars null */
export const filledSprint = (input: RemoteTestInput): Effort | null =>
  input.sprint && input.sprint.power > 0 && input.sprint.durationSec > 0 ? input.sprint : null;

/**
 * Sprinten om den går att räkna på. En sprint under 15 s används bara med uppmätt laktat:
 * ur watten ensam ger den för låg VLaMax och en tröskel över CP.
 */
export const usableSprint = (input: RemoteTestInput): Effort | null => {
  const sprint = filledSprint(input);
  return sprint && (sprint.durationSec >= MIN_SPRINT_SECONDS || (input.sprintLactate?.peak ?? 0) > 0) ? sprint : null;
};

/** VLaMax ur sprintlaktat: (högsta − vila) / (sprinttid − alaktacid tid), mmol/L/s */
export const sprintLactateVlamax = (input: RemoteTestInput): number | null => {
  const sprint = filledSprint(input);
  const lactate = input.sprintLactate;
  if (!sprint || !lactate || !(lactate.peak > 0)) return null;
  const rest = lactate.rest && lactate.rest > 0 ? lactate.rest : INVERSION_CONSTANTS.restingLactate;
  const vlamax = (lactate.peak - rest) / (sprint.durationSec - INVERSION_CONSTANTS.alacticSeconds);
  return vlamax > 0 ? vlamax : null;
};

export const resolveVolRel = (input: RemoteTestInput) =>
  input.volRelOverride && input.volRelOverride > 0.2 && input.volRelOverride < 0.8
    ? input.volRelOverride
    : lactateDistributionVolume(input.sex, input.bodyFatPct);

interface Terms {
  markers: MarkerFit[];
  objective: number;
}

const evaluate = (
  vo2max: number,
  vlamax: number,
  ctx: {
    bodyMass: number;
    volRel: number;
    sprint: Effort | null;
    measuredVlamax: number | null;
    aerobicTest: Effort | null;
    cp: CriticalPowerFit | null;
    weights: MarkerWeights;
  },
  resolution: number
): Terms => {
  const { bodyMass, volRel, sprint, measuredVlamax, aerobicTest, cp, weights } = ctx;
  const ic = INVERSION_CONSTANTS;
  const map = aerobicPower(vo2max, bodyMass);
  const pg = glycolyticPower(vlamax, volRel, bodyMass);
  const markers: MarkerFit[] = [];
  const add = (key: MarkerKey, model: number, test: number) => {
    const sigmaRel = ic.sigmaRel[key];
    markers.push({ key, model, test, sigmaRel, weight: weights[key], deviationPct: (100 * (model - test)) / test });
  };
  if (aerobicTest) {
    add("aerobic", map, aerobicTest.power - (pg * ic.glycolyticSecondsInAerobicTest) / aerobicTest.durationSec);
  }
  if (sprint) {
    add(
      "glycolytic",
      pg,
      measuredVlamax
        ? glycolyticPower(measuredVlamax, volRel, bodyMass)
        : sprint.power - (map * ic.aerobicSecondsInSprint) / sprint.durationSec
    );
  }
  if (cp) {
    const at = runEngine({ bodyMass, vo2max, vlamax, volRel }, { resolution }).at;
    add("threshold", at ? at.power : 0, ic.thresholdFractionOfCp * cp.cp);
  }
  let objective = 0;
  for (const m of markers) {
    if (m.test <= 0) return { markers, objective: Number.POSITIVE_INFINITY };
    objective += m.weight * ((m.model - m.test) / (m.sigmaRel * m.test)) ** 2;
  }
  return { markers, objective };
};

export const estimateProfile = (
  input: RemoteTestInput,
  { start }: { start?: [number, number] } = {}
): ProfileEstimate | null => {
  const volRel = resolveVolRel(input);
  const weights: MarkerWeights = { ...DEFAULT_WEIGHTS, ...input.weights };
  const longEfforts = input.efforts.filter(
    (e) => e.durationSec >= CP_EFFORT_RANGE.min && e.durationSec <= CP_EFFORT_RANGE.max && e.power > 0
  );
  const cp = longEfforts.length >= 2 ? fitCriticalPower(longEfforts) : null;
  const aerobicTest = pickAerobicTest(input.efforts);
  const sprint = usableSprint(input);
  // Två okända kräver minst två markörer
  if ((sprint ? 1 : 0) + (aerobicTest ? 1 : 0) + (cp ? 1 : 0) < 2) return null;

  const measuredVlamax = sprintLactateVlamax(input);
  const ctx = { bodyMass: input.bodyMass, volRel, sprint, measuredVlamax, aerobicTest, cp, weights };
  const pgPerUnit = glycolyticPower(1, volRel, input.bodyMass);
  const ic = INVERSION_CONSTANTS;

  // Startvärden ur testvärdena med VLaMax 0,5 som första gissning
  let x0 = start;
  if (!x0) {
    const aerobicGuess = aerobicTest
      ? aerobicTest.power - (0.5 * pgPerUnit * ic.glycolyticSecondsInAerobicTest) / aerobicTest.durationSec
      : (cp as CriticalPowerFit).cp / 0.8;
    const vo2Guess = (aerobicGuess * MODEL_CONSTANTS.o2PerWatt) / input.bodyMass;
    const vlaGuess = measuredVlamax
      ? measuredVlamax
      : sprint
      ? (sprint.power - (aerobicGuess * ic.aerobicSecondsInSprint) / sprint.durationSec) / pgPerUnit
      : 0.5;
    x0 = [Math.min(90, Math.max(30, vo2Guess)), Math.min(1.2, Math.max(0.1, vlaGuess))];
  }

  const f = ([vo2max, vlamax]: number[]) => {
    if (vo2max < 20 || vo2max > 100 || vlamax < 0.03 || vlamax > 2) return 1e12;
    return evaluate(vo2max, vlamax, ctx, 500).objective;
  };
  const first = nelderMead(f, x0, [2, 0.05], { maxIterations: 400 });
  const best = nelderMead(f, first.x, [0.2, 0.005], { maxIterations: 400, tolerance: 1e-12 });
  const [vo2max, vlamax] = best.x;
  const final = evaluate(vo2max, vlamax, ctx, 1200);

  return {
    vo2max,
    vlamax,
    volRel,
    cp,
    aerobicTest,
    engine: runEngine({ bodyMass: input.bodyMass, vo2max, vlamax, volRel }),
    markers: final.markers,
    objective: final.objective,
    converged: best.converged,
  };
};

export interface OutputSpread {
  vo2max: number;
  vlamax: number;
  map: number;
  at: number;
  fatMax: number;
  carbMax: number;
  cp: number;
}

const outputsOf = (e: ProfileEstimate): OutputSpread => ({
  vo2max: e.vo2max,
  vlamax: e.vlamax,
  map: e.engine.map,
  at: e.engine.at?.power ?? NaN,
  fatMax: e.engine.fatMax?.power ?? NaN,
  carbMax: e.engine.carbMax ?? NaN,
  cp: e.cp?.cp ?? NaN,
});

export interface UncertaintyOptions {
  bodyFatMethod?: BodyFatMethod;
  errorModel?: typeof DEFAULT_ERROR_MODEL;
}

/**
 * Profilen omräknad med en felkälla i taget förskjuten 1 SD: wattmätaren, sprinten, varje
 * längre test, kroppsvikten och kroppsfettet. Används för osäkerheten i både värden och kurvor.
 */
export const profileVariants = (
  input: RemoteTestInput,
  base: ProfileEstimate,
  { bodyFatMethod = "scale", errorModel = DEFAULT_ERROR_MODEL }: UncertaintyOptions = {}
): ProfileEstimate[] => {
  const scale = (e: Effort, f: number): Effort => ({ ...e, power: e.power * f });
  const sprint = usableSprint(input);
  const variants: RemoteTestInput[] = [
    {
      ...input,
      sprint: sprint ? scale(sprint, 1 + errorModel.powerMeter) : null,
      efforts: input.efforts.map((e) => scale(e, 1 + errorModel.powerMeter)),
    },
    ...(sprint ? [{ ...input, sprint: scale(sprint, 1 + errorModel.sprint) }] : []),
    ...(input.sprintLactate && sprintLactateVlamax(input)
      ? [{ ...input, sprintLactate: { ...input.sprintLactate, peak: input.sprintLactate.peak + errorModel.sprintLactate } }]
      : []),
    ...input.efforts.map((_, i) => ({
      ...input,
      efforts: input.efforts.map((e, j) => (i === j ? scale(e, 1 + errorModel.longEffort) : e)),
    })),
    { ...input, bodyMass: input.bodyMass + errorModel.bodyMass },
  ];
  if (!input.volRelOverride) {
    variants.push({ ...input, bodyFatPct: input.bodyFatPct + BODY_FAT_METHOD_SD[bodyFatMethod] });
  }
  return variants
    .map((v) => estimateProfile(v, { start: [base.vo2max, base.vlamax] }))
    .filter((e): e is ProfileEstimate => e !== null);
};

/** Osäkerhet (1 SD): felkällornas effekter summeras kvadratiskt (linjär felfortplantning) */
export const spreadFromVariants = (base: ProfileEstimate, variants: ProfileEstimate[]): OutputSpread => {
  const b = outputsOf(base);
  const sum: OutputSpread = { vo2max: 0, vlamax: 0, map: 0, at: 0, fatMax: 0, carbMax: 0, cp: 0 };
  for (const v of variants) {
    const o = outputsOf(v);
    for (const k of Object.keys(sum) as (keyof OutputSpread)[]) {
      const d = o[k] - b[k];
      if (Number.isFinite(d)) sum[k] += d * d;
    }
  }
  for (const k of Object.keys(sum) as (keyof OutputSpread)[]) sum[k] = Math.sqrt(sum[k]);
  return sum;
};

/** Osäkerhet (1 SD) i resultaten givet typiska mätfel i testerna */
export const estimateUncertainty = (
  input: RemoteTestInput,
  base: ProfileEstimate,
  options: UncertaintyOptions = {}
): OutputSpread => spreadFromVariants(base, profileVariants(input, base, options));
