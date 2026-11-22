/**
 * Labbets laktatkurva i modellen: vilken VLaMax återger stegtestets laktat under tröskeln,
 * givet VO2max och kroppsvikt vid labbtestet? Ger ett oberoende värde att jämföra med
 * distanstestets VLaMax och AT.
 *
 * Steg på 3–5 minuter hinner nästan till steady state under tröskeln, så bara punkter upp till
 * cirka 4,5 mmol/L används. Över tröskeln ligger stegtestets laktat under steady state.
 */
import { EngineResult, runEngine } from "./engine";
import { lactateAtPower } from "./bands";
import { StepPoint } from "./stepTest";

export interface StepTestFit {
  vlamax: number;
  /** Rms-avvikelse mot labbets laktat i de använda punkterna, mmol/L */
  rmsLactate: number;
  usedPoints: StepPoint[];
  /** Modellen med den anpassade VLaMax, vid labbtestets vikt */
  engine: EngineResult;
}

export interface StepTestFitOptions {
  bodyMass: number;
  /** ml/kg/min vid labbtestets vikt */
  vo2max: number;
  volRel: number;
  /** Högsta laktat som tas med, mmol/L */
  maxLactate?: number;
}

export const fitVlamaxToStepTest = (
  points: StepPoint[],
  { bodyMass, vo2max, volRel, maxLactate = 4.5 }: StepTestFitOptions
): StepTestFit | null => {
  const used = points
    .filter((p) => p.power > 0 && p.lactate > 0 && p.lactate <= maxLactate)
    .sort((a, b) => a.power - b.power);
  if (used.length < 3 || !(vo2max > 20) || !(bodyMass > 30)) return null;

  const error = (vlamax: number) => {
    const engine = runEngine({ bodyMass, vo2max, vlamax, volRel }, { resolution: 600 });
    let ss = 0;
    for (const p of used) {
      const model = lactateAtPower(engine, p.power);
      // Punkten ligger över modellens tröskel: räkna det som en stor avvikelse
      ss += model === null ? 9 : (model - p.lactate) ** 2;
    }
    return Math.sqrt(ss / used.length);
  };

  let best = 0.4;
  let bestError = Number.POSITIVE_INFINITY;
  const scan = (from: number, to: number, step: number) => {
    for (let v = from; v <= to + 1e-9; v += step) {
      const e = error(v);
      if (e < bestError) {
        bestError = e;
        best = v;
      }
    }
  };
  scan(0.15, 1.4, 0.01);
  scan(Math.max(0.1, best - 0.01), best + 0.01, 0.001);

  return {
    vlamax: best,
    rmsLactate: bestError,
    usedPoints: used,
    engine: runEngine({ bodyMass, vo2max, vlamax: best, volRel }),
  };
};
