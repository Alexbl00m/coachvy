/**
 * Ett laktattest ur en testrapport: vad modellen ska läsa ut, i vilken form,
 * och kontrollen av det som kommer tillbaka.
 *
 * Rapporterna ser olika ut hos varje labb, och hos flera – Aktivitus bland
 * dem – finns stegen bara som etiketter i ett diagram, inte i en tabell.
 * Därför läses sidan som bild av en modell i stället för med en mall per
 * labb. Det som läses ut fyller bara i formuläret; coachen granskar och
 * sparar.
 *
 * Modulen är ren: inga anrop, så att kontrollen går att pröva utan nätverk.
 */

const nullable = (schema: object) => ({ anyOf: [schema, { type: "null" }] });
const num = nullable({ type: "number" });

/** Svarets form. Alla fält krävs; det som inte står i rapporten är null. */
export const REPORT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "sport",
    "unit",
    "performed_on",
    "weight_kg",
    "rest",
    "steps",
    "peak",
    "lab_values",
    "warnings",
  ],
  properties: {
    sport: nullable({
      type: "string",
      enum: ["cykling", "löpning", "simning"],
    }),
    unit: nullable({ type: "string", enum: ["W", "km/h", "m/s"] }),
    performed_on: nullable({ type: "string", format: "date" }),
    weight_kg: num,
    rest: nullable({
      type: "object",
      additionalProperties: false,
      required: ["lactate", "heart_rate"],
      properties: { lactate: num, heart_rate: num },
    }),
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "intensity",
          "duration_seconds",
          "lactate",
          "heart_rate",
          "rpe",
        ],
        properties: {
          intensity: { type: "number" },
          duration_seconds: num,
          lactate: num,
          heart_rate: num,
          rpe: num,
        },
      },
    },
    peak: nullable({
      type: "object",
      additionalProperties: false,
      required: ["intensity", "heart_rate", "lactate", "vo2max"],
      properties: {
        intensity: num,
        heart_rate: num,
        lactate: num,
        vo2max: num,
      },
    }),
    lab_values: nullable({ type: "string" }),
    warnings: { type: "array", items: { type: "string" } },
  },
} as const;

export const REPORT_SYSTEM_PROMPT = `Du läser ut rådatan ur en testrapport från ett laktattest – ett stegtest på cykel, löpband eller i simning – så att den kan registreras i ett träningsverktyg. Svara med JSON enligt schemat.

Läs varje sida. Stegen finns ibland i en tabell, ibland bara som etiketter i ett diagram – då är effekten eller farten den gula trappan eller x-axelns steg, laktatet etiketterna vid laktatpunkterna och pulsen etiketterna vid pulspunkterna. Står protokollet angivet (starteffekt eller startfart, ökning per steg, steglängd) så räknar du ut stegens belastning ur det och stämmer av mot diagrammet.

- steps: ett objekt per belastningssteg, i ordning. intensity i W för cykel, km/h för löpning, m/s för simning. duration_seconds är stegets längd; är sista steget kortare, ange det. lactate är provet som togs i slutet av steget. heart_rate är pulsen i slutet av steget – står flera pulsvärden per steg, ta det sista. rpe bara om Borg-värdet står vid steget. Hoppa inte över steg och hitta inte på steg.
- rest: vilovärdet före första steget (laktat vid tid 0 eller "vila"), annars null. Det är inget steg.
- peak: toppen om testet slutade maximalt (Wmax, Vmax, högsta puls, maxlaktat, uppmätt VO2max). Uppskattade värden hör inte hit.
- performed_on: testdatumet som ÅÅÅÅ-MM-DD. weight_kg: kroppsvikten.
- lab_values: labbets egna tolkningar på en eller två rader – trösklar, uppskattat VO2max, VLamax – med enheter. Inga namn, adresser, telefonnummer, e-post eller webbadresser, varken atletens, testledarens eller labbets.
- warnings: korta meningar på svenska om sådant som är osäkert: värden som är svåra att läsa, steg där laktat saknas, ett avbrutet sista steg, eller om rapporten inte ser ut att vara ett laktattest.

Skriv inte in något som inte står i rapporten. Är ett värde oläsligt, sätt null och säg det i warnings.`;

export type ReportStep = {
  intensity: number;
  durationSeconds: number | null;
  lactate: number | null;
  heartRate: number | null;
  rpe: number | null;
};

export type ReportReading = {
  sport: "cykling" | "löpning" | "simning" | null;
  unit: "W" | "km/h" | "m/s" | null;
  performedOn: string | null;
  weightKg: number | null;
  rest: { lactate: number | null; heartRate: number | null } | null;
  steps: ReportStep[];
  peak: {
    intensity: number | null;
    heartRate: number | null;
    lactate: number | null;
    vo2max: number | null;
  } | null;
  labValues: string | null;
  warnings: string[];
};

const record = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;

/** Ett tal inom spannet, annars null – ett avläsningsfel ska inte sparas. */
const inRange = (v: unknown, lo: number, hi: number): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : null;

const SPORTS = ["cykling", "löpning", "simning"] as const;
const UNITS = ["W", "km/h", "m/s"] as const;

/** Rimliga belastningar per enhet. */
const INTENSITY_RANGE: Record<(typeof UNITS)[number], [number, number]> = {
  W: [10, 1500],
  "km/h": [3, 30],
  "m/s": [0.3, 3],
};

/**
 * Kontrollerar svaret och gör det till formulärets form. Värden utanför det
 * rimliga stryks och sägs ut som varningar i stället för att fyllas i.
 */
export function readReport(
  raw: unknown,
): { ok: true; reading: ReportReading } | { ok: false; error: string } {
  const r = record(raw);
  if (!r) return { ok: false, error: "Svaret gick inte att läsa." };
  const warnings = Array.isArray(r.warnings)
    ? r.warnings.filter((w): w is string => typeof w === "string").slice(0, 10)
    : [];

  const sport = SPORTS.find((s) => s === r.sport) ?? null;
  const unit =
    UNITS.find((u) => u === r.unit) ??
    (sport === "cykling" ? "W" : sport === "löpning" ? "km/h" : null);
  const [lo, hi] = unit ? INTENSITY_RANGE[unit] : [0.3, 1500];

  const steps: ReportStep[] = [];
  let dropped = 0;
  for (const s of Array.isArray(r.steps) ? r.steps.slice(0, 40) : []) {
    const step = record(s);
    const intensity = inRange(step?.intensity, lo, hi);
    if (!step || intensity === null) {
      dropped += 1;
      continue;
    }
    steps.push({
      intensity,
      durationSeconds: inRange(step.duration_seconds, 10, 3600),
      lactate: inRange(step.lactate, 0, 30),
      heartRate: inRange(step.heart_rate, 30, 250),
      rpe: inRange(step.rpe, 1, 20),
    });
  }
  if (dropped > 0) {
    warnings.push(
      `${dropped} steg hade en belastning som inte gick att läsa och togs bort.`,
    );
  }
  if (steps.length === 0) {
    return {
      ok: false,
      error:
        warnings[0] ?? "Inga steg hittades i rapporten. Är det ett laktattest?",
    };
  }

  const rest = record(r.rest);
  const peak = record(r.peak);
  const date =
    typeof r.performed_on === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(r.performed_on) &&
    !Number.isNaN(Date.parse(r.performed_on))
      ? r.performed_on
      : null;

  return {
    ok: true,
    reading: {
      sport,
      unit,
      performedOn: date,
      weightKg: inRange(r.weight_kg, 20, 250),
      rest: rest
        ? {
            lactate: inRange(rest.lactate, 0, 10),
            heartRate: inRange(rest.heart_rate, 30, 150),
          }
        : null,
      steps,
      peak: peak
        ? {
            intensity: inRange(peak.intensity, lo, hi),
            heartRate: inRange(peak.heart_rate, 60, 250),
            lactate: inRange(peak.lactate, 0, 40),
            vo2max: inRange(peak.vo2max, 10, 100),
          }
        : null,
      labValues:
        typeof r.lab_values === "string" && r.lab_values.trim()
          ? r.lab_values.trim().slice(0, 500)
          : null,
      warnings,
    },
  };
}

/** Filtyperna som går att läsa: PDF och vanliga bilder (ett foto av protokollet). */
export const REPORT_TYPES: Record<string, "document" | "image"> = {
  "application/pdf": "document",
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "image/gif": "image",
};

/** Under server actions gräns på 4 MB (next.config.ts), med marginal. */
export const REPORT_MAX_BYTES = 3.8 * 1024 * 1024;
