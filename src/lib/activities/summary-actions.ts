"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";

import { aiBlockedMessage } from "@/lib/adepts/consent-state";
import { getAdept, getConsentState } from "@/lib/adepts/queries";
import { philosophyBlocks } from "@/lib/ai-coach/philosophy";
import { coachPhilosophyFor } from "@/lib/ai-coach/philosophy-queries";
import { requireCoach } from "@/lib/auth/session";
import { listScheduledWorkouts } from "@/lib/calendar/queries";
import type { Sport } from "@/lib/calculators/lactate";
import { routes } from "@/lib/routes";
import { listBlocks, listRaces } from "@/lib/season/queries";
import { addDays, blockOn } from "@/lib/season/season";
import { createClient } from "@/lib/supabase/server";
import { phaseLabel } from "@/lib/tests/phases";
import type { ActivityAiSummaryRow } from "@/lib/types/database";
import { contextToPrompt } from "@/lib/workouts/context";
import { isAnthropicConfigured } from "@/lib/workouts/env";
import { contextForAdept } from "@/lib/workouts/generate";
import { activityStrain, loadTrend } from "./load";
import { listLoadActivities } from "./load-queries";
import { getActivity, listActivities } from "./queries";
import { sessionBrief } from "./session-brief";

const MODEL = "claude-opus-5-5";

/** Lika för alla pass och adepter, så den ligger före cachepunkten. */
const SYSTEM_PROMPT = `Du skriver en kort sammanfattning av ett genomfört träningspass åt en uthållighetscoach. Svara på svenska.

Underlaget är passets mätta värden, testvärdena som gällde, det som var planerat den dagen, adeptens incheckning, perioden i säsongsplanen, veckans belastning och de senaste passen av samma slag. Analysen av passet i sig har appen redan gjort och coachen ser den bredvid; ditt jobb är vad passet betyder i sitt sammanhang.

Det du ska svara på, i den ordning som säger mest om just det här passet:
- Vad passet blev: huvudsyftet och vilken egenskap det tränade. Klassa intensiteten per pass efter huvudsyftet, som i träningsfilosofins avsnitt 19: lugnt (under LT1), medel (mellan LT1 och LT2) eller högt (över LT2). Ett VO₂max-pass är högt även om det mest är uppvärmning och vila; ett distanspass med några stegringar är lugnt.
- Mot planen, om något var planerat: genomfört som tänkt, kortare, hårdare, annat.
- Det som sticker ut mot adeptens egna senaste pass: frikoppling, puls vid given effekt eller fart, jämnhet mellan halvorna och intervallerna, nya bästa.
- Vad passet kostade: strain och volym, mot veckan och perioden.
- Inför de närmaste dagarna: ett förslag som coachen tar ställning till, motiverat ur perioden och filosofin.

Regler:
- Bara ur talen. Saknas något du behöver, säg vilket i en bisats – hitta aldrig på ett värde.
- Skriv om passet, inte om personen: "passet", "pulsen", "effekten". Inga namn och inga pronomen för adepten, så att coachen kan dela texten med adepten om hen vill.
- Konstaterande och kort. Coachen är erfaren och behöver inga grunder förklarade. Inga punktlistor, inga rubriker, ingen markdown.
- Rubriken är en mening, högst 120 tecken, med det viktigaste.
- Syftet är en kort etikett, högst sex ord, till exempel "Distans, lugnt" eller "VO₂max, 5 × 4 min".
- Två till fyra stycken, sammanlagt högst 170 ord. Varje stycke börjar med det det handlar om ("Mot planen: …").
- Föreslå inte medicinsk behandling. Ser något ut som en skada eller sjukdom, säg att det hör hemma hos vården.`;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    rubrik: {
      type: "string",
      description: "En mening med det viktigaste om passet.",
    },
    syfte: {
      type: "string",
      description: "Passets huvudsyfte som kort etikett.",
    },
    intensitet: {
      type: "string",
      enum: ["lugnt", "medel", "högt"],
      description: "Passets intensitet efter huvudsyftet.",
    },
    stycken: {
      type: "array",
      items: { type: "string" },
      description: "Två till fyra korta stycken.",
    },
  },
  required: ["rubrik", "syfte", "intensitet", "stycken"],
  additionalProperties: false,
} as const;

type Output = {
  rubrik: string;
  syfte: string;
  intensitet: "lugnt" | "medel" | "högt";
  stycken: string[];
};

export type SummaryResult =
  | { ok: true; summary: ActivityAiSummaryRow }
  | { ok: false; error: string };

const SPORTS: Sport[] = ["cykling", "löpning", "simning"];

/** Allt runt passet som underlaget behöver, ur databasen. */
async function briefFor(activityId: string) {
  const activity = await getActivity(activityId);
  if (!activity) return null;
  const adeptId = activity.adept_id;
  const date = activity.performed_on;
  const supabase = await createClient();

  const [races, blocks, planned, checkin, load, heads] = await Promise.all([
    listRaces(adeptId),
    listBlocks(adeptId),
    listScheduledWorkouts(date, date, adeptId),
    supabase
      .from("adept_checkins")
      .select(
        "session_rpe, duration_minutes, sleep, fatigue, soreness, stress, note",
      )
      .eq("adept_id", adeptId)
      .eq("performed_on", date)
      .maybeSingle(),
    listLoadActivities(adeptId, addDays(date, -34)),
    listActivities(adeptId),
  ]);

  const block = blockOn(blocks, date);
  const nextRace =
    races
      .filter((r) => r.race_date > date)
      .sort((a, b) => a.race_date.localeCompare(b.race_date))[0] ?? null;
  const sameSport = heads.filter(
    (h) => h.sport === activity.sport && h.id !== activity.id,
  );
  const before = sameSport.filter(
    (h) =>
      h.started_at < activity.started_at &&
      h.performed_on >= addDays(date, -90),
  );

  const text = sessionBrief({
    activity,
    strain: activityStrain(activity),
    race: activity.race_id
      ? (races.find((r) => r.id === activity.race_id) ?? null)
      : null,
    planned: planned.map((p) => ({
      title: p.title,
      sport: p.sport,
      duration: p.duration,
      summary: p.summary,
    })),
    checkin: checkin.data ?? null,
    block: block
      ? {
          phase: phaseLabel(block.phase) ?? block.phase,
          name: block.name,
          focus: block.focus,
        }
      : null,
    nextRace,
    trend: loadTrend(
      load.filter((l) => l.performed_on <= date),
      date,
    ),
    earlier: before
      .filter((h) => h.performed_on >= addDays(date, -60))
      .slice(0, 6)
      .map((h) => ({
        performed_on: h.performed_on,
        name: h.name,
        seconds: Number(h.moving_s ?? h.duration_s ?? 0),
        distance_m: h.distance_m,
        normalized_power: h.normalized_power,
        intensity_factor: h.intensity_factor,
        avg_speed: h.avg_speed,
        avg_hr: h.avg_hr,
        decoupling: h.decoupling,
      })),
    before90: before
      .filter((h) => h.performed_on < date)
      .map((h) => ({
        id: h.id,
        name: h.name,
        sport: h.sport,
        performed_on: h.performed_on,
        curve: h.curve,
        best: null,
      })),
  });
  return { activity, text };
}

/**
 * Skriver en sammanfattning av passet och sparar den. En ny ersätter den
 * gamla och är odelad tills coachen delar den – coachen läser först.
 */
export async function summariseActivity(
  activityId: string,
): Promise<SummaryResult> {
  const user = await requireCoach();
  if (!isAnthropicConfigured()) {
    return {
      ok: false,
      error:
        "ANTHROPIC_API_KEY saknas. Lägg in den som miljövariabel (i Vercel: Settings → Environment Variables) och deploya om.",
    };
  }

  const brief = await briefFor(activityId);
  if (!brief) return { ok: false, error: "Passet hittades inte." };
  const { activity, text } = brief;

  const adept = await getAdept(activity.adept_id);
  if (!adept || adept.coach_id !== user.id) {
    return { ok: false, error: "Bara adeptens coach kan sammanfatta passet." };
  }
  // Underlaget är hälsouppgifter som går till Anthropic: bara med samtycke.
  const consent = await getConsentState(adept);
  if (consent.kind !== "godkänt") {
    return { ok: false, error: aiBlockedMessage(adept.full_name, consent) };
  }

  const sport = SPORTS.find((s) => s === activity.sport);
  const [context, philosophy] = await Promise.all([
    contextForAdept(adept.id, sport),
    coachPhilosophyFor(user.id),
  ]);
  const briefing = [
    context
      ? `Adeptens värden och bakgrund i dag:\n${contextToPrompt(context)}`
      : null,
    text,
  ]
    .filter(Boolean)
    .join("\n\n");

  const client = new Anthropic();
  let output: Output;
  try {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        format: { type: "json_schema", schema: OUTPUT_SCHEMA },
      },
      system: [
        { type: "text", text: SYSTEM_PROMPT },
        ...philosophyBlocks(philosophy),
      ],
      messages: [
        {
          role: "user",
          content: `Sammanfatta passet.\n\n${briefing}`,
        },
      ],
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") {
      return { ok: false, error: "Passet gick inte att sammanfatta." };
    }
    if (message.stop_reason === "max_tokens") {
      return { ok: false, error: "Svaret blev för långt. Försök igen." };
    }
    const raw = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");
    output = JSON.parse(raw) as Output;
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
    if (error instanceof SyntaxError) {
      return { ok: false, error: "Svaret gick inte att läsa. Försök igen." };
    }
    return {
      ok: false,
      error: "Kunde inte nå modellen. Kontrollera nätverket och försök igen.",
    };
  }

  const headline = output.rubrik.trim().slice(0, 300);
  const body = output.stycken
    .map((p) => p.trim())
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 4000);
  if (!headline || !body) {
    return { ok: false, error: "Svaret var tomt. Försök igen." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_summaries")
    .upsert(
      {
        activity_id: activity.id,
        adept_id: activity.adept_id,
        headline,
        purpose: output.syfte.trim().slice(0, 120) || null,
        intensity: output.intensitet,
        body,
        model: MODEL,
        edited: false,
        shared_at: null,
        created_by: user.id,
      },
      { onConflict: "activity_id" },
    )
    .select("*")
    .single();
  if (error || !data) {
    return {
      ok: false,
      error: `Kunde inte spara sammanfattningen: ${error?.message ?? "okänt fel"}`,
    };
  }

  revalidatePath(
    `${routes.adepts}/${activity.adept_id}/aktivitet/${activity.id}`,
  );
  return { ok: true, summary: data };
}

/** Coachen rättar texten. */
export async function editActivitySummary(input: {
  activityId: string;
  headline: string;
  body: string;
}): Promise<SummaryResult> {
  await requireCoach();
  const headline = input.headline.trim();
  const body = input.body.trim();
  if (!headline || !body) {
    return { ok: false, error: "Rubrik och text behövs båda." };
  }
  if (headline.length > 300 || body.length > 4000) {
    return { ok: false, error: "Texten är för lång." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_summaries")
    .update({ headline, body, edited: true })
    .eq("activity_id", input.activityId)
    .select("*")
    .single();
  if (error || !data) {
    return {
      ok: false,
      error: `Kunde inte spara: ${error?.message ?? "okänt fel"}`,
    };
  }
  revalidatePath(
    `${routes.adepts}/${data.adept_id}/aktivitet/${data.activity_id}`,
  );
  return { ok: true, summary: data };
}

/** Coachen delar sammanfattningen med adepten, eller slutar dela den. */
export async function shareActivitySummary(input: {
  activityId: string;
  share: boolean;
}): Promise<SummaryResult> {
  await requireCoach();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_summaries")
    .update({ shared_at: input.share ? new Date().toISOString() : null })
    .eq("activity_id", input.activityId)
    .select("*")
    .single();
  if (error || !data) {
    return {
      ok: false,
      error: `Kunde inte spara: ${error?.message ?? "okänt fel"}`,
    };
  }
  revalidatePath(
    `${routes.adepts}/${data.adept_id}/aktivitet/${data.activity_id}`,
  );
  return { ok: true, summary: data };
}
