import "server-only";

import { adeptSwimPaces } from "@/lib/adepts/swim-paces";
import type { SwimPaces } from "@/lib/workouts/swim-pace";

import type Anthropic from "@anthropic-ai/sdk";

import {
  listScheduledWorkouts,
  listSessionsBetween,
} from "@/lib/calendar/queries";
import { loadRunningFitness } from "@/lib/plan-library/fitness";
import { listRaces, listSeasonBlocks } from "@/lib/season/queries";
import { addDays, daysBetween, todayIso } from "@/lib/season/season";
import type { LibrarySession } from "@/lib/session-library/library";
import { listLibrary } from "@/lib/session-library/queries";
import { createClient } from "@/lib/supabase/server";
import { PROTOCOLS } from "@/lib/tests/protocols";
import { TRAINING_PHASES } from "@/lib/tests/phases";
import { contextForAdept } from "@/lib/workouts/generate";
import type { TargetBasis } from "@/lib/workouts/schema";

import {
  checkDraft,
  checkSummary,
  parseDraft,
  type CheckContext,
  type LibraryRef,
  type PlanDraft,
} from "./draft";

/**
 * Verktygen AI-chatten planerar med. Tre läser – biblioteket, kalendern och
 * det senaste förslaget – och ett föreslår. Inget verktyg skriver i
 * kalendern: förslaget sparas och läggs in först när coachen godkänner det.
 */

const ISO = { type: "string", description: "ÅÅÅÅ-MM-DD" } as const;
const nullable = (schema: Record<string, unknown>) => ({
  anyOf: [schema, { type: "null" }],
});

export const PLANNING_TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "bibliotek",
    description:
      "Söker i coachens passbibliotek. Ger varje pass med id, typ, syfte, bas, passraden (nivå B) och nivåerna A och C, som är samma format i mer och mindre mängd. Välj pass härifrån i första hand. Ange gren; utan sökord kommer hela grenens bibliotek.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        sport: { type: "string", enum: ["cykling", "löpning", "simning"] },
        typ: {
          type: "string",
          description:
            "Passets typ, t.ex. Kvalitet, Distans, Kraft, Återhämtning, Test.",
        },
        sok: {
          type: "string",
          description:
            "Ord i namn, syfte eller intensitet, t.ex. tröskel, VO2max, torque.",
        },
      },
    },
  },
  {
    name: "kalender",
    description:
      "Det som redan ligger i adeptens kalender mellan två datum: säsongens perioder, planerade pass med TSS, tävlingar och tester. Läs den innan du föreslår, så att förslaget inte krockar.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: { fran: ISO, till: ISO },
      required: ["fran", "till"],
    },
  },
  {
    name: "foresla_plan",
    description:
      "Föreslår perioder och pass för adepten. Förslaget kontrolleras mot biblioteket och filosofin och visas för coachen, som lägger in det i kalendern med en knapp. Svaret säger om förslaget sparades, och ger fel, varningar och veckornas summor. Ett nytt anrop ersätter förra förslaget. Pass bygger på format: ett pass ur biblioteket (library_id) eller ett nytt pass (new_session) som sparas i biblioteket. Varje pass i kalendern pekar på ett format och kan ge veckans dos som passrad.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Planens namn." },
        idea: {
          type: "string",
          description:
            "Idén i två till fyra meningar: vilken egenskap planen utvecklar, vilken begränsning den påverkar, hur den bidrar till tävlingen och hur formaten byggs på.",
        },
        periods: {
          type: "array",
          description:
            "Säsongens perioder att lägga in, eller en tom lista. Perioderna får inte överlappa varandra.",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              phase: {
                type: "string",
                enum: TRAINING_PHASES.map((p) => p.key),
              },
              starts_on: ISO,
              ends_on: ISO,
              focus: {
                type: "string",
                description: "Periodens fokus i en mening.",
              },
            },
            required: ["name", "phase", "starts_on", "ends_on", "focus"],
          },
        },
        formats: {
          type: "array",
          description: "De återkommande passen planen byggs av.",
          items: {
            type: "object",
            properties: {
              key: {
                type: "string",
                description: "Kort nyckel, t.ex. torque, hog, distans.",
              },
              library_id: nullable({ type: "string" }),
              new_session: nullable({
                type: "object",
                description:
                  "Ett nytt pass när inget i biblioteket passar. Skriv det som ett format som kan återkomma.",
                properties: {
                  title: { type: "string" },
                  sport: {
                    type: "string",
                    enum: ["cykling", "löpning", "simning"],
                  },
                  kind: {
                    type: "string",
                    description:
                      "Kvalitet, Distans, Kraft, Återhämtning, Långpass, Test.",
                  },
                  intensity: {
                    type: "string",
                    description: "Intensiteten i ord: Tröskel, VO2max.",
                  },
                  purpose: {
                    type: "string",
                    description: "Vilken egenskap passet utvecklar.",
                  },
                  description: {
                    type: "string",
                    description: "Utförandet: hur det ska kännas.",
                  },
                  progression: {
                    type: "string",
                    description: "Hur passet byggs på, en variabel i taget.",
                  },
                  basis: {
                    type: "string",
                    enum: [
                      "FTP",
                      "CP",
                      "LT2",
                      "CS",
                      "CSS",
                      "5K",
                      "10K",
                      "HM",
                      "MP",
                    ],
                  },
                  structure: { type: "string", description: "Passraden." },
                },
                required: [
                  "title",
                  "sport",
                  "kind",
                  "intensity",
                  "purpose",
                  "progression",
                  "basis",
                  "structure",
                ],
              }),
              test_protocol: nullable({
                type: "string",
                enum: PROTOCOLS.map((p) => p.key),
                description: "Protokollet när formatet är en del av ett test.",
              }),
            },
            required: ["key"],
          },
        },
        sessions: {
          type: "array",
          description: "Passen dag för dag.",
          items: {
            type: "object",
            properties: {
              date: ISO,
              format: { type: "string", description: "Nyckeln för formatet." },
              structure: nullable({
                type: "string",
                description:
                  "Veckans dos som passrad, när den skiljer sig från formatets.",
              }),
              level: nullable({ type: "string", enum: ["A", "B", "C"] }),
              note: nullable({
                type: "string",
                description: "En rad till adepten om passet.",
              }),
            },
            required: ["date", "format"],
          },
        },
      },
      required: ["title", "idea", "periods", "formats", "sessions"],
    },
  },
  {
    name: "hamta_forslag",
    description:
      "Hämtar det senaste planförslaget i tråden som det sparades, för att ändra i det.",
    eager_input_streaming: true,
    input_schema: { type: "object", properties: {} },
  },
];

export type ToolContext = {
  adeptId: string;
  conversationId: string;
  userId: string;
  /** Biblioteket och referenserna, hämtade en gång per fråga. */
  cache: {
    library?: LibrarySession[];
    speeds?: Partial<Record<TargetBasis, number>>;
    /** Adeptens CSS och tävlingsfart i simning; null utan CSS. */
    swim?: SwimPaces | null;
  };
};

export type ToolOutcome = {
  content: string;
  isError: boolean;
  /** Förslaget som sparades av anropet. */
  draftId?: string;
};

const json = (value: unknown) => JSON.stringify(value);
const short = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

async function library(ctx: ToolContext) {
  ctx.cache.library ??= await listLibrary();
  return ctx.cache.library;
}

/** Referenserna stegen i meter får sin tid ur: FTP i W, farterna i m/s. */
async function speeds(ctx: ToolContext) {
  if (!ctx.cache.speeds) {
    const [cycling, running, swimming] = await Promise.all([
      contextForAdept(ctx.adeptId, "cykling"),
      loadRunningFitness(ctx.adeptId),
      contextForAdept(ctx.adeptId, "simning"),
    ]);
    const out: Partial<Record<TargetBasis, number>> = { ...running.refs };
    if (cycling?.basis && cycling.reference)
      out[cycling.basis] = cycling.reference;
    const css =
      swimming?.basis === "CSS" && swimming.reference
        ? swimming.reference
        : null;
    if (css) out.CSS = css;
    ctx.cache.swim = await adeptSwimPaces(ctx.adeptId, css);
    ctx.cache.speeds = out;
  }
  return ctx.cache.speeds;
}

const toRef = (s: LibrarySession): LibraryRef => ({
  id: s.id,
  title: s.title,
  sport: s.sport,
  kind: s.kind,
  intensity: s.intensity,
  basis: s.basis,
  blocks: s.blocks,
  structure: s.structure,
  levels: s.levels.map((l) => ({
    key: l.key,
    blocks: l.blocks,
    structure: l.structure,
  })),
});

async function searchLibrary(input: Record<string, unknown>, ctx: ToolContext) {
  const sport = typeof input.sport === "string" ? input.sport : null;
  const kind = typeof input.typ === "string" ? input.typ.toLowerCase() : null;
  const words =
    typeof input.sok === "string"
      ? input.sok.toLowerCase().split(/\s+/).filter(Boolean)
      : [];
  const hits = (await library(ctx)).filter((s) => {
    if (sport && s.sport !== sport) return false;
    if (kind && s.kind.toLowerCase() !== kind) return false;
    const text =
      `${s.title} ${s.intensity} ${s.purpose} ${s.kind}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
  const list = hits.slice(0, 60).map((s) => ({
    id: s.id,
    namn: s.title,
    gren: s.sport,
    typ: s.kind,
    intensitet: s.intensity,
    bas: s.basis,
    syfte: short(s.purpose, 220),
    progression: short(s.progression, 220),
    faser: s.phases,
    passrad: s.structure,
    ...(s.levels.length > 0
      ? {
          nivå_A: s.levels.find((l) => l.key === "A")?.structure,
          nivå_C: s.levels.find((l) => l.key === "C")?.structure,
        }
      : {}),
  }));
  return json({
    antal: hits.length,
    visade: list.length,
    pass: list,
    ...(hits.length > list.length ? { obs: "Fler finns; sök snävare." } : {}),
  });
}

async function readCalendar(input: Record<string, unknown>, ctx: ToolContext) {
  const from = typeof input.fran === "string" ? input.fran : todayIso();
  let to = typeof input.till === "string" ? input.till : addDays(from, 42);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new Error("fran och till ska vara ÅÅÅÅ-MM-DD.");
  }
  if (daysBetween(from, to) > 200) to = addDays(from, 200);
  const [blocks, workouts, races, tests] = await Promise.all([
    listSeasonBlocks(ctx.adeptId),
    listScheduledWorkouts(from, to, ctx.adeptId),
    listRaces(ctx.adeptId),
    listSessionsBetween(from, to, ctx.adeptId),
  ]);
  return json({
    fran: from,
    till: to,
    perioder: blocks
      .filter((b) => b.ends_on >= from && b.starts_on <= to)
      .map((b) => ({
        namn: b.name ?? b.phase,
        fas: b.phase,
        från: b.starts_on,
        till: b.ends_on,
        fokus: b.focus,
        ...(b.plan ? { ur_plan: b.plan.title } : {}),
      })),
    pass: workouts.map((w) => ({
      datum: w.date,
      namn: w.title,
      gren: w.sport,
      ...(w.load ? { tss: Math.round(w.load.tss) } : {}),
      ...(w.goal ? { huvudsyfte: w.goal } : {}),
      ...(w.fromPlan ? { ur_plan: true } : {}),
      ...(w.testProtocol ? { test: w.testProtocol } : {}),
    })),
    tävlingar: races
      .filter((r) => r.race_date >= from && r.race_date <= to)
      .map((r) => ({
        datum: r.race_date,
        namn: r.name,
        prioritet: r.priority,
      })),
    tester: tests.map((t) => ({ datum: t.date, test: t.label })),
  });
}

export async function checkForAdept(
  draft: PlanDraft,
  ctx: ToolContext,
  /** Dagen datumen prövas mot; i dag om inget annat sägs. */
  today = todayIso(),
) {
  const lib = await library(ctx);
  const checkCtx: CheckContext = {
    today,
    library: new Map(lib.map((s) => [s.id, toRef(s)])),
    speeds: await speeds(ctx),
    swim: ctx.cache.swim ?? undefined,
  };
  return checkDraft(draft, checkCtx);
}

async function propose(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolOutcome> {
  const parsed = parseDraft(input);
  if (!parsed.ok) {
    return {
      isError: true,
      content: json({ sparat: false, fel: parsed.errors }),
    };
  }
  const check = await checkForAdept(parsed.draft, ctx);
  const summary = checkSummary(check);
  if (check.errors.length > 0) {
    return {
      isError: true,
      content: json({
        sparat: false,
        fel: summary.errors,
        varningar: summary.warnings,
        obs: "Rätta felen och föreslå igen.",
      }),
    };
  }
  if (check.sessions.length === 0 && parsed.draft.periods.length === 0) {
    return {
      isError: true,
      content: json({
        sparat: false,
        fel: ["Förslaget har varken perioder eller pass."],
      }),
    };
  }

  const supabase = await createClient();
  // Ett nytt förslag ersätter det som ännu inte lagts in.
  await supabase
    .from("ai_plan_drafts")
    .update({ status: "ersatt" })
    .eq("conversation_id", ctx.conversationId)
    .eq("status", "förslag");
  const { data, error } = await supabase
    .from("ai_plan_drafts")
    .insert({
      conversation_id: ctx.conversationId,
      adept_id: ctx.adeptId,
      created_by: ctx.userId,
      title: parsed.draft.title,
      plan: parsed.draft,
      warnings: summary.warnings,
    })
    .select("id")
    .single();
  if (error || !data) {
    return {
      isError: true,
      content: json({
        sparat: false,
        fel: [`Kunde inte spara förslaget: ${error?.message ?? "okänt fel"}`],
      }),
    };
  }
  return {
    isError: false,
    draftId: data.id,
    content: json({
      sparat: true,
      obs: "Förslaget visas för coachen, som lägger in det i kalendern. Det ligger inte i kalendern än.",
      varningar: summary.warnings,
      veckor: summary.weeks,
      nya_pass: check.sessions.filter((s) => s.isNew).length,
    }),
  };
}

async function latestDraft(ctx: ToolContext) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_plan_drafts")
    .select("id, title, plan, status, warnings, created_at")
    .eq("conversation_id", ctx.conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return json(data ?? { obs: "Inget förslag i tråden än." });
}

/** Kör ett verktygsanrop. Fel blir ett felsvar till modellen, inte ett undantag. */
export async function runPlanningTool(
  name: string,
  input: unknown,
  ctx: ToolContext,
): Promise<ToolOutcome> {
  const args =
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : null;
  if (!args) {
    return {
      isError: true,
      content: json({ INVALID_JSON: JSON.stringify(input) }),
    };
  }
  try {
    switch (name) {
      case "bibliotek":
        return { isError: false, content: await searchLibrary(args, ctx) };
      case "kalender":
        return { isError: false, content: await readCalendar(args, ctx) };
      case "foresla_plan":
        return await propose(args, ctx);
      case "hamta_forslag":
        return { isError: false, content: await latestDraft(ctx) };
      default:
        return { isError: true, content: `Okänt verktyg: ${name}` };
    }
  } catch (error) {
    return {
      isError: true,
      content: `Verktyget ${name} gick inte: ${error instanceof Error ? error.message : "okänt fel"}`,
    };
  }
}
