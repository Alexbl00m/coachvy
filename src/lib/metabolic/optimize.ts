/**
 * Nelder–Mead-minimering utan externa beroenden. Används för regressionen över (VO2max, VLaMax).
 */
export interface MinimizeResult {
  x: number[];
  value: number;
  iterations: number;
  converged: boolean;
}

export const nelderMead = (
  f: (x: number[]) => number,
  start: number[],
  step: number[],
  { maxIterations = 600, tolerance = 1e-10 } = {}
): MinimizeResult => {
  const n = start.length;
  let simplex = [start.slice()];
  for (let i = 0; i < n; i++) {
    const p = start.slice();
    p[i] += step[i];
    simplex.push(p);
  }
  let values = simplex.map(f);
  const centroid = (pts: number[][]) =>
    pts[0].map((_, j) => pts.reduce((s, p) => s + p[j], 0) / pts.length);
  const move = (from: number[], to: number[], t: number) =>
    from.map((v, j) => v + t * (to[j] - v));

  let iteration = 0;
  let converged = false;
  for (; iteration < maxIterations; iteration++) {
    const order = values.map((v, i) => i).sort((a, b) => values[a] - values[b]);
    simplex = order.map((i) => simplex[i]);
    values = order.map((i) => values[i]);
    if (Math.abs(values[n] - values[0]) < tolerance) {
      converged = true;
      break;
    }
    const c = centroid(simplex.slice(0, n));
    const reflected = move(simplex[n], c, 2);
    const fr = f(reflected);
    if (fr < values[0]) {
      const expanded = move(simplex[n], c, 3);
      const fe = f(expanded);
      [simplex[n], values[n]] = fe < fr ? [expanded, fe] : [reflected, fr];
    } else if (fr < values[n - 1]) {
      [simplex[n], values[n]] = [reflected, fr];
    } else {
      const contracted = move(simplex[n], c, 0.5);
      const fc = f(contracted);
      if (fc < values[n]) {
        [simplex[n], values[n]] = [contracted, fc];
      } else {
        simplex = simplex.map((p) => move(simplex[0], p, 0.5));
        values = simplex.map(f);
      }
    }
  }
  const best = values.indexOf(Math.min(...values));
  return { x: simplex[best], value: values[best], iterations: iteration, converged };
};
