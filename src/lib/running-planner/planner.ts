/**
 * Löpplaneraren: veckovolymen och långpasset vecka för vecka fram till ett
 * lopp, ur distans, nivå, antal veckor och var löparen står i dag.
 *
 * Räkningen är Alexanders löpträningsplanerare (kalkylarket) rad för rad:
 *
 *   - Volym och långpass stiger linjärt från start till topp.
 *   - Var tredje vecka är avlastning: långpasset × 0,70, volymen × 0,72.
 *     Var fjärde går också att välja – filosofins block är tre till fyra
 *     veckor.
 *   - Toppveckan ligger före tapern. Tapern sänker långpasset med 20 % och
 *     volymen med 18 % per vecka. Loppveckan har 35 % av toppvolymen.
 *
 * Ovanpå det ligger träningsfilosofin: uppbyggnaden delas i en polariserad
 * grund, en uppbyggnad med tröskel och en specifik del, med faserna längs
 * blockens gränser. Ett test ligger veckan före den specifika delen, där det
 * kalibrerar farterna. Passen veckan visar är förslag på vad blocket bygger
 * på – ett eller två återkommande format.
 *
 * Modulen är ren.
 */

import type { RaceKey } from "@/lib/plan-library/races";
import type { TrainingPhase } from "@/lib/tests/phases";

export type PlannerDistance =
  | "5K"
  | "10K"
  | "HM"
  | "M"
  | "U50"
  | "U100"
  | "U160";

export type PlannerLevel = 1 | 2 | 3;

type Reference = {
  peakLongKm: number;
  peakWeekKm: number;
  startLongKm: number;
  startWeekKm: number;
  taperWeeks: number;
};

export const PLANNER_DISTANCES: {
  key: PlannerDistance;
  name: string;
  /** Loppet zonerna räknas mot. Null för ultra: då maratonfarten. */
  race: RaceKey | null;
}[] = [
  { key: "5K", name: "5 km", race: "5K" },
  { key: "10K", name: "10 km", race: "10K" },
  { key: "HM", name: "Halvmaraton", race: "HM" },
  { key: "M", name: "Maraton", race: "M" },
  { key: "U50", name: "Ultra 50 km", race: null },
  { key: "U100", name: "Ultra 100 km", race: null },
  { key: "U160", name: "Ultra 160 km", race: null },
];

const ref = (
  peakLongKm: number,
  peakWeekKm: number,
  startLongKm: number,
  startWeekKm: number,
  taperWeeks: number,
): Reference => ({
  peakLongKm,
  peakWeekKm,
  startLongKm,
  startWeekKm,
  taperWeeks,
});

/** Arkets referenstabell: topp- och startvärden per distans och nivå. */
export const REFERENCE: Record<
  PlannerDistance,
  Partial<Record<PlannerLevel, Reference>>
> = {
  "5K": {
    1: ref(11, 28, 6, 16, 1),
    2: ref(15, 50, 9, 32, 1),
    3: ref(18, 88, 12, 58, 1),
  },
  "10K": {
    1: ref(14, 35, 7, 20, 1),
    2: ref(18, 58, 11, 38, 1),
    3: ref(22, 98, 14, 65, 1),
  },
  HM: {
    1: ref(17, 45, 8, 26, 2),
    2: ref(20, 65, 11, 42, 2),
    3: ref(25, 105, 14, 68, 2),
  },
  M: {
    1: ref(30, 60, 12, 32, 3),
    2: ref(32, 85, 15, 52, 3),
    3: ref(34, 125, 18, 78, 3),
  },
  U50: { 2: ref(34, 95, 16, 58, 3), 3: ref(38, 135, 20, 85, 3) },
  U100: { 2: ref(38, 105, 18, 62, 3), 3: ref(45, 155, 22, 95, 3) },
  U160: { 3: ref(50, 170, 25, 105, 3) },
};

export const MIN_WEEKS = 8;
export const MAX_WEEKS = 30;

export type PlannerInput = {
  distance: PlannerDistance;
  level: PlannerLevel;
  weeks: number;
  /** Långpasset i dag. 0: nivåns startvärde. */
  longRunKm: number;
  /** Veckovolymen i dag. 0: nivåns startvärde. */
  weeklyKm: number;
  /** Avlastning var tredje (arkets) eller var fjärde vecka. */
  deloadEvery: 3 | 4;
};

/** Veckans typ i arket. */
export type WeekKind =
  | "bas"
  | "bygg"
  | "avlastning"
  | "topp"
  | "taper"
  | "lopp";

export type PlannerWeek = {
  week: number;
  kind: WeekKind;
  /** Fasen i säsongen, ur filosofin. */
  phase: TrainingPhase;
  /** "Avlastning", "Toppvecka", "Taper 2", "Loppvecka" – eller null. */
  label: string | null;
  longRunKm: number;
  volumeKm: number;
  /** Långpasset som andel av veckan. Null i loppveckan. */
  longShare: number | null;
  /** Veckans nyckelpass, i den ordning de står i raden. */
  sessions: string[];
  /** Ett test den här veckan. */
  test: string | null;
  note: { tone: "varning" | "info"; text: string } | null;
};

export type PlannerPlan = {
  weeks: PlannerWeek[];
  reference: Reference;
  start: { longRunKm: number; weeklyKm: number };
  peakWeek: number;
  totalKm: number;
  warnings: string[];
};

export type PlannerResult =
  | { ok: true; plan: PlannerPlan }
  | { ok: false; error: string };

/** Excels ROUND: halvor avrundas bort från noll. */
const xround = (v: number) => Math.sign(v) * Math.floor(Math.abs(v) + 0.5);

export const distanceByKey = (key: PlannerDistance) =>
  PLANNER_DISTANCES.find((d) => d.key === key)!;

export const levelsFor = (distance: PlannerDistance): PlannerLevel[] =>
  ([1, 2, 3] as PlannerLevel[]).filter((l) => REFERENCE[distance][l]);

type Group = "kort" | "halv" | "maraton" | "ultra";
const groupOf = (d: PlannerDistance): Group =>
  d === "5K" || d === "10K"
    ? "kort"
    : d === "HM"
      ? "halv"
      : d === "M"
        ? "maraton"
        : "ultra";

/** Blockets återkommande format per fas – ett eller två, enligt filosofin. */
function formats(distance: PlannerDistance, phase: TrainingPhase): string[] {
  const group = groupOf(distance);
  if (phase === "grund") return ["Backspurter", "Stegringar"];
  if (phase === "uppbyggnad") {
    return group === "kort"
      ? ["Tröskeldrag", "Intervaller i 5 km-fart"]
      : group === "halv"
        ? ["Tröskeldrag", "Milfart"]
        : group === "maraton"
          ? ["Tröskeldrag", "Progressivt långpass"]
          : ["Tröskeldrag", "Backlöpning"];
  }
  // Specifik.
  switch (distance) {
    case "5K":
      return ["5 km-fart", "Snabbhet"];
    case "10K":
      return ["Milfart", "Tröskel"];
    case "HM":
      return ["Halvmaratonfart med flyt", "Tröskel"];
    case "M":
      return ["Maratontempo", "Tröskel, underhåll"];
    default:
      return ["Loppfart i terräng", "Dubbla långpass"];
  }
}

const km = (v: number) => `${v.toString().replace(".", ",")} km`;

/**
 * Räknar fram planen. Felet gäller indata som inte går att planera – en
 * kombination som saknas eller ett antal veckor utanför 8–30.
 */
export function planWeeks(input: PlannerInput): PlannerResult {
  const reference = REFERENCE[input.distance]?.[input.level];
  if (!reference) {
    const levels = levelsFor(input.distance);
    return {
      ok: false,
      error: `${distanceByKey(input.distance).name} finns bara på nivå ${levels.join(" och ")}.`,
    };
  }
  const n = Math.round(input.weeks);
  if (!(n >= MIN_WEEKS && n <= MAX_WEEKS)) {
    return {
      ok: false,
      error: `Välj mellan ${MIN_WEEKS} och ${MAX_WEEKS} veckor.`,
    };
  }
  const every = input.deloadEvery === 4 ? 4 : 3;
  const { peakLongKm: pL, peakWeekKm: pV, taperWeeks: t } = reference;
  const eL = input.longRunKm > 0 ? input.longRunKm : reference.startLongKm;
  const eV = input.weeklyKm > 0 ? input.weeklyKm : reference.startWeekKm;
  const peak = n - t;

  // Veckokurvan, som i arket.
  const raw = Array.from({ length: n }, (_, i) => {
    const w = i + 1;
    const step = (w - 1) / Math.max(peak - 1, 1);
    const longLine = eL + (pL - eL) * step;
    const volumeLine = eV + (pV - eV) * step;
    let kind: WeekKind;
    let longRunKm: number;
    let volumeKm: number;
    if (w === n) {
      kind = "lopp";
      longRunKm = 0;
      volumeKm = xround(pV * 0.35);
    } else if (w === peak) {
      kind = "topp";
      longRunKm = pL;
      volumeKm = pV;
    } else if (w > peak) {
      kind = "taper";
      longRunKm = xround(pL * (1 - (w - peak) * 0.2));
      volumeKm = xround(pV * (1 - (w - peak) * 0.18));
    } else if (w % every === 0) {
      kind = "avlastning";
      longRunKm = xround(longLine * 0.7);
      volumeKm = xround(volumeLine * 0.72);
    } else {
      kind = w <= 2 ? "bas" : "bygg";
      longRunKm = xround(longLine);
      volumeKm = xround(volumeLine);
    }
    return { week: w, kind, longRunKm, volumeKm };
  });

  // Faserna längs blocken: ett block slutar med avlastningen. Grunden får
  // ungefär två femtedelar av blocken och den specifika delen en fjärdedel,
  // och toppveckan hör till den specifika delen.
  const build = raw.filter((w) => w.week < peak);
  const blocks: number[][] = [];
  let current: number[] = [];
  for (const w of build) {
    current.push(w.week);
    if (w.kind === "avlastning") {
      blocks.push(current);
      current = [];
    }
  }
  if (current.length > 0) blocks.push(current);
  const k = blocks.length;
  const specificBlocks = k >= 2 ? Math.max(1, Math.round(k * 0.25)) : 0;
  const baseBlocks = Math.max(
    1,
    Math.min(k - specificBlocks, Math.round(k * 0.4)),
  );
  const phaseOfWeek = new Map<number, TrainingPhase>();
  blocks.forEach((block, i) => {
    const phase: TrainingPhase =
      i < baseBlocks
        ? "grund"
        : i >= k - specificBlocks
          ? "specifik"
          : "uppbyggnad";
    for (const w of block) phaseOfWeek.set(w, phase);
  });
  const firstSpecific = raw.find(
    (w) => phaseOfWeek.get(w.week) === "specifik",
  )?.week;
  const testWeek =
    firstSpecific && firstSpecific > 1 ? firstSpecific - 1 : null;
  const testName = input.distance === "5K" ? "5 km-test" : "10 km-test";

  const weeks: PlannerWeek[] = raw.map((w) => {
    const phase: TrainingPhase =
      w.kind === "taper" || w.kind === "lopp"
        ? "topp"
        : w.kind === "topp"
          ? "specifik"
          : (phaseOfWeek.get(w.week) ?? "grund");
    const longShare =
      w.volumeKm > 0 && w.longRunKm > 0 ? w.longRunKm / w.volumeKm : null;
    const label =
      w.kind === "avlastning"
        ? "Avlastning"
        : w.kind === "topp"
          ? "Toppvecka"
          : w.kind === "taper"
            ? `Taper ${w.week - peak}`
            : w.kind === "lopp"
              ? "Loppvecka"
              : null;
    const test = w.week === testWeek ? testName : null;

    let sessions: string[];
    if (w.kind === "lopp") sessions = ["Kort aktivering", "Loppet"];
    else if (w.kind === "taper") sessions = ["Korta drag i loppfart"];
    else if (w.kind === "avlastning") sessions = test ? [test] : ["Stegringar"];
    else sessions = formats(input.distance, phase);
    if (test && w.kind !== "avlastning")
      sessions = [test, ...sessions.slice(1)];
    if (w.longRunKm > 0)
      sessions = [...sessions, `Långpass ${km(w.longRunKm)}`];

    // Arkets kommentar för toppveckan. Långpassets andel visas per vecka
    // och sammanfattas i varningarna.
    const note: PlannerWeek["note"] =
      w.kind === "topp"
        ? { tone: "info", text: "Säsongens tyngsta vecka." }
        : null;

    return { ...w, phase, label, longShare, sessions, test, note };
  });

  // Arkets kontroller, och en för hur fort volymen ökar.
  const warnings: string[] = [];
  if (eL > pL) {
    warnings.push(
      "Långpasset i dag är längre än toppen – sänk startvärdet eller välj en högre nivå.",
    );
  }
  if (eV > pV) {
    warnings.push(
      "Veckovolymen i dag är högre än toppen – välj en högre nivå.",
    );
  }
  const heavy = weeks.filter((w) => w.longShare !== null && w.longShare > 0.4);
  if (heavy.length > 0) {
    warnings.push(
      `Långpasset är över 40 % av veckan i ${heavy.length} av ${n} veckor – höj basvolymen eller välj en högre nivå.`,
    );
  }
  if (input.distance === "M" && input.level === 1 && n < 16) {
    warnings.push("Första maran: minst 16 veckor rekommenderas.");
  }
  if (eV < pV && peak > 1) {
    const growth = Math.pow(pV / eV, 1 / (peak - 1)) - 1;
    if (growth > 0.1) {
      warnings.push(
        `Volymen ökar i snitt ${Math.round(growth * 100)} % i veckan. Över 10 % är brant – fler veckor eller en lägre nivå ger en jämnare ökning.`,
      );
    }
  }

  return {
    ok: true,
    plan: {
      weeks,
      reference,
      start: { longRunKm: eL, weeklyKm: eV },
      peakWeek: peak,
      totalKm: weeks.reduce((s, w) => s + w.volumeKm, 0),
      warnings,
    },
  };
}

/** Indata ur en adress, med standardvärden för det som saknas. */
export function inputFromParams(
  params: Record<string, string | string[] | undefined>,
): PlannerInput {
  const one = (k: string) => {
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const distance = PLANNER_DISTANCES.some((d) => d.key === one("distans"))
    ? (one("distans") as PlannerDistance)
    : "M";
  const levels = levelsFor(distance);
  const wanted = Number(one("niva"));
  const level = (
    levels.includes(wanted as PlannerLevel) ? wanted : levels[0]
  ) as PlannerLevel;
  const num = (k: string, fallback: number) => {
    const raw = one(k)?.trim();
    if (!raw) return fallback;
    const v = Number(raw.replace(",", "."));
    return Number.isFinite(v) && v >= 0 ? v : fallback;
  };
  const weeks = Math.min(
    MAX_WEEKS,
    Math.max(MIN_WEEKS, Math.round(num("veckor", 16))),
  );
  return {
    distance,
    level,
    weeks,
    longRunKm: num("langpass", 0),
    weeklyKm: num("volym", 0),
    deloadEvery: one("avlastning") === "4" ? 4 : 3,
  };
}

/** Indata som adress, för att spara och dela. */
export function inputToParams(input: PlannerInput): URLSearchParams {
  const p = new URLSearchParams({
    distans: input.distance,
    niva: String(input.level),
    veckor: String(input.weeks),
  });
  if (input.longRunKm > 0) p.set("langpass", String(input.longRunKm));
  if (input.weeklyKm > 0) p.set("volym", String(input.weeklyKm));
  if (input.deloadEvery === 4) p.set("avlastning", "4");
  return p;
}
