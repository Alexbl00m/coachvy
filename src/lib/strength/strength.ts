/**
 * Styrkeloggen: övningarna, tolkningen av det adepten skriver, och
 * progressionen per övning.
 *
 * Adepterna planerar ofta i TrainingPeaks och skrev tidigare styrkan som en
 * kommentar där: "FB 4x8 50 kg, RM 4x8 70 kg, BS 5x5 45 kg. Lats,
 * armhävningar, vadlyft och Deadbugg". Samma rad går att skriva här; den
 * tolkas till övningar som går att rätta innan passet sparas.
 *
 * Progressionen följer filosofins avsnitt 20: tung styrka med få övningar,
 * från 10–15 repetitioner mot 4–6 över 12–16 veckor. Därför visas både det
 * tyngsta setet och ett skattat 1RM (Epley), som gör 3×10 på 40 kg och 4×8 på
 * 50 kg jämförbara.
 *
 * Modulen är ren och delas av sidan, servern och AI-underlaget.
 */

import { shortDate } from "@/lib/season/season";

export type StrengthEntry = {
  /** Övningens nyckel: katalogens, eller "egen:<namn>" för en egen övning. */
  key: string;
  /** Namnet som visas. */
  name: string;
  sets: number | null;
  reps: number | null;
  weightKg: number | null;
  /** Repetitionerna gäller per ben eller sida. */
  perSide: boolean;
};

export type StrengthSession = {
  id: string;
  adept_id: string;
  performed_on: string;
  title: string | null;
  exercises: StrengthEntry[];
  note: string | null;
  session_rpe: number | null;
  created_by: string | null;
  created_at: string;
};

type CatalogItem = { key: string; name: string; aliases: string[] };

/**
 * Övningarna som känns igen, med de förkortningar och namn som brukar
 * skrivas. En övning som inte finns här sparas med det namn adepten skrev.
 */
export const EXERCISES: CatalogItem[] = [
  {
    key: "frontbo",
    name: "Frontböj",
    aliases: ["fb", "frontböj", "front squat", "frontsquat", "front squats"],
  },
  {
    key: "knabo",
    name: "Knäböj",
    aliases: [
      "kb",
      "knäböj",
      "back squat",
      "backsquat",
      "squat",
      "squats",
      "böj",
    ],
  },
  {
    key: "bulgarisk",
    name: "Bulgarisk splitböj",
    aliases: [
      "bs",
      "bss",
      "bulgarisk",
      "bulgarisk splitböj",
      "bulgarian",
      "bulgarian split squat",
      "splitböj",
      "split squat",
    ],
  },
  {
    key: "rumansk",
    name: "Rumänsk marklyft",
    aliases: [
      "rm",
      "rdl",
      "rumänsk",
      "rumänsk marklyft",
      "romanian",
      "romanian deadlift",
      "romanian dead lift",
      "marklyft raka ben",
    ],
  },
  {
    key: "marklyft",
    name: "Marklyft",
    aliases: ["ml", "dl", "marklyft", "deadlift", "dead lift"],
  },
  {
    key: "utfall",
    name: "Utfall",
    aliases: [
      "utfall",
      "utfallssteg",
      "utfall bakåt",
      "lunge",
      "lunges",
      "reverse lunge",
    ],
  },
  {
    key: "stepup",
    name: "Step-up",
    aliases: ["step up", "step-up", "stepup", "step ups", "uppkliv"],
  },
  {
    key: "hoftlyft",
    name: "Höftlyft",
    aliases: [
      "höftlyft",
      "hip thrust",
      "hipthrust",
      "glute bridge",
      "höftbrygga",
    ],
  },
  {
    key: "goblet",
    name: "Goblet squat",
    aliases: ["goblet", "goblet squat", "gobletböj"],
  },
  { key: "benpress", name: "Benpress", aliases: ["benpress", "leg press"] },
  {
    key: "vad",
    name: "Vadpress",
    aliases: [
      "vadpress",
      "vadlyft",
      "tåhävning",
      "tåhävningar",
      "calf raise",
      "calf raises",
      "vader",
    ],
  },
  {
    key: "nordic",
    name: "Nordic hamstring",
    aliases: ["nordic", "nordics", "nordic hamstring"],
  },
  {
    key: "rodd",
    name: "Rodd",
    aliases: [
      "rodd",
      "row",
      "sittande rodd",
      "bandrodd",
      "hantelrodd",
      "skivstångsrodd",
    ],
  },
  {
    key: "latsdrag",
    name: "Latsdrag",
    aliases: ["lats", "latsdrag", "lat pulldown", "pulldown"],
  },
  {
    key: "chins",
    name: "Chins",
    aliases: ["chins", "pull-up", "pull up", "pullups", "pull-ups"],
  },
  {
    key: "armhav",
    name: "Armhävningar",
    aliases: [
      "armhävning",
      "armhävningar",
      "push-up",
      "push up",
      "pushups",
      "push-ups",
    ],
  },
  {
    key: "bank",
    name: "Bänkpress",
    aliases: ["bänk", "bänkpress", "bench", "bench press"],
  },
  {
    key: "axelpress",
    name: "Axelpress",
    aliases: ["axelpress", "militärpress", "shoulder press", "overhead press"],
  },
  {
    key: "deadbug",
    name: "Dead bug",
    aliases: ["dead bug", "deadbug", "deadbugg", "dead bugs"],
  },
  {
    key: "pallof",
    name: "Pallof press",
    aliases: ["pallof", "pallof press", "pallof-press", "pallofpress"],
  },
  { key: "planka", name: "Planka", aliases: ["planka", "plankan", "plank"] },
  {
    key: "sidoplanka",
    name: "Sidoplanka",
    aliases: ["sidoplanka", "side plank"],
  },
  {
    key: "copenhagen",
    name: "Copenhagen",
    aliases: ["copenhagen", "copenhagen plank", "köpenhamnare"],
  },
];

const normalise = (text: string) =>
  text
    .toLowerCase()
    .replace(/[‐-–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

const ALIASES = EXERCISES.flatMap((item) =>
  item.aliases.map((alias) => ({ alias: normalise(alias), item })),
).sort((a, b) => b.alias.length - a.alias.length);

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const capitalise = (text: string) =>
  text ? text[0].toUpperCase() + text.slice(1) : text;

/**
 * Övningen ett namn betyder. Först hela namnet mot förkortningar och namn,
 * sedan det längsta kända namnet som står som eget ord i det – "sittande
 * rodd el. bandrodd" är rodd. Okänt blir en egen övning med adeptens namn.
 */
export function matchExercise(raw: string): { key: string; name: string } {
  const text = normalise(raw).replace(/[.:,;]+$/, "");
  if (!text) return { key: "egen:", name: "" };
  const exact = ALIASES.find((a) => a.alias === text);
  if (exact) return { key: exact.item.key, name: exact.item.name };
  // Korta förkortningar (fb, rm) bara som hela namnet – annars blir "rm" i
  // "armhävningar" en rumänsk marklyft.
  const inside = ALIASES.find(
    (a) =>
      a.alias.length > 3 &&
      new RegExp(
        `(^|[^\\p{L}])${escapeRegExp(a.alias)}($|[^\\p{L}])`,
        "u",
      ).test(text),
  );
  if (inside) return { key: inside.item.key, name: inside.item.name };
  const name = capitalise(
    raw
      .trim()
      .replace(/[.:,;]+$/, "")
      .replace(/\s+/g, " "),
  );
  return { key: `egen:${normalise(name)}`, name };
}

const SETS_REPS = /(\d+)\s*[x×*]\s*(\d+)(\s*\/\s*(?:ben|sida|arm|side|leg))?/i;
const WEIGHT = /(\d+(?:[.,]\d+)?)\s*kg\b/i;
const RPE = /@?\s*rpe\s*\d+(?:[.,]\d+)?/i;

/**
 * Det adepten skriver, som övningar. En del per kommatecken, punkt, rad
 * eller "och": "FB 4x8 50 kg" blir frontböj, 4 set à 8 på 50 kg; "Lats" blir
 * latsdrag utan siffror – gjort, men inget att räkna progression på.
 */
export function parseStrengthText(text: string): StrengthEntry[] {
  const parts = text
    .replace(/\r/g, "")
    // Punkt och kommatecken som skiljer övningar åt – inte decimaltecknet i
    // "52.5 kg" eller "12,5 kg".
    .split(/(?<!\d),|,(?!\d)|[;\n]|\.(?!\d)|\s+och\s+|\s+&\s+|\s\+\s/i)
    .map((p) => p.trim())
    .filter(Boolean);

  const entries: StrengthEntry[] = [];
  for (const part of parts) {
    const setsReps = part.match(SETS_REPS);
    const weight = part.match(WEIGHT);
    const rest = part
      .replace(SETS_REPS, " ")
      .replace(WEIGHT, " ")
      .replace(RPE, " ")
      .replace(/^\d+\)\s*/, "")
      .replace(/[@:–-]\s*$/g, "")
      .replace(/\s+@\s*/g, " ")
      .trim();
    if (!rest) continue;
    const { key, name } = matchExercise(rest);
    if (!name) continue;
    entries.push({
      key,
      name,
      sets: setsReps ? Number(setsReps[1]) : null,
      reps: setsReps ? Number(setsReps[2]) : null,
      weightKg: weight ? Number(weight[1].replace(",", ".")) : null,
      perSide: Boolean(setsReps?.[3]),
    });
  }
  return entries;
}

const inRange = (value: unknown, min: number, max: number) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max
    ? value
    : null;

/** Övningarna som kom från formuläret, kontrollerade. Tomma rader faller bort. */
export function cleanEntries(input: unknown): StrengthEntry[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 40).flatMap((raw): StrengthEntry[] => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const typed = typeof r.name === "string" ? r.name.trim().slice(0, 60) : "";
    if (!typed) return [];
    // Namnet avgör övningen: står det "Knäböj" i raden är det knäböj, även
    // om tolkningen först gissade på något annat.
    const { key, name } = matchExercise(typed);
    return [
      {
        key,
        name,
        sets: inRange(r.sets, 1, 20),
        reps: inRange(r.reps, 1, 100),
        weightKg: inRange(r.weightKg, 0, 500),
        perSide: r.perSide === true,
      },
    ];
  });
}

const sv = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");

/** "4×8 · 50 kg", "3×8/ben", "–". */
export function entryText(
  e: Pick<StrengthEntry, "sets" | "reps" | "weightKg" | "perSide">,
): string {
  const volume =
    e.sets && e.reps
      ? `${e.sets}×${e.reps}${e.perSide ? "/ben" : ""}`
      : e.reps
        ? `${e.reps}${e.perSide ? "/ben" : ""}`
        : null;
  const weight = e.weightKg ? `${sv(e.weightKg)} kg` : null;
  return [volume, weight].filter(Boolean).join(" · ") || "–";
}

/**
 * Skattat 1RM ur vikt och repetitioner (Epley). Över tolv repetitioner blir
 * skattningen osäker, och utan vikt finns ingen.
 */
export function estimatedMax(
  weightKg: number | null,
  reps: number | null,
): number | null {
  if (!weightKg || !reps || weightKg <= 0 || reps <= 0) return null;
  if (reps === 1) return weightKg;
  return weightKg * (1 + Math.min(reps, 15) / 30);
}

// ---------------------------------------------------------------------------
// Progression
// ---------------------------------------------------------------------------

export type ProgressPoint = {
  date: string;
  sets: number | null;
  reps: number | null;
  weightKg: number | null;
  perSide: boolean;
  e1rm: number | null;
};

export type ExerciseProgress = {
  key: string;
  name: string;
  /** Pass där övningen finns, äldst först, med passets bästa set. */
  points: ProgressPoint[];
  latest: ProgressPoint;
  /** Första passet i fönstret – det förändringen räknas från. */
  first: ProgressPoint;
  /** Förändringen i skattat 1RM, i procent, när båda har vikt. */
  changePct: number | null;
};

const DAY = 86_400_000;
const dayNumber = (iso: string) =>
  Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY);

/** Ett pass bästa set i en övning: högst skattat 1RM, annars flest repetitioner. */
function bestOf(entries: StrengthEntry[]): StrengthEntry {
  return entries.reduce((best, e) => {
    const a = estimatedMax(best.weightKg, best.reps);
    const b = estimatedMax(e.weightKg, e.reps);
    if (a !== null || b !== null) return (b ?? -1) > (a ?? -1) ? e : best;
    return (e.reps ?? 0) * (e.sets ?? 1) > (best.reps ?? 0) * (best.sets ?? 1)
      ? e
      : best;
  });
}

/**
 * Progressionen per övning inom `days` dagar före `today`, mest loggade
 * först. Övningar med vikt kommer före de utan, eftersom det är där
 * progressionen går att läsa.
 */
export function strengthProgress(
  sessions: Pick<StrengthSession, "performed_on" | "exercises">[],
  today: string,
  days = 112,
): ExerciseProgress[] {
  const from = dayNumber(today) - days;
  const byKey = new Map<string, { name: string; points: ProgressPoint[] }>();
  const sorted = [...sessions]
    .filter((s) => dayNumber(s.performed_on) >= from)
    .sort((a, b) => a.performed_on.localeCompare(b.performed_on));

  for (const session of sorted) {
    const groups = new Map<string, StrengthEntry[]>();
    for (const e of session.exercises) {
      groups.set(e.key, [...(groups.get(e.key) ?? []), e]);
    }
    for (const [key, entries] of groups) {
      const best = bestOf(entries);
      const slot = byKey.get(key) ?? { name: best.name, points: [] };
      slot.points.push({
        date: session.performed_on,
        sets: best.sets,
        reps: best.reps,
        weightKg: best.weightKg,
        perSide: best.perSide,
        e1rm: estimatedMax(best.weightKg, best.reps),
      });
      slot.name = best.name;
      byKey.set(key, slot);
    }
  }

  return [...byKey.entries()]
    .map(([key, { name, points }]) => {
      const latest = points[points.length - 1];
      const first = points[0];
      const changePct =
        points.length > 1 && first.e1rm && latest.e1rm
          ? ((latest.e1rm - first.e1rm) / first.e1rm) * 100
          : null;
      return { key, name, points, latest, first, changePct };
    })
    .sort((a, b) => {
      const weighted =
        Number(b.latest.weightKg !== null) - Number(a.latest.weightKg !== null);
      return (
        weighted ||
        b.points.length - a.points.length ||
        a.name.localeCompare(b.name, "sv")
      );
    });
}

/** Pass per vecka de senaste `weeks` veckorna, äldst först. */
export function sessionsPerWeek(
  sessions: Pick<StrengthSession, "performed_on">[],
  today: string,
  weeks = 8,
): number[] {
  const end = dayNumber(today);
  const counts = Array.from({ length: weeks }, () => 0);
  for (const s of sessions) {
    const ago = end - dayNumber(s.performed_on);
    if (ago < 0) continue;
    const index = weeks - 1 - Math.floor(ago / 7);
    if (index >= 0) counts[index] += 1;
  }
  return counts;
}

/**
 * Styrkan som text till AI-coachen: hur ofta, och var de viktade övningarna
 * står nu jämfört med för åtta veckor sedan.
 */
export function strengthToPrompt(
  sessions: Pick<StrengthSession, "performed_on" | "exercises">[],
  today: string,
): string | null {
  const recent = sessions.filter(
    (s) =>
      dayNumber(today) - dayNumber(s.performed_on) <= 56 &&
      s.performed_on <= today,
  );
  if (recent.length === 0) return null;
  const progress = strengthProgress(sessions, today, 56);
  const weighted = progress
    .filter((p) => p.latest.weightKg !== null)
    .slice(0, 8);
  const other = progress
    .filter((p) => p.latest.weightKg === null)
    .map((p) => p.name);
  const lines = [
    `Styrka, loggad av adepten: ${recent.length} pass de senaste åtta veckorna (${sv(recent.length / 8)} per vecka).`,
    ...weighted.map((p) => {
      const now = `${entryText(p.latest)} (${shortDate(p.latest.date)})`;
      const then =
        p.points.length > 1
          ? `, från ${entryText(p.first)} (${shortDate(p.first.date)})`
          : "";
      const change =
        p.changePct !== null
          ? `, skattat 1RM ${p.changePct >= 0 ? "+" : "−"}${sv(Math.abs(Math.round(p.changePct)))} %`
          : "";
      return `- ${p.name}: ${now}${then}${change}.`;
    }),
  ];
  if (other.length > 0) lines.push(`- Utan vikt: ${other.join(", ")}.`);
  return lines.join("\n");
}
