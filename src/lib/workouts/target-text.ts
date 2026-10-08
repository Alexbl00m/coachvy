import type { Sport } from "@/lib/calculators/lactate";
import {
  BASIS_LABEL,
  formatDuration,
  formatPace,
  type ResolvedStep,
  type TargetBasis,
} from "./schema";

/** Målet i belastningens egen enhet: watt, eller tempo från det snabbaste. */
export function targetText(step: ResolvedStep, sport: Sport): string {
  if (sport === "cykling") {
    return Math.round(step.low) === Math.round(step.high)
      ? `${Math.round(step.target)} W`
      : `${Math.round(step.low)}–${Math.round(step.high)} W`;
  }
  if (Math.abs(step.high - step.low) < 0.005) {
    return formatPace(step.target, sport);
  }
  const per = sport === "simning" ? 100 : 1000;
  // Snabbast först, som tempo brukar skrivas: "4:05–4:15/km".
  return `${formatDuration(per / step.high)}–${formatPace(step.low, sport)}`;
}

/** Målet som andel av referensen: "95–100 % av FTP". */
export function percentText(step: ResolvedStep, basis: TargetBasis): string {
  const low = Math.round(step.lowFraction * 100);
  const high = Math.round(step.highFraction * 100);
  return `${low === high ? low : `${low}–${high}`} % av ${BASIS_LABEL[basis]}`;
}
