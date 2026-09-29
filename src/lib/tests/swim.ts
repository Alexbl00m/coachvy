/**
 * Simningen ur swim-speed-calculator-pro: simprofil, loppprognoser och
 * Red Mist-cykler ovanpå CSS.
 *
 * CSS (lutningen i d = CSS·t + D′) räknades rätt i originalet och räknas här
 * likadant. Tre saker rättades:
 *
 *   - D′ räknades som (snittfart − CSS) · snittid. Det är inte linjens
 *     skärning och ger fel värde så fort testerna inte ligger symmetriskt;
 *     D′ är skärningen, snittdistans − CSS · snittid.
 *   - SDI var snabbaste farten delad med den långsammaste, och användes sedan
 *     som exponent i loppprognosen. En fartkvot är ingen exponent: samma
 *     simmare får olika SDI med 200 + 400 m och med 200 + 800 m. Här anpassas
 *     exponenten ur testerna (log t mot log d), och originalets gränser
 *     1,05 och 1,09 gäller den.
 *   - Drop-off i procent berodde på vilka distanser som simmades. Här är det
 *     fart-tapp per dubblad distans, 1 − 2^(1−b), som går att jämföra mellan
 *     tester och mellan simmare.
 */

import { buildPredictionModel } from "@/lib/calculators/race-prediction";
import { CS_RANGE_SECONDS } from "@/lib/calculators/critical-speed";

export type SwimPoint = { metres: number; seconds: number };

/** Exponenten när det bara finns en distans: originalets "bra" nivå. */
export const SWIM_TYPICAL_EXPONENT = 1.04;

export type SwimmerType = "Dieselmotor" | "Balanserad" | "Bensinmotor";

export type SwimProfile = {
  exponent: number;
  /** Fart som tappas per dubblad distans, %. */
  lossPerDoubling: number;
  type: SwimmerType;
  reading: string;
};

const pct = (v: number) => v.toFixed(1).replace(".", ",");

/** Simprofilen ur minst två distanser, annars null. */
export function swimProfile(points: SwimPoint[]): SwimProfile | null {
  const model = buildPredictionModel(points, SWIM_TYPICAL_EXPONENT);
  if (!model || !model.individual) return null;
  const b = model.exponent;
  const loss = (1 - 2 ** (1 - b)) * 100;
  if (b < 1.05) {
    return {
      exponent: b,
      lossPerDoubling: loss,
      type: "Dieselmotor",
      reading: `Dieselmotor: tappar ${pct(loss)} % fart per dubblad distans. Uthålligheten är god – farten och tekniken i högre tempo har mest att hämta.`,
    };
  }
  if (b <= 1.09) {
    return {
      exponent: b,
      lossPerDoubling: loss,
      type: "Balanserad",
      reading: `Balanserad: tappar ${pct(loss)} % fart per dubblad distans.`,
    };
  }
  return {
    exponent: b,
    lossPerDoubling: loss,
    type: "Bensinmotor",
    reading: `Bensinmotor: tappar ${pct(loss)} % fart per dubblad distans. Farten finns – uthålligheten och CSS-serierna har mest att hämta.`,
  };
}

/** Distanserna ur originalet – triathlon och öppet vatten. */
export const SWIM_RACES: { label: string; metres: number }[] = [
  { label: "Supersprint", metres: 400 },
  { label: "Sprint", metres: 750 },
  { label: "Tröskelserie", metres: 1000 },
  { label: "Olympisk", metres: 1500 },
  { label: "Halv-Ironman", metres: 1900 },
  { label: "Vansbrosimningen", metres: 3000 },
  { label: "Ironman", metres: 3800 },
  { label: "Halvmaraton sim", metres: 5000 },
  { label: "Maraton sim", metres: 10000 },
];

/** Exponenterna att jämföra med, från originalets perfekt/bra/dålig. */
export const SWIM_REFERENCES = [
  { label: "Mycket uthållig (1,03)", exponent: 1.03 },
  { label: "Typisk (1,04)", exponent: 1.04 },
  { label: "Svag uthållighet (1,06)", exponent: 1.06 },
] as const;

export type SwimPrediction = {
  label: string;
  metres: number;
  /** Ur simmarens egen kurva, från det längsta testet. */
  own: number;
  references: number[];
  /** CSS-modellen, t = (d − D′) / CSS. */
  css: number | null;
  cssBeyondModel: boolean;
};

/**
 * Tider på loppdistanserna. Alla räknas från det längsta testet – det
 * närmaste loppen – med simmarens egen exponent och med referenserna.
 */
export function swimPredictions(
  points: SwimPoint[],
  cs: number | null,
  dPrime: number | null,
): SwimPrediction[] {
  const valid = points.filter((p) => p.metres > 0 && p.seconds > 0);
  if (valid.length === 0) return [];
  const base = valid.reduce((a, b) => (b.metres > a.metres ? b : a));
  const exponent = swimProfile(valid)?.exponent ?? SWIM_TYPICAL_EXPONENT;
  const at = (metres: number, b: number) =>
    base.seconds * (metres / base.metres) ** b;
  return SWIM_RACES.map(({ label, metres }) => {
    const css =
      cs && cs > 0 && dPrime !== null && metres > dPrime
        ? (metres - dPrime) / cs
        : null;
    return {
      label,
      metres,
      own: at(metres, exponent),
      references: SWIM_REFERENCES.map((r) => at(metres, r.exponent)),
      css,
      cssBeyondModel:
        css !== null &&
        (css < CS_RANGE_SECONDS[0] || css > CS_RANGE_SECONDS[1]),
    };
  });
}

/**
 * Red Mist-cyklerna: tiden per 50 m i CSS-tempo, avrundad till hel sekund,
 * och sedan en sekund i taget uppåt – cykel 0 till 10, som i originalet.
 */
export function redMistCycles(cs: number): { cycle: number; per50: number }[] {
  if (!(cs > 0)) return [];
  const base = Math.round(50 / cs);
  return Array.from({ length: 11 }, (_, i) => ({ cycle: i, per50: base + i }));
}
