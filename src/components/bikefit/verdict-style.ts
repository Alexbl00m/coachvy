import type { Verdict } from "@/lib/bikefit/templates";

/** Omdömets färg som text: grönt, gult, rött. */
export const VERDICT_TEXT: Record<Verdict, string> = {
  grön: "text-good",
  gul: "text-warn",
  röd: "text-bad",
};

/** Omdömets färg som ram. */
export const VERDICT_BORDER: Record<Verdict, string> = {
  grön: "border-good/60",
  gul: "border-warn/60",
  röd: "border-bad/60",
};
