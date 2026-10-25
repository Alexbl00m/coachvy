import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

import type { Audience, Author, Share, ShareKind, ShareStatus } from "./shares";

export type { ShareKind } from "./shares";

/** Tabellen eller funktionerna finns inte ännu – migrationen är inte körd. */
const notMigrated = (error: { code?: string } | null) =>
  error?.code === "PGRST205" ||
  error?.code === "PGRST202" ||
  error?.code === "42P01" ||
  error?.code === "42883";

/**
 * Mottagarna för ägarens pass eller planer, per id. Andras pass och planer
 * ger inga rader – det avgör databasen.
 */
export async function listSharesFor(
  kind: ShareKind,
  ids: string[],
): Promise<Map<string, Share[]>> {
  const out = new Map<string, Share[]>();
  if (!isSupabaseConfigured() || ids.length === 0) return out;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("library_share_list", {
    p_sessions: kind === "pass" ? ids : [],
    p_templates: kind === "plan" ? ids : [],
  });
  if (error) {
    if (notMigrated(error)) return out;
    throw new Error(`Kunde inte läsa delningarna: ${error.message}`);
  }
  for (const row of data ?? []) {
    if (!row.id || !row.item_id) continue;
    const share: Share = {
      id: row.id,
      audience: row.audience as Audience,
      status: row.status as ShareStatus,
      reviewNote: row.review_note,
      adeptId: row.adept_id,
      adeptName: row.adept_name,
      coachId: row.coach_id,
      coachName: row.coach_name,
    };
    out.set(row.item_id, [...(out.get(row.item_id) ?? []), share]);
  }
  return out;
}

export async function listShares(
  kind: ShareKind,
  id: string,
): Promise<Share[]> {
  return (await listSharesFor(kind, [id])).get(id) ?? [];
}

/** Namnen bakom det den inloggade ser, per ägare. */
export async function listAuthors(
  ownerIds: string[],
): Promise<Map<string, Author>> {
  const out = new Map<string, Author>();
  const ids = [...new Set(ownerIds.filter(Boolean))];
  if (!isSupabaseConfigured() || ids.length === 0) return out;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("library_authors", {
    p_owners: ids,
  });
  if (error) {
    if (notMigrated(error)) return out;
    throw new Error(`Kunde inte läsa namnen: ${error.message}`);
  }
  for (const row of data ?? []) {
    if (!row.id) continue;
    out.set(row.id, {
      id: row.id,
      name: row.name,
      company: row.company,
      coachvy: row.coachvy === true,
    });
  }
  return out;
}

export type ReviewItem = {
  id: string;
  kind: ShareKind;
  itemId: string;
  title: string;
  slug: string | null;
  ownerName: string | null;
  status: ShareStatus;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

/** Det coacher delat med alla medlemmar, det som väntar först. Bara admin. */
export async function listReviewQueue(): Promise<ReviewItem[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("library_review_queue");
  if (error) {
    if (notMigrated(error)) return [];
    throw new Error(`Kunde inte läsa granskningen: ${error.message}`);
  }
  return (data ?? []).flatMap((row) =>
    row.id && row.item_id && row.created_at
      ? [
          {
            id: row.id,
            kind: row.kind === "plan" ? "plan" : "pass",
            itemId: row.item_id,
            title: row.title ?? "Utan namn",
            slug: row.slug,
            ownerName: row.owner_name,
            status: row.status as ShareStatus,
            reviewNote: row.review_note,
            createdAt: row.created_at,
            reviewedAt: row.reviewed_at,
          } satisfies ReviewItem,
        ]
      : [],
  );
}
