/**
 * Seriefärger för diagrammen: violett, cyan och guld – fritt från accentens
 * orange (ton 40°), som är "gör detta", och från zonernas blå (252°), som
 * passets intensitet ritas i.
 *
 * Samma hex på den mörka appen och den ljusa sajten, så att kartan och andra
 * ritytor som inte löser CSS-variabler får rätt färg. Validerade med
 * dataviz-skillens `validate_palette.js --pairs all` mot #111216, #1f1f24 och
 * #ffffff: alla inom ljushetsbandet, minst 3:1 mot ytan, och sämsta par
 * ΔE 10,1 under deutanopi (violett–cyan) och 17,0 för normalseende.
 *
 * Den förra paletten (#e07049, #3d9ec2, #7fa03f) föll på färgblindhet:
 * orange och grönt låg på ΔE 1,7 under deutanopi.
 */
export const SERIES = {
  /** Huvudserien: en trend, laktatkurvan, effekten. Ton 288°. */
  primary: "#8a78ee",
  /** Andra serien: puls, fett. Ton 215°. */
  secondary: "#2b9db5",
  /** Tredje serien, som stigningen i cykelkalkylen och belastningen. Ton 90°. */
  tertiary: "#b0902c",
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
