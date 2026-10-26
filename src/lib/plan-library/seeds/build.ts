/**
 * Färdiga planer som data, och SQL av dem.
 *
 * En plan skrivs som faser med veckor, och varje vecka som pass med en
 * struktur per nivå i samma textform som mallverktyget läser
 * (`structure.ts`). Ett pass utan variant på en nivå görs inte på den
 * nivån. Veckans volym räknas ur passen, så att den alltid stämmer med det
 * som står i veckan.
 *
 * `checkSeed` kontrollerar planen som mallverktyget gör innan publicering,
 * och att en vanlig veckas timmar ryms i nivåns spann. `seedSql` gör SQL
 * som går att köra igen: finns adressen redan hoppas planen över.
 *
 * Modulen är ren.
 */

import { createHash } from "node:crypto";

import type { PlanFocus } from "../focus";
import { parseStructure, structureSeconds } from "../structure";
import type { SeasonPhase, WeekKind } from "../types";
import { validateVersion } from "../validate";

export type LevelKey = "A" | "B" | "C" | "D";
export const LEVEL_KEYS: LevelKey[] = ["A", "B", "C", "D"];

export type Mix = { låg: number; medel: number; hög: number };

export type SeedLevel = {
  key: LevelKey;
  name: string;
  description: string;
  hours: [number, number];
  sessions: [number, number];
  intensity: Mix;
};

/** Ett pass: struktur per nivå, eller för styrka bara en längd i minuter. */
export type SeedSession = {
  day: number;
  discipline: "cykling" | "löpning" | "styrka";
  type: string;
  title: string;
  description: string;
  zone: string | null;
  variants: Partial<Record<LevelKey, string | { minutes: number }>>;
};

export type SeedWeek = {
  kind: WeekKind;
  title: string;
  note?: string;
  checkpoint?: boolean;
  sessions: SeedSession[];
};

export type SeedPhase = {
  name: string;
  seasonPhase: SeasonPhase;
  purpose: string;
  focus: string;
  specificity: number;
  intensity: Mix;
  minWeeks: number;
  trimOrder: number | null;
  weeks: SeedWeek[];
};

export type PlanSeed = {
  slug: string;
  category: string;
  focus: PlanFocus | null;
  /** Vad passens mål är andelar av: FTP för cykel, maratonfart (MP) för löpning med zoner. */
  basis?: "FTP" | "MP";
  /** Loppet planen leder mot, i meter, för löpplanernas tempon. */
  raceMetres?: number | null;
  title: string;
  summary: string;
  goal: string;
  description: string;
  prerequisites: string;
  minWeeks: number;
  levels: SeedLevel[];
  phases: SeedPhase[];
};

/** Samma id varje gång för samma del av planen, så att SQL:en är stabil. */
export function seedId(...parts: (string | number)[]): string {
  const h = createHash("sha256").update(parts.join("/")).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const weeksOf = (seed: PlanSeed) => seed.phases.flatMap((p) => p.weeks);

/** Passets längd i sekunder på en nivå, eller null om det inte görs där. */
export function variantSeconds(
  v: string | { minutes: number } | undefined,
): number | null {
  if (v === undefined) return null;
  if (typeof v !== "string") return v.minutes * 60;
  const parsed = parseStructure(v);
  return parsed.ok ? structureSeconds(parsed.blocks) : null;
}

/** Veckans timmar per nivå, ur passen. */
export function weekHours(week: SeedWeek): Record<LevelKey, number> {
  const out = { A: 0, B: 0, C: 0, D: 0 };
  for (const s of week.sessions) {
    for (const key of LEVEL_KEYS) {
      out[key] += (variantSeconds(s.variants[key]) ?? 0) / 3600;
    }
  }
  return out;
}

/** Fel som stoppar planen. Tomt när den går igenom. */
export function checkSeed(seed: PlanSeed): string[] {
  const errors: string[] = [];
  const weeks = weeksOf(seed);

  seed.phases.forEach((phase) => {
    phase.weeks.forEach((week, wi) => {
      week.sessions.forEach((s) => {
        for (const [key, v] of Object.entries(s.variants)) {
          if (typeof v !== "string") continue;
          const parsed = parseStructure(v);
          if (!parsed.ok) {
            errors.push(`${phase.name} v${wi + 1} ${s.title} ${key}: ${parsed.error}`);
          }
        }
      });
      // I toppningen sjunker volymen med avsikt.
      if (week.kind !== "normal" || phase.seasonPhase === "topp") return;
      const hours = weekHours(week);
      for (const level of seed.levels) {
        const h = hours[level.key];
        const [lo, hi] = level.hours;
        // En vanlig vecka ska rymmas i nivåns spann, med lite marginal.
        if (h < lo * 0.85 || h > hi * 1.1) {
          errors.push(
            `${phase.name} v${wi + 1}, nivå ${level.key}: ${h.toFixed(1)} h, nivån är ${lo}–${hi} h.`,
          );
        }
      }
    });
  });

  // Samma kontroll som mallverktyget gör.
  const levelIds = seed.levels.map((l) => ({
    id: l.key,
    rank: 4 - LEVEL_KEYS.indexOf(l.key),
    key: l.key,
    name: l.name,
  }));
  let position = 0;
  const phases = seed.phases.map((p, i) => ({
    id: `p${i}`,
    position: i + 1,
    name: p.name,
    minWeeks: p.minWeeks,
    trimOrder: p.trimOrder,
    seasonPhase: p.seasonPhase,
  }));
  const tWeeks = seed.phases.flatMap((p, i) =>
    p.weeks.map((w) => ({
      id: `w${++position}`,
      phaseId: `p${i}`,
      position,
      kind: w.kind,
    })),
  );
  let wi = 0;
  const sessions = seed.phases.flatMap((p) =>
    p.weeks.flatMap((w) => {
      const weekId = `w${++wi}`;
      return w.sessions.map((s, si) => ({
        id: `${weekId}s${si}`,
        weekId,
        day: s.day,
        position: si + 1,
        discipline: s.discipline,
        type: s.type,
        title: s.title,
        description: s.description,
        variants: Object.keys(s.variants).map((k) => ({
          levelId: k,
          description: null,
          durationS: null,
          distanceM: null,
          zone: null,
          basis: null,
          blocks: null,
        })),
      }));
    }),
  );
  for (const issue of validateVersion({
    levels: levelIds,
    phases,
    weeks: tWeeks,
    sessions,
    minWeeks: seed.minWeeks,
  })) {
    if (issue.level === "fel") errors.push(issue.text);
  }
  if (weeks.length < seed.minWeeks) {
    errors.push(`Planen har ${weeks.length} veckor men kortast ${seed.minWeeks}.`);
  }
  return errors;
}

const lit = (v: string | number | null | undefined) =>
  v === null || v === undefined
    ? "null"
    : typeof v === "number"
      ? String(v)
      : `'${v.replace(/'/g, "''")}'`;
const json = (v: unknown) => `${lit(JSON.stringify(v))}::jsonb`;
const round1 = (n: number) => Math.round(n * 10) / 10;

type Row = Record<string, string | number | boolean | null | object>;

export type SeedRows = {
  template: {
    id: string;
    slug: string;
    category: string;
    focus: string | null;
    race_distance_m: number | null;
  };
  version: Row;
  levels: Row[];
  phases: Row[];
  weeks: Row[];
  sessions: Row[];
  variants: Row[];
  volumes: Row[];
};

/**
 * Planens rader, med kolumnnamnen som nycklar. Ägare och kategori-id sätts
 * av den som läser in: SQL-skriptet eller inläsningen i appen.
 */
export function seedRows(seed: PlanSeed): SeedRows {
  const errors = checkSeed(seed);
  if (errors.length) throw new Error(`${seed.slug}:\n${errors.join("\n")}`);

  const t = seedId(seed.slug, "template");
  const v = seedId(seed.slug, "version");
  const levelId = (k: LevelKey) => seedId(seed.slug, "level", k);
  const rows: SeedRows = {
    template: {
      id: t,
      slug: seed.slug,
      category: seed.category,
      focus: seed.focus,
      race_distance_m: seed.raceMetres ?? null,
    },
    version: {
      id: v,
      template_id: t,
      version: 1,
      status: "utkast",
      title: seed.title,
      summary: seed.summary,
      goal: seed.goal,
      description: seed.description,
      prerequisites: seed.prerequisites,
      min_weeks: seed.minWeeks,
      max_weeks: weeksOf(seed).length,
      volume_unit: "h",
    },
    levels: seed.levels.map((l) => ({
      id: levelId(l.key),
      version_id: v,
      rank: 4 - LEVEL_KEYS.indexOf(l.key),
      key: l.key,
      name: l.name,
      description: l.description,
      hours_min: l.hours[0],
      hours_max: l.hours[1],
      sessions_min: l.sessions[0],
      sessions_max: l.sessions[1],
      intensity: l.intensity,
    })),
    phases: seed.phases.map((p, i) => ({
      id: seedId(seed.slug, "phase", i),
      version_id: v,
      position: i + 1,
      name: p.name,
      season_phase: p.seasonPhase,
      purpose: p.purpose,
      focus: p.focus,
      specificity: p.specificity,
      intensity: p.intensity,
      min_weeks: p.minWeeks,
      trim_order: p.trimOrder,
    })),
    weeks: [],
    sessions: [],
    variants: [],
    volumes: [],
  };

  let position = 0;
  seed.phases.forEach((p, pi) => {
    p.weeks.forEach((w) => {
      position += 1;
      const wid = seedId(seed.slug, "week", position);
      rows.weeks.push({
        id: wid,
        version_id: v,
        phase_id: seedId(seed.slug, "phase", pi),
        position,
        kind: w.kind,
        title: w.title,
        note: w.note ?? null,
        checkpoint: Boolean(w.checkpoint),
      });
      const hours = weekHours(w);
      for (const l of seed.levels) {
        const h = hours[l.key];
        if (h <= 0) continue;
        rows.volumes.push({
          version_id: v,
          week_id: wid,
          level_id: levelId(l.key),
          volume_min: round1(h * 0.95),
          volume_max: round1(h * 1.05),
        });
      }
      w.sessions.forEach((s, si) => {
        const sid = seedId(seed.slug, "session", position, si);
        rows.sessions.push({
          id: sid,
          version_id: v,
          week_id: wid,
          day: s.day,
          position: si + 1,
          discipline: s.discipline,
          type: s.type,
          title: s.title,
          description: s.description,
        });
        for (const key of LEVEL_KEYS) {
          const variant = s.variants[key];
          if (variant === undefined) continue;
          const base = {
            version_id: v,
            session_id: sid,
            level_id: levelId(key),
            description: null,
            distance_m: null,
            zone: s.zone,
          };
          if (typeof variant !== "string") {
            rows.variants.push({ ...base, duration_s: variant.minutes * 60, basis: null, blocks: null });
            continue;
          }
          const parsed = parseStructure(variant);
          if (!parsed.ok) throw new Error(parsed.error);
          rows.variants.push({
            ...base,
            duration_s: structureSeconds(parsed.blocks),
            basis: seed.basis ?? "FTP",
            blocks: parsed.blocks,
          });
        }
      });
    });
  });
  return rows;
}

/** Ett uttryck som skrivs som det står, till exempel en variabel i SQL:en. */
const sql = (expression: string) => ({ __sql: expression });

const value = (v: unknown): string =>
  v === null || v === undefined
    ? "null"
    : typeof v === "object" && "__sql" in (v as object)
      ? (v as { __sql: string }).__sql
      : typeof v === "object"
      ? json(v)
      : typeof v === "boolean"
        ? String(v)
        : lit(v as string | number);

/** En insert av rader med samma kolumner. */
function insert(table: string, rows: Row[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  return (
    `  insert into public.${table} (${cols.join(", ")}) values\n` +
    rows.map((r) => `    (${cols.map((c) => value(r[c])).join(", ")})`).join(",\n") +
    ";"
  );
}

/**
 * SQL för en plan: mallen, en version som utkast och allt innehåll, ägd
 * av ägaren och delad med medlemmar och coacher. Hoppas över om adressen
 * redan finns. Publiceras sedan med publish_plan_version, som kontrollerar
 * planen en gång till.
 */
export function seedSql(seed: PlanSeed, owner: string): string {
  const r = seedRows(seed);
  const t = r.template;
  return [
    `-- ${seed.title}`,
    "do $$",
    `declare v_owner uuid := ${owner};`,
    "begin",
    `  if exists (select 1 from public.plan_templates where slug = ${lit(t.slug)}) then return; end if;`,
    `  insert into public.plan_templates (id, slug, category_id, focus, race_distance_m, created_by, owner_id) values (${lit(t.id)}, ${lit(t.slug)}, (select id from public.plan_categories where key = ${lit(t.category)}), ${lit(t.focus)}, ${lit(t.race_distance_m)}, v_owner, v_owner);`,
    insert("plan_template_versions", [{ ...r.version, created_by: sql("v_owner") }]),
    insert("plan_template_levels", r.levels),
    insert("plan_template_phases", r.phases),
    insert("plan_template_weeks", r.weeks),
    insert("plan_template_sessions", r.sessions),
    insert("plan_template_session_variants", r.variants),
    insert("plan_template_week_volumes", r.volumes),
    `  insert into public.library_shares (template_id, audience, created_by) values (${lit(t.id)}, 'medlemmar', v_owner), (${lit(t.id)}, 'coacher', v_owner) on conflict do nothing;`,
    "end;",
    "$$;",
  ].join("\n");
}
