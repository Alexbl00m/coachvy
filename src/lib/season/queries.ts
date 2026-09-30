import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { AdeptRaceRow, TrainingBlockRow } from "@/lib/types/database";

const RACE_COLUMNS =
  "id, adept_id, name, race_date, sport, distance, priority, target, note, created_by, created_at, updated_at";
const BLOCK_COLUMNS =
  "id, adept_id, phase, starts_on, ends_on, focus, created_by, created_at, updated_at";

/** En tävling med adeptens namn, för vyer över flera adepter. */
export type RaceWithAdept = AdeptRaceRow & { adept_name: string };
export type BlockWithAdept = TrainingBlockRow & { adept_name: string };

/**
 * Tabellen finns inte ännu – migrationen för säsongen är inte körd. Då visas
 * appen som innan, utan tävlingar och perioder, i stället för att sidor som
 * översikten, passbyggaren och AI-coachen slutar fungera. PostgREST svarar
 * PGRST205 när tabellen saknas i schemat (äldre versioner Postgres egen
 * 42P01), och PGRST200 när frågan bäddar in adepten – relationen till en
 * tabell som inte finns går inte heller att hitta.
 */
const notMigrated = (error: { code?: string } | null) =>
  error?.code === "PGRST205" ||
  error?.code === "42P01" ||
  error?.code === "PGRST200";

type Embedded = {
  adepts: { full_name: string } | { full_name: string }[] | null;
};

const adeptName = (row: Embedded) => {
  const a = Array.isArray(row.adepts) ? row.adepts[0] : row.adepts;
  return a?.full_name ?? "";
};

/** En adepts tävlingar, i datumordning. */
export async function listRaces(adeptId: string): Promise<AdeptRaceRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("adept_races")
    .select(RACE_COLUMNS)
    .eq("adept_id", adeptId)
    .order("race_date", { ascending: true });

  if (notMigrated(error)) return [];
  if (error) throw new Error(`Kunde inte hämta tävlingarna: ${error.message}`);
  return (data ?? []) as AdeptRaceRow[];
}

/** En adepts perioder, i datumordning. */
export async function listBlocks(adeptId: string): Promise<TrainingBlockRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("training_blocks")
    .select(BLOCK_COLUMNS)
    .eq("adept_id", adeptId)
    .order("starts_on", { ascending: true });

  if (notMigrated(error)) return [];
  if (error) throw new Error(`Kunde inte hämta perioderna: ${error.message}`);
  return (data ?? []) as TrainingBlockRow[];
}

/**
 * Tävlingar mellan två datum, för alla adepter den inloggade ser.
 *
 * RLS avgör vilka: coachen får sina adepters, adepten sina egna. Därför
 * filtreras det inte på adept här.
 */
export async function listRacesBetween(
  from: string,
  to: string,
): Promise<RaceWithAdept[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("adept_races")
    .select(`${RACE_COLUMNS}, adepts(full_name)`)
    .gte("race_date", from)
    .lte("race_date", to)
    .order("race_date", { ascending: true });

  if (notMigrated(error)) return [];
  if (error) throw new Error(`Kunde inte hämta tävlingarna: ${error.message}`);
  return ((data ?? []) as unknown as (AdeptRaceRow & Embedded)[]).map(
    ({ adepts, ...race }) => ({ ...race, adept_name: adeptName({ adepts }) }),
  );
}

/** Perioder som berör intervallet, för alla adepter den inloggade ser. */
export async function listBlocksBetween(
  from: string,
  to: string,
): Promise<BlockWithAdept[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("training_blocks")
    .select(`${BLOCK_COLUMNS}, adepts(full_name)`)
    .lte("starts_on", to)
    .gte("ends_on", from)
    .order("starts_on", { ascending: true });

  if (notMigrated(error)) return [];
  if (error) throw new Error(`Kunde inte hämta perioderna: ${error.message}`);
  return ((data ?? []) as unknown as (TrainingBlockRow & Embedded)[]).map(
    ({ adepts, ...block }) => ({ ...block, adept_name: adeptName({ adepts }) }),
  );
}
