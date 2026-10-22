/**
 * Mätkedjan i en bikefit ur video: från ledpunkter per bild till knäböjningen
 * i nedre dödläget, bålens lutning och armbågens böjning.
 *
 * Kedjan tar emot punkter i PIXLAR (se geometry.ts) och vet inget om vilken
 * posemodell som hittade dem. Fyra ställen gör en sådan mätning tyst fel utan
 * att det syns på resultatet, och de är byggda så här:
 *
 * 1. Pixlar, aldrig per axel normerade koordinater.
 * 2. Bara bilder där adepten trampar räknas. När man kliver på, av eller står
 *    bredvid är benet rakare och foten lägre än i något riktigt tramptag –
 *    just de bilderna skulle annars vinna. Trampandet känns igen på att
 *    fotledens höjd svänger regelbundet, och första och sista sekunden kastas.
 * 3. Nedre dödläget läses inte som median över ett band av bilder (den ligger
 *    alltid över minimum, runt fem grader) och inte som bilden med minst
 *    böjning (den väljer bilder där bruset råkar peka nedåt). I stället: per
 *    varv bilden med minst böjning som grov plats, en parabel med minsta
 *    kvadrat genom ett fönster runt den, och parabelns vertex. Fönstret är en
 *    fjärdedel av trampperioden, inte ett fast antal bilder, och värdet läses
 *    på den oglättade serien även om platsen hittades på en glättad.
 *    Medianen över alla varv är resultatet.
 * 4. Bildfrekvensen kommer ur filen, aldrig ett antagande.
 *
 * Modulen är ren, utan anrop, och prövas mot en konstgjord trampcykel med
 * känd vinkel (chain.test.ts).
 */

import {
  angleAt,
  distance,
  flexion,
  inclination,
  mmPerDegree,
  type Point,
} from "./geometry";

export type Keypoint = Point & {
  /** Modellens tilltro till punkten, 0–1. */
  c: number;
};

export type Joint = "shoulder" | "elbow" | "wrist" | "hip" | "knee" | "ankle";
export const JOINTS: Joint[] = [
  "shoulder",
  "elbow",
  "wrist",
  "hip",
  "knee",
  "ankle",
];

export type SideJoints = Record<Joint, Keypoint>;
export type BodySide = "left" | "right";

/** Punkterna i en bild, båda sidor; null när ingen person hittades. */
export type PoseFrame = Record<BodySide, SideJoints> | null;

/** Under det här räknas en punkt som osäker. */
export const MIN_CONF = 0.5;
/** Över det här står kameran snett: axlarna ligger inte över varandra. */
export const MAX_SIDE_RATIO = 0.25;
/** Kortare klipp räcker inte till flera vevvarv. */
export const MIN_DURATION_S = 10;

export type ClipCheck = {
  durationS: number;
  durationOk: boolean;
  /** Vågrätt avstånd mellan axlarna delat med avståndet axel–höft. */
  sideRatio: number | null;
  sideOk: boolean;
  /** Andel bilder där höft, knä eller fotled har tilltro under 0,5. */
  lowConfShare: number;
  confOk: boolean;
  /** Trampandet gick att känna igen. */
  pedallingOk: boolean;
  /** En mening per problem; tom när inspelningen håller. */
  problems: string[];
};

export type BdcReading = {
  /** Bildindex för parabelns vertex (kan ligga mellan två bilder). */
  at: number;
  /** Knäböjningen vid vertex, grader. */
  flex: number;
};

export type ClipAnalysis = {
  fps: number;
  frames: number;
  side: BodySide | null;
  check: ClipCheck;
  /** Trampperioden i bilder, och kadensen den motsvarar. */
  periodFrames: number | null;
  cadenceRpm: number | null;
  /** Bilder som räknas som trampande. */
  pedalling: boolean[];
  /** Per bild, för diagram och overlay. */
  series: {
    knee: (number | null)[];
    trunk: (number | null)[];
    elbow: (number | null)[];
    shoulder: (number | null)[];
    hip: (number | null)[];
    /** Medeltilltro för höft, knä och fotled. */
    quality: (number | null)[];
  };
  /** Nedre dödläget per varv och medianen. */
  bdc: BdcReading[];
  kneeFlexBdc: number | null;
  /** Spridningen mellan varven, kvartilavstånd i grader. */
  kneeSpread: number | null;
  /** Medianer under trampandet. */
  trunk: number | null;
  elbow: number | null;
  shoulder: number | null;
  /** Höftvinkeln vid nedre dödläget (axel–höft–knä). */
  hip: number | null;
  /** Skala och benlängder ur videon, för millimeter per grad. */
  scale: {
    pxPerMm: number | null;
    thighMm: number | null;
    shankMm: number | null;
    mmPerDegree: number | null;
  };
};

// ---------------------------------------------------------------------------
// Hjälpare
// ---------------------------------------------------------------------------

export function median(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

function quantile(values: number[], q: number): number | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const pos = (v.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
}

/** Luckor fyllda linjärt, så att signalen går att analysera som en helhet. */
function fillGaps(series: (number | null)[]): number[] | null {
  const known = series
    .map((v, i) => (v === null ? null : i))
    .filter((i): i is number => i !== null);
  if (known.length < 2) return null;
  const out = new Array<number>(series.length);
  for (let i = 0; i < series.length; i += 1) {
    const v = series[i];
    if (v !== null) {
      out[i] = v;
      continue;
    }
    const next = known.find((k) => k > i);
    const prev = [...known].reverse().find((k) => k < i);
    if (prev === undefined) out[i] = series[next as number] as number;
    else if (next === undefined) out[i] = series[prev] as number;
    else {
      const a = series[prev] as number;
      const b = series[next] as number;
      out[i] = a + ((b - a) * (i - prev)) / (next - prev);
    }
  }
  return out;
}

/** Glidande medelvärde med udda fönster; null där underlaget saknas. */
function smooth(series: (number | null)[], window: number): (number | null)[] {
  const half = Math.max(0, Math.floor(window / 2));
  return series.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let j = i - half; j <= i + half; j += 1) {
      const v = series[j];
      if (v !== null && v !== undefined) {
        sum += v;
        n += 1;
      }
    }
    return n > 0 ? sum / n : null;
  });
}

/**
 * Trampperioden i bilder ur fotledens höjd: autokorrelationens topp mellan
 * 40 och 140 varv per minut, förfinad med en parabel runt toppen.
 */
export function estimatePeriod(
  ankleY: (number | null)[],
  fps: number,
): number | null {
  const filled = fillGaps(ankleY);
  if (!filled || filled.length < 4) return null;
  const mean = filled.reduce((a, b) => a + b, 0) / filled.length;
  const x = filled.map((v) => v - mean);
  const minLag = Math.max(2, Math.floor((fps * 60) / 140));
  const maxLag = Math.min(x.length - 2, Math.ceil((fps * 60) / 40));
  if (maxLag <= minLag) return null;
  const ac = (lag: number) => {
    let s = 0;
    let a = 0;
    let b = 0;
    for (let i = 0; i + lag < x.length; i += 1) {
      s += x[i] * x[i + lag];
      a += x[i] * x[i];
      b += x[i + lag] * x[i + lag];
    }
    return a > 0 && b > 0 ? s / Math.sqrt(a * b) : 0;
  };
  const values: number[] = [];
  for (let lag = minLag; lag <= maxLag; lag += 1) values.push(ac(lag));
  // Den första tydliga toppen, inte den största: multipler av perioden
  // korrelerar nästan lika bra och skulle annars ge halva kadensen.
  let best = -1;
  const top = Math.max(...values);
  for (let k = 1; k < values.length - 1; k += 1) {
    if (
      values[k] >= values[k - 1] &&
      values[k] >= values[k + 1] &&
      values[k] >= 0.8 * top
    ) {
      best = k;
      break;
    }
  }
  if (best < 0 || values[best] < 0.3) return null;
  const y0 = values[best - 1];
  const y1 = values[best];
  const y2 = values[best + 1];
  const denom = y0 - 2 * y1 + y2;
  const shift = denom !== 0 ? (0.5 * (y0 - y2)) / denom : 0;
  return minLag + best + Math.max(-0.5, Math.min(0.5, shift));
}

/**
 * Parabeln a·t² + b·t + c med minsta kvadrat genom punkterna; vertex och
 * värdet där, eller null när kurvan inte har ett minimum i fönstret.
 */
export function parabolaVertex(
  points: { t: number; v: number }[],
  window: number,
  center: number,
): { at: number; value: number } | null {
  if (points.length < 5) return null;
  // Centrerat kring den grova platsen för numerisk stabilitet.
  const pts = points.map((p) => ({ t: p.t - center, v: p.v }));
  let s0 = 0,
    s1 = 0,
    s2 = 0,
    s3 = 0,
    s4 = 0,
    sv = 0,
    stv = 0,
    st2v = 0;
  for (const { t, v } of pts) {
    const t2 = t * t;
    s0 += 1;
    s1 += t;
    s2 += t2;
    s3 += t2 * t;
    s4 += t2 * t2;
    sv += v;
    stv += t * v;
    st2v += t2 * v;
  }
  // Normalekvationerna för [a, b, c], löst med Cramers regel.
  const m = [
    [s4, s3, s2],
    [s3, s2, s1],
    [s2, s1, s0],
  ];
  const r = [st2v, stv, sv];
  const det = (q: number[][]) =>
    q[0][0] * (q[1][1] * q[2][2] - q[1][2] * q[2][1]) -
    q[0][1] * (q[1][0] * q[2][2] - q[1][2] * q[2][0]) +
    q[0][2] * (q[1][0] * q[2][1] - q[1][1] * q[2][0]);
  const d = det(m);
  if (Math.abs(d) < 1e-12) return null;
  const col = (k: number) =>
    m.map((row, i) => row.map((v, j) => (j === k ? r[i] : v)));
  const a = det(col(0)) / d;
  const b = det(col(1)) / d;
  const c = det(col(2)) / d;
  if (!(a > 0)) return null;
  const tv = -b / (2 * a);
  if (Math.abs(tv) > window / 2) return null;
  return { at: center + tv, value: a * tv * tv + b * tv + c };
}

// ---------------------------------------------------------------------------
// Kedjan
// ---------------------------------------------------------------------------

const meanConf = (s: SideJoints) =>
  JOINTS.reduce((sum, j) => sum + s[j].c, 0) / JOINTS.length;

/** Sidan närmast kameran: högst medeltilltro över hela klippet. */
export function chooseSide(frames: PoseFrame[]): BodySide | null {
  let left = 0;
  let right = 0;
  let n = 0;
  for (const f of frames) {
    if (!f) continue;
    left += meanConf(f.left);
    right += meanConf(f.right);
    n += 1;
  }
  if (n === 0) return null;
  return left >= right ? "left" : "right";
}

/** En vinkel ur tre punkter, bara när alla tre är säkra nog. */
function angleIf(
  a: Keypoint,
  b: Keypoint,
  c: Keypoint,
  fn: (a: Point, b: Point, c: Point) => number,
  min = MIN_CONF,
): number | null {
  return a.c >= min && b.c >= min && c.c >= min ? fn(a, b, c) : null;
}

export function analyseClip(
  frames: PoseFrame[],
  fps: number,
  options: { crankMm?: number } = {},
): ClipAnalysis {
  const crankMm = options.crankMm ?? 172.5;
  const n = frames.length;
  const durationS = fps > 0 ? n / fps : 0;
  const side = chooseSide(frames);
  const sideOf = (f: PoseFrame) => (f && side ? f[side] : null);
  const other = (f: PoseFrame) =>
    f && side ? f[side === "left" ? "right" : "left"] : null;

  // Serierna per bild.
  const knee: (number | null)[] = [];
  const trunk: (number | null)[] = [];
  const elbow: (number | null)[] = [];
  const shoulder: (number | null)[] = [];
  const hip: (number | null)[] = [];
  const quality: (number | null)[] = [];
  const ankleY: (number | null)[] = [];
  for (const f of frames) {
    const s = sideOf(f);
    if (!s) {
      knee.push(null);
      trunk.push(null);
      elbow.push(null);
      shoulder.push(null);
      hip.push(null);
      quality.push(null);
      ankleY.push(null);
      continue;
    }
    knee.push(angleIf(s.hip, s.knee, s.ankle, flexion, 0.3));
    trunk.push(
      s.shoulder.c >= MIN_CONF && s.hip.c >= MIN_CONF
        ? inclination(s.shoulder, s.hip)
        : null,
    );
    elbow.push(angleIf(s.shoulder, s.elbow, s.wrist, flexion));
    shoulder.push(angleIf(s.hip, s.shoulder, s.elbow, angleAt));
    hip.push(angleIf(s.shoulder, s.hip, s.knee, angleAt));
    quality.push((s.hip.c + s.knee.c + s.ankle.c) / 3);
    ankleY.push(s.ankle.c >= 0.3 ? s.ankle.y : null);
  }

  // Kontrollen av inspelningen.
  const problems: string[] = [];
  const durationOk = durationS >= MIN_DURATION_S;
  if (!durationOk)
    problems.push(
      `Klippet är ${durationS.toFixed(1).replace(".", ",")} s – minst ${MIN_DURATION_S} s behövs för flera vevvarv.`,
    );

  const ratios: number[] = [];
  for (const f of frames) {
    const s = sideOf(f);
    const o = other(f);
    if (!s || !o) continue;
    if (
      s.shoulder.c < MIN_CONF ||
      o.shoulder.c < MIN_CONF ||
      s.hip.c < MIN_CONF
    )
      continue;
    const torso = distance(s.shoulder, s.hip);
    if (torso > 0) ratios.push(Math.abs(s.shoulder.x - o.shoulder.x) / torso);
  }
  const sideRatio = median(ratios);
  // Syns den bortre axeln inte alls är vyn rent från sidan.
  const sideOk = sideRatio === null || sideRatio <= MAX_SIDE_RATIO;
  if (!sideOk)
    problems.push(
      `Kameran stod snett: axlarna ligger ${Math.round((sideRatio as number) * 100)} % av bålens längd isär (högst 25 %). Alla vinklar blir då för små.`,
    );

  const withPerson = frames.filter((f) => f !== null).length;
  const low = frames.filter((f) => {
    const s = sideOf(f);
    return (
      !s || s.hip.c < MIN_CONF || s.knee.c < MIN_CONF || s.ankle.c < MIN_CONF
    );
  }).length;
  const lowConfShare = n > 0 ? low / n : 1;
  const confOk = withPerson > 0 && lowConfShare <= 0.2;
  if (!confOk)
    problems.push(
      `Höft, knä eller fotled syns osäkert i ${Math.round(lowConfShare * 100)} % av bilderna – för mörkt, eller något skymmer benet.`,
    );

  // Trampandet: första och sista sekunden bort, sedan regelbunden svängning.
  const trim = Math.round(fps);
  const inner = ankleY.map((v, i) => (i < trim || i >= n - trim ? null : v));
  const period = estimatePeriod(inner, fps);
  const pedalling = new Array<boolean>(n).fill(false);
  if (period) {
    const half = Math.round(period / 2);
    const lows: (number | null)[] = [];
    const highs: (number | null)[] = [];
    for (let i = 0; i < n; i += 1) {
      if (inner[i] === null) {
        lows.push(null);
        highs.push(null);
        continue;
      }
      let lo = Infinity;
      let hi = -Infinity;
      for (let j = i - half; j <= i + half; j += 1) {
        const v = inner[j];
        if (v === null || v === undefined) continue;
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
      lows.push(hi > lo ? lo : null);
      highs.push(hi > lo ? hi : null);
    }
    const amplitude = lows.map((lo, i) =>
      lo !== null && highs[i] !== null ? (highs[i] as number) - lo : null,
    );
    const typical = median(amplitude.filter((v): v is number => v !== null));
    const bandLo = median(lows.filter((v): v is number => v !== null));
    const bandHi = median(highs.filter((v): v is number => v !== null));
    // Trampar gör den vars fot svänger lika mycket som i det typiska varvet
    // – och vars fot just nu ligger inom trampbandet. Står foten på golvet
    // ligger den under bandet, även om fönstret runt bilden når in i
    // trampandet.
    for (let i = 0; i < n; i += 1) {
      const a = amplitude[i];
      const y = inner[i];
      const margin = typical !== null ? 0.15 * typical : 0;
      pedalling[i] =
        typical !== null &&
        bandLo !== null &&
        bandHi !== null &&
        a !== null &&
        y !== null &&
        a >= 0.5 * typical &&
        y >= bandLo - margin &&
        y <= bandHi + margin &&
        knee[i] !== null;
    }
  }
  const pedallingOk = period !== null && pedalling.filter(Boolean).length > 0;
  if (!pedallingOk)
    problems.push(
      "Trampandet gick inte att känna igen – fotleden svänger inte regelbundet i klippet.",
    );

  // Nedre dödläget per varv.
  const bdc: BdcReading[] = [];
  if (period) {
    const window = Math.max(5, Math.round(period / 4));
    const smoothWindow = Math.max(3, Math.round(period / 8) | 1);
    const kneeOk = knee.map((v, i) => (pedalling[i] ? v : null));
    const kneeSmooth = smooth(kneeOk, smoothWindow);
    const ankleSmooth = smooth(
      inner.map((v, i) => (pedalling[i] ? v : null)),
      smoothWindow,
    );
    // Pedalen längst ned: fotleden lägst i bilden (störst y), en per varv.
    const bottoms: number[] = [];
    for (let i = 1; i < n - 1; i += 1) {
      const v = ankleSmooth[i];
      if (v === null) continue;
      let isMax = true;
      const reach = Math.round(period / 2);
      for (
        let j = Math.max(0, i - reach);
        j <= Math.min(n - 1, i + reach);
        j += 1
      ) {
        const w = ankleSmooth[j];
        if (w !== null && w > v) {
          isMax = false;
          break;
        }
      }
      if (
        isMax &&
        (bottoms.length === 0 ||
          i - bottoms[bottoms.length - 1] >= 0.6 * period)
      )
        bottoms.push(i);
    }
    for (const bottom of bottoms) {
      // Grov plats: minst böjning på den glättade serien inom ett halvt varv.
      let coarse = -1;
      let lowest = Infinity;
      const reach = Math.round(period / 2);
      for (
        let j = Math.max(0, bottom - reach);
        j <= Math.min(n - 1, bottom + reach);
        j += 1
      ) {
        const v = kneeSmooth[j];
        if (v !== null && v < lowest) {
          lowest = v;
          coarse = j;
        }
      }
      if (coarse < 0) continue;
      // Värdet läses på den oglättade serien.
      const half = window / 2;
      const pts: { t: number; v: number }[] = [];
      for (
        let j = Math.ceil(coarse - half);
        j <= Math.floor(coarse + half);
        j += 1
      ) {
        const v = kneeOk[j];
        if (v !== null && v !== undefined) pts.push({ t: j, v });
      }
      const vertex = parabolaVertex(pts, window, coarse);
      if (vertex) bdc.push({ at: vertex.at, flex: vertex.value });
    }
  }
  const flexValues = bdc.map((b) => b.flex);
  const kneeFlexBdc = median(flexValues);
  const q1 = quantile(flexValues, 0.25);
  const q3 = quantile(flexValues, 0.75);

  // Medianer under trampandet.
  const during = (series: (number | null)[]) =>
    median(series.filter((v, i): v is number => v !== null && pedalling[i]));
  const hipAtBdc = median(
    bdc
      .map((b) => hip[Math.round(b.at)])
      .filter((v): v is number => v !== null && v !== undefined),
  );

  // Skalan: fotledens höjd svänger ungefär två vevlängder.
  let pxPerMm: number | null = null;
  let thighMm: number | null = null;
  let shankMm: number | null = null;
  let perDegree: number | null = null;
  if (period && side) {
    const swings: number[] = [];
    const span = Math.round(period);
    for (let start = trim; start + span < n - trim; start += span) {
      let lo = Infinity;
      let hi = -Infinity;
      let ok = 0;
      for (let j = start; j < start + span; j += 1) {
        const v = inner[j];
        if (v === null || !pedalling[j]) continue;
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
        ok += 1;
      }
      if (ok >= 0.8 * span) swings.push(hi - lo);
    }
    const swing = median(swings);
    const thighPx = median(
      frames
        .map((f, i) => {
          const s = sideOf(f);
          return s && pedalling[i] ? distance(s.hip, s.knee) : NaN;
        })
        .filter(Number.isFinite),
    );
    const shankPx = median(
      frames
        .map((f, i) => {
          const s = sideOf(f);
          return s && pedalling[i] ? distance(s.knee, s.ankle) : NaN;
        })
        .filter(Number.isFinite),
    );
    if (swing && swing > 0) {
      pxPerMm = swing / (2 * crankMm);
      if (thighPx) thighMm = thighPx / pxPerMm;
      if (shankPx) shankMm = shankPx / pxPerMm;
      if (thighMm && shankMm && kneeFlexBdc !== null)
        perDegree = mmPerDegree(thighMm, shankMm, kneeFlexBdc);
    }
  }

  return {
    fps,
    frames: n,
    side,
    check: {
      durationS,
      durationOk,
      sideRatio,
      sideOk,
      lowConfShare,
      confOk,
      pedallingOk,
      problems,
    },
    periodFrames: period,
    cadenceRpm: period ? (60 * fps) / period : null,
    pedalling,
    series: { knee, trunk, elbow, shoulder, hip, quality },
    bdc,
    kneeFlexBdc,
    kneeSpread: q1 !== null && q3 !== null ? q3 - q1 : null,
    trunk: during(trunk),
    elbow: during(elbow),
    shoulder: during(shoulder),
    hip: hipAtBdc,
    scale: { pxPerMm, thighMm, shankMm, mmPerDegree: perDegree },
  };
}
