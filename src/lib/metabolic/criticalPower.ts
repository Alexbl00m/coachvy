/**
 * Critical power ur maximala insatser på 2–20 minuter (linjär modell arbete = CP·t + W′).
 */
export interface Effort {
  /** Sekunder */
  durationSec: number;
  /** Medeleffekt, W */
  power: number;
}

export interface EffortResidual extends Effort {
  /** Modellens effekt för samma tid */
  predicted: number;
  /** Uppmätt minus modell, i procent av modellen */
  deviationPct: number;
}

export interface CriticalPowerFit {
  cp: number;
  /** J */
  wPrime: number;
  /** Förklaringsgrad för arbete mot tid */
  r2: number;
  residuals: EffortResidual[];
  /** Effekt som kan hållas i t sekunder enligt modellen */
  powerAt: (durationSec: number) => number;
}

export const fitCriticalPower = (efforts: Effort[]): CriticalPowerFit | null => {
  const valid = efforts.filter((e) => e.durationSec > 0 && e.power > 0);
  if (valid.length < 2) return null;
  const n = valid.length;
  const t = valid.map((e) => e.durationSec);
  const w = valid.map((e) => e.power * e.durationSec);
  const mt = t.reduce((a, b) => a + b, 0) / n;
  const mw = w.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (t[i] - mt) * (w[i] - mw);
    sxx += (t[i] - mt) ** 2;
    syy += (w[i] - mw) ** 2;
  }
  if (sxx === 0) return null;
  const cp = sxy / sxx;
  const wPrime = mw - cp * mt;
  const powerAt = (d: number) => cp + wPrime / d;
  const residuals = valid.map((e) => {
    const predicted = powerAt(e.durationSec);
    return { ...e, predicted, deviationPct: (100 * (e.power - predicted)) / predicted };
  });
  return { cp, wPrime, r2: syy > 0 ? (sxy * sxy) / (sxx * syy) : 1, residuals, powerAt };
};
