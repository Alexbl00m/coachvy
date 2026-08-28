/**
 * Seriefärger för kalkylernas diagram, valda mot den mörka ytan (#1f1f24):
 * båda ligger i rätt ljushetsband, har tillräcklig kroma för att inte läsa som
 * grått, och skiljs åt även vid färgblindhet (ΔE 17,6 under deutan).
 */
export const SERIES = {
  /** Brand-accenten, nedsänkt till diagrammens ljushetsband. */
  primary: "#e07049",
  secondary: "#3d9ec2",
  /**
   * Tredje serien, för effektbudgeten i cykelkalkylen. Sämsta grannpar med de
   * två ovan är ΔE 18,1 för normalseende och 14,6 under protanopi – båda över
   * gränsen. Validerad med dataviz-skillens `validate_palette.js` mot #1f1f24.
   */
  tertiary: "#7fa03f",
} as const;

/**
 * Diagrammens ram som CSS-variabler i stället för fasta värden.
 *
 * Samma komponenter renderas på den mörka appen och den ljusa publika sajten.
 * Serierna är validerade mot båda ytorna och behöver inte bytas, men rutnätet,
 * axeltexten och ytan bakom en punkt måste vända – och SVG-attribut löser
 * var() precis som vilken annan färgangivelse som helst.
 */
export const CHART_GRID = "var(--chart-grid)";
export const CHART_AXIS_TEXT = "var(--chart-axis-text)";
export const CHART_SURFACE = "var(--chart-surface)";

/** Textfärg för etiketter direkt på datan, som en utpekad punkt. */
export const CHART_LABEL_TEXT = "var(--text)";
