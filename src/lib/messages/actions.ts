"use server";

import { revalidatePath } from "next/cache";

import { requireSessionUser } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export type SendMessageResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

const MAX_LENGTH = 4000;

/**
 * Skickar ett meddelande i en adepts tråd.
 *
 * Avsändaren sätts av servern till den inloggade, inte av klienten. RLS
 * kräver dessutom att `sender_id` är den inloggade – utan den kontrollen
 * kunde en coach lägga ord i sin adepts mun i hennes egen tråd.
 */
export async function sendMessage(input: {
  adeptId: string;
  body: string;
  workoutId?: string | null;
  sessionId?: string | null;
}): Promise<SendMessageResult> {
  const user = await requireSessionUser();

  const body = input.body.trim();
  if (body.length === 0) return { ok: false, error: "Skriv något först." };
  if (body.length > MAX_LENGTH) {
    return { ok: false, error: `Meddelandet får vara högst ${MAX_LENGTH} tecken.` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_messages")
    .insert({
      adept_id: input.adeptId,
      sender_id: user.id,
      body,
      workout_id: input.workoutId ?? null,
      session_id: input.sessionId ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: `Kunde inte skicka meddelandet: ${error?.message ?? "okänt fel"}`,
    };
  }

  revalidatePath(`${routes.adepts}/${input.adeptId}`);
  return { ok: true, id: data.id };
}

/**
 * Markerar motpartens olästa meddelanden som lästa.
 *
 * Går via en databasfunktion i stället för en UPDATE: en uppdateringspolicy
 * som tillåter att sätta `read_at` på någon annans rad hade också tillåtit att
 * ändra texten i den.
 */
export async function markThreadRead(adeptId: string): Promise<number> {
  await requireSessionUser();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_messages_read", {
    adept: adeptId,
  });

  if (error) return 0;
  revalidatePath(`${routes.adepts}/${adeptId}`);
  return (data as number) ?? 0;
}

export async function deleteMessage(
  id: string,
  adeptId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireSessionUser();

  const supabase = await createClient();
  const { error } = await supabase.from("coach_messages").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`${routes.adepts}/${adeptId}`);
  return { ok: true };
}
