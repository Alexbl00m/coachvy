/**
 * VLamax ur sprintlaktat, den klassiska formeln (Mader 1984, Heck m.fl. 2003):
 * (högsta laktat − vilolaktat) / (sprinttid − alaktacid tid).
 *
 * Samma formel och samma två tal som den kalibrerade modellen
 * (`@/lib/metabolic`, `sprintLactateVlamax`), men utan dess konstanter, så att
 * kalkylen kan räkna i webbläsaren. Ett test håller de två lika.
 */

/** Sekunder innan glykolysen tar över i sprinten. */
export const ALACTIC_SECONDS = 3.5;
/** Vilolaktat när det inte är mätt, mmol/l. */
export const RESTING_LACTATE = 1.0;

/** Null när värdena inte går att räkna på: laktat utanför 2–30 mmol/l, under vilan, eller för kort sprint. */
export function vlamaxFromSprintLactate(
  peak: number,
  rest: number | null,
  sprintSeconds: number,
): number | null {
  const base = rest !== null && rest > 0 ? rest : RESTING_LACTATE;
  if (!(peak >= 2 && peak <= 30) || peak <= base || !(sprintSeconds > ALACTIC_SECONDS + 1)) {
    return null;
  }
  return (peak - base) / (sprintSeconds - ALACTIC_SECONDS);
}
