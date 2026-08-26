/**
 * Seriefärger för kalkylernas diagram, valda mot den mörka ytan (#1f1f24):
 * båda ligger i rätt ljushetsband, har tillräcklig kroma för att inte läsa som
 * grått, och skiljs åt även vid färgblindhet (ΔE 17,6 under deutan).
 */
export const SERIES = {
  /** Brand-accenten, nedsänkt till diagrammens ljushetsband. */
  primary: "#e07049",
  secondary: "#3d9ec2",
} as const;

export const CHART_GRID = "#2f2f37";
export const CHART_AXIS_TEXT = "#7a7a86";
export const CHART_SURFACE = "#1f1f24";
