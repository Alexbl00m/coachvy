"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";

import { getAdept } from "@/lib/adepts/queries";
import { requireCoach } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { phaseLabel } from "@/lib/tests/phases";
import { protocolByKey } from "@/lib/tests/protocols";
import { listSessions } from "@/lib/tests/session-queries";
import { isAnthropicConfigured } from "@/lib/workouts/env";
import { contextForAdept } from "@/lib/workouts/generate";
import { contextToPrompt } from "@/lib/workouts/context";
import { listWorkouts } from "@/lib/workouts/queries";
import { formatDuration, resolveWorkout, toWorkout } from "@/lib/workouts/schema";
import { getConversation, listAiMessages } from "./queries";

const MODEL = "claude-opus-5";

/**
 * Reglerna ändras aldrig mellan frågor, så de ligger bakom en cachepunkt.
 * Atletens tal – som skiljer sig åt per adept och per dag – ligger efter den.
 */
const SYSTEM_PROMPT = `Du är bollplank åt en uthållighetscoach som frågar om en av sina adepter. Svara på svenska.

Vad du har att gå på:

- Coachen ger dig atletens mätta värden: tröskel, anaerob kapacitet, zoner, bakgrund, belastning och mående de senaste veckorna, samt de senaste testerna och passen. Det är riktiga mätningar, inte antaganden.
- Svara utifrån just de talen. "Öka volymen gradvis" är sant om alla och hjälper ingen; "hennes W′ är 21 kJ och passet du beskriver tar 34 kJ ur den" är ett svar.
- Saknas ett tal du behöver: säg vilket, och vad det skulle ändra. Hitta aldrig på ett värde och räkna aldrig vidare på ett du gissat.

Hur du svarar:

- Kort och konkret. Coachen är erfaren och behöver inte grunderna i träningslära förklarade.
- Var ärlig om osäkerhet. Modellerna appen använder – critical power, W′bal, sRPE-belastning – är approximationer, och när en slutsats vilar på tunt underlag ska det stå.
- Föreslå inte medicinsk behandling. Ser något ut att vara en skada eller ett hälsoproblem, säg att det hör hemma hos vården.
- Du fattar inga beslut åt coachen. Du lägger fram vad talen säger och vad alternativen kostar.`;

export type AskResult =
  | { ok: true; answer: string }
  | { ok: false; error: string };

/** De senaste testerna och passen, kortfattat. */
async function historyToPrompt(adeptId: string): Promise<string | null> {
  const [sessions, workouts] = await Promise.all([
    listSessions(adeptId),
    listWorkouts(adeptId),
  ]);

  const lines: string[] = [];

  if (sessions.length > 0) {
    lines.push("Senaste testtillfällen:");
    for (const session of sessions.slice(0, 5)) {
      const primary = session.test_metrics
        .filter((m) => m.is_primary)
        .map((m) => `${m.key.replace("_prime", "′")} ${Number(m.value)} ${m.unit}`)
        .join(", ");
      const phase = phaseLabel(session.training_phase);
      lines.push(
        `- ${session.performed_on}: ${protocolByKey(session.protocol)?.label ?? session.protocol}${phase ? ` (${phase.toLowerCase()})` : ""} – ${primary || "inga primärvärden"}`,
      );
    }
  }

  if (workouts.length > 0) {
    lines.push("Senast byggda pass:");
    for (const saved of workouts.slice(0, 5)) {
      const resolved = resolveWorkout(toWorkout(saved), saved.reference);
      lines.push(
        `- ${saved.created_at.slice(0, 10)}: ${saved.title}, ${formatDuration(resolved.totalSeconds)}${saved.summary ? ` – ${saved.summary}` : ""}`,
      );
    }
  }

  return lines.length > 0 ? lines.join("\n") : null;
}

/**
 * Ställer en fråga om en adept och sparar både frågan och svaret.
 *
 * Underlaget byggs om vid varje fråga i stället för att frysas i tråden. Talen
 * rör sig – ett nytt test, en veckas incheckningar – och ett svar som räknar
 * på förra månadens CP är sämre än inget svar.
 */
export async function askCoach(input: {
  adeptId: string;
  question: string;
}): Promise<AskResult> {
  const user = await requireCoach();

  const question = input.question.trim();
  if (question.length === 0) return { ok: false, error: "Skriv en fråga." };
  if (!isAnthropicConfigured()) {
    return {
      ok: false,
      error:
        "ANTHROPIC_API_KEY saknas. Lägg den i .env.local så kan AI-coachen användas.",
    };
  }

  const adept = await getAdept(input.adeptId);
  if (!adept) return { ok: false, error: "Adepten hittades inte." };

  const supabase = await createClient();

  // Tråden skapas vid första frågan, inte när sidan öppnas – annars fylls
  // databasen med tomma trådar för varje adept coachen råkat titta på.
  const existing = await getConversation(input.adeptId, user.id);
  let conversationId = existing?.id ?? null;

  if (conversationId === null) {
    const { data, error } = await supabase
      .from("ai_conversations")
      .insert({
        adept_id: input.adeptId,
        created_by: user.id,
        title: adept.full_name,
      })
      .select("id")
      .single();

    if (error || !data) {
      return {
        ok: false,
        error: `Kunde inte starta samtalet: ${error?.message ?? "okänt fel"}`,
      };
    }
    conversationId = data.id;
  }

  const [context, history, previous] = await Promise.all([
    contextForAdept(input.adeptId),
    historyToPrompt(input.adeptId),
    listAiMessages(conversationId),
  ]);

  const briefing = [
    `Adept: ${adept.full_name}${adept.current_level ? `, ${adept.current_level}` : ""}`,
    context ? contextToPrompt(context) : "Inga mätta värden finns ännu.",
    history,
  ]
    .filter(Boolean)
    .join("\n\n");

  const client = new Anthropic();

  try {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        // Underlaget som ett eget första turpar, så att historiken under det
        // läser som ett samtal och inte som en lista med upprepade briefingar.
        { role: "user", content: `Underlag om adepten:\n\n${briefing}` },
        {
          role: "assistant",
          content: "Tack, jag har talen. Vad vill du veta?",
        },
        ...previous.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        { role: "user", content: question },
      ],
    });

    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      return {
        ok: false,
        error: "Frågan gick inte att besvara. Formulera om den.",
      };
    }

    const answer = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    if (answer.length === 0) {
      return { ok: false, error: "Svaret var tomt. Försök igen." };
    }

    const { error: writeError } = await supabase.from("ai_messages").insert([
      { conversation_id: conversationId, role: "user", content: question },
      { conversation_id: conversationId, role: "assistant", content: answer },
    ]);

    if (writeError) {
      // Svaret finns och är värt att visa även om det inte gick att spara.
      return { ok: true, answer };
    }

    await supabase
      .from("ai_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    revalidatePath(routes.aiCoach);
    return { ok: true, answer };
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

/** Tömmer tråden för en adept. Underlaget påverkas inte – det byggs ändå om. */
export async function clearConversation(
  adeptId: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireCoach();

  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_conversations")
    .delete()
    .eq("adept_id", adeptId)
    .eq("created_by", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath(routes.aiCoach);
  return { ok: true };
}
