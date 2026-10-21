"use server";

import { revalidatePath } from "next/cache";

import { requireCoach } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { callWhen, cleanMeetingUrl, stockholmToIso } from "./time";

export type CallResult = { ok: true } | { ok: false; error: string };

const DURATIONS = [15, 30, 45, 60, 90];

/** Sparar coachens mötesrum. Tom text tar bort det. */
export async function saveMeetingUrl(raw: string): Promise<CallResult> {
  const user = await requireCoach();
  const url = raw.trim() ? cleanMeetingUrl(raw) : null;
  if (raw.trim() && !url) {
    return {
      ok: false,
      error:
        "Klistra in hela länken till mötesrummet, den som börjar med https://.",
    };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coaches")
    .update({ meeting_url: url })
    .eq("id", user.id)
    .select("id");
  if (error) return { ok: false, error: `Kunde inte spara: ${error.message}` };
  if (!data || data.length === 0)
    return { ok: false, error: "Coachkontot hittades inte." };
  revalidatePath(routes.settings);
  return { ok: true };
}

/** Samtalet och meddelandet som bär det, i adeptens tråd. */
async function createCall(input: {
  adeptId: string;
  coachId: string;
  url: string;
  startsAt: string;
  duration: number;
  topic: string | null;
  body: string;
}): Promise<CallResult> {
  const supabase = await createClient();
  const { data: call, error } = await supabase
    .from("coach_calls")
    .insert({
      adept_id: input.adeptId,
      coach_id: input.coachId,
      starts_at: input.startsAt,
      duration_minutes: input.duration,
      topic: input.topic,
      url: input.url,
    })
    .select("id")
    .single();
  if (error || !call) {
    return {
      ok: false,
      error: `Kunde inte skapa samtalet: ${error?.message ?? "okänt fel"}`,
    };
  }
  const { error: messageError } = await supabase.from("coach_messages").insert({
    adept_id: input.adeptId,
    sender_id: input.coachId,
    body: input.body,
    call_id: call.id,
  });
  if (messageError) {
    return {
      ok: false,
      error: `Samtalet är sparat men meddelandet gick inte att skicka: ${messageError.message}`,
    };
  }
  revalidatePath(`${routes.adepts}/${input.adeptId}`, "layout");
  revalidatePath(routes.calendar);
  return { ok: true };
}

function meetingUrlOf(user: Awaited<ReturnType<typeof requireCoach>>) {
  return user.coach?.meeting_url ?? null;
}

const NO_ROOM = "Lägg in länken till ditt mötesrum under Inställningar först.";

/**
 * Ringer direkt: ett samtal som börjar nu, och ett meddelande i tråden så att
 * adepten ser det och kan gå med. Coachen själv öppnar rummet från knappen.
 */
export async function startCall(adeptId: string): Promise<CallResult> {
  const user = await requireCoach();
  const url = meetingUrlOf(user);
  if (!url) return { ok: false, error: NO_ROOM };
  return createCall({
    adeptId,
    coachId: user.id,
    url,
    startsAt: new Date().toISOString(),
    duration: 30,
    topic: null,
    body: "Ringer dig nu på video – gå med via kortet här.",
  });
}

/** Bokar ett samtal på en tid i svensk tid. */
export async function bookCall(input: {
  adeptId: string;
  date: string;
  time: string;
  duration: number;
  topic: string;
}): Promise<CallResult> {
  const user = await requireCoach();
  const url = meetingUrlOf(user);
  if (!url) return { ok: false, error: NO_ROOM };
  const startsAt = stockholmToIso(input.date, input.time);
  if (!startsAt) return { ok: false, error: "Välj dag och klockslag." };
  if (Date.parse(startsAt) < Date.now() - 5 * 60_000) {
    return { ok: false, error: "Tiden har redan varit. Välj en senare." };
  }
  if (!DURATIONS.includes(input.duration)) {
    return { ok: false, error: "Välj en längd för samtalet." };
  }
  const topic = input.topic.trim().slice(0, 200) || null;
  return createCall({
    adeptId: input.adeptId,
    coachId: user.id,
    url,
    startsAt,
    duration: input.duration,
    topic,
    body: `Bokade ett videosamtal ${callWhen(startsAt)}, ${input.duration} min${topic ? ` – ${topic}` : ""}.`,
  });
}

/** Avbokar ett samtal och säger det i tråden. */
export async function cancelCall(callId: string): Promise<CallResult> {
  const user = await requireCoach();
  const supabase = await createClient();
  const { data: call, error } = await supabase
    .from("coach_calls")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("id", callId)
    .is("cancelled_at", null)
    .select("id, adept_id, starts_at")
    .single();
  if (error || !call) {
    return { ok: false, error: "Samtalet gick inte att avboka." };
  }
  await supabase.from("coach_messages").insert({
    adept_id: call.adept_id,
    sender_id: user.id,
    body: `Avbokade videosamtalet ${callWhen(call.starts_at)}.`,
    call_id: call.id,
  });
  revalidatePath(`${routes.adepts}/${call.adept_id}`, "layout");
  revalidatePath(routes.calendar);
  return { ok: true };
}
