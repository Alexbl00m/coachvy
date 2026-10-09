"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/plan-library.generated";
import { TARGET_BASES, type TargetBasis } from "@/lib/workouts/schema";

import { parseStructure, structureSeconds } from "./structure";
import type { SeasonPhase, WeekKind } from "./types";

/**
 * Mallverktygen. Bara admin: varje åtgärd kontrollerar det, och RLS och
 * triggrarna i databasen gör det igen – och stoppar ändringar i en
 * publicerad version oavsett vem som försöker.
 */

export type AdminResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

const fail = (error: string): AdminResult => ({ ok: false, error });

/** Felmeddelandena från databasens lås är skrivna för människor. */
const dbError = (error: { message: string; code?: string }) =>
  error.code === "42501" || error.code === "23514" || error.code === "P0001"
    ? fail(error.message)
    : fail(`Det gick inte att spara: ${error.message ?? "okänt fel"}.`);

const text = (value: string | null | undefined, max: number) => {
  const t = (value ?? "").trim().slice(0, max);
  return t.length > 0 ? t : null;
};

const intOrNull = (value: number | null | undefined, min = 0) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? null
    : Math.max(min, Math.round(value));

const numOrNull = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? null
    : Math.max(0, value);

function refresh(templateId?: string) {
  revalidatePath(routes.planTemplates);
  revalidatePath(routes.planLibrary);
  if (templateId) revalidatePath(`${routes.planTemplates}/${templateId}`);
}

export async function slugify(title: string): Promise<string> {
  return (
    title
      .toLowerCase()
      .replace(/[åä]/g, "a")
      .replace(/ö/g, "o")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "plan"
  );
}

/** Mallens id för en version, för att uppdatera rätt sida. */
async function templateOf(versionId: string): Promise<string | undefined> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("plan_template_versions")
    .select("template_id")
    .eq("id", versionId)
    .maybeSingle();
  return data?.template_id;
}

// ---------------------------------------------------------------------------
// Mallen
// ---------------------------------------------------------------------------

const DEFAULT_LEVELS = [
  { rank: 3, key: "A", name: "Nivå A" },
  { rank: 2, key: "B", name: "Nivå B" },
  { rank: 1, key: "C", name: "Nivå C" },
];

const DEFAULT_PHASES: {
  name: string;
  season_phase: SeasonPhase;
  specificity: number;
  min_weeks: number;
  trim_order: number | null;
}[] = [
  {
    name: "Bas",
    season_phase: "grund",
    specificity: 1,
    min_weeks: 2,
    trim_order: 1,
  },
  {
    name: "Uppbyggnad",
    season_phase: "uppbyggnad",
    specificity: 3,
    min_weeks: 2,
    trim_order: 2,
  },
  {
    name: "Specifik",
    season_phase: "specifik",
    specificity: 4,
    min_weeks: 1,
    trim_order: null,
  },
  {
    name: "Taper",
    season_phase: "topp",
    specificity: 5,
    min_weeks: 1,
    trim_order: null,
  },
];

/**
 * En ny mall: version 1 som utkast, tre nivåer och fyra faser med en vecka
 * vardera att bygga vidare på. Allt går att ändra.
 */
export async function createTemplate(input: {
  title: string;
  categoryId: string | null;
}): Promise<AdminResult> {
  const user = await requireAdmin();
  const title = text(input.title, 120);
  if (!title) return fail("Ge mallen ett namn.");
  const supabase = await createClient();

  const base = await slugify(title);
  const { data: taken } = await supabase
    .from("plan_templates")
    .select("slug")
    .like("slug", `${base}%`);
  const used = new Set((taken ?? []).map((t) => t.slug));
  let slug = base;
  for (let i = 2; used.has(slug); i++) slug = `${base}-${i}`;

  const { data: template, error } = await supabase
    .from("plan_templates")
    .insert({ slug, category_id: input.categoryId, created_by: user.id })
    .select("id")
    .single();
  if (error) return dbError(error);

  const { data: version, error: vError } = await supabase
    .from("plan_template_versions")
    .insert({
      template_id: template.id,
      version: 1,
      title,
      // En vecka per fas till att börja med; kortaste längd följer med när
      // veckorna läggs till och numreras om.
      min_weeks: 4,
      max_weeks: 4,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (vError) return dbError(vError);

  const { error: lError } = await supabase
    .from("plan_template_levels")
    .insert(DEFAULT_LEVELS.map((l) => ({ ...l, version_id: version.id })));
  if (lError) return dbError(lError);

  const { data: phases, error: pError } = await supabase
    .from("plan_template_phases")
    .insert(
      DEFAULT_PHASES.map((p, i) => ({
        ...p,
        position: i + 1,
        version_id: version.id,
      })),
    )
    .select("id, position");
  if (pError) return dbError(pError);

  const { error: wError } = await supabase.from("plan_template_weeks").insert(
    phases
      .sort((a, b) => a.position - b.position)
      .map((p, i) => ({
        version_id: version.id,
        phase_id: p.id,
        position: i + 1,
      })),
  );
  if (wError) return dbError(wError);
  await supabase.rpc("reorder_plan_weeks", { draft: version.id });

  refresh(template.id);
  return { ok: true, id: template.id };
}

export async function updateTemplate(input: {
  templateId: string;
  slug: string;
  categoryId: string | null;
}): Promise<AdminResult> {
  await requireAdmin();
  const slug = await slugify(input.slug);
  const supabase = await createClient();
  const { error } = await supabase
    .from("plan_templates")
    .update({ slug, category_id: input.categoryId })
    .eq("id", input.templateId);
  if (error) {
    return error.code === "23505"
      ? fail("Adressen används redan av en annan mall.")
      : dbError(error);
  }
  refresh(input.templateId);
  return { ok: true };
}

export async function setTemplateArchived(
  templateId: string,
  archived: boolean,
): Promise<AdminResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("plan_templates")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", templateId);
  if (error) return dbError(error);
  refresh(templateId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Versionen
// ---------------------------------------------------------------------------

export async function saveVersionMeta(input: {
  versionId: string;
  title: string;
  summary: string;
  goal: string;
  description: string;
  prerequisites: string;
  minWeeks: number;
  volumeUnit: "km" | "h";
}): Promise<AdminResult> {
  await requireAdmin();
  const title = text(input.title, 120);
  if (!title) return fail("Ge planen ett namn.");
  const supabase = await createClient();
  const { data: version } = await supabase
    .from("plan_template_versions")
    .select("max_weeks")
    .eq("id", input.versionId)
    .maybeSingle();
  if (!version) return fail("Versionen finns inte.");
  const minWeeks = Math.round(input.minWeeks);
  if (!(minWeeks >= 1) || minWeeks > version.max_weeks) {
    return fail(`Kortaste längd ska vara 1–${version.max_weeks} veckor.`);
  }
  const { error } = await supabase
    .from("plan_template_versions")
    .update({
      title,
      summary: text(input.summary, 300),
      goal: text(input.goal, 600),
      description: text(input.description, 6000),
      prerequisites: text(input.prerequisites, 2000),
      min_weeks: minWeeks,
      volume_unit: input.volumeUnit === "h" ? "h" : "km",
    })
    .eq("id", input.versionId);
  if (error) return dbError(error);
  refresh(await templateOf(input.versionId));
  return { ok: true };
}

export async function publishVersion(versionId: string): Promise<AdminResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_plan_version", {
    draft: versionId,
  });
  if (error) return dbError(error);
  refresh(await templateOf(versionId));
  return { ok: true };
}

export async function newDraft(templateId: string): Promise<AdminResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("new_plan_draft", {
    template: templateId,
  });
  if (error) return dbError(error);
  refresh(templateId);
  return { ok: true, id: data };
}

/** Tar bort ett utkast. En mall utan versioner tas bort helt. */
export async function deleteDraft(versionId: string): Promise<AdminResult> {
  await requireAdmin();
  const supabase = await createClient();
  const templateId = await templateOf(versionId);
  const { error } = await supabase
    .from("plan_template_versions")
    .delete()
    .eq("id", versionId)
    .eq("status", "utkast");
  if (error) return dbError(error);
  if (templateId) {
    const { count } = await supabase
      .from("plan_template_versions")
      .select("id", { count: "exact", head: true })
      .eq("template_id", templateId);
    if (count === 0) {
      await supabase.from("plan_templates").delete().eq("id", templateId);
    }
  }
  refresh(templateId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Nivåer och faser
// ---------------------------------------------------------------------------

export type IntensityInput = { låg: number; medel: number; hög: number } | null;

const intensityJson = (value: IntensityInput): Json | null => {
  if (!value) return null;
  const parts = [value.låg, value.medel, value.hög].map((n) =>
    Math.max(0, Math.round(n || 0)),
  );
  if (parts.every((n) => n === 0)) return null;
  return { låg: parts[0], medel: parts[1], hög: parts[2] };
};

export type LevelInput = {
  id: string | null;
  key: string;
  name: string;
  description: string;
  hoursMin: number | null;
  hoursMax: number | null;
  sessionsMin: number | null;
  sessionsMax: number | null;
  intensity: IntensityInput;
};

/**
 * Sparar nivåerna i den ordning de står, högst först. En nivå som tas bort
 * tar sina varianter med sig.
 */
export async function saveLevels(input: {
  versionId: string;
  levels: LevelInput[];
}): Promise<AdminResult> {
  await requireAdmin();
  if (input.levels.length === 0) return fail("Planen behöver minst en nivå.");
  const keys = input.levels.map((l) => (l.key ?? "").trim());
  if (keys.some((k) => !k || k.length > 12)) {
    return fail("Varje nivå behöver en kort beteckning, högst 12 tecken.");
  }
  if (new Set(keys.map((k) => k.toLowerCase())).size !== keys.length) {
    return fail("Två nivåer har samma beteckning.");
  }
  if (input.levels.some((l) => !text(l.name, 80))) {
    return fail("Varje nivå behöver ett namn.");
  }
  const supabase = await createClient();
  const { data: existing, error } = await supabase
    .from("plan_template_levels")
    .select("id")
    .eq("version_id", input.versionId);
  if (error) return dbError(error);

  const keep = new Set(input.levels.map((l) => l.id).filter(Boolean));
  const removed = existing.filter((e) => !keep.has(e.id)).map((e) => e.id);
  if (removed.length > 0) {
    const { error: dError } = await supabase
      .from("plan_template_levels")
      .delete()
      .in("id", removed);
    if (dError) return dbError(dError);
  }
  // Ranken och beteckningen är unika: flytta undan först, så att två nivåer
  // kan byta plats.
  for (const [i, level] of input.levels.entries()) {
    if (!level.id) continue;
    const { error: tError } = await supabase
      .from("plan_template_levels")
      .update({ rank: 1000 + i, key: `~${i}` })
      .eq("id", level.id);
    if (tError) return dbError(tError);
  }
  const n = input.levels.length;
  for (const [i, level] of input.levels.entries()) {
    const row = {
      version_id: input.versionId,
      rank: n - i,
      key: keys[i],
      name: text(level.name, 80)!,
      description: text(level.description, 1000),
      hours_min: numOrNull(level.hoursMin),
      hours_max: numOrNull(level.hoursMax),
      sessions_min: intOrNull(level.sessionsMin),
      sessions_max: intOrNull(level.sessionsMax),
      intensity: intensityJson(level.intensity),
    };
    const { error: sError } = level.id
      ? await supabase
          .from("plan_template_levels")
          .update(row)
          .eq("id", level.id)
      : await supabase.from("plan_template_levels").insert(row);
    if (sError) return dbError(sError);
  }
  refresh(await templateOf(input.versionId));
  return { ok: true };
}

export type PhaseInput = {
  id: string | null;
  name: string;
  seasonPhase: SeasonPhase | null;
  purpose: string;
  focus: string;
  specificity: number | null;
  intensity: IntensityInput;
  minWeeks: number;
  /** Kortas fasen när planen görs kortare? Ordningen är fasernas egen. */
  trimOrder: number | null;
};

/** Sparar faserna i den ordning de står och numrerar om veckorna efter dem. */
export async function savePhases(input: {
  versionId: string;
  phases: PhaseInput[];
}): Promise<AdminResult> {
  await requireAdmin();
  if (input.phases.length === 0) return fail("Planen behöver minst en fas.");
  if (input.phases.some((p) => !text(p.name, 80))) {
    return fail("Varje fas behöver ett namn.");
  }
  const supabase = await createClient();
  const { data: existing, error } = await supabase
    .from("plan_template_phases")
    .select("id")
    .eq("version_id", input.versionId);
  if (error) return dbError(error);

  const keep = new Set(input.phases.map((p) => p.id).filter(Boolean));
  const removed = existing.filter((e) => !keep.has(e.id)).map((e) => e.id);
  if (removed.length > 0) {
    const { error: dError } = await supabase
      .from("plan_template_phases")
      .delete()
      .in("id", removed);
    if (dError) return dbError(dError);
  }
  for (const [i, phase] of input.phases.entries()) {
    if (!phase.id) continue;
    const { error: tError } = await supabase
      .from("plan_template_phases")
      .update({ position: 1000 + i })
      .eq("id", phase.id);
    if (tError) return dbError(tError);
  }
  for (const [i, phase] of input.phases.entries()) {
    const row = {
      version_id: input.versionId,
      position: i + 1,
      name: text(phase.name, 80)!,
      season_phase: phase.seasonPhase,
      purpose: text(phase.purpose, 1000),
      focus: text(phase.focus, 1000),
      specificity:
        phase.specificity === null
          ? null
          : Math.min(5, Math.max(1, Math.round(phase.specificity))),
      intensity: intensityJson(phase.intensity),
      min_weeks: Math.max(0, Math.round(phase.minWeeks || 0)),
      trim_order:
        phase.trimOrder === null
          ? null
          : Math.max(1, Math.round(phase.trimOrder)),
    };
    if (phase.id) {
      const { error: sError } = await supabase
        .from("plan_template_phases")
        .update(row)
        .eq("id", phase.id);
      if (sError) return dbError(sError);
    } else {
      // En ny fas får en första vecka, så att den syns i veckovyn.
      const { data, error: sError } = await supabase
        .from("plan_template_phases")
        .insert(row)
        .select("id")
        .single();
      if (sError) return dbError(sError);
      const { error: wError } = await supabase
        .from("plan_template_weeks")
        .insert({
          version_id: input.versionId,
          phase_id: data.id,
          position: 90000 + i,
        });
      if (wError) return dbError(wError);
    }
  }
  const { error: rError } = await supabase.rpc("reorder_plan_weeks", {
    draft: input.versionId,
  });
  if (rError) return dbError(rError);
  refresh(await templateOf(input.versionId));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Veckor
// ---------------------------------------------------------------------------

export async function addWeek(input: {
  versionId: string;
  phaseId: string;
}): Promise<AdminResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plan_template_weeks")
    .insert({
      version_id: input.versionId,
      phase_id: input.phaseId,
      position: 90000 + Math.floor(Math.random() * 9000),
    })
    .select("id")
    .single();
  if (error) return dbError(error);
  const { error: rError } = await supabase.rpc("reorder_plan_weeks", {
    draft: input.versionId,
  });
  if (rError) return dbError(rError);
  refresh(await templateOf(input.versionId));
  return { ok: true, id: data.id };
}

export async function copyWeek(weekId: string): Promise<AdminResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("copy_plan_week", {
    week: weekId,
  });
  if (error) return dbError(error);
  revalidatePath(routes.planTemplates, "layout");
  return { ok: true, id: data };
}

export async function deleteWeek(input: {
  versionId: string;
  weekId: string;
}): Promise<AdminResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("plan_template_weeks")
    .delete()
    .eq("id", input.weekId);
  if (error) return dbError(error);
  const { error: rError } = await supabase.rpc("reorder_plan_weeks", {
    draft: input.versionId,
  });
  if (rError) return dbError(rError);
  refresh(await templateOf(input.versionId));
  return { ok: true };
}

export async function saveWeek(input: {
  weekId: string;
  kind: WeekKind;
  title: string;
  note: string;
  checkpoint: boolean;
}): Promise<AdminResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("plan_template_weeks")
    .update({
      kind: input.kind,
      title: text(input.title, 120),
      note: text(input.note, 2000),
      checkpoint: input.checkpoint,
    })
    .eq("id", input.weekId);
  if (error) return dbError(error);
  revalidatePath(routes.planTemplates, "layout");
  return { ok: true };
}

/**
 * Veckans volym per nivå. En nivå utan tal har ingen volym angiven; ett
 * spann sparas som min och max.
 */
export async function saveWeekVolumes(input: {
  versionId: string;
  weekId: string;
  volumes: { levelId: string; min: number | null; max: number | null }[];
}): Promise<AdminResult> {
  await requireAdmin();
  const rows: {
    version_id: string;
    week_id: string;
    level_id: string;
    volume_min: number;
    volume_max: number | null;
  }[] = [];
  const clear: string[] = [];
  for (const v of input.volumes) {
    const min = v.min !== null && Number.isFinite(v.min) ? v.min : null;
    const max = v.max !== null && Number.isFinite(v.max) ? v.max : null;
    if (min === null) {
      if (max !== null) return fail("Ange det lägre talet först.");
      clear.push(v.levelId);
      continue;
    }
    if (min < 0 || min > 1000) return fail("Volymen ska vara 0–1000.");
    if (max !== null && max < min) {
      return fail("Spannets övre tal ska vara minst lika stort som det lägre.");
    }
    rows.push({
      version_id: input.versionId,
      week_id: input.weekId,
      level_id: v.levelId,
      volume_min: min,
      volume_max: max !== null && max > min ? max : null,
    });
  }
  const supabase = await createClient();
  if (clear.length > 0) {
    const { error } = await supabase
      .from("plan_template_week_volumes")
      .delete()
      .eq("week_id", input.weekId)
      .in("level_id", clear);
    if (error) return dbError(error);
  }
  if (rows.length > 0) {
    const { error } = await supabase
      .from("plan_template_week_volumes")
      .upsert(rows, { onConflict: "week_id,level_id" });
    if (error) return dbError(error);
  }
  revalidatePath(routes.planTemplates, "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Pass
// ---------------------------------------------------------------------------

export type VariantInput = {
  levelId: string;
  included: boolean;
  description: string;
  durationMin: number | null;
  distanceKm: number | null;
  zone: string;
  basis: TargetBasis | null;
  /** Strukturen som text, se structure.ts. Tom: passet beskrivs i ord. */
  structure: string;
};

export type SessionInput = {
  id: string | null;
  versionId: string;
  weekId: string;
  day: number | null;
  discipline: string;
  type: string;
  title: string;
  description: string;
  variants: VariantInput[];
};

export async function saveSession(input: SessionInput): Promise<AdminResult> {
  await requireAdmin();
  const title = text(input.title, 120);
  if (!title) return fail("Ge passet ett namn.");
  if (input.day !== null && !(input.day >= 0 && input.day <= 6)) {
    return fail("Ogiltig dag.");
  }
  const included = input.variants.filter((v) => v.included);
  if (included.length === 0) {
    return fail("Passet ingår inte på någon nivå – ta bort det i stället.");
  }

  // Strukturen tolkas här också: det som sparas har gått genom tolken.
  const parsed = new Map<
    string,
    { blocks: Json | null; basis: TargetBasis | null; seconds: number | null }
  >();
  for (const v of included) {
    const raw = v.structure.trim();
    if (!raw) {
      parsed.set(v.levelId, { blocks: null, basis: null, seconds: null });
      continue;
    }
    if (!v.basis || !TARGET_BASES.includes(v.basis)) {
      return fail(
        "Välj vad procenten räknas mot (FTP, CP, CS, CSS, LT2, 5 km-fart eller maratonfart).",
      );
    }
    if (raw.includes("@") && v.basis !== "MP") {
      return fail(
        "Zoner som @LO och @MT räknas mot maratonfart – välj Maratonfart som bas, eller skriv procent.",
      );
    }
    const result = parseStructure(raw);
    if (!result.ok) return fail(result.error);
    parsed.set(v.levelId, {
      blocks: result.blocks as unknown as Json,
      basis: v.basis,
      seconds: structureSeconds(result.blocks),
    });
  }

  const supabase = await createClient();
  const row = {
    version_id: input.versionId,
    week_id: input.weekId,
    day: input.day,
    discipline: input.discipline,
    type: text(input.type, 60),
    title,
    description: text(input.description, 2000),
  };
  let sessionId = input.id;
  if (sessionId) {
    const { error } = await supabase
      .from("plan_template_sessions")
      .update(row)
      .eq("id", sessionId);
    if (error) return dbError(error);
  } else {
    const { data, error } = await supabase
      .from("plan_template_sessions")
      .insert(row)
      .select("id")
      .single();
    if (error) return dbError(error);
    sessionId = data.id;
  }

  const excluded = input.variants
    .filter((v) => !v.included)
    .map((v) => v.levelId);
  if (excluded.length > 0) {
    const { error } = await supabase
      .from("plan_template_session_variants")
      .delete()
      .eq("session_id", sessionId)
      .in("level_id", excluded);
    if (error) return dbError(error);
  }
  const { error: vError } = await supabase
    .from("plan_template_session_variants")
    .upsert(
      included.map((v) => {
        const p = parsed.get(v.levelId)!;
        const minutes = numOrNull(v.durationMin);
        return {
          version_id: input.versionId,
          session_id: sessionId!,
          level_id: v.levelId,
          description: text(v.description, 2000),
          duration_s:
            minutes !== null && minutes > 0
              ? Math.round(minutes * 60)
              : p.seconds,
          distance_m:
            v.distanceKm !== null && v.distanceKm > 0
              ? Math.round(v.distanceKm * 1000)
              : null,
          zone: text(v.zone, 40),
          basis: p.basis,
          blocks: p.blocks,
        };
      }),
      { onConflict: "session_id,level_id" },
    );
  if (vError) return dbError(vError);

  revalidatePath(routes.planTemplates, "layout");
  return { ok: true, id: sessionId };
}

export async function deleteSession(sessionId: string): Promise<AdminResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("plan_template_sessions")
    .delete()
    .eq("id", sessionId);
  if (error) return dbError(error);
  revalidatePath(routes.planTemplates, "layout");
  return { ok: true };
}
