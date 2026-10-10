#!/usr/bin/env node
/**
 * Genererar TypeScript-typerna för planbibliotekets tabeller ur databasen.
 *
 *   DATABASE_URL=postgres://… npm run db:types
 *
 * Läser kolumner, standardvärden, null-barhet och check-villkor (`x in (…)`
 * blir en union) med psql och skriver src/lib/types/plan-library.generated.ts
 * i samma form som `supabase gen types`: Row, Insert, Update per tabell, och
 * Args/Returns per funktion. Resten av appens typer är fortfarande
 * handskrivna i database.ts, som tar in de genererade.
 */

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Sätt DATABASE_URL till databasen typerna ska läsas ur.");
  process.exit(1);
}

const TABLES = [
  "plan_library_settings",
  "plan_categories",
  "disciplines",
  "plan_templates",
  "plan_template_versions",
  "plan_template_levels",
  "plan_template_phases",
  "plan_template_weeks",
  "plan_template_sessions",
  "plan_template_session_variants",
  "plan_template_week_volumes",
  "plan_instances",
  "plan_level_changes",
  "plan_session_overrides",
  "plan_session_logs",
  "plan_ai_suggestions",
  "plan_instance_events",
  "fitness_estimates",
  "session_library",
];

const FUNCTIONS = [
  "publish_plan_version",
  "new_plan_draft",
  "reorder_plan_weeks",
  "copy_plan_week",
  "can_read_plan_library",
  "can_read_plan_version",
  "can_edit_plan",
  "plan_week_of",
];

const query = `
select json_build_object(
  'columns', (
    select json_agg(json_build_object(
      'table', c.table_name,
      'name', c.column_name,
      'type', c.udt_name,
      'nullable', c.is_nullable = 'YES',
      'hasDefault', c.column_default is not null
    ) order by c.table_name, c.ordinal_position)
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = any($tables$)
  ),
  'checks', (
    select json_agg(json_build_object(
      'table', t.relname,
      'def', pg_get_constraintdef(k.oid)
    ))
    from pg_constraint k
    join pg_class t on t.oid = k.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and k.contype = 'c' and t.relname = any($tables$)
  ),
  'functions', (
    select json_agg(json_build_object(
      'name', p.proname,
      'args', coalesce(p.proargnames, '{}'),
      'argTypes', (select json_agg(format_type(t, null)) from unnest(p.proargtypes) t),
      'returns', format_type(p.prorettype, null)
    ))
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any($functions$)
  )
)`
  .replaceAll("$tables$", `array[${TABLES.map((t) => `'${t}'`).join(",")}]`)
  .replaceAll(
    "$functions$",
    `array[${FUNCTIONS.map((f) => `'${f}'`).join(",")}]`,
  );

const raw = execFileSync("psql", [url, "-At", "-c", query], {
  encoding: "utf8",
});
const schema = JSON.parse(raw);

const BASE = {
  uuid: "string",
  text: "string",
  date: "string",
  timestamptz: "string",
  int2: "number",
  int4: "number",
  int8: "number",
  numeric: "number",
  bool: "boolean",
  boolean: "boolean",
  integer: "number",
  smallint: "number",
  jsonb: "Json",
  json: "Json",
  void: "undefined",
};

/** `status in ('a', 'b')` som Postgres skriver det: = ANY (ARRAY['a'::text, …]). */
function unions(table) {
  const out = new Map();
  for (const { table: t, def } of schema.checks ?? []) {
    if (t !== table) continue;
    const match = def.match(/\(+(\w+) = ANY \(+ARRAY\[(.+?)\]\)+/);
    if (!match) continue;
    // Bara villkor som är precis en uppräkning, eventuellt med "is null or".
    if (/\b(and|<>|>|<)\b/.test(def.replace(match[0], ""))) continue;
    const values = [...match[2].matchAll(/'((?:[^']|'')*)'::text/g)].map(
      (m) => m[1],
    );
    if (values.length > 0) out.set(match[1], values);
  }
  return out;
}

const quote = (s) => JSON.stringify(s);

let ts = `/**
 * GENERERAD – ändra inte för hand. Kör \`npm run db:types\` efter en migration.
 *
 * Typerna för planbibliotekets tabeller och funktioner, lästa ur databasen
 * (scripts/generate-plan-types.mjs).
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type PlanLibraryTables = {
`;

for (const table of TABLES) {
  const columns = schema.columns.filter((c) => c.table === table);
  if (columns.length === 0) {
    console.error(`Tabellen ${table} finns inte. Har migrationen körts?`);
    process.exit(1);
  }
  const enums = unions(table);
  const typeOf = (c) => {
    const base = enums.has(c.name)
      ? enums
          .get(c.name)
          .map((v) => quote(v))
          .join(" | ")
      : (BASE[c.type] ?? "unknown");
    return c.nullable ? `${base} | null` : base;
  };
  const row = columns.map((c) => `        ${c.name}: ${typeOf(c)};`);
  const insert = columns.map(
    (c) =>
      `        ${c.name}${c.nullable || c.hasDefault ? "?" : ""}: ${typeOf(c)};`,
  );
  const update = columns.map((c) => `        ${c.name}?: ${typeOf(c)};`);
  ts += `  ${table}: {
      Row: {
${row.join("\n")}
      };
      Insert: {
${insert.join("\n")}
      };
      Update: {
${update.join("\n")}
      };
      Relationships: [];
    };
`;
}
ts += `};

export type PlanLibraryFunctions = {
`;
for (const name of FUNCTIONS) {
  const fn = (schema.functions ?? []).find((f) => f.name === name);
  if (!fn) {
    console.error(`Funktionen ${name} finns inte. Har migrationen körts?`);
    process.exit(1);
  }
  const argTypes = fn.argTypes ?? [];
  const pgBase = (t) =>
    BASE[
      {
        "timestamp with time zone": "timestamptz",
        integer: "int4",
      }[t] ?? t
    ] ?? "unknown";
  const args =
    argTypes.length === 0
      ? "Record<string, never>"
      : `{ ${argTypes.map((t, i) => `${fn.args[i]}: ${pgBase(t)}`).join("; ")} }`;
  ts += `  ${name}: {
    Args: ${args};
    Returns: ${pgBase(fn.returns)};
  };
`;
}
ts += `};
`;

const here = dirname(fileURLToPath(import.meta.url));
const out = join(
  here,
  "..",
  "src",
  "lib",
  "types",
  "plan-library.generated.ts",
);
writeFileSync(out, ts);
console.log(`Skrev ${out}`);
