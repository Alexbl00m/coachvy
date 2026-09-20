import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { AiConversationRow, AiMessageRow } from "@/lib/types/database";

/**
 * Coachens tråd om en adept.
 *
 * En tråd per adept och coach. Trådarna är coachens arbetsanteckningar om
 * atleten, inte ett samtal med henne – adepten ser dem inte, och det säger
 * gränssnittet rakt ut så att ingen skriver något där i tron att det gör det.
 */
export async function getConversation(
  adeptId: string,
  coachId: string,
): Promise<AiConversationRow | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("id, adept_id, created_by, title, created_at, updated_at")
    .eq("adept_id", adeptId)
    .eq("created_by", coachId)
    .maybeSingle();

  if (error) throw new Error(`Kunde inte hämta samtalet: ${error.message}`);
  return (data ?? null) as AiConversationRow | null;
}

/** Meddelandena i en tråd, äldst först. */
export async function listAiMessages(
  conversationId: string,
): Promise<AiMessageRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_messages")
    .select("id, conversation_id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Kunde inte hämta meddelandena: ${error.message}`);
  return (data ?? []) as AiMessageRow[];
}
