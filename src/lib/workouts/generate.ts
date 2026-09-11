"use server";

import Anthropic from "@anthropic-ai/sdk";

import { requireCoach } from "@/lib/auth/session";
import type { Sport } from "@/lib/calculators/lactate";
import { getAdept } from "@/lib/adepts/queries";
import { sportOf } from "@/lib/tests/protocols";
import { rollingCriticalPower, rollingCriticalSpeed } from "@/lib/tests/rolling";
import { listMaximalEfforts, listSessions } from "@/lib/tests/session-queries";
import { readBalance, wPrimeBalance } from "./balance";
import {
  buildAthleteContext,
  contextToPrompt,
  manualAthleteContext,
  type AthleteContext,
} from "./context";
import { isAnthropicConfigured } from "./env";
import { parseWorkout, WORKOUT_JSON_SCHEMA } from "./parse";
import { formatDuration, resolveWorkout, type Workout } from "./schema";

const MODEL = "claude-opus-5";

/**
 * Reglerna ändras aldrig mellan anrop, så de ligger i systemprompten med en
 * cachepunkt. Atletens tal – som skiljer sig åt varje gång – ligger i
 * användarmeddelandet efter den, där de inte slår sönder cachen.
 */
const SYSTEM_PROMPT = `Du bygger enskilda träningspass åt en uthållighetscoach. Svaren är på svenska.

Så här fungerar passet du skriver:

- Alla mål anges som ANDEL av en referens som coachen ger dig: 0,75 betyder 75 % av referensen. Skriv aldrig watt eller fart direkt – appen räknar om åt dig.
- För löpning och simning är referensen en FART, inte ett tempo. 1,05 är alltså snabbare än referensen, inte långsammare. Blanda aldrig ihop de två.
- Ett steg anges antingen i sekunder eller i meter, aldrig båda. Cykling anges alltid i sekunder. Löpning och simning får använda meter när passet tänks i banlängder, annars sekunder.
- Vila mellan intervaller är ett eget steg med kind "vila" och ett lågt mål. Skriv aldrig vilan som en del av intervallets längd.
- Ett block med times > 1 upprepar sina steg. En intervallserie är alltså ett block med intervallet och vilan som två steg, upprepat times gånger. Uppvärmning och nedvarvning är egna block med times = 1.

Så här tänker du om innehållet:

- Bygg passet mot atletens mätta värden. Får du CP och W′ (eller CS och D′) ska upplägget gå att genomföra: arbetet över tröskeln får inte överstiga reserven om inte coachen uttryckligen bett om ett pass som tömmer den.
- Modellen bakom är W′bal. Ett intervall över tröskeln tär på reserven med (mål − tröskel) × sekunder; vila under tröskeln fyller på den igen, snabbare ju lägre vilan ligger. Räkna igenom serien innan du svarar.
- Saknas ett värde: bygg ändå passet, men säg i motiveringen vad som saknas och vad det gör osäkert. Hitta aldrig på ett tal.
- Motiveringen ("rationale") ska hänga ihop med just de här siffrorna och just det coachen bad om. Skriv inte allmänna sanningar om träning.
- Följ coachens begäran. Ber coachen om ett pass på en timme ska passet bli ungefär en timme, uppvärmning och nedvarvning inräknade.`;

export type GenerateInput = {
  prompt: string;
  sport: Sport;
  /** När satt hämtas underlaget ur adeptens testtillfällen. */
  adeptId: string | null;
  /** Används bara när ingen adept är vald. */
  manual: {
    reference: number | null;
    critical: number | null;
    reserve: number | null;
  };
  /** Ett tidigare pass som prompten ska ändra på. */
  previous: Workout | null;
};

export type GenerateResult =
  | { ok: true; workout: Workout; context: AthleteContext }
  | { ok: false; error: string };

/** Underlaget för en adept, hämtat ur testtillfällena. */
export async function contextForAdept(
  adeptId: string,
): Promise<AthleteContext | null> {
  const adept = await getAdept(adeptId);
  if (!adept) return null;

  const sport = sportOf(adept.sport);
  const [sessions, efforts] = await Promise.all([
    listSessions(adeptId),
    listMaximalEfforts(adeptId, sport),
  ]);

  const lastFullTestOn = sessions[0]?.performed_on ?? null;
  const rolling =
    sport === "cykling"
      ? rollingCriticalPower({ efforts, lastFullTestOn })
      : rollingCriticalSpeed({ efforts, lastFullTestOn });

  // Vikten tas från det senaste testet som har en, inte från adeptprofilen –
  // den har ingen viktkolumn, och vikten vid testet är ändå det ärligare talet.
  const weightKg =
    sessions.find((s) => s.weight_kg !== null)?.weight_kg ?? null;

  return buildAthleteContext({
    sport,
    weightKg: weightKg === null ? null : Number(weightKg),
    sessions,
    rolling,
  });
}

/**
 * Det tidigare passet som text, med vad W′bal sade om det.
 *
 * Poängen med att skicka med utfallet och inte bara stegen: ber coachen om
 * "lite hårdare" behöver modellen veta att det förra bottnade på 62 % för att
 * kunna svara på vad hårdare betyder här.
 */
function previousToPrompt(
  workout: Workout,
  context: AthleteContext,
): string {
  const lines = [
    `Föregående pass: "${workout.title}" – ${workout.summary}`,
  ];

  if (context.reference !== null) {
    const resolved = resolveWorkout(workout, context.reference);
    lines.push(`Längd: ${formatDuration(resolved.totalSeconds)}.`);

    if (context.balance) {
      const result = wPrimeBalance(resolved.steps, context.balance);
      if (result) {
        lines.push(
          `W′bal för det passet: ${readBalance(result, context.sport === "cykling" ? "J" : "m")}`,
        );
      }
    }
  }

  lines.push("Stegen i ordning:");
  for (const block of workout.blocks) {
    if (block.type === "steg") {
      const s = block.step;
      lines.push(
        `- ${s.kind}${s.label ? ` (${s.label})` : ""}: ${s.durationSeconds !== null ? `${s.durationSeconds} s` : `${s.distanceM} m`} vid ${fmtRange(s.low, s.high)}`,
      );
    } else {
      lines.push(`- ${block.times} × :`);
      for (const s of block.steps) {
        lines.push(
          `    - ${s.kind}${s.label ? ` (${s.label})` : ""}: ${s.durationSeconds !== null ? `${s.durationSeconds} s` : `${s.distanceM} m`} vid ${fmtRange(s.low, s.high)}`,
        );
      }
    }
  }

  return lines.join("\n");
}

const fmtRange = (low: number, high: number) =>
  low === high
    ? `${Math.round(low * 100)} %`
    : `${Math.round(low * 100)}–${Math.round(high * 100)} %`;

/**
 * Bygger ett pass ur en prompt.
 *
 * Underlaget hämtas på servern när en adept är vald, inte från klienten. Det
 * är samma skäl som att testanalysen körs om vid sparandet: det som passet
 * vilar på ska komma från databasen, inte från ett formulär.
 */
export async function generateWorkout(
  input: GenerateInput,
): Promise<GenerateResult> {
  await requireCoach();

  const prompt = input.prompt.trim();
  if (prompt.length === 0) {
    return { ok: false, error: "Skriv vad passet ska göra." };
  }
  if (!isAnthropicConfigured()) {
    return {
      ok: false,
      error:
        "ANTHROPIC_API_KEY saknas. Lägg den i .env.local så kan passbyggaren användas.",
    };
  }

  const context =
    input.adeptId !== null
      ? await contextForAdept(input.adeptId)
      : manualAthleteContext(input.sport, input.manual);

  if (!context) return { ok: false, error: "Adepten hittades inte." };
  if (context.reference === null || context.basis === null) {
    return {
      ok: false,
      error:
        "Det saknas ett referensvärde att räkna procenten mot. Registrera ett testtillfälle, eller fyll i tröskeln för hand.",
    };
  }

  const parts = [
    contextToPrompt(context),
    "",
    input.previous
      ? `${previousToPrompt(input.previous, context)}\n\nCoachen vill ändra passet: ${prompt}`
      : `Coachen vill ha: ${prompt}`,
  ];

  const client = new Anthropic();

  try {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      // Att lägga en intervallserie mot W′bal är ingen uppslagsfråga – det är
      // en räkning som ska göras innan svaret skrivs.
      thinking: { type: "adaptive" },
      output_config: {
        format: { type: "json_schema", schema: WORKOUT_JSON_SCHEMA },
      },
      // Skulle en förfrågan nekas av en klassificerare körs den om på en annan
      // modell i samma anrop i stället för att coachen möts av ett tomt svar.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: parts.join("\n") }],
    });

    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      return {
        ok: false,
        error: "Förfrågan gick inte att besvara. Formulera om den.",
      };
    }

    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    if (text.trim().length === 0) {
      return { ok: false, error: "Svaret var tomt. Försök igen." };
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return { ok: false, error: "Svaret gick inte att läsa som ett pass." };
    }

    const parsed = parseWorkout(raw, context.sport, context.basis);
    if (!parsed.ok) return { ok: false, error: parsed.error };

    return { ok: true, workout: parsed.workout, context };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return { ok: false, error: "ANTHROPIC_API_KEY avvisades." };
    }
    if (error instanceof Anthropic.RateLimitError) {
      return { ok: false, error: "För många anrop just nu. Vänta en stund." };
    }
    if (error instanceof Anthropic.APIError) {
      return { ok: false, error: `Anropet misslyckades (${error.status}).` };
    }
    return {
      ok: false,
      error: "Kunde inte nå modellen. Kontrollera nätverket och försök igen.",
    };
  }
}
