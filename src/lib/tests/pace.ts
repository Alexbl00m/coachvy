/**
 * Tempo för löpning och simning.
 *
 * Testerna räknar i fart – km/h eller m/s – eftersom det är fart modellerna
 * arbetar med. Men löpare tänker i minuter per kilometer och simmare i tid
 * per 100 meter, så allt som visas för dem skrivs också som tempo.
 */

import type { Sport } from "@/lib/calculators/lactate";
import { formatDuration } from "@/lib/calculators/time";

export const isSpeedUnit = (unit: string) => unit === "km/h" || unit === "m/s";

/** Värdet i m/s, eller null om enheten inte är en fart. */
export function toMetresPerSecond(value: number, unit: string): number | null {
  if (unit === "m/s") return value;
  if (unit === "km/h") return value / 3.6;
  return null;
}

/** Sträckan tempot räknas per: 1 000 m i löpning, 100 m i simning. */
export const paceDistance = (sport: Sport) => (sport === "simning" ? 100 : 1000);

export const paceUnit = (sport: Sport) => (sport === "simning" ? "/100 m" : "/km");

/** m/s till "4:05" (löpning) eller "1:32" (simning), utan enhet. */
export function formatPace(metresPerSecond: number, sport: Sport): string {
  if (!(metresPerSecond > 0)) return "–";
  return formatDuration(paceDistance(sport) / metresPerSecond);
}

/** Om en storhet i den här grenen ska visas som tempo. */
export const showsPace = (sport: Sport, unit: string) =>
  sport !== "cykling" && isSpeedUnit(unit);

const svNumber = (value: number, digits: number) =>
  value.toFixed(digits).replace(".", ",");

/**
 * Ett värde som det visas i resultaten. Farter i löpning och simning blir
 * tempo, med farten kvar som en bisats; allt annat går igenom oförändrat.
 */
export function displayValue(
  value: number,
  unit: string,
  sport: Sport,
  digits: number,
): { value: string; unit: string; speed: string | null } {
  const mps = showsPace(sport, unit) ? toMetresPerSecond(value, unit) : null;
  if (mps === null) {
    return { value: svNumber(value, digits), unit, speed: null };
  }
  return {
    value: formatPace(mps, sport),
    unit: paceUnit(sport),
    speed: `${svNumber(value, digits)} ${unit}`,
  };
}
