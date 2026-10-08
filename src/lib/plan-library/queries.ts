import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { PlanLibraryTables } from "@/lib/types/plan-library.generated";
import type { TargetBasis, WorkoutBlock } from "@/lib/workouts/schema";

import type {
  Level,
  Phase,
  TemplateSession,
  TemplateWeek,
  Variant,
} from "./types";

export type Row<T extends keyof PlanLibraryTables> =
  PlanLibraryTables[T]["Row"];

export type VersionRow = Row<"plan_template_versions">;
export type TemplateRow = Row<"plan_templates">;
export type CategoryRow = Row<"plan_categories">;
export type DisciplineRow = Row<"disciplines">;
export type LevelRow = Row<"plan_template_levels">;
export type PhaseRow = Row<"plan_template_phases">;
export type WeekRow = Row<"plan_template_weeks">;
export type SessionRow = Row<"plan_template_sessions">;
export type VariantRow = Row<"plan_template_session_variants">;

/**
 * Tabellerna finns inte ännu – migrationen för planbiblioteket är inte körd.
 * Då är biblioteket tomt i stället för att sidan går sönder.
 */
const notMigrated = (error: { code?: string } | null) =>
  error?.code === "PGRST205" || error?.code === "42P01";

type DbError = { code?: string; message: string };
type Result = { data: unknown; error: DbError | null };

function fail(error: DbError, what: string) {
  if (notMigrated(error)) return;
  throw new Error(`Kunde inte hämta ${what}: ${error.message}`);
}

/** Raderna, eller inga när tabellen saknas. */
function rows<R extends Result>(result: R, what: string) {
  if (result.error) fail(result.error, what);
  return (result.data ?? []) as NonNullable<R["data"]>;
}

/** En rad, eller null. */
function one<R extends Result>(result: R, what: string) {
  if (result.error) fail(result.error, what);
  return (result.data ?? null) as NonNullable<R["data"]> | null;
}

// ---------------------------------------------------------------------------
// Rader till planbibliotekets begrepp
// ---------------------------------------------------------------------------

export const toLevel = (r: LevelRow): Level => ({
  id: r.id,
  rank: r.rank,
  key: r.key,
  name: r.name,
});

export const toPhase = (r: PhaseRow): Phase => ({
  id: r.id,
  position: r.position,
  name: r.name,
  minWeeks: r.min_weeks,
  trimOrder: r.trim_order,
  seasonPhase: r.season_phase,
});

export const toWeek = (r: WeekRow): TemplateWeek => ({
  id: r.id,
  phaseId: r.phase_id,
  position: r.position,
  kind: r.kind,
});

export const toVariant = (r: VariantRow): Variant => ({
  levelId: r.level_id,
  description: r.description,
  durationS: r.duration_s,
  distanceM: r.distance_m,
  zone: r.zone,
  basis: r.basis as TargetBasis | null,
  blocks: (r.blocks as WorkoutBlock[] | null) ?? null,
});

export const toSession = (
  r: SessionRow,
  variants: VariantRow[],
): TemplateSession => ({
  id: r.id,
  weekId: r.week_id,
  day: r.day,
  position: r.position,
  discipline: r.discipline,
  type: r.type,
  title: r.title,
  description: r.description,
  variants: variants.filter((v) => v.session_id === r.id).map(toVariant),
});

// ---------------------------------------------------------------------------
// Uppslag
// ---------------------------------------------------------------------------

export async function listCategories(): Promise<CategoryRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  return rows(
    await supabase.from("plan_categories").select("*").order("sort"),
    "målen",
  );
}

export async function listDisciplines(): Promise<DisciplineRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  return rows(
    await supabase.from("disciplines").select("*").order("sort"),
    "disciplinerna",
  );
}

// ---------------------------------------------------------------------------
// En version med allt innehåll
// ---------------------------------------------------------------------------

export type VersionContent = {
  template: TemplateRow;
  version: VersionRow;
  category: CategoryRow | null;
  levels: LevelRow[];
  phases: PhaseRow[];
  weeks: WeekRow[];
  sessions: SessionRow[];
  variants: VariantRow[];
  /** Samma sak som planbibliotekets begrepp, för logiken. */
  domain: {
    levels: Level[];
    phases: Phase[];
    weeks: TemplateWeek[];
    sessions: TemplateSession[];
  };
};

export async function loadVersion(
  versionId: string,
): Promise<VersionContent | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();

  const version = one(
    await supabase
      .from("plan_template_versions")
      .select("*")
      .eq("id", versionId)
      .maybeSingle(),
    "versionen",
  );
  if (!version) return null;

  const [template, levels, phases, weeks, sessions, variants] =
    await Promise.all([
      supabase
        .from("plan_templates")
        .select("*")
        .eq("id", version.template_id)
        .maybeSingle(),
      supabase
        .from("plan_template_levels")
        .select("*")
        .eq("version_id", versionId)
        .order("rank", { ascending: false }),
      supabase
        .from("plan_template_phases")
        .select("*")
        .eq("version_id", versionId)
        .order("position"),
      supabase
        .from("plan_template_weeks")
        .select("*")
        .eq("version_id", versionId)
        .order("position"),
      supabase
        .from("plan_template_sessions")
        .select("*")
        .eq("version_id", versionId)
        .order("position"),
      supabase
        .from("plan_template_session_variants")
        .select("*")
        .eq("version_id", versionId),
    ]);

  const templateRow = one(template, "mallen");
  if (!templateRow) return null;
  const content = {
    levels: rows(levels, "nivåerna"),
    phases: rows(phases, "faserna"),
    weeks: rows(weeks, "veckorna"),
    sessions: rows(sessions, "passen"),
    variants: rows(variants, "varianterna"),
  };

  let category: CategoryRow | null = null;
  if (templateRow.category_id) {
    category = one(
      await supabase
        .from("plan_categories")
        .select("*")
        .eq("id", templateRow.category_id)
        .maybeSingle(),
      "målet",
    );
  }

  return {
    template: templateRow,
    version,
    category,
    ...content,
    domain: {
      levels: content.levels.map(toLevel),
      phases: content.phases.map(toPhase),
      weeks: content.weeks.map(toWeek),
      sessions: content.sessions.map((s) => toSession(s, content.variants)),
    },
  };
}

// ---------------------------------------------------------------------------
// Admin: mallarna med alla versioner
// ---------------------------------------------------------------------------

export type AdminTemplate = TemplateRow & {
  category: CategoryRow | null;
  versions: Pick<
    VersionRow,
    "id" | "version" | "status" | "title" | "updated_at" | "published_at"
  >[];
  instances: number;
};

export async function listAdminTemplates(): Promise<AdminTemplate[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const [templates, versions, categories, instances] = await Promise.all([
    supabase
      .from("plan_templates")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("plan_template_versions")
      .select(
        "id, template_id, version, status, title, updated_at, published_at",
      )
      .order("version", { ascending: false }),
    supabase.from("plan_categories").select("*"),
    supabase.from("plan_instances").select("template_id"),
  ]);
  const vs = rows(versions, "versionerna");
  const cs = rows(categories, "målen");
  const is = rows(instances, "planerna");
  return rows(templates, "mallarna").map((t) => ({
    ...t,
    category: cs.find((c) => c.id === t.category_id) ?? null,
    versions: vs.filter((v) => v.template_id === t.id),
    instances: is.filter((i) => i.template_id === t.id).length,
  }));
}

// ---------------------------------------------------------------------------
// Biblioteket: publicerade mallar
// ---------------------------------------------------------------------------

export type LibraryEntry = {
  template: TemplateRow;
  version: VersionRow;
  category: CategoryRow | null;
  levels: LevelRow[];
  phases: (Pick<PhaseRow, "id" | "name" | "position" | "specificity"> & {
    weeks: number;
  })[];
};

export async function listLibrary(): Promise<LibraryEntry[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const [templates, versions, categories, levels, phases, weeks] =
    await Promise.all([
      supabase.from("plan_templates").select("*").is("archived_at", null),
      supabase
        .from("plan_template_versions")
        .select("*")
        .eq("status", "publicerad"),
      supabase.from("plan_categories").select("*").order("sort"),
      supabase
        .from("plan_template_levels")
        .select("*")
        .order("rank", { ascending: false }),
      supabase
        .from("plan_template_phases")
        .select("id, version_id, name, position, specificity")
        .order("position"),
      supabase.from("plan_template_weeks").select("phase_id"),
    ]);
  const ts = rows(templates, "mallarna");
  const cs = rows(categories, "målen");
  const ls = rows(levels, "nivåerna");
  const ps = rows(phases, "faserna");
  const ws = rows(weeks, "veckorna");
  const entries: LibraryEntry[] = [];
  for (const version of rows(versions, "versionerna")) {
    const template = ts.find((t) => t.id === version.template_id);
    if (!template) continue;
    entries.push({
      template,
      version,
      category: cs.find((c) => c.id === template.category_id) ?? null,
      levels: ls.filter((l) => l.version_id === version.id),
      phases: ps
        .filter((p) => p.version_id === version.id)
        .map((p) => ({
          ...p,
          weeks: ws.filter((w) => w.phase_id === p.id).length,
        })),
    });
  }
  // Målens ordning, sedan titeln.
  return entries.sort(
    (a, b) =>
      (a.category?.sort ?? 999) - (b.category?.sort ?? 999) ||
      a.version.title.localeCompare(b.version.title, "sv"),
  );
}

/** Den publicerade versionen av en mall, med innehåll. */
export async function loadPublishedBySlug(
  slug: string,
): Promise<VersionContent | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const template = one(
    await supabase
      .from("plan_templates")
      .select("id")
      .eq("slug", slug)
      .maybeSingle(),
    "mallen",
  );
  if (!template) return null;
  const version = one(
    await supabase
      .from("plan_template_versions")
      .select("id")
      .eq("template_id", template.id)
      .eq("status", "publicerad")
      .maybeSingle(),
    "versionen",
  );
  return version ? loadVersion(version.id) : null;
}

// ---------------------------------------------------------------------------
// Medlemmens planer
// ---------------------------------------------------------------------------

export type InstanceRow = Row<"plan_instances">;
export type LevelChangeRow = Row<"plan_level_changes">;
export type OverrideRow = Row<"plan_session_overrides">;
export type LogRow = Row<"plan_session_logs">;
export type SuggestionRow = Row<"plan_ai_suggestions">;
export type EventRow = Row<"plan_instance_events">;

/** En adepts planer, den senast startade först. */
export async function listInstances(adeptId: string): Promise<InstanceRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  return rows(
    await supabase
      .from("plan_instances")
      .select("*")
      .eq("adept_id", adeptId)
      .order("created_at", { ascending: false }),
    "planerna",
  );
}

export async function getActiveInstance(
  adeptId: string,
): Promise<InstanceRow | null> {
  const all = await listInstances(adeptId);
  return all.find((i) => i.status === "aktiv") ?? null;
}

export type InstanceContent = {
  instance: InstanceRow;
  content: VersionContent;
  changes: LevelChangeRow[];
  overrides: OverrideRow[];
  logs: LogRow[];
  suggestions: SuggestionRow[];
  events: EventRow[];
};

/** En plan med sin version och allt medlemmen gjort i den. */
export async function loadInstance(
  instanceId: string,
): Promise<InstanceContent | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const instance = one(
    await supabase
      .from("plan_instances")
      .select("*")
      .eq("id", instanceId)
      .maybeSingle(),
    "planen",
  );
  if (!instance) return null;
  const [content, changes, overrides, logs, suggestions, events] =
    await Promise.all([
      loadVersion(instance.version_id),
      supabase
        .from("plan_level_changes")
        .select("*")
        .eq("instance_id", instanceId)
        .order("created_at"),
      supabase
        .from("plan_session_overrides")
        .select("*")
        .eq("instance_id", instanceId),
      supabase
        .from("plan_session_logs")
        .select("*")
        .eq("instance_id", instanceId),
      supabase
        .from("plan_ai_suggestions")
        .select("*")
        .eq("instance_id", instanceId)
        .order("created_at", { ascending: false }),
      supabase
        .from("plan_instance_events")
        .select("*")
        .eq("instance_id", instanceId)
        .order("created_at"),
    ]);
  if (!content) return null;
  return {
    instance,
    content,
    changes: rows(changes, "nivåhistoriken"),
    overrides: rows(overrides, "ändringarna"),
    logs: rows(logs, "loggen"),
    suggestions: rows(suggestions, "förslagen"),
    events: rows(events, "händelserna"),
  };
}
