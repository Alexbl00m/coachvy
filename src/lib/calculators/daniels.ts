/**
 * Daniels och Gilberts ekvationer: VDOT ur ett lopp, och lopp ur VDOT.
 *
 * Två kurvor, båda anpassade till elitlöpares data (Daniels & Gilbert 1979):
 *
 *   Syrekostnad vid farten v (m/min):
 *     VO2 = −4,60 + 0,182258·v + 0,000104·v²
 *
 *   Andel av VO2max som går att hålla i t minuter:
 *     %max = 0,8 + 0,1894393·e^(−0,012778·t) + 0,2989558·e^(−0,1932605·t)
 *
 * VDOT är loppets syrekostnad delad med den andelen – det VO2max loppet
 * "motsvarar". Det är ett prestationsmått, inte ett uppmätt VO2max: en löpare
 * med dålig löpekonomi får lägre VDOT än sitt labbvärde.
 *
 * Portat från runner-metrics-calculator. Den äldre GPT_APP-versionen räknade
 * farten i km/h i stället för m/min och utelämnade %max-kurvan; här är det
 * Daniels egna enheter rakt igenom. Kontrollerat mot hans tabeller: 5 km på
 * 20:00 ger VDOT 49,8, VDOT 50 ger 10 km på 41:20 (tabell 41:21), maraton på
 * 3:10:40 (3:10:49) och tröskelfart 4:15/km.
 */

/** Andel av VO2max som går att hålla i `minutes` minuter. */
export function fractionOfVo2max(minutes: number): number {
  return (
    0.8 +
    0.1894393 * Math.exp(-0.012778 * minutes) +
    0.2989558 * Math.exp(-0.1932605 * minutes)
  );
}

/** Syrekostnaden i ml/kg/min vid farten `metresPerMinute`. */
export function oxygenCost(metresPerMinute: number): number {
  return -4.6 + 0.182258 * metresPerMinute + 0.000104 * metresPerMinute ** 2;
}

/** Farten i m/min som kostar `vo2` ml/kg/min – andragradsekvationens positiva rot. */
export function speedForOxygen(vo2: number): number {
  const a = 0.000104;
  const b = 0.182258;
  const c = -4.6 - vo2;
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
}

/** VDOT ur ett lopp. */
export function vdotFromPerformance(
  metres: number,
  seconds: number,
): number | null {
  if (!(metres > 0) || !(seconds > 0)) return null;
  const minutes = seconds / 60;
  return oxygenCost(metres / minutes) / fractionOfVo2max(minutes);
}

/**
 * Loppets tid ur VDOT.
 *
 * Tiden styr hur stor andel av VDOT som går att hålla, och andelen styr
 * farten – så tiden löses iterativt. Fixpunkten konvergerar på några varv;
 * 30 är gott och väl.
 */
export function timeFromVdot(vdot: number, metres: number): number | null {
  if (!(vdot > 0) || !(metres > 0)) return null;
  let minutes = metres / speedForOxygen(vdot * 0.9);
  for (let i = 0; i < 30; i += 1) {
    minutes = metres / speedForOxygen(vdot * fractionOfVo2max(minutes));
  }
  return Number.isFinite(minutes) && minutes > 0 ? minutes * 60 : null;
}

/** Farten i m/s som går att hålla i `minutes` minuter vid ett givet VDOT. */
export function speedAtDuration(vdot: number, minutes: number): number {
  return speedForOxygen(vdot * fractionOfVo2max(minutes)) / 60;
}

/**
 * Tröskelfarten: Daniels T-tempo, 88 % av VDOT.
 *
 * För en vältränad löpare är det ungefär loppfarten för en timme. Samma
 * definition används oavsett varifrån VDOT kom, så att ett 5 km-test, ett
 * 20-minuterstest och ett lopp ger jämförbara trösklar.
 */
export const THRESHOLD_FRACTION = 0.88;

export function thresholdSpeedFromVdot(vdot: number): number {
  return speedForOxygen(vdot * THRESHOLD_FRACTION) / 60;
}
