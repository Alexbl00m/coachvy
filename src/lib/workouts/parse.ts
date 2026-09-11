/**
 * Schemat modellen svarar i, och tolkningen tillbaka till appens typer.
 *
 * Strukturerad utdata garanterar att JSON:en följer schemat. Den garanterar
 * inte att passet är vettigt: schemat kan inte säga "ett intervall är längre
 * än noll sekunder" eller "300 % av tröskeln är inte ett träningspass". Den
 * kontrollen ligger här, och den körs på allt som kommer in – ett fält som
 * inte går att rädda tas bort i stället för att följa med ut i grafen.
 */

import type { Sport } from "@/lib/calculators/lactate";
import {
  STEP_KINDS,
  type StepKind,
  type TargetBasis,
  type Workout,
  type WorkoutBlock,
  type WorkoutStep,
} from "./schema";

/**
 * Block skickas i en enda form: en grupp som upprepas `times` gånger.
 *
 * Ett fristående steg är alltså `times: 1` med ett steg i listan. Det är en
 * form mindre för modellen att välja fel i, och den viks ut till appens två
 * blocktyper här i stället.
 */
export const WORKOUT_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "Passets namn på svenska, högst 60 tecken.",
    },
    summary: {
      type: "string",
      description: "En mening om vad passet är och hur långt det är.",
    },
    rationale: {
      type: "string",
      description:
        "Därför det här passet: koppla upplägget till atletens mätta värden och till vad coachen bad om. 2–5 meningar.",
    },
    blocks: {
      type: "array",
      description: "Passet i ordning, från uppvärmning till nedvarvning.",
      items: {
        type: "object",
        properties: {
          times: {
            type: "integer",
            description:
              "Antal varv. 1 för ett fristående steg, fler för en intervallserie.",
          },
          steps: {
            type: "array",
            description: "Stegen som upprepas, i ordning.",
            items: {
              type: "object",
              properties: {
                kind: {
                  type: "string",
                  enum: STEP_KINDS,
                },
                label: {
                  type: "string",
                  description:
                    "Kort etikett, eller tom sträng när steget inte behöver någon.",
                },
                duration_seconds: {
                  type: ["integer", "null"],
                  description:
                    "Stegets längd i sekunder. Null om steget anges i meter i stället.",
                },
                distance_m: {
                  type: ["integer", "null"],
                  description:
                    "Stegets längd i meter. Bara för löpning och simning; null annars.",
                },
                low: {
                  type: "number",
                  description:
                    "Målets nedre gräns som andel av referensen. 0,75 betyder 75 %.",
                },
                high: {
                  type: "number",
                  description:
                    "Målets övre gräns som andel av referensen. Samma som low när målet är ett enda tal.",
                },
              },
              required: [
                "kind",
                "label",
                "duration_seconds",
                "distance_m",
                "low",
                "high",
              ],
              additionalProperties: false,
            },
          },
        },
        required: ["times", "steps"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "summary", "rationale", "blocks"],
  additionalProperties: false,
} as const;

/** Övre tak för ett mål. Mer än tre gånger tröskeln är ingen träningsanvisning. */
const MAX_FRACTION = 3;
/** Tak för antalet steg efter utrullning, så en trasig `times` inte fyller sidan. */
const MAX_FLAT_STEPS = 240;
const MAX_SECONDS = 8 * 3600;

const text = (value: unknown, fallback: string, max: number): string => {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length === 0 ? fallback : trimmed.slice(0, max);
};

const positive = (value: unknown, max: number): number | null => {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(n, max);
};

function parseStep(raw: unknown): WorkoutStep | null {
  if (typeof raw !== "object" || raw === null) return null;
  const row = raw as Record<string, unknown>;

  const kind = STEP_KINDS.includes(row.kind as StepKind)
    ? (row.kind as StepKind)
    : "intervall";

  const low = typeof row.low === "number" ? row.low : Number(row.low);
  const high = typeof row.high === "number" ? row.high : Number(row.high);
  if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
  if (low < 0 || high < 0) return null;

  const durationSeconds = positive(row.duration_seconds, MAX_SECONDS);
  const distanceM = positive(row.distance_m, 100_000);
  // Ett steg utan längd är inget steg.
  if (durationSeconds === null && distanceM === null) return null;

  return {
    kind,
    label: text(row.label, "", 60),
    durationSeconds,
    distanceM,
    low: Math.min(Math.min(low, high), MAX_FRACTION),
    high: Math.min(Math.max(low, high), MAX_FRACTION),
  };
}

export type ParseResult =
  | { ok: true; workout: Workout }
  | { ok: false; error: string };

/**
 * Modellens svar till ett pass appen kan räkna på.
 *
 * Gren och referens sätts av appen, inte av modellen: båda är redan bestämda
 * när prompten skickas, och att låta modellen välja om dem vore att öppna för
 * ett pass i fel gren mot fel tröskel.
 */
export function parseWorkout(
  raw: unknown,
  sport: Sport,
  basis: TargetBasis,
): ParseResult {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Svaret gick inte att tolka som ett pass." };
  }
  const root = raw as Record<string, unknown>;
  if (!Array.isArray(root.blocks)) {
    return { ok: false, error: "Svaret innehöll inga block." };
  }

  const blocks: WorkoutBlock[] = [];
  let flatCount = 0;

  for (const rawBlock of root.blocks) {
    if (typeof rawBlock !== "object" || rawBlock === null) continue;
    const block = rawBlock as Record<string, unknown>;

    const parsedSteps = Array.isArray(block.steps)
      ? block.steps.map(parseStep).filter((s): s is WorkoutStep => s !== null)
      : [];
    if (parsedSteps.length === 0) continue;

    const rawTimes = Number(block.times);
    const times =
      Number.isFinite(rawTimes) && rawTimes >= 1 ? Math.floor(rawTimes) : 1;

    if (flatCount + times * parsedSteps.length > MAX_FLAT_STEPS) break;
    flatCount += times * parsedSteps.length;

    // Ett varv är ingen repetition. Då blir stegen fristående i stället, så
    // tabellen inte visar "1 ×" framför en uppvärmning.
    if (times === 1) {
      for (const step of parsedSteps) blocks.push({ type: "steg", step });
    } else {
      blocks.push({ type: "repetition", times, steps: parsedSteps });
    }
  }

  if (blocks.length === 0) {
    return { ok: false, error: "Passet blev tomt när stegen kontrollerades." };
  }

  return {
    ok: true,
    workout: {
      title: text(root.title, "Pass", 80),
      sport,
      summary: text(root.summary, "", 240),
      rationale: text(root.rationale, "", 1200),
      basis,
      blocks,
    },
  };
}

/** Appens form tillbaka till den form modellen svarar i. */
const toWire = (step: WorkoutStep) => ({
  kind: step.kind,
  label: step.label,
  duration_seconds: step.durationSeconds,
  distance_m: step.distanceM,
  low: step.low,
  high: step.high,
});

/**
 * Kontrollerar ett pass som redan har appens form.
 *
 * Klienten får redigera längder och mål fritt, och det som sparas ska ha gått
 * genom samma kontroll som det som modellen svarade – annars kunde ett tomt
 * fält eller ett orimligt tal ta sig in i databasen via redigeringen. I
 * stället för att skriva reglerna en gång till viks passet tillbaka till
 * modellens form och körs genom samma tolk.
 */
export function sanitiseWorkout(workout: Workout): Workout | null {
  const blocks = workout.blocks.map((block) =>
    block.type === "steg"
      ? { times: 1, steps: [toWire(block.step)] }
      : { times: block.times, steps: block.steps.map(toWire) },
  );

  const result = parseWorkout(
    {
      title: workout.title,
      summary: workout.summary,
      rationale: workout.rationale,
      blocks,
    },
    workout.sport,
    workout.basis,
  );

  return result.ok ? result.workout : null;
}
