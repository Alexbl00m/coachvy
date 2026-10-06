"use server";

import Anthropic from "@anthropic-ai/sdk";

import { aiBlockedMessage } from "@/lib/adepts/consent-state";
import { getAdept, getConsentState } from "@/lib/adepts/queries";
import { isMember } from "@/lib/auth/membership";
import { requireSessionUser } from "@/lib/auth/session";
import { isAnthropicConfigured } from "@/lib/workouts/env";
import {
  readReport,
  REPORT_JSON_SCHEMA,
  REPORT_MAX_BYTES,
  REPORT_SYSTEM_PROMPT,
  REPORT_TYPES,
  type ReportReading,
} from "./report-read";

const MODEL = "claude-opus-5-5";

export type ReadReportResult =
  | { ok: true; reading: ReportReading }
  | { ok: false; error: string };

/**
 * Läser ut ett laktattest ur en testrapport – PDF eller foto – med en modell.
 *
 * Rapporten skickas till Anthropic för att läsas och sparas inte, varken där
 * eller här. Den bär hälsouppgifter, så samma samtycke krävs som för
 * AI-coachen. Det som kommer tillbaka fyller bara i formuläret; coachen
 * granskar och sparar själv.
 */
export async function readTestReport(
  formData: FormData,
): Promise<ReadReportResult> {
  const user = await requireSessionUser();
  const adeptId = formData.get("adeptId");
  const file = formData.get("file");
  if (typeof adeptId !== "string" || !(file instanceof File)) {
    return { ok: false, error: "Välj en rapport att läsa in." };
  }

  // Samma regel som för att spara ett test: coachen, eller en adept med
  // medlemskap som registrerar sina egna.
  const isCoach = user.profile?.role === "coach";
  const isSelf =
    user.profile?.role === "adept" &&
    isMember(user) &&
    user.adept?.id === adeptId;
  if (!isCoach && !isSelf) {
    return { ok: false, error: "Bara coachen kan registrera tester här." };
  }

  const kind = REPORT_TYPES[file.type];
  if (!kind) {
    return {
      ok: false,
      error: "Rapporten ska vara en PDF eller en bild (PNG, JPEG, WebP).",
    };
  }
  if (file.size > REPORT_MAX_BYTES) {
    return {
      ok: false,
      error:
        "Filen är för stor. Spara rapporten som PDF eller ta ett mindre foto.",
    };
  }
  if (!isAnthropicConfigured()) {
    return {
      ok: false,
      error:
        "ANTHROPIC_API_KEY saknas. Lägg in den som miljövariabel och deploya om, så kan rapporter läsas in.",
    };
  }

  const adept = await getAdept(adeptId);
  if (!adept) return { ok: false, error: "Adepten hittades inte." };
  const consent = await getConsentState(adept);
  if (consent.kind !== "godkänt") {
    return {
      ok: false,
      error: aiBlockedMessage(
        adept.full_name,
        consent,
        adept.profile_id === user.id,
      ),
    };
  }

  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  const source: Anthropic.Beta.BetaContentBlockParam =
    kind === "document"
      ? {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data },
        }
      : {
          type: "image",
          source: {
            type: "base64",
            media_type: file.type as
              | "image/png"
              | "image/jpeg"
              | "image/webp"
              | "image/gif",
            data,
          },
        };

  const client = new Anthropic();
  try {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      // Att läsa etiketter i ett diagram och para ihop dem med rätt steg är
      // noggrannhetsarbete, inte en snabb uppslagning.
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: { type: "json_schema", schema: REPORT_JSON_SCHEMA },
      },
      // Nekas en förfrågan av en klassificerare körs den om på en annan
      // modell i samma anrop i stället för att coachen får ett tomt svar.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [
        {
          type: "text",
          text: REPORT_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            source,
            {
              type: "text",
              text: "Läs ut laktattestet ur rapporten.",
            },
          ],
        },
      ],
    });
    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      return { ok: false, error: "Rapporten gick inte att läsa in." };
    }
    if (message.stop_reason === "max_tokens") {
      return { ok: false, error: "Rapporten var för lång att läsa in." };
    }
    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return { ok: false, error: "Svaret gick inte att läsa. Försök igen." };
    }
    return readReport(raw);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return { ok: false, error: "ANTHROPIC_API_KEY avvisades." };
    }
    if (error instanceof Anthropic.RateLimitError) {
      return { ok: false, error: "För många anrop just nu. Vänta en stund." };
    }
    if (error instanceof Anthropic.BadRequestError) {
      return {
        ok: false,
        error: "Rapporten kunde inte läsas – är filen hel och olåst?",
      };
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
