/**
 * Loppprognos ur ett eller flera tidigare lopp.
 *
 * Portad från runner-performance-calculator. Modellen är Riegels potenslag:
 *
 *   T₂ = T₁ · (D₂ / D₁)^b
 *
 * där b är utmattningsexponenten. Riegel (1977) satte b = 1,06 ur ett stort
 * material, och det är förvalet när bara ett lopp finns.
 *
 * Med två eller fler lopp går exponenten att skatta ur atletens egna
 * resultat: log T = log a + b · log D är en rät linje, så en
 * minstakvadratanpassning i log-log-rummet ger b direkt. Det är en
 * individanpassad Riegel och nästan alltid bättre än 1,06.
 *
 * Originalet kallar den varianten "Cameron's formula". Det är fel namn –
 * Camerons formel är en helt annan ekvation – så den heter individuell
 * exponent här.
 */

import { linearFit } from "./regression";

export type RaceResult = {
  /** Distans i meter. */
  metres: number;
  /** Tid i sekunder. */
  seconds: number;
};

export type PredictionModel = {
  /** Utmattningsexponenten. */
  exponent: number;
  /** true när exponenten skattats ur atletens egna lopp. */
  individual: boolean;
  /** Hur väl linjen passar, 0–1. null vid färre än tre lopp. */
  rSquared: number | null;
  resultCount: number;
  predict: (metres: number) => number;
  warnings: string[];
};

/** Riegels förval, ur ett material på tiotusentals lopp. */
export const RIEGEL_EXPONENT = 1.06;

export const STANDARD_DISTANCES: { label: string; metres: number }[] = [
  { label: "800 m", metres: 800 },
  { label: "1 500 m", metres: 1500 },
  { label: "Engelsk mil", metres: 1609.34 },
  { label: "3 000 m", metres: 3000 },
  { label: "5 km", metres: 5000 },
  { label: "10 km", metres: 10000 },
  { label: "Halvmaraton", metres: 21097.5 },
  { label: "Maraton", metres: 42195 },
];

/**
 * Bygger prognosmodellen ur de lopp som finns.
 *
 * Ett lopp ger Riegels exponent; två eller fler ger atletens egen.
 */
export function buildPredictionModel(
  results: RaceResult[],
  fallbackExponent = RIEGEL_EXPONENT,
): PredictionModel | null {
  const valid = results
    .filter((r) => r.metres > 0 && r.seconds > 0)
    .sort((a, b) => a.metres - b.metres);

  if (valid.length === 0) return null;

  const warnings: string[] = [];

  // Ett enda lopp: skala med den givna exponenten.
  const distinct = new Set(valid.map((r) => Math.round(r.metres))).size;
  if (valid.length < 2 || distinct < 2) {
    const base = valid[0];
    if (valid.length >= 2 && distinct < 2) {
      warnings.push(
        "Loppen är på samma distans, så någon egen exponent går inte att räkna fram. Riegels förval används.",
      );
    }
    return {
      exponent: fallbackExponent,
      individual: false,
      rSquared: null,
      resultCount: valid.length,
      warnings,
      predict: (metres: number) =>
        base.seconds * (metres / base.metres) ** fallbackExponent,
    };
  }

  // Två eller fler: anpassa log T = log a + b · log D.
  const logD = valid.map((r) => Math.log(r.metres));
  const logT = valid.map((r) => Math.log(r.seconds));
  const fit = linearFit(logD, logT);
  if (!fit || !(fit.slope > 0)) {
    const base = valid[0];
    warnings.push(
      "Loppen ger ingen giltig kurva – kontrollera att den längre distansen har ett långsammare tempo. Riegels förval används.",
    );
    return {
      exponent: fallbackExponent,
      individual: false,
      rSquared: null,
      resultCount: valid.length,
      warnings,
      predict: (metres: number) =>
        base.seconds * (metres / base.metres) ** fallbackExponent,
    };
  }

  let rSquared: number | null = null;
  if (valid.length > 2) {
    const mean = logT.reduce((a, b) => a + b, 0) / logT.length;
    const ssTot = logT.reduce((s, v) => s + (v - mean) ** 2, 0);
    const ssRes = logT.reduce(
      (s, v, i) => s + (v - (fit.intercept + fit.slope * logD[i])) ** 2,
      0,
    );
    rSquared = ssTot > 0 ? 1 - ssRes / ssTot : null;
  }

  const exponent = fit.slope;
  const scale = Math.exp(fit.intercept);

  if (exponent < 1) {
    warnings.push(
      `Exponenten blev ${exponent.toFixed(3)}, alltså under 1. Det betyder att tempot i modellen ökar med distansen, vilket ingen håller i verkligheten. Kontrollera tiderna.`,
    );
  } else if (exponent > 1.2) {
    warnings.push(
      `Exponenten blev ${exponent.toFixed(3)}, vilket är högt. Antingen är den korta tiden ovanligt stark, eller den långa ovanligt svag – prognoserna uppåt blir försiktiga.`,
    );
  }

  return {
    exponent,
    individual: true,
    rSquared,
    resultCount: valid.length,
    warnings,
    predict: (metres: number) => scale * metres ** exponent,
  };
}

export type Prediction = {
  label: string;
  metres: number;
  seconds: number;
  /** Sekunder per kilometer. */
  paceSeconds: number;
  /** true när distansen ligger långt utanför de lopp modellen bygger på. */
  extrapolated: boolean;
};

/**
 * Hur långt utanför de kända loppen en prognos får ligga innan den markeras.
 *
 * Tre gånger, inte två. Halvmaraton ur ett 10 km-lopp är 2,1 gånger och är en
 * av de mest använda och pålitliga prognoserna som finns – den ska inte
 * flaggas. Maraton ur samma lopp är 4,2 gånger och är ökänt optimistisk, för
 * där sätter bränslet och inte utmattningen gränsen. Tre gånger skiljer de
 * två åt.
 */
const EXTRAPOLATION_FACTOR = 3;

/**
 * Prognoser för en lista distanser.
 *
 * `extrapolated` markerar de distanser som ligger mer än tre gånger så långt
 * bort som det längsta loppet, eller under en tredjedel av det kortaste.
 * Potenslagen håller väl inom det spannet men driver isär utanför.
 */
export function predictRaces(
  model: PredictionModel,
  results: RaceResult[],
  distances = STANDARD_DISTANCES,
): Prediction[] {
  const known = results.filter((r) => r.metres > 0 && r.seconds > 0);
  const shortest = known.length ? Math.min(...known.map((r) => r.metres)) : 0;
  const longest = known.length ? Math.max(...known.map((r) => r.metres)) : 0;

  return distances.flatMap(({ label, metres }) => {
    const seconds = model.predict(metres);
    if (!Number.isFinite(seconds) || seconds <= 0) return [];
    return [
      {
        label,
        metres,
        seconds,
        paceSeconds: (seconds / metres) * 1000,
        extrapolated:
          metres > longest * EXTRAPOLATION_FACTOR ||
          metres < shortest / EXTRAPOLATION_FACTOR,
      },
    ];
  });
}

/**
 * Mellantider för ett lopp i jämnt tempo.
 *
 * `negativeSplitPercent` fördelar tiden så att andra halvan går snabbare med
 * den andelen – 2 betyder två procent snabbare andra halvan.
 */
export function splits(
  totalSeconds: number,
  totalMetres: number,
  intervalMetres: number,
  negativeSplitPercent = 0,
): { atMetres: number; elapsedSeconds: number; paceSeconds: number }[] {
  if (!(totalSeconds > 0) || !(totalMetres > 0) || !(intervalMetres > 0)) {
    return [];
  }

  const halfway = totalMetres / 2;
  const drift = negativeSplitPercent / 100;

  // Tempot går linjärt från långsammare till snabbare, med samma medeltempo.
  // Första halvan blir `drift` långsammare och andra lika mycket snabbare.
  const paceAt = (metres: number) => {
    const meanPace = totalSeconds / totalMetres;
    if (drift === 0) return meanPace;
    const position = (metres - halfway) / totalMetres;
    return meanPace * (1 - 2 * drift * position);
  };

  const rows: { atMetres: number; elapsedSeconds: number; paceSeconds: number }[] = [];
  let elapsed = 0;
  let previous = 0;

  // Villkoret sitter på hur långt vi kommit, inte på nästa markering. Går
  // intervallet inte jämnt upp i distansen – 3 km-markeringar på ett
  // 10 km-lopp – ska den sista biten fram till mål ändå komma med.
  while (previous < totalMetres - 1e-9) {
    const at = Math.min(previous + intervalMetres, totalMetres);
    const segment = at - previous;
    // Medeltempot över segmentet, taget i mitten av det.
    const pace = paceAt((previous + at) / 2);
    elapsed += pace * segment;
    rows.push({ atMetres: at, elapsedSeconds: elapsed, paceSeconds: pace * 1000 });
    previous = at;
  }

  return rows;
}
