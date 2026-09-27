import "server-only";

import type { SessionUser } from "@/lib/auth/session";
import { protocolByKey } from "@/lib/tests/protocols";
import { createClient } from "@/lib/supabase/server";
import type { CommunityChannel, CommunityFeedItem } from "@/lib/types/database";

export const PAGE_SIZE = 30;

export async function getFeed(
  channel: CommunityChannel | null,
  before: string | null = null,
): Promise<CommunityFeedItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("community_feed", {
    p_channel: channel,
    p_before: before,
    p_limit: PAGE_SIZE,
  });
  if (error) throw new Error(`Kunde inte hämta flödet: ${error.message}`);
  return data ?? [];
}

export type Shareable = { kind: "workout" | "test"; id: string; label: string };

/**
 * Det den inloggade kan dela: pass den får läsa, och – för en adept – egna
 * testresultat. Coachen delar inte adepternas tester; det är adeptens beslut.
 */
export async function getShareables(user: SessionUser): Promise<Shareable[]> {
  const supabase = await createClient();
  const items: Shareable[] = [];

  const { data: workouts } = await supabase
    .from("workouts")
    .select("id, title, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  for (const w of workouts ?? []) {
    items.push({ kind: "workout", id: w.id, label: `Pass: ${w.title}` });
  }

  if (user.adept) {
    const { data: tests } = await supabase
      .from("test_sessions")
      .select("id, protocol, performed_on")
      .eq("adept_id", user.adept.id)
      .order("performed_on", { ascending: false })
      .limit(20);
    for (const t of tests ?? []) {
      items.push({
        kind: "test",
        id: t.id,
        label: `Test: ${protocolByKey(t.protocol)?.label ?? t.protocol} ${t.performed_on}`,
      });
    }
  }

  return items;
}
