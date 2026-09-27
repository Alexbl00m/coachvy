import "server-only";

import { createClient } from "@/lib/supabase/server";

export type CoachInvitation = {
  id: string;
  coach_name: string;
  company_name: string | null;
  created_at: string;
};

/** Coacher som lagt till den inloggade adepten med dess e-post. */
export async function listCoachInvitations(): Promise<CoachInvitation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_coach_invitations");
  if (error) return [];
  return data ?? [];
}
