/**
 * Numeriska byggstenar som kalkylerna delar: minstakvadratanpassning,
 * polynom, exponentialkurvor, naturliga kubiska splines och brytpunkter.
 *
 * Skrivna för att ge samma svar som R:s `lm`, `nls`, `splines::ns` och
 * `segmented::segmented`, eftersom laktatmodulen är portad därifrån.
 */

/**
 * Löser normalekvationerna med Gauss-Jordan-elimination. Returnerar null när
 * systemet är singulärt eller underbestämt.
 */
export function solveLeastSquares(
  rows: number[][],
  targets: number[],
): number[] | null {
  const width = rows[0]?.length ?? 0;
  if (rows.length < width || width === 0) return null;

  const matrix = Array.from({ length: width }, (_, i) =>
    Array.from({ length: width + 1 }, (_, j) =>
      j < width
        ? rows.reduce((sum, row) => sum + row[i] * row[j], 0)
        : rows.reduce((sum, row, k) => sum + row[i] * targets[k], 0),
    ),
  );

  for (let col = 0; col < width; col++) {
    let pivot = col;
    for (let row = col + 1; row < width; row++) {
      if (Math.abs(matrix[row][col]) > Math.abs(matrix[pivot][col])) pivot = row;
    }
    [matrix[col], matrix[pivot]] = [matrix[pivot], matrix[col]];

    if (Math.abs(matrix[col][col]) < 1e-12) return null;

    const divisor = matrix[col][col];
    for (let j = col; j <= width; j++) matrix[col][j] /= divisor;

    for (let row = 0; row < width; row++) {
      if (row === col) continue;
      const factor = matrix[row][col];
      for (let j = col; j <= width; j++) matrix[row][j] -= factor * matrix[col][j];
    }
  }

  return matrix.map((row) => row[width]);
}

/**
 * Gauss-Jordan på en färdig utvidgad matris. `solveLeastSquares` bygger sin
 * matris ur observationsrader; den här varianten tar normalekvationerna direkt,
 * för anropare som redan har dem.
 */
function solveAugmented(matrix: number[][], width: number): number[] | null {
  for (let col = 0; col < width; col++) {
    let pivot = col;
    for (let row = col + 1; row < width; row++) {
      if (Math.abs(matrix[row][col]) > Math.abs(matrix[pivot][col])) pivot = row;
    }
    [matrix[col], matrix[pivot]] = [matrix[pivot], matrix[col]];

    if (Math.abs(matrix[col][col]) < 1e-12) return null;

    const divisor = matrix[col][col];
    for (let j = col; j <= width; j++) matrix[col][j] /= divisor;

    for (let row = 0; row < width; row++) {
      if (row === col) continue;
      const factor = matrix[row][col];
      for (let j = col; j <= width; j++) matrix[row][j] -= factor * matrix[col][j];
    }
  }

  return matrix.map((row) => row[width]);
}

/** Residualkvadratsumman för en anpassning. */
function residualSumOfSquares(
  rows: number[][],
  targets: number[],
  coefficients: number[],
): number {
  return rows.reduce((sum, row, i) => {
    const fitted = row.reduce((acc, value, j) => acc + value * coefficients[j], 0);
    return sum + (targets[i] - fitted) ** 2;
  }, 0);
}

// ---------------------------------------------------------------------------
// Polynom
// ---------------------------------------------------------------------------

export type PolynomialFit = {
  degree: number;
  predict: (x: number) => number;
  /**
   * De x-värden där kurvans lutning är `slope`. Används av Dmax-metoderna,
   * som letar efter punkten där laktatkurvan är lika brant som linjen mellan
   * testets ändpunkter.
   */
  slopeRoots: (slope: number) => number[];
  /** Modellens värden i de punkter den anpassades till. */
  fitted: number[];
};

/**
 * Polynomanpassning av valfri grad.
 *
 * x centreras och skalas före anpassningen. Normalekvationerna för [1, x, x²,
 * x³] med effekter runt 200 W har ett konditionstal i storleksordningen 10¹³,
 * vilket äter upp halva dubbelprecisionen. Med centrering blir samma
 * anpassning välkonditionerad, och eftersom skalningen är en linjär
 * omparametrisering är de anpassade värdena exakt desamma.
 */
export function polynomialFit(
  x: number[],
  y: number[],
  degree: number,
): PolynomialFit | null {
  if (x.length !== y.length || x.length <= degree) return null;

  const centre = x.reduce((a, b) => a + b, 0) / x.length;
  const spread = Math.max(...x.map((v) => Math.abs(v - centre)), 1e-9);
  const z = x.map((v) => (v - centre) / spread);

  const rows = z.map((v) =>
    Array.from({ length: degree + 1 }, (_, k) => v ** k),
  );
  const coefficients = solveLeastSquares(rows, y);
  if (!coefficients) return null;

  const evaluate = (value: number) => {
    const scaled = (value - centre) / spread;
    return coefficients.reduce((acc, c, k) => acc + c * scaled ** k, 0);
  };

  return {
    degree,
    predict: evaluate,
    fitted: x.map(evaluate),
    slopeRoots: (slope: number) => {
      // dP/dx = slope  ⟺  dP/dz = slope · spread, löst i z och skalat tillbaka.
      if (degree !== 3) return [];
      const target = slope * spread;
      const a = 3 * coefficients[3];
      const b = 2 * coefficients[2];
      const c = coefficients[1] - target;

      if (Math.abs(a) < 1e-15) {
        if (Math.abs(b) < 1e-15) return [];
        return [centre + spread * (-c / b)];
      }

      const discriminant = b * b - 4 * a * c;
      if (discriminant < 0) return [];
      const root = Math.sqrt(discriminant);
      return [(-b - root) / (2 * a), (-b + root) / (2 * a)].map(
        (zRoot) => centre + spread * zRoot,
      );
    },
  };
}

// ---------------------------------------------------------------------------
// Exponential
// ---------------------------------------------------------------------------

export type ExponentialFit = {
  a: number;
  b: number;
  c: number;
  predict: (x: number) => number;
  fitted: number[];
};

/**
 * Anpassar y = a + b·e^(c·x).
 *
 * Med c givet är a och b linjära, så bara c behöver sökas numerisk – resten
 * faller ut exakt. Det gör anpassningen mycket stabilare än en fri
 * tre-parameterssökning, som lätt fastnar i ett lokalt minimum (originalets
 * `nlsLM` gjorde det med sina startvärden a=0, b=1, c=0).
 */
export function exponentialFit(x: number[], y: number[]): ExponentialFit | null {
  if (x.length !== y.length || x.length < 3) return null;

  const span = Math.max(...x) - Math.min(...x);
  if (!(span > 0)) return null;

  const linearPart = (c: number) => {
    // Skalar exponenten kring x-medel så e^(c·x) inte spiller över.
    const rows = x.map((v) => [1, Math.exp(c * (v - x[0]))]);
    if (rows.some((row) => !Number.isFinite(row[1]))) return null;
    const coefficients = solveLeastSquares(rows, y);
    if (!coefficients) return null;
    return {
      a: coefficients[0],
      bScaled: coefficients[1],
      rss: residualSumOfSquares(rows, y, coefficients),
    };
  };

  // Grovsökning över c, sedan gyllene snittet kring bästa punkten.
  const lower = 0.1 / span;
  const upper = 20 / span;
  const steps = 200;

  let best: { c: number; rss: number } | null = null;
  for (let i = 0; i <= steps; i += 1) {
    const c = lower * (upper / lower) ** (i / steps);
    const fit = linearPart(c);
    if (fit && Number.isFinite(fit.rss) && (!best || fit.rss < best.rss)) {
      best = { c, rss: fit.rss };
    }
  }
  if (!best) return null;

  let low = best.c / 1.5;
  let high = best.c * 1.5;
  const phi = (Math.sqrt(5) - 1) / 2;
  for (let i = 0; i < 120; i += 1) {
    const m1 = high - phi * (high - low);
    const m2 = low + phi * (high - low);
    const r1 = linearPart(m1)?.rss ?? Infinity;
    const r2 = linearPart(m2)?.rss ?? Infinity;
    if (r1 < r2) high = m2;
    else low = m1;
  }

  const c = (low + high) / 2;
  const fit = linearPart(c);
  if (!fit) return null;

  // Tillbaka till b i originalskala: b·e^(c·x) = bScaled·e^(c·(x−x₀)).
  const b = fit.bScaled * Math.exp(-c * x[0]);
  const predict = (value: number) => fit.a + b * Math.exp(c * value);

  return { a: fit.a, b, c, predict, fitted: x.map(predict) };
}

// ---------------------------------------------------------------------------
// Naturlig kubisk spline
// ---------------------------------------------------------------------------

/** R:s förvalda kvantil (typ 7) på en sorterad vektor. */
export function quantileType7(sorted: number[], p: number): number {
  const h = (sorted.length - 1) * p;
  const lower = Math.floor(h);
  const upper = Math.min(lower + 1, sorted.length - 1);
  return sorted[lower] + (h - lower) * (sorted[upper] - sorted[lower]);
}

/**
 * Naturlig kubisk regressionsspline med 4 frihetsgrader – motsvarigheten till
 * `lm(y ~ splines::ns(x, 4))`.
 *
 * Basen här är den trunkerade potensbasen (Hastie, Tibshirani & Friedman,
 * ekv. 5.4–5.5) i stället för R:s QR-roterade B-splinebas. Baserna spänner
 * samma funktionsrum, så de anpassade värdena är identiska – kontrollerat mot
 * R till 9·10⁻¹⁶.
 */
export function naturalSplineFit(
  x: number[],
  y: number[],
): { predict: (value: number) => number } | null {
  if (x.length !== y.length || x.length < 5) return null;

  const sorted = [...x].sort((a, b) => a - b);
  const knots = [
    sorted[0],
    quantileType7(sorted, 0.25),
    quantileType7(sorted, 0.5),
    quantileType7(sorted, 0.75),
    sorted[sorted.length - 1],
  ];

  const last = knots.length - 1;
  const centre = (knots[0] + knots[last]) / 2;
  const spread = Math.max((knots[last] - knots[0]) / 2, 1e-9);
  const scale = (value: number) => (value - centre) / spread;
  const scaledKnots = knots.map(scale);

  const cube = (value: number) => (value > 0 ? value ** 3 : 0);
  const d = (value: number, k: number) =>
    (cube(value - scaledKnots[k]) - cube(value - scaledKnots[last])) /
    (scaledKnots[last] - scaledKnots[k]);

  const basis = (value: number) => {
    const z = scale(value);
    const row = [1, z];
    for (let k = 0; k <= last - 2; k += 1) row.push(d(z, k) - d(z, last - 1));
    return row;
  };

  const coefficients = solveLeastSquares(x.map(basis), y);
  if (!coefficients) return null;

  return {
    predict: (value: number) =>
      basis(value).reduce((acc, term, i) => acc + term * coefficients[i], 0),
  };
}

// ---------------------------------------------------------------------------
// Linjär anpassning och interpolation
// ---------------------------------------------------------------------------

export function linearFit(
  x: number[],
  y: number[],
): { slope: number; intercept: number } | null {
  const n = x.length;
  if (n < 2 || n !== y.length) return null;

  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  const sxx = x.reduce((sum, v) => sum + (v - meanX) ** 2, 0);
  if (!(sxx > 0)) return null;
  const sxy = x.reduce((sum, v, i) => sum + (v - meanX) * (y[i] - meanY), 0);

  const slope = sxy / sxx;
  return { slope, intercept: meanY - slope * meanX };
}

/**
 * Linjär interpolation, motsvarande R:s `approx`. `x` måste vara sorterad.
 * Returnerar null utanför datans spann i stället för att extrapolera.
 */
export function approxLinear(
  x: number[],
  y: number[],
  xout: number,
): number | null {
  const n = x.length;
  if (n === 0 || n !== y.length) return null;
  if (xout < x[0] || xout > x[n - 1]) return null;

  for (let i = 0; i < n - 1; i += 1) {
    if (xout >= x[i] && xout <= x[i + 1]) {
      const span = x[i + 1] - x[i];
      if (span === 0) return y[i];
      return y[i] + ((xout - x[i]) / span) * (y[i + 1] - y[i]);
    }
  }
  return y[n - 1];
}

/**
 * Samma sak, men med x sorterad efter *y*: hittar det x som hör till ett givet
 * y-värde. Går kurvan upp och ner väljs den högsta lösningen, som i originalet.
 */
export function inverseApprox(
  values: number[],
  positions: number[],
  target: number,
): number | null {
  let result: number | null = null;

  for (let i = 0; i < values.length - 1; i += 1) {
    const a = values[i];
    const b = values[i + 1];
    if ((target >= a && target <= b) || (target <= a && target >= b)) {
      const span = b - a;
      const t = span === 0 ? 0 : (target - a) / span;
      const candidate = positions[i] + t * (positions[i + 1] - positions[i]);
      if (result === null || candidate > result) result = candidate;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Brytpunkter
// ---------------------------------------------------------------------------

/**
 * Styckvis linjär regression med ett eller två knän.
 *
 * Originalet använder `segmented::segmented`, som söker brytpunkten iterativt
 * från ett startvärde (Muggeo 2003). Här görs i stället en uttömmande sökning,
 * grov först och sedan förfinad: långsammare, men kan inte fastna i ett lokalt
 * minimum och behöver inget startvärde. På paketets egen demodata skiljer sig
 * svaren med 0,2–0,3 W.
 */
export function segmentedBreakpoints(
  x: number[],
  y: number[],
  count: 1 | 2,
): number[] | null {
  const n = x.length;
  if (n < 6) return null;

  const min = x[0];
  const max = x[n - 1];
  const range = max - min;
  if (!(range > 0)) return null;

  const margin = range * 0.02;

  // Prefixsummor. En rak sökning skulle bygga om normalekvationerna över alla
  // punkter för varje kandidatpar – på ett rutnät med 1 700 punkter tog det
  // knappt tre sekunder. Eftersom (x−p)⁺ är x−p ovanför p och noll under kan
  // varje summa i stället läsas ur prefixsummor, och en kandidat kostar O(1).
  const prefixCount = new Float64Array(n + 1);
  const prefixX = new Float64Array(n + 1);
  const prefixXX = new Float64Array(n + 1);
  const prefixY = new Float64Array(n + 1);
  const prefixXY = new Float64Array(n + 1);
  let sumYY = 0;

  for (let i = 0; i < n; i += 1) {
    prefixCount[i + 1] = i + 1;
    prefixX[i + 1] = prefixX[i] + x[i];
    prefixXX[i + 1] = prefixXX[i] + x[i] * x[i];
    prefixY[i + 1] = prefixY[i] + y[i];
    prefixXY[i + 1] = prefixXY[i] + x[i] * y[i];
    sumYY += y[i] * y[i];
  }

  /** Index för första punkten strikt ovanför `p` (rutnätet är sorterat). */
  const indexAbove = (p: number): number => {
    let low = 0;
    let high = n;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (x[mid] > p) high = mid;
      else low = mid + 1;
    }
    return low;
  };

  /** Summor över punkterna ovanför `p`. */
  const above = (p: number) => {
    const k = indexAbove(p);
    return {
      count: n - k,
      x: prefixX[n] - prefixX[k],
      xx: prefixXX[n] - prefixXX[k],
      y: prefixY[n] - prefixY[k],
      xy: prefixXY[n] - prefixXY[k],
    };
  };

  /** RSS för en styckvis linjär modell med de givna knäna. */
  const rss = (breaks: number[]): number => {
    const width = 2 + breaks.length;
    const hinges = breaks.map(above);

    // Xᵀ X och Xᵀ y, byggda ur prefixsummorna.
    const xtx: number[][] = Array.from({ length: width }, () =>
      new Array<number>(width).fill(0),
    );
    const xty = new Array<number>(width).fill(0);

    xtx[0][0] = n;
    xtx[0][1] = prefixX[n];
    xtx[1][1] = prefixXX[n];
    xty[0] = prefixY[n];
    xty[1] = prefixXY[n];

    breaks.forEach((p, i) => {
      const h = hinges[i];
      const col = 2 + i;
      xtx[0][col] = h.x - p * h.count;
      xtx[1][col] = h.xx - p * h.x;
      xtx[col][col] = h.xx - 2 * p * h.x + p * p * h.count;
      xty[col] = h.xy - p * h.y;
    });

    // Korstermen mellan två knän lever bara ovanför det högre av dem.
    if (breaks.length === 2) {
      const [p1, p2] = breaks;
      const outer = hinges[p2 >= p1 ? 1 : 0];
      xtx[2][3] =
        outer.xx - (p1 + p2) * outer.x + p1 * p2 * outer.count;
    }

    for (let i = 0; i < width; i += 1) {
      for (let j = 0; j < i; j += 1) xtx[i][j] = xtx[j][i];
    }

    const augmented = xtx.map((row, i) => [...row, xty[i]]);
    const coefficients = solveAugmented(augmented, width);
    if (!coefficients) return Infinity;

    // Vid minsta kvadrat är RSS = Σy² − βᵀXᵀy.
    const value =
      sumYY - coefficients.reduce((sum, b, i) => sum + b * xty[i], 0);
    return value >= 0 ? value : Infinity;
  };

  if (count === 1) {
    let best: { at: number; rss: number } | null = null;
    let low = min + margin;
    let high = max - margin;

    // Tre pass: varje gång en tiondel så brett spann kring bästa punkten.
    for (let pass = 0; pass < 3; pass += 1) {
      const steps = 200;
      for (let i = 0; i <= steps; i += 1) {
        const at = low + ((high - low) * i) / steps;
        const value = rss([at]);
        if (!best || value < best.rss) best = { at, rss: value };
      }
      if (!best) return null;
      const width = (high - low) / 10;
      low = Math.max(min + margin, best.at - width);
      high = Math.min(max - margin, best.at + width);
    }

    return best ? [best.at] : null;
  }

  let best: { at: [number, number]; rss: number } | null = null;
  let lowFirst = min + margin;
  let highFirst = max - margin;
  let lowSecond = min + margin;
  let highSecond = max - margin;

  for (let pass = 0; pass < 3; pass += 1) {
    const steps = pass === 0 ? 70 : 40;
    for (let i = 0; i <= steps; i += 1) {
      const first = lowFirst + ((highFirst - lowFirst) * i) / steps;
      for (let j = 0; j <= steps; j += 1) {
        const second = lowSecond + ((highSecond - lowSecond) * j) / steps;
        if (second - first < margin) continue;
        const value = rss([first, second]);
        if (!best || value < best.rss) best = { at: [first, second], rss: value };
      }
    }
    if (!best) return null;
    const widthFirst = (highFirst - lowFirst) / 8;
    const widthSecond = (highSecond - lowSecond) / 8;
    lowFirst = Math.max(min + margin, best.at[0] - widthFirst);
    highFirst = Math.min(max - margin, best.at[0] + widthFirst);
    lowSecond = Math.max(min + margin, best.at[1] - widthSecond);
    highSecond = Math.min(max - margin, best.at[1] + widthSecond);
  }

  return best ? [...best.at] : null;
}
