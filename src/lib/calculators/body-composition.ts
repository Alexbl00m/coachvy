/**
 * Kroppsfett ur BMI, när inget är mätt.
 *
 * Deurenberg, Weststrate & Seidell (1991), anpassad på 1 229 vuxna:
 *
 *   kroppsfett % = 1,20 · BMI + 0,23 · ålder − 10,8 · kön − 5,4
 *
 * där kön är 1 för män och 0 för kvinnor. Standardfelet är ungefär 4
 * procentenheter i den befolkning den togs fram på. För tränade atleter är den
 * sämre: BMI kan inte skilja muskler från fett, så en muskulös cyklist eller
 * roddare får ett för högt kroppsfett – ofta flera procentenheter. Den ger en
 * känsla för storleksordningen, inte ett värde att räkna VLamax på utan att
 * säga det.
 */

export type Sex = "man" | "kvinna";

export function bmi(weightKg: number, heightCm: number): number | null {
  if (!(weightKg > 0) || !(heightCm > 0)) return null;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

/** Kroppsfett i procent ur BMI, ålder och kön. null utan giltiga värden. */
export function bodyFatFromBmi(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: Sex,
): number | null {
  const b = bmi(weightKg, heightCm);
  if (b === null || !(age > 0)) return null;
  const pct = 1.2 * b + 0.23 * age - 10.8 * (sex === "man" ? 1 : 0) - 5.4;
  return Math.min(Math.max(pct, 3), 60);
}

/** Fettfri massa i kg. */
export const fatFreeMass = (weightKg: number, bodyFatPct: number) =>
  weightKg * (1 - bodyFatPct / 100);

/** Formelns ungefärliga standardfel, procentenheter. */
export const BMI_FAT_ERROR = 4;
