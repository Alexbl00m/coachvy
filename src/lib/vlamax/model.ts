import type { VlamaxSample } from "@/lib/types/database";

/**
 * VLamax-prediktion, portad från `vlamax_calc_app` (scikit-learn
 * LinearRegression i Python).
 *
 * Modellen är en vanlig minsta-kvadratanpassning på fem variabler:
 * fettfri massa, sprintlängd, snitteffekt, toppeffekt och kön. Den tränas om
 * varje gång referensdatan ändras — datamängden är liten nog att det kostar
 * mikrosekunder, och då slipper vi en modellfil som kan hamna ur synk.
 */

export type VlamaxInput = {
  sex: "man" | "kvinna";
  weightKg: number;
  bodyFatPct: number;
  sprintSeconds: number;
  wattAvg: number;
  wattPeak: number;
};

export type VlamaxPrediction = {
  value: number;
  /** Typiskt fel på en atlet modellen inte sett, från korsvalidering. */
  rmse: number;
  /** Antal referensrader modellen tränats på. */
  sampleCount: number;
  /** Variabler där indata ligger utanför referensdatans spann. */
  outOfRange: OutOfRange[];
};

export type OutOfRange = {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
};

/** Fettfri massa — den enda härledda variabeln i modellen. */
export function fatFreeMass(weightKg: number, bodyFatPct: number): number {
  return weightKg * (1 - bodyFatPct / 100);
}

/** [intercept, FFM, sprintlängd, snitteffekt, toppeffekt, kön] */
function designRow(input: VlamaxInput): number[] {
  return [
    1,
    fatFreeMass(input.weightKg, input.bodyFatPct),
    input.sprintSeconds,
    input.wattAvg,
    input.wattPeak,
    input.sex === "kvinna" ? 1 : 0,
  ];
}

function sampleToInput(sample: VlamaxSample): VlamaxInput {
  return {
    sex: sample.sex,
    weightKg: Number(sample.weight_kg),
    bodyFatPct: Number(sample.body_fat_pct),
    sprintSeconds: Number(sample.sprint_seconds),
    wattAvg: Number(sample.watt_avg),
    wattPeak: Number(sample.watt_peak),
  };
}

/**
 * Löser normalekvationerna med Gauss-Jordan-elimination. Returnerar null när
 * systemet är singulärt, vilket händer så fort det finns färre rader än
 * variabler — då finns ingen entydig anpassning.
 */
function solveLeastSquares(rows: number[][], targets: number[]): number[] | null {
  const width = rows[0]?.length ?? 0;
  if (rows.length < width) return null;

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

function fit(samples: VlamaxSample[]): number[] | null {
  if (samples.length === 0) return null;
  return solveLeastSquares(
    samples.map((s) => designRow(sampleToInput(s))),
    samples.map((s) => Number(s.vlamax)),
  );
}

function applyModel(coefficients: number[], input: VlamaxInput): number {
  return designRow(input).reduce((sum, x, i) => sum + x * coefficients[i], 0);
}

/**
 * Leave-one-out: träna om utan varje rad och mät felet på just den raden. Det
 * är det ärligaste felmåttet en så här liten datamängd tillåter — felet på
 * egen träningsdata skulle se mycket bättre ut än verkligheten.
 */
function crossValidatedRmse(samples: VlamaxSample[]): number | null {
  if (samples.length < 8) return null;

  let sumSquared = 0;
  let counted = 0;

  for (let i = 0; i < samples.length; i++) {
    const coefficients = fit(samples.filter((_, j) => j !== i));
    if (!coefficients) continue;
    const error =
      applyModel(coefficients, sampleToInput(samples[i])) - Number(samples[i].vlamax);
    sumSquared += error * error;
    counted += 1;
  }

  return counted > 0 ? Math.sqrt(sumSquared / counted) : null;
}

const GUARDED: {
  label: string;
  unit: string;
  of: (input: VlamaxInput) => number;
  from: (sample: VlamaxSample) => number;
}[] = [
  {
    label: "Fettfri massa",
    unit: "kg",
    of: (i) => fatFreeMass(i.weightKg, i.bodyFatPct),
    from: (s) => fatFreeMass(Number(s.weight_kg), Number(s.body_fat_pct)),
  },
  {
    label: "Sprintlängd",
    unit: "s",
    of: (i) => i.sprintSeconds,
    from: (s) => Number(s.sprint_seconds),
  },
  {
    label: "Snitteffekt",
    unit: "W",
    of: (i) => i.wattAvg,
    from: (s) => Number(s.watt_avg),
  },
  {
    label: "Toppeffekt",
    unit: "W",
    of: (i) => i.wattPeak,
    from: (s) => Number(s.watt_peak),
  },
];

/**
 * En linjär modell extrapolerar villigt och tyst. Utanför referensdatans spann
 * är siffran inte längre en interpolation mellan uppmätta atleter, och det ska
 * synas i gränssnittet.
 */
function rangeWarnings(
  samples: VlamaxSample[],
  input: VlamaxInput,
): OutOfRange[] {
  const warnings: OutOfRange[] = [];

  for (const guard of GUARDED) {
    const observed = samples.map(guard.from);
    const min = Math.min(...observed);
    const max = Math.max(...observed);
    const value = guard.of(input);

    if (value < min || value > max) {
      warnings.push({ label: guard.label, value, min, max, unit: guard.unit });
    }
  }

  return warnings;
}

export function predictVlamax(
  samples: VlamaxSample[],
  input: VlamaxInput,
): VlamaxPrediction | null {
  const coefficients = fit(samples);
  if (!coefficients) return null;

  const value = applyModel(coefficients, input);
  if (!Number.isFinite(value)) return null;

  return {
    value,
    rmse: crossValidatedRmse(samples) ?? 0,
    sampleCount: samples.length,
    outOfRange: rangeWarnings(samples, input),
  };
}

/** Hur många kvinnor referensdatan innehåller — se kommentaren i UI:t. */
export function countBySex(samples: VlamaxSample[]) {
  return {
    man: samples.filter((s) => s.sex === "man").length,
    kvinna: samples.filter((s) => s.sex === "kvinna").length,
  };
}
