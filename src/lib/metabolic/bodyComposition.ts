/**
 * Kroppssammansättning: laktatens fördelningsvolym (VolRel) ur kroppsfett.
 *
 * Regressionerna kommer från Mader & Heck-traditionen (se konaendu/vlamax). För män gav de
 * exakt samma värde som INSCYD:s "aktiv muskel + passivt laktatutrymme" i tre rapporter
 * (49 % vid 12 % fett, 48 % vid 14 % fett). Kvinnornas regression är ännu inte kontrollerad.
 */
export type Sex = "male" | "female";

/** Laktatens fördelningsvolym som andel av kroppsmassan (L/kg) */
export const lactateDistributionVolume = (sex: Sex, bodyFatPct: number): number => {
  const pct = sex === "female" ? -0.5364 * bodyFatPct + 54.02 : -0.5 * bodyFatPct + 55.13;
  return pct / 100;
};

/** Kroppsvatten i procent av kroppsmassan */
export const bodyWaterPct = (sex: Sex, bodyFatPct: number): number =>
  sex === "female" ? -0.73 * bodyFatPct + 73.5 : -0.68 * bodyFatPct + 75;

/** Fettfri massa, kg */
export const fatFreeMass = (bodyMass: number, bodyFatPct: number): number =>
  bodyMass * (1 - bodyFatPct / 100);
