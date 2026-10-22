/**
 * En konstgjord trampcykel med känd knävinkel, för att pröva mätkedjan.
 *
 * Vevlagret ligger i origo, pedalen går runt på en cirkel med vevlängdens
 * radie, och höften står stilla ovanför och lite bakom. Knät är skärningen
 * mellan två cirklar: en kring höften med lårbenets längd och en kring
 * pedalen med underbenets. Höftens läge räknas fram med cosinussatsen så att
 * benet i sitt mest sträckta läge har exakt den böjning man ber om – det är
 * det kedjan ska hitta.
 *
 * Koordinaterna här har y uppåt i millimeter; bilden får y nedåt i pixlar.
 */

import { hipToPedal } from "./geometry";
import type { Keypoint, PoseFrame, SideJoints } from "./chain";

export type CycleOptions = {
  thighMm?: number;
  shankMm?: number;
  crankMm?: number;
  /** Böjningen i det mest sträckta läget, grader. */
  bdcFlex?: number;
  /** Höftens läge bakom vevlagret, mm. */
  hipBehindMm?: number;
  fps: number;
  rpm: number;
  seconds: number;
  /** Vevens vinkel vid första bilden, radianer. */
  phase?: number;
  /** Pixlar per millimeter i bilden. */
  pxPerMm?: number;
  /** Standardavvikelse för slumpmässigt fel på varje punkt, pixlar. */
  noisePx?: number;
  /** Sekunder av stillastående med rakt ben före och efter trampandet. */
  standingS?: number;
  /** Slumpkälla, för upprepbara körningar. */
  random?: () => number;
};

/** Enkel deterministisk slump (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Normalfördelat brus ur två likformiga tal (Box–Muller). */
function gaussian(random: () => number): number {
  const u = Math.max(random(), 1e-12);
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Skärningen mellan två cirklar, den främre (störst x). */
function kneeOf(
  hip: { x: number; y: number },
  thigh: number,
  pedal: { x: number; y: number },
  shank: number,
) {
  const dx = pedal.x - hip.x;
  const dy = pedal.y - hip.y;
  const d = Math.hypot(dx, dy);
  const a = (thigh * thigh - shank * shank + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, thigh * thigh - a * a));
  const mx = hip.x + (a * dx) / d;
  const my = hip.y + (a * dy) / d;
  const k1 = { x: mx + (h * dy) / d, y: my - (h * dx) / d };
  const k2 = { x: mx - (h * dy) / d, y: my + (h * dx) / d };
  return k1.x >= k2.x ? k1 : k2;
}

export function syntheticCycle(options: CycleOptions): PoseFrame[] {
  const T = options.thighMm ?? 430;
  const S = options.shankMm ?? 440;
  const r = options.crankMm ?? 172.5;
  const flex = options.bdcFlex ?? 35;
  const behind = options.hipBehindMm ?? 100;
  const scale = options.pxPerMm ?? 0.7;
  const noise = options.noisePx ?? 0;
  const random = options.random ?? Math.random;
  const standing = options.standingS ?? 0;

  // Mest sträckt när pedalen står på linjen höft–vevlager förlängd: då är
  // avståndet höft–pedal = |höft| + vevlängd. Det ska vara L(φ).
  const reach = hipToPedal(T, S, flex) - r;
  const hip = { x: -behind, y: Math.sqrt(reach * reach - behind * behind) };
  // Axel, armbåge och handled står stilla framför och ovanför: bål 45°.
  const shoulder = { x: hip.x + 420, y: hip.y + 420 };
  const elbow = { x: shoulder.x + 110, y: shoulder.y - 250 };
  const wrist = { x: elbow.x + 200, y: elbow.y - 120 };

  const origin = { x: 540, y: 1500 };
  const toImage = (p: { x: number; y: number }, c = 0.95): Keypoint => ({
    x: origin.x + p.x * scale + (noise ? gaussian(random) * noise : 0),
    y: origin.y - p.y * scale + (noise ? gaussian(random) * noise : 0),
    c,
  });

  const frames: PoseFrame[] = [];
  const total = Math.round(options.seconds * options.fps);
  const still = Math.round(standing * options.fps);
  const omega = (2 * Math.PI * options.rpm) / 60;
  for (let i = 0; i < total + 2 * still; i += 1) {
    let pedal: { x: number; y: number };
    let hipNow = hip;
    if (i < still || i >= total + still) {
      // Bredvid cykeln: rakt ben, foten på golvet långt under pedalen.
      hipNow = { x: hip.x + 150, y: hip.y - 40 };
      pedal = { x: hipNow.x + 20, y: hipNow.y - (T + S - 5) };
    } else {
      const t = (i - still) / options.fps;
      const angle = (options.phase ?? 0) + omega * t;
      // Vinkel 0 pekar rakt ned; framåt är +x.
      pedal = { x: r * Math.sin(angle), y: -r * Math.cos(angle) };
    }
    const knee = kneeOf(hipNow, T, pedal, S);
    const near: SideJoints = {
      shoulder: toImage(shoulder),
      elbow: toImage(elbow),
      wrist: toImage(wrist),
      hip: toImage(hipNow),
      knee: toImage(knee),
      ankle: toImage(pedal),
    };
    // Bortre sidan: skymd, låg tilltro, nästan samma läge.
    const far: SideJoints = {
      shoulder: { ...near.shoulder, x: near.shoulder.x + 6, c: 0.4 },
      elbow: { ...near.elbow, c: 0.3 },
      wrist: { ...near.wrist, c: 0.3 },
      hip: { ...near.hip, x: near.hip.x + 4, c: 0.4 },
      knee: { ...near.knee, c: 0.3 },
      ankle: { ...near.ankle, c: 0.3 },
    };
    frames.push({ left: near, right: far });
  }
  return frames;
}
