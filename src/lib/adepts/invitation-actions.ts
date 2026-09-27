"use server";

import { revalidatePath } from "next/cache";

import { requireSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Tacka ja till en coach. Databasen kontrollerar att inbjudan gäller den
 * inloggades e-post och flyttar det adepten loggat till coachens adeptrad.
 */
export async function acceptCoachInvitation(
  invitationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSessionUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_coach_invitation", { invitation: invitationId });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app", "layout");
  return { ok: true };
}
