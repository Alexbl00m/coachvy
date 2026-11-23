"use server";

import { revalidatePath } from "next/cache";

import type { Sport } from "@/lib/calculators/lactate";
import { requireAdmin } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/plan-library.generated";

import { atlasRows, SESSION_ATLAS } from "./seed";

export type AtlasStatus = {
  sport: Sport;
  total: number;
  /** Pass ur atlasen som redan finns hos den inloggade admin. */
  present: number;
};

const key = (title: string, sport: string) => `${sport}\u0000${title}`;

async function presentKeys(ownerId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("session_library")
    .select("title, sport")
    .eq("owner_id", ownerId);
  return new Set((data ?? []).map((r) => key(r.title, r.sport)));
}

/** Hur många av de färdiga passen per gren som redan finns i biblioteket. */
export async function atlasStatus(): Promise<AtlasStatus[]> {
  const user = await requireAdmin();
  const present = await presentKeys(user.id);
  const sports: Sport[] = ["cykling", "löpning", "simning"];
  return sports.map((sport) => {
    const rows = SESSION_ATLAS.filter((s) => s.sport === sport);
    return {
      sport,
      total: rows.length,
      present: rows.filter((r) => present.has(key(r.title, r.sport))).length,
    };
  });
}

export type AtlasImportResult = {
  ok: boolean;
  added: number;
  failed: string[];
};

/**
 * Läser in de färdiga pass som saknas – cykelatlasen, löppassen och
 * simpassen – med den inloggade admin som ägare, delade med alla coacher.
 * Ett pass med samma namn och gren hoppas över, så ett pass som ändrats
 * skrivs inte över. Samma regel som `seed.ts` följer när atlasen läses in
 * med SQL.
 */
export async function importSessionAtlas(): Promise<AtlasImportResult> {
  const user = await requireAdmin();
  const supabase = await createClient();
  const present = await presentKeys(user.id);
  const missing = atlasRows().filter(
    (row) => !present.has(key(row.title, row.sport)),
  );

  let added = 0;
  const failed: string[] = [];
  const now = Date.now();
  for (const [i, row] of missing.entries()) {
    // Biblioteket visar det senast ändrade först: atlasens ordning behålls.
    const stamp = new Date(now - i * 1000).toISOString();
    const { data, error } = await supabase
      .from("session_library")
      .insert({
        owner_id: user.id,
        title: row.title,
        sport: row.sport,
        kind: row.kind || null,
        intensity: row.intensity || null,
        purpose: row.purpose || null,
        description: row.description || null,
        progression: row.progression || null,
        adaptations: row.adaptations || null,
        fueling: row.fueling || null,
        timing: row.timing || null,
        phases: row.phases,
        basis: row.basis,
        structure: row.structure,
        blocks: row.blocks as unknown as Json,
        levels: row.levels as unknown as Json,
        created_at: stamp,
        updated_at: stamp,
      } as never)
      .select("id")
      .single();
    if (error || !data) {
      failed.push(`${row.title}: ${error?.message ?? "okänt fel"}`);
      continue;
    }
    const { error: shareError } = await supabase.from("library_shares").insert({
      session_id: (data as { id: string }).id,
      audience: "coacher",
      created_by: user.id,
    } as never);
    if (shareError) {
      failed.push(`${row.title} (delningen): ${shareError.message}`);
      continue;
    }
    added += 1;
  }

  revalidatePath(routes.admin);
  revalidatePath(routes.sessionLibrary);
  return { ok: failed.length === 0, added, failed };
}
