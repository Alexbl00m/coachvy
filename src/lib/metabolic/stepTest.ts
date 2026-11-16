/**
 * Labbets stegtest: laktattrösklar ur en tredjegradskurva genom mätpunkterna.
 * - D-max (Cheng m.fl. 1992): största avståndet mellan kurvan och linjen från första till sista punkten
 * - Modifierad D-max (Bishop m.fl. 1998): linjen börjar i punkten före första ökningen på mer än 0,4 mmol/L
 * - 4 mmol/L (OBLA)
 */
export interface StepPoint {
  /** W */
  power: number;
  /** mmol/L */
  lactate: number;
}

export interface StepTestAnalysis {
  points: StepPoint[];
  /** Kurvan i W, för diagram */
  curve: StepPoint[];
  dmax: number | null;
  modDmax: number | null;
  obla4: number | null;
}

/** Minsta kvadrat-anpassning av ett polynom; x skalas för att hålla ekvationerna välkonditionerade */
export const polyfit = (xs: number[], ys: number[], degree: number) => {
  const scale = Math.max(...xs.map(Math.abs)) || 1;
  const n = degree + 1;
  const a: number[][] = Array.from({ length: n }, () => new Array(n + 1).fill(0));
  xs.forEach((x0, k) => {
    const x = x0 / scale;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) a[i][j] += x ** (i + j);
      a[i][n] += ys[k] * x ** i;
    }
  });
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    if (Math.abs(a[col][col]) < 1e-14) return null;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = a[r][col] / a[col][col];
      for (let c = col; c <= n; c++) a[r][c] -= factor * a[col][c];
    }
  }
  const coef = a.map((row, i) => row[n] / row[i]);
  return (x: number) => coef.reduce((s, c, i) => s + c * (x / scale) ** i, 0);
};

/** Effekten där kurvan ligger längst under linjen mellan två punkter */
const maxDistance = (f: (x: number) => number, p0: StepPoint, p1: StepPoint): number | null => {
  if (p1.power <= p0.power) return null;
  const slope = (p1.lactate - p0.lactate) / (p1.power - p0.power);
  let best: number | null = null;
  let bestGap = 0;
  for (let w = p0.power; w <= p1.power; w += 0.5) {
    const gap = p0.lactate + slope * (w - p0.power) - f(w);
    if (gap > bestGap) {
      bestGap = gap;
      best = w;
    }
  }
  return best;
};

export const analyzeStepTest = (input: StepPoint[]): StepTestAnalysis | null => {
  const points = input
    .filter((p) => p.power > 0 && p.lactate > 0)
    .sort((a, b) => a.power - b.power);
  if (points.length < 4) return null;
  const f = polyfit(
    points.map((p) => p.power),
    points.map((p) => p.lactate),
    3
  );
  if (!f) return null;
  const first = points[0];
  const last = points[points.length - 1];

  const rise = points.findIndex((p, i) => i > 0 && p.lactate - points[i - 1].lactate > 0.4);
  const modStart = rise > 0 ? points[rise - 1] : null;

  let obla4: number | null = null;
  for (let w = first.power; w < last.power; w += 0.5) {
    if (f(w) < 4 && f(w + 0.5) >= 4) {
      obla4 = w + (0.5 * (4 - f(w))) / (f(w + 0.5) - f(w));
      break;
    }
  }

  const curve: StepPoint[] = [];
  const step = Math.max(1, (last.power - first.power) / 80);
  for (let w = first.power; w <= last.power + 1e-9; w += step) curve.push({ power: w, lactate: f(w) });

  return {
    points,
    curve,
    dmax: maxDistance(f, first, last),
    modDmax: modStart ? maxDistance(f, modStart, last) : null,
    obla4,
  };
};
