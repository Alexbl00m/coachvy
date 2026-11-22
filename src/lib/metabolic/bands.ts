/**
 * Osäkerhetsband för kurvorna: ± 1 SD över profilens varianter (en felkälla i taget,
 * kvadratiskt summerat som i estimateUncertainty).
 *
 * Två riktningar:
 * - lodrät: spridningen i värdet vid samma effekt (fett, kolhydrater)
 * - vågrät: spridningen i effekten där kurvan når samma värde (laktat). Laktatkurvans
 *   osäkerhet är främst en förskjutning i watt, och nära tröskeln där kurvan är brant
 *   ger lodrät spridning ett hackigt band.
 */
import { EngineResult, valueAtPower } from "./engine";

export type BandKey = "lactate" | "choGh" | "fatGh";

export interface BandPoint {
  power: number;
  value: number;
  low: number;
  high: number;
  /** Sant när övre gränsen passerar tröskeln eller taket, så att den är öppen uppåt */
  open: boolean;
}

/** Laktat i steady state vid en effekt; null över tröskeln */
export const lactateAtPower = (engine: EngineResult, power: number): number | null => {
  const pts = engine.points;
  if (power < pts[0].power || power > pts[pts.length - 1].power) return null;
  let lo = 0;
  let hi = pts.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].power <= power) lo = mid;
    else hi = mid;
  }
  const a = pts[lo].lactate;
  const b = pts[hi].lactate;
  if (a === null || b === null) return null;
  const t = (power - pts[lo].power) / (pts[hi].power - pts[lo].power || 1);
  return a + (b - a) * t;
};

const valueOf = (engine: EngineResult, power: number, key: BandKey) =>
  key === "lactate" ? lactateAtPower(engine, power) : valueAtPower(engine, power, key);

/** Index där laktatkurvan är lägst; därifrån stiger den mot tröskeln */
const lactateMinimumIndex = (engine: EngineResult) => {
  let best = -1;
  engine.points.forEach((p, i) => {
    if (p.lactate !== null && (best < 0 || p.lactate < (engine.points[best].lactate as number))) best = i;
  });
  return best;
};

/** Effekten där en stigande kurva når ett värde; null om den inte gör det */
export const powerAtValue = (engine: EngineResult, key: "lactate" | "choGh", value: number): number | null => {
  const pts = engine.points;
  const start = key === "lactate" ? Math.max(1, lactateMinimumIndex(engine)) : 1;
  for (let i = start; i < pts.length; i++) {
    const a = key === "lactate" ? pts[i - 1].lactate : pts[i - 1].choGh;
    const b = key === "lactate" ? pts[i].lactate : pts[i].choGh;
    if (a === null || b === null) break;
    if (a < value && b >= value) return pts[i - 1].power + ((value - a) / (b - a)) * (pts[i].power - pts[i - 1].power);
  }
  return null;
};

export const curveBand = (
  base: EngineResult,
  variants: EngineResult[],
  key: BandKey,
  powers: number[],
  { cap = Number.POSITIVE_INFINITY, direction = "vertical" as "vertical" | "horizontal" } = {}
): BandPoint[] => {
  const out: BandPoint[] = [];
  const risingFrom =
    direction === "horizontal" && key === "lactate"
      ? base.points[Math.max(0, lactateMinimumIndex(base))].power
      : Number.NEGATIVE_INFINITY;

  for (const power of powers) {
    const value = valueOf(base, power, key);
    if (value === null || !Number.isFinite(value) || value > cap) continue;

    if (direction === "horizontal" && key !== "fatGh" && power >= risingFrom) {
      let ss = 0;
      for (const v of variants) {
        const p = powerAtValue(v, key, value);
        if (p !== null) ss += (p - power) ** 2;
      }
      const sd = Math.sqrt(ss);
      const lowValue = valueOf(base, power - sd, key);
      const highValue = valueOf(base, power + sd, key);
      const open = highValue === null || highValue > cap;
      out.push({
        power,
        value,
        // Nära kurvans lägsta punkt kan förskjutningen hamna på den fallande delen
        low: Math.min(value, Math.max(0, lowValue ?? value)),
        high: open ? cap : Math.max(value, highValue as number),
        open,
      });
      continue;
    }

    let ss = 0;
    let open = false;
    for (const v of variants) {
      const x = valueOf(v, power, key);
      if (x === null || !Number.isFinite(x)) {
        open = true;
        continue;
      }
      ss += (x - value) ** 2;
    }
    const sd = Math.sqrt(ss);
    const high = value + sd;
    out.push({
      power,
      value,
      low: Math.max(0, value - sd),
      high: open || high > cap ? cap : high,
      open: open || high > cap,
    });
  }
  return out;
};
