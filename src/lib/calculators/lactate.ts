/**
 * Laktattrösklar från ett stegtest.
 *
 * Portad från R-paketet `lactater` av Felipe Mattioni Maturana
 * (https://github.com/fmmattioni/lactater), MIT-licensierat,
 * © 2020 Felipe Mattioni Maturana. Metoderna och deras referenser:
 *
 *   Log-log     Beaver, Wasserman & Whipp (1985)
 *   OBLA        Heck m.fl. (1985), Kindermann m.fl. (1979)
 *   Bsln+       Berg m.fl. (1990), Zoladz m.fl. (1995)
 *   Dmax        Cheng m.fl. (1992)
 *   ModDmax     Bishop, Jenkins & Mackinnon (1998)
 *   LTP         Hofmann & Tschakert (2017), Pokan m.fl. (1997)
 *   LTratio     Dickhuth m.fl., via Berg m.fl. (1990)
 *
 * Talen är kontrollerade mot paketets publicerade resultat på dess egen
 * demodata – se `scripts/` i utvecklingsanteckningarna.
 */

import {
  approxLinear,
  exponentialFit,
  inverseApprox,
  linearFit,
  naturalSplineFit,
  polynomialFit,
  segmentedBreakpoints,
} from "./regression";

export type LactateStep = {
  /** Belastning: watt, m/s eller m/s beroende på gren. */
  intensity: number;
  /** Laktat i mmol/l. */
  lactate: number;
  /** Puls i slag/min, om den mätts. */
  heartRate: number | null;
};

export type Sport = "cykling" | "löpning" | "simning";

export type FitName =
  | "3:e gradens polynom"
  | "4:e gradens polynom"
  | "Naturlig spline"
  | "Exponentiell";

export type MethodCategory =
  | "Log-log"
  | "OBLA"
  | "Bsln+"
  | "Dmax"
  | "LTP"
  | "LTratio";

export const METHOD_CATEGORIES: {
  id: MethodCategory;
  label: string;
  description: string;
}[] = [
  {
    id: "Log-log",
    label: "Log-log",
    description:
      "Brytpunkten i log-log-transformerad laktatkurva. Ger ett tidigt tröskelvärde, nära LT1.",
  },
  {
    id: "OBLA",
    label: "OBLA",
    description:
      "Belastningen vid fasta laktatnivåer: 2,0 / 2,5 / 3,0 / 3,5 / 4,0 mmol/l. OBLA 4,0 är den klassiska tröskeln.",
  },
  {
    id: "Bsln+",
    label: "Bsln+",
    description:
      "Baslinjen plus 0,5 / 1,0 / 1,5 mmol/l. Tar hänsyn till att vilolaktatet varierar mellan atleter.",
  },
  {
    id: "Dmax",
    label: "Dmax",
    description:
      "Punkten där kurvan böjer av mest från linjen mellan testets ändpunkter. Fem varianter.",
  },
  {
    id: "LTP",
    label: "LTP",
    description:
      "Två brytpunkter i laktatkurvan: LTP1 ≈ aerob tröskel, LTP2 ≈ anaerob tröskel.",
  },
  {
    id: "LTratio",
    label: "LTratio",
    description:
      "Lägsta kvoten laktat / belastning. Ett tidigt tröskelvärde som inte kräver någon fast laktatnivå.",
  },
];

export type ThresholdResult = {
  category: MethodCategory;
  method: string;
  fitting: string;
  /** null när metoden inte går att tillämpa på den här datan. */
  intensity: number | null;
  lactate: number | null;
  heartRate: number | null;
  /** Sekunder per 100 m – bara för simning. */
  pace: number | null;
  note?: string;
};

export type LactateAnalysis = {
  results: ThresholdResult[];
  /** Den anpassade kurvan, för diagrammet. */
  curve: { intensity: number; lactate: number }[];
  /** Stegen efter baslinjejusteringen, för diagrammet. */
  steps: LactateStep[];
  warnings: string[];
};

/** Decimaler i redovisad belastning, efter gren. */
const INTENSITY_DIGITS: Record<Sport, number> = {
  cykling: 1,
  löpning: 2,
  simning: 3,
};

/** Upplösning i den interpolerade kurvan, efter gren. */
const INTERPOLATION_STEP: Record<Sport, number> = {
  cykling: 0.1,
  löpning: 0.1,
  simning: 0.01,
};

const round = (value: number, digits: number) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

/** m/s till sekunder per 100 m. */
export function speedToPace(speed: number): number | null {
  if (!(speed > 0)) return null;
  return round(100 / speed, 1);
}

type Fitted = {
  predict: (x: number) => number;
  fittedAtSteps: number[];
  label: string;
};

function buildFit(
  x: number[],
  y: number[],
  fit: FitName,
): Fitted | null {
  if (fit === "Naturlig spline") {
    const spline = naturalSplineFit(x, y);
    if (!spline) return null;
    return {
      predict: spline.predict,
      fittedAtSteps: x.map(spline.predict),
      label: fit,
    };
  }

  if (fit === "Exponentiell") {
    const exp = exponentialFit(x, y);
    if (!exp) return null;
    return { predict: exp.predict, fittedAtSteps: exp.fitted, label: fit };
  }

  const degree = fit === "4:e gradens polynom" ? 4 : 3;
  const poly = polynomialFit(x, y, degree);
  if (!poly) return null;
  return { predict: poly.predict, fittedAtSteps: poly.fitted, label: fit };
}

export type AnalysisInput = {
  steps: LactateStep[];
  sport: Sport;
  fit: FitName;
  /** Ta med vilovärdet i kurvanpassningen. */
  includeBaseline: boolean;
  methods: MethodCategory[];
  /**
   * Andel av datan som log-log-metoden får använda, 0–1. Lägre värde tvingar
   * brytpunkten tidigare i testet.
   */
  loglogRestrainer: number;
};

export function analyseLactateTest(input: AnalysisInput): LactateAnalysis | null {
  const { sport, fit, includeBaseline, methods, loglogRestrainer } = input;
  const digits = INTENSITY_DIGITS[sport];
  const stepSize = INTERPOLATION_STEP[sport];
  const warnings: string[] = [];

  const clean = input.steps
    .filter(
      (s) =>
        Number.isFinite(s.intensity) &&
        Number.isFinite(s.lactate) &&
        s.intensity >= 0 &&
        s.lactate > 0,
    )
    .sort((a, b) => a.intensity - b.intensity);

  if (clean.length < 4) return null;

  // Vilovärdet ligger på belastning 0 och skulle dra kurvan kraftigt åt vänster.
  // Originalet flyttar det i stället till ett tänkt steg före steg 1, med samma
  // avstånd som mellan de två första stegen.
  const steps = clean.map((s) => ({ ...s }));
  if (steps[0].intensity === 0 && steps.length >= 3) {
    steps[0].intensity = steps[1].intensity - (steps[2].intensity - steps[1].intensity);
  }

  const hasBaselineRow = clean[0].intensity === 0;
  const modelling = includeBaseline || !hasBaselineRow ? steps : steps.slice(1);
  if (modelling.length < 4) return null;

  const mx = modelling.map((s) => s.intensity);
  const my = modelling.map((s) => s.lactate);

  const fitted = buildFit(mx, my, fit);
  if (!fitted) return null;

  const min = Math.min(...mx);
  const max = Math.max(...mx);

  const grid: number[] = [];
  for (let v = min; v <= max + stepSize / 2; v += stepSize) {
    grid.push(round(v, 6));
  }

  const curve = grid.map((intensity) => ({
    intensity,
    lactate: fitted.predict(intensity),
  }));

  // Rå, linjärt interpolerad kurva – det är den brytpunktsmetoderna arbetar på.
  const interpolated = grid.map((v) => approxLinear(mx, my, v) ?? 0);

  // Puls modelleras linjärt mot belastning, alltid utan vilovärdet.
  const hrSteps = steps.slice(hasBaselineRow ? 1 : 0);
  const hrPairs = hrSteps.filter(
    (s) => s.heartRate !== null && Number.isFinite(s.heartRate),
  );
  const hrModel =
    hrPairs.length >= 2
      ? linearFit(
          hrPairs.map((s) => s.intensity),
          hrPairs.map((s) => s.heartRate as number),
        )
      : null;

  const heartRateAt = (intensity: number | null): number | null => {
    if (intensity === null || !hrModel) return null;
    return Math.round(hrModel.intercept + hrModel.slope * intensity);
  };

  const make = (
    category: MethodCategory,
    method: string,
    fitting: string,
    intensity: number | null,
    lactate: number | null,
    note?: string,
  ): ThresholdResult => ({
    category,
    method,
    fitting,
    intensity: intensity === null ? null : round(intensity, digits),
    lactate: lactate === null ? null : round(lactate, 1),
    heartRate: heartRateAt(intensity),
    pace: sport === "simning" && intensity !== null ? speedToPace(intensity) : null,
    note,
  });

  const userFit = `${fitted.label} (vald)`;
  const results: ThresholdResult[] = [];

  // --- Log-log -------------------------------------------------------------
  // Brytpunkten bygger bara på den interpolerade datan, så den är oberoende av
  // vilken kurva användaren valt. Laktatvärdet läses däremot ur den valda.
  let loglogIntensity: number | null = null;
  let loglogLactate: number | null = null;

  {
    const usable = grid
      .map((v, i) => ({ v, lac: interpolated[i] }))
      .filter((p) => p.v > 0 && p.lac > 0);
    const kept = usable.slice(
      0,
      Math.max(6, Math.round(Math.min(Math.max(loglogRestrainer, 0.1), 1) * usable.length)),
    );

    if (kept.length >= 6) {
      const breaks = segmentedBreakpoints(
        kept.map((p) => Math.log(p.v)),
        kept.map((p) => Math.log(p.lac)),
        1,
      );
      if (breaks) {
        loglogIntensity = round(Math.exp(breaks[0]), digits);
        loglogLactate = round(fitted.predict(loglogIntensity), 1);
      }
    }
  }

  if (methods.includes("Log-log")) {
    results.push(
      make("Log-log", "Log-log", userFit, loglogIntensity, loglogLactate),
    );
  }

  // --- OBLA och Bsln+ ------------------------------------------------------
  // Belastningen läses ur modellens värden i testpunkterna, som i originalet.
  const lowest = Math.min(...fitted.fittedAtSteps);
  const highest = Math.max(...fitted.fittedAtSteps);

  const intensityAtLactate = (target: number): number | null => {
    if (target > highest || target < lowest) return null;
    if (fit === "Naturlig spline") {
      // Splinen kan svänga; sök på det täta rutnätet och ta det högsta svaret.
      return inverseApprox(
        curve.map((p) => p.lactate),
        curve.map((p) => p.intensity),
        target,
      );
    }
    return inverseApprox(fitted.fittedAtSteps, mx, target);
  };

  if (methods.includes("OBLA")) {
    for (const level of [2, 2.5, 3, 3.5, 4]) {
      const at = intensityAtLactate(level);
      results.push(
        make(
          "OBLA",
          `OBLA ${level.toFixed(1).replace(".", ",")}`,
          userFit,
          at,
          level,
          at === null ? "Laktatnivån nås inte i testet." : undefined,
        ),
      );
    }
  }

  if (methods.includes("Bsln+")) {
    const baseline = steps[0].lactate;
    for (const plus of [0.5, 1, 1.5]) {
      const target = baseline + plus;
      const at = intensityAtLactate(target);
      results.push(
        make(
          "Bsln+",
          `Bsln + ${plus.toFixed(1).replace(".", ",")}`,
          userFit,
          at,
          target,
          at === null ? "Laktatnivån nås inte i testet." : undefined,
        ),
      );
    }
  }

  // --- Dmax-familjen -------------------------------------------------------
  // Alla fem har fasta kurvor i originalet och anpassas utan vilovärdet.
  if (methods.includes("Dmax")) {
    const withoutBaseline = hasBaselineRow ? steps.slice(1) : steps;
    const dx = withoutBaseline.map((s) => s.intensity);
    const dy = withoutBaseline.map((s) => s.lactate);
    const poly = polynomialFit(dx, dy, 3);
    const exp = exponentialFit(dx, dy);

    const maxIntensity = Math.max(...dx);
    const lastLactate = dy[dy.length - 1];

    /** Punkten där polynomets lutning möter linjens. */
    const polyDmax = (slope: number): { at: number; lactate: number } | null => {
      if (!poly) return null;
      const roots = poly
        .slopeRoots(slope)
        .filter((r) => r > 0 && r <= maxIntensity);
      if (roots.length === 0) return null;

      let at = Math.max(...roots);
      let lactate = round(poly.predict(at), 1);
      // Originalets skydd mot orimliga rötter: hamnar svaret över 8 mmol/l är
      // det nästan alltid den övre roten som fångat kurvans slut i stället.
      if (lactate > 8) {
        at = Math.min(...roots);
        lactate = round(poly.predict(at), 1);
      }
      return { at, lactate };
    };

    /**
     * Exponentialvarianten har en sluten lösning: punkten där kurvans lutning
     * är lika med dess egen sekant mellan si och sf beror bara på exponenten.
     */
    const expDmax = (si: number, sf: number): { at: number; lactate: number } | null => {
      if (!exp || !(exp.c > 0)) return null;
      const numerator = Math.exp(exp.c * sf) - Math.exp(exp.c * si);
      const denominator = exp.c * sf - exp.c * si;
      if (!(numerator > 0) || !(denominator > 0)) return null;
      const at = Math.log(numerator / denominator) / exp.c;
      if (!Number.isFinite(at)) return null;
      return { at, lactate: round(exp.predict(at), 1) };
    };

    const dmax = polyDmax(
      (Math.max(...dy) - Math.min(...dy)) / (maxIntensity - Math.min(...dx)),
    );
    results.push(
      make("Dmax", "Dmax", "3:e gradens polynom", dmax?.at ?? null, dmax?.lactate ?? null),
    );

    // ModDmax: linjen börjar vid första steget som följs av en ökning ≥ 0,4.
    const riseIndex = dy.findIndex(
      (value, i) => i < dy.length - 1 && dy[i + 1] - value >= 0.4,
    );
    if (riseIndex === -1) {
      results.push(
        make("Dmax", "ModDmax", "3:e gradens polynom", null, null,
          "Ingen stegökning på 0,4 mmol/l eller mer i testet."),
      );
    } else {
      const mod = polyDmax(
        (Math.max(...dy) - dy[riseIndex]) / (maxIntensity - dx[riseIndex]),
      );
      results.push(
        make("Dmax", "ModDmax", "3:e gradens polynom", mod?.at ?? null, mod?.lactate ?? null),
      );
    }

    const expResult = expDmax(dx[0], maxIntensity);
    results.push(
      make("Dmax", "Exp-Dmax", "Exponentiell", expResult?.at ?? null, expResult?.lactate ?? null),
    );

    if (loglogIntensity !== null && loglogLactate !== null) {
      const slope =
        (lastLactate - loglogLactate) / (maxIntensity - loglogIntensity);
      const logPoly = polyDmax(slope);
      results.push(
        make("Dmax", "Log-Poly-ModDmax", "3:e gradens polynom",
          logPoly?.at ?? null, logPoly?.lactate ?? null),
      );

      const logExp = expDmax(loglogIntensity, maxIntensity);
      results.push(
        make("Dmax", "Log-Exp-ModDmax", "Exponentiell",
          logExp?.at ?? null, logExp?.lactate ?? null),
      );
    } else {
      for (const name of ["Log-Poly-ModDmax", "Log-Exp-ModDmax"]) {
        results.push(
          make("Dmax", name, "–", null, null, "Kräver att Log-log går att beräkna."),
        );
      }
    }
  }

  // --- LTP -----------------------------------------------------------------
  if (methods.includes("LTP")) {
    const breaks = segmentedBreakpoints(grid, interpolated, 2);
    if (breaks) {
      breaks.forEach((at, i) => {
        results.push(
          make("LTP", `LTP${i + 1}`, userFit, at, fitted.predict(at)),
        );
      });
    } else {
      results.push(
        make("LTP", "LTP1", userFit, null, null, "Två brytpunkter kunde inte hittas."),
        make("LTP", "LTP2", userFit, null, null, "Två brytpunkter kunde inte hittas."),
      );
    }
  }

  // --- LTratio -------------------------------------------------------------
  if (methods.includes("LTratio")) {
    const spline = naturalSplineFit(mx, my);
    if (spline) {
      let best: { at: number; lactate: number; ratio: number } | null = null;
      for (const intensity of grid) {
        if (intensity <= 0) continue;
        const lactate = spline.predict(intensity);
        const ratio = lactate / intensity;
        if (!best || ratio < best.ratio) best = { at: intensity, lactate, ratio };
      }
      results.push(
        make("LTratio", "LTratio", "Naturlig spline (fast)",
          best?.at ?? null, best?.lactate ?? null),
      );
    } else {
      results.push(
        make("LTratio", "LTratio", "Naturlig spline (fast)", null, null,
          "För få steg för en spline."),
      );
    }
  }

  if (!hrModel) {
    warnings.push("Ingen puls angiven – pulskolumnen lämnas tom.");
  }
  if (!hasBaselineRow && methods.includes("Bsln+")) {
    warnings.push(
      "Inget vilovärde på belastning 0 – Bsln+ utgår från det lägsta steget i stället.",
    );
  }

  return { results, curve, steps, warnings };
}

/**
 * Sammanfattar analysen till två trösklar. LT1 tas från de metoder som brukar
 * hamna vid den första stigningen, LT2 från de som markerar den andra.
 *
 * Medianen används i stället för medelvärdet: metoderna spretar, och ett enda
 * utfall som inte gick att beräkna eller landade långt bort ska inte flytta
 * hela svaret.
 */
export function summariseThresholds(results: ThresholdResult[]): {
  lt1: number | null;
  lt2: number | null;
  lt1Methods: string[];
  lt2Methods: string[];
} {
  const LT1 = ["Log-log", "LTP1", "LTratio", "Bsln + 0,5"];
  const LT2 = ["OBLA 4,0", "Dmax", "ModDmax", "LTP2"];

  const pick = (names: string[]) =>
    results.filter((r) => names.includes(r.method) && r.intensity !== null);

  const median = (rows: ThresholdResult[]): number | null => {
    if (rows.length === 0) return null;
    const values = rows.map((r) => r.intensity as number).sort((a, b) => a - b);
    const middle = Math.floor(values.length / 2);
    return values.length % 2 === 1
      ? values[middle]
      : (values[middle - 1] + values[middle]) / 2;
  };

  const first = pick(LT1);
  const second = pick(LT2);

  return {
    lt1: median(first),
    lt2: median(second),
    lt1Methods: first.map((r) => r.method),
    lt2Methods: second.map((r) => r.method),
  };
}
