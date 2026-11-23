import "server-only";

import { listBlocks } from "@/lib/season/queries";
import { todayIso } from "@/lib/season/season";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { AiPlanDraftRow, TrainingBlockRow } from "@/lib/types/database";

import {
  parseDraft,
  type DraftPeriod,
  type DraftWeek,
  type PlanDraft,
} from "./draft";
import { checkForAdept, type ToolContext } from "./tools";

const notMigrated = (error: { code?: string } | null) =>
  error?.code === "PGRST205" || error?.code === "42P01";

const overlaps = (
  a: { starts_on: string; ends_on: string },
  b: { starts_on: string; ends_on: string },
) => a.starts_on <= b.ends_on && a.ends_on >= b.starts_on;

/** Perioderna i kalendern som ett förslag krockar med. */
export async function periodConflicts(
  adeptId: string,
  draft: PlanDraft,
): Promise<TrainingBlockRow[]> {
  if (draft.periods.length === 0) return [];
  const existing = await listBlocks(adeptId);
  return existing.filter((b) => draft.periods.some((p) => overlaps(b, p)));
}

/** Ett planförslag som kortet i chatten visar det. */
export type DraftView = {
  id: string;
  messageId: string | null;
  status: AiPlanDraftRow["status"];
  title: string;
  idea: string;
  periods: DraftPeriod[];
  weeks: DraftWeek[];
  warnings: string[];
  /** Det som hindrar inläggningen nu, till exempel datum som passerat. */
  errors: string[];
  /** Perioder i kalendern som förslagets perioder krockar med. */
  conflicts: string[];
  /** Nya pass som sparas i biblioteket när planen läggs in. */
  newSessions: string[];
  /** Första passets datum, för länken till kalendern. */
  firstDate: string | null;
  appliedAt: string | null;
  applied: { workouts: number; periods: number; library: number } | null;
};

/**
 * Trådens planförslag, kontrollerade på nytt. Ett förslag som väntar prövas
 * mot dagens datum och bibliotek, så att kortet visar om det fortfarande går
 * att lägga in. Inlagda och förkastade visas som de var när de gjordes.
 * Ersatta förslag visas inte; det nyare står i tråden.
 */
export async function listDraftViews(
  conversationId: string,
  adeptId: string,
  userId: string,
): Promise<DraftView[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_plan_drafts")
    .select("*")
    .eq("conversation_id", conversationId)
    .neq("status", "ersatt")
    .order("created_at", { ascending: true });
  if (notMigrated(error)) return [];
  if (error)
    throw new Error(`Kunde inte hämta planförslagen: ${error.message}`);
  const rows = (data ?? []) as AiPlanDraftRow[];
  if (rows.length === 0) return [];

  // Biblioteket och referenserna hämtas en gång för alla förslag.
  const ctx: ToolContext = { adeptId, conversationId, userId, cache: {} };
  const today = todayIso();
  const views: DraftView[] = [];
  for (const row of rows) {
    const parsed = parseDraft(row.plan);
    if (!parsed.ok) continue;
    const draft = parsed.draft;
    const waiting = row.status === "förslag";
    let check: Awaited<ReturnType<typeof checkForAdept>>;
    let conflicts: TrainingBlockRow[];
    try {
      check = await checkForAdept(
        draft,
        ctx,
        waiting ? today : row.created_at.slice(0, 10),
      );
      conflicts = waiting ? await periodConflicts(adeptId, draft) : [];
    } catch {
      // Ett förslag som inte går att räkna på stoppar inte tråden.
      continue;
    }
    views.push({
      id: row.id,
      messageId: row.message_id,
      status: row.status,
      title: draft.title,
      idea: draft.idea,
      periods: draft.periods,
      weeks: check.weeks,
      warnings: check.warnings,
      errors: waiting ? check.errors : [],
      conflicts: conflicts.map(
        (b) => `${b.name ?? b.phase} ${b.starts_on} – ${b.ends_on}`,
      ),
      newSessions: draft.formats
        .filter((f) => f.new_session)
        .map((f) => f.new_session!.title),
      firstDate: check.sessions[0]?.date ?? draft.periods[0]?.starts_on ?? null,
      appliedAt: row.applied_at,
      applied: row.applied
        ? {
            workouts: row.applied.workouts.length,
            periods: row.applied.blocks.length,
            library: row.applied.library.length,
          }
        : null,
    });
  }
  return views;
}
