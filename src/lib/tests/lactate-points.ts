/**
 * Linjär läsning av ett stegtests rådata.
 *
 * Trösklarna kräver en anpassad kurva och minst fyra steg. De här måtten
 * kräver bara två punkter: de läser rakt av mellan stegen, som man gör med
 * linjal på en utskriven laktatkurva. Därför fungerar de också på äldre
 * tester från andra testare, med tre steg och glesa belastningar – och det är
 * just där de behövs för att kunna jämföra.
 */

export type LactatePoint = {
  intensity: number;
  lactate: number;
  heartRate: number | null;
};

/** Stegen sorterade efter belastning, utan vilovärde och ofullständiga rader. */
export function cleanPoints(points: LactatePoint[]): LactatePoint[] {
  return points
    .filter(
      (p) =>
        Number.isFinite(p.intensity) &&
        Number.isFinite(p.lactate) &&
        p.intensity > 0 &&
        p.lactate > 0,
    )
    .sort((a, b) => a.intensity - b.intensity);
}

/**
 * Belastningen där laktatet först når `level`, linjärt mellan stegen.
 *
 * Första korsningen, inte sista: ett laktat som svänger ner igen efter att ha
 * passerat nivån har ändå passerat den. Null när kurvan aldrig når dit – att
 * extrapolera bortom sista steget vore att hitta på ett steg som inte gjordes.
 */
export function intensityAtLactate(
  points: LactatePoint[],
  level: number,
): number | null {
  const pts = cleanPoints(points);
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1];
    const b = pts[i];
    if (a.lactate < level && b.lactate >= level) {
      return (
        a.intensity +
        ((level - a.lactate) / (b.lactate - a.lactate)) *
          (b.intensity - a.intensity)
      );
    }
  }
  return null;
}

/** Laktatet vid en belastning, linjärt mellan stegen. Null utanför testet. */
export function lactateAtIntensity(
  points: LactatePoint[],
  intensity: number,
): number | null {
  const pts = cleanPoints(points);
  return interpolate(
    pts.map((p) => [p.intensity, p.lactate]),
    intensity,
  );
}

/** Pulsen vid en belastning, linjärt mellan stegen som har puls. */
export function heartRateAtIntensity(
  points: LactatePoint[],
  intensity: number,
): number | null {
  const pts = cleanPoints(points).filter((p) => p.heartRate !== null);
  return interpolate(
    pts.map((p) => [p.intensity, p.heartRate as number]),
    intensity,
  );
}

function interpolate(pairs: [number, number][], x: number): number | null {
  if (pairs.length === 0) return null;
  if (pairs.length === 1) return pairs[0][0] === x ? pairs[0][1] : null;
  if (x < pairs[0][0] || x > pairs[pairs.length - 1][0]) return null;
  for (let i = 1; i < pairs.length; i += 1) {
    const [x0, y0] = pairs[i - 1];
    const [x1, y1] = pairs[i];
    if (x >= x0 && x <= x1) {
      return x1 === x0 ? y1 : y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return null;
}
