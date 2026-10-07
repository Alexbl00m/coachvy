/**
 * Intensitetszoner för passets profil.
 *
 * Zonerna styr bara hur ett steg *ritas* – färgen i profilen och namnet i
 * förklaringen. Ingenting räknas på dem: målen sparas som andel av referensen
 * och W′bal räknar på watten och farten direkt.
 *
 * Gränserna skiljer sig mellan referenserna, eftersom en procentsats betyder
 * olika saker mot olika storheter:
 *
 * - **FTP och LT2**: Coggans nivåer – 55, 75, 90, 105 och 120 %. Nivå 6 och 7
 *   är slagna ihop till "Anaerob"; i ett byggt pass går de inte att skilja åt.
 * - **CP** ligger några procent över FTP, så samma nivåer flyttas ned med 4 %.
 * - **CS** (löpning) är en fart. CS är gränsen mot det svåra området, där
 *   VO2max kan nås, så zon 5 börjar vid 100 %. Lugn distans ligger runt
 *   72–82 % av CS, maratonfart kring 85–90 %.
 * - **CSS** (simning) är också en fart, men vattnets motstånd växer så brant
 *   med farten att några procent är ett helt zonsteg.
 */

import type { TargetBasis } from "./schema";

export type IntensityZone = 1 | 2 | 3 | 4 | 5 | 6;

export const ZONES: IntensityZone[] = [1, 2, 3, 4, 5, 6];

export const ZONE_NAMES: Record<IntensityZone, string> = {
  1: "Återhämtning",
  2: "Distans",
  3: "Tempo",
  4: "Tröskel",
  5: "VO2max",
  6: "Anaerob",
};

/**
 * Övre gränsen för zon 1–5, som andel av referensen, med gränsen själv i den
 * lägre zonen – som Coggan: 55 % är återhämtning, 120 % VO2max.
 */
const CUTS: Record<TargetBasis, [number, number, number, number, number]> = {
  FTP: [0.55, 0.75, 0.9, 1.05, 1.2],
  LT2: [0.55, 0.75, 0.9, 1.05, 1.2],
  CP: [0.53, 0.72, 0.87, 1.01, 1.15],
  CS: [0.72, 0.82, 0.9, 1.0, 1.08],
  CSS: [0.86, 0.92, 0.97, 1.02, 1.07],
};

/** Zonen för ett mål angivet som andel av referensen. */
export function zoneOf(fraction: number, basis: TargetBasis): IntensityZone {
  const cuts = CUTS[basis];
  for (let i = 0; i < cuts.length; i += 1) {
    // Marginalen tar hand om att 0,55 inte alltid blir exakt 0,55 i flyttal.
    if (fraction <= cuts[i] + 1e-9) return (i + 1) as IntensityZone;
  }
  return 6;
}

/** Zonens färg: en blå stege, validerad mot både den mörka och ljusa ytan. */
export const zoneColor = (zone: IntensityZone) => `var(--zone-${zone})`;
