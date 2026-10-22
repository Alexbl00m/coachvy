/**
 * Geometrin i en bikefit: vinklar mellan leder och vad en grad i knät är
 * värd i millimeter sadelhöjd.
 *
 * Allt räknas i pixlar (eller millimeter) – aldrig i koordinater som
 * normerats per axel. En posemodell som ger x och y mellan 0 och 1 normerar
 * varje axel för sig, och i en stående video är 0,1 på bredden en annan
 * sträcka än 0,1 på höjden; varje vinkel ur sådana punkter blir hoptryckt
 * (143° blir 119°) och ser ändå rimlig ut. Den som tar emot normerade punkter
 * räknar om dem med `toPixels` först.
 */

export type Point = { x: number; y: number };

const DEG = 180 / Math.PI;

/** Normerade punkter (0–1 per axel) till pixlar. */
export function toPixels(p: Point, width: number, height: number): Point {
  return { x: p.x * width, y: p.y * height };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Vinkeln vid b mellan a och c, i grader (0–180). */
export function angleAt(a: Point, b: Point, c: Point): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const n = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (n === 0) return NaN;
  const cos = Math.min(1, Math.max(-1, (v1x * v2x + v1y * v2y) / n));
  return Math.acos(cos) * DEG;
}

/** Böjningen i en led: 180° minus vinkeln, så att sträckt är 0. */
export function flexion(a: Point, b: Point, c: Point): number {
  return 180 - angleAt(a, b, c);
}

/** Linjen a–b mot vågrätt, 0–90°, oberoende av riktning. */
export function inclination(a: Point, b: Point): number {
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  return Math.atan2(dy, dx) * DEG;
}

/**
 * Avståndet höft–pedal (fotled) vid en viss knäböjning, ur cosinussatsen:
 * L² = T² + S² − 2·T·S·cos(180° − φ) = T² + S² + 2·T·S·cos φ.
 */
export function hipToPedal(thigh: number, shank: number, flexDeg: number) {
  const phi = flexDeg / DEG;
  return Math.sqrt(
    thigh * thigh + shank * shank + 2 * thigh * shank * Math.cos(phi),
  );
}

/**
 * Hur många millimeter avståndet höft–pedal ändras per grad knäböjning vid
 * böjningen φ: derivatan av cosinussatsen, |dL/dφ| = T·S·sin φ / L.
 */
export function mmPerDegree(thigh: number, shank: number, flexDeg: number) {
  const phi = flexDeg / DEG;
  return (
    (thigh * shank * Math.sin(phi)) / hipToPedal(thigh, shank, flexDeg) / DEG
  );
}

/**
 * Hur mycket sadeln ska flyttas för att böjningen ska gå från `from` till
 * `to`, i millimeter. Positivt är högre sadel. Räknat exakt ur
 * cosinussatsen, inte med en faktor per grad.
 */
export function saddleChange(
  thigh: number,
  shank: number,
  from: number,
  to: number,
): number {
  return hipToPedal(thigh, shank, to) - hipToPedal(thigh, shank, from);
}
