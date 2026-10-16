"use server";

import Anthropic from "@anthropic-ai/sdk";
import { extractText, getDocumentProxy } from "unpdf";

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
import { readReportText } from "./report-text";

const MODEL = "claude-opus-5-5";

export type ReadReportResult =
  | {
      ok: true;
      reading: ReportReading;
      /** Hur rapporten lästes: formatet ur textlagret, eller AI. */
      source: string;
    }
  | { ok: false; error: string };

/** Avläsningen i svarets form, så att samma kontroll gäller båda vägarna. */
const asRaw = (r: ReportReading) => ({
  sport: r.sport,
  unit: r.unit,
  performed_on: r.performedOn,
  weight_kg: r.weightKg,
  rest: r.rest && { lactate: r.rest.lactate, heart_rate: r.rest.heartRate },
  steps: r.steps.map((s) => ({
    intensity: s.intensity,
    duration_seconds: s.durationSeconds,
    lactate: s.lactate,
    heart_rate: s.heartRate,
    rpe: s.rpe,
  })),
  peak: r.peak && {
    intensity: r.peak.intensity,
    heart_rate: r.peak.heartRate,
    lactate: r.peak.lactate,
    vo2max: r.peak.vo2max,
  },
  lab_values: r.labValues,
  warnings: r.warnings,
});

/** Sidornas text ur en PDF, eller null om den inte går att läsa. */
async function pdfPages(bytes: Uint8Array): Promise<string[] | null> {
  try {
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: false });
    return Array.isArray(text) ? text : [text];
  } catch {
    return null;
  }
}

/**
 * Läser ut ett laktattest ur en testrapport – PDF eller foto.
 *
 * En PDF i ett format vi känner igen (Aktivitus, Ergonizer, 30K,
 * laktatkurvan) läses ur sitt textlager här, exakt och utan att rapporten
 * lämnar Coachvy. Annars läser en modell den: rapporten skickas till
 * Anthropic och sparas inte, varken där eller här. Den bär hälsouppgifter,
 * så samma samtycke krävs som för AI-coachen. Det som kommer tillbaka
 * fyller bara i formuläret; coachen granskar och sparar själv.
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
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pages = kind === "document" ? await pdfPages(bytes) : null;
  const known = pages ? readReportText(pages) : null;
  if (known) {
    const checked = readReport(asRaw(known.reading));
    if (checked.ok) {
      return {
        ok: true,
        reading: checked.reading,
        source: `Läst ur PDF:ens text (${known.format}).`,
      };
    }
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

  const data = Buffer.from(bytes).toString("base64");
  // Textlagret följer med som stöd: siffrorna står där exakt, också när
  // de i bilden bara är etiketter i ett diagram.
  const layer = pages?.join("\n\n").trim().slice(0, 20_000) ?? "";
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
              text: layer
                ? `Läs ut laktattestet ur rapporten. Här är PDF:ens textlager, sida för sida, som stöd – siffrorna i det är exakta men ordningen kan vara diagrammets:\n\n${layer}`
                : "Läs ut laktattestet ur rapporten.",
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
    const checked = readReport(raw);
    return checked.ok
      ? { ok: true, reading: checked.reading, source: "Läst av AI." }
      : checked;
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
