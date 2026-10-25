/**
 * Passbiblioteket: coachens egna pass att återanvända.
 *
 * Ett utvecklingsblock bygger på ett eller två återkommande kvalitetsformat.
 * Biblioteket är stället där formatet står en gång – strukturen, syftet och
 * hur det byggs på – och hämtas därifrån till en planmall eller till en
 * adept i passbyggaren.
 *
 * Passet skrivs som samma rad som planmallarnas pass (structure.ts): zoner
 * som `@LO` och `@HM-10K` mot maratonfart, eller procent av en bas. Raden är
 * originalet; blocken tolkas ur den.
 *
 * Ett pass kan ha tre nivåer, som planmallarna: A (mest) till C (minst),
 * samma format i olika mängd. Med nivåer är passets egen rad nivå B.
 *
 * Passet förklarar sig också för den som tränar – syfte, utförande,
 * anpassningar, energi, när det passar och hur det byggs på – och den
 * förklaringen följer med till adepten.
 *
 * Modulen är ren.
 */

import type { Sport } from "@/lib/calculators/lactate";
import type { ReferenceSpeeds } from "@/lib/plan-library/paces";
import { formatStructure, parseStructure } from "@/lib/plan-library/structure";
import { TRAINING_PHASES, type TrainingPhase } from "@/lib/tests/phases";
import {
  BASIS_LABEL,
  type TargetBasis,
  type Workout,
  type WorkoutBlock,
  type WorkoutStep,
} from "@/lib/workouts/schema";
import type { Share } from "@/lib/sharing/shares";

export type LibraryLevelKey = "A" | "B" | "C";

/** Nivåerna i mallarnas ordning, högst först. */
export const LIBRARY_LEVELS: { key: LibraryLevelKey; hint: string }[] = [
  { key: "A", hint: "mest" },
  { key: "B", hint: "mellan" },
  { key: "C", hint: "minst" },
];

export type LibraryLevel = {
  key: LibraryLevelKey;
  structure: string;
  blocks: WorkoutBlock[];
};

export type LibrarySession = {
  id: string;
  /** Ägs av den inloggade, som då kan ändra, dela och ta bort det. */
  own: boolean;
  ownerId: string;
  /**
   * Vem passet kommer från, sett från den inloggade: "Från din coach",
   * "Coachvy" eller coachens namn. Null för det egna.
   */
  author: string | null;
  /** Vem som ser passet; bara för det egna, annars tom. */
  shares: Share[];
  title: string;
  sport: Sport;
  /** Typen, som i planmallarna: "Kvalitet", "Långpass". */
  kind: string;
  /** Intensiteten i ord: "Tröskel", "Halvmaratonfart". */
  intensity: string;
  /** Vilken egenskap passet utvecklar – ur träningsfilosofin. */
  purpose: string;
  /** Instruktionen till den som springer: hur det ska kännas. */
  description: string;
  /** Hur passet byggs på över blocket, en variabel i taget. */
  progression: string;
  /** Vad kroppen anpassar sig till. */
  adaptations: string;
  /** Energi och vätska under passet. */
  fueling: string;
  /** När passet passar: fas, hur ofta och var. */
  timing: string;
  phases: TrainingPhase[];
  basis: TargetBasis;
  /** Med nivåer: nivå B. */
  structure: string;
  blocks: WorkoutBlock[];
  /** A, B och C – eller tom när passet bara har en struktur. */
  levels: LibraryLevel[];
  updatedAt: string;
};

export type LibraryInput = {
  title: string;
  sport: Sport;
  kind: string;
  intensity: string;
  purpose: string;
  description: string;
  progression: string;
  adaptations: string;
  fueling: string;
  timing: string;
  phases: string[];
  basis: TargetBasis;
  /** Utan nivåer: passets enda rad. Med nivåer läses nivå B. */
  structure: string;
  /** Tom, eller en rad per nivå A, B och C. */
  levels: { key: LibraryLevelKey; structure: string }[];
};

export type ValidInput = Omit<LibraryInput, "phases" | "levels"> & {
  phases: TrainingPhase[];
  blocks: WorkoutBlock[];
  levels: LibraryLevel[];
};

export const LIBRARY_SPORTS: Sport[] = ["löpning", "cykling", "simning"];

/**
 * Baserna per gren, den vanligaste först. Maratonfart är basen för zonerna,
 * så den står först för löpning.
 */
export const BASES_FOR_SPORT: Record<Sport, TargetBasis[]> = {
  löpning: ["MP", "HM", "10K", "5K", "CS", "LT2"],
  cykling: ["FTP", "CP", "LT2"],
  simning: ["CSS"],
};

const RACE_BASES: TargetBasis[] = ["5K", "10K", "HM", "MP"];

const trimmed = (value: string, max: number) => value.trim().slice(0, max);

/** Basen som rubrik: "Maratonfart", "FTP". */
export const basisName = (basis: TargetBasis) => {
  const label = BASIS_LABEL[basis];
  return label === basis ? label : label[0].toUpperCase() + label.slice(1);
};

/**
 * Kontrollerar ett pass innan det sparas, och tolkar raden till block.
 * Samma regler som planmallarnas pass: zoner står mot maratonfart.
 */
export function validateLibraryInput(
  input: LibraryInput,
): { ok: true; value: ValidInput } | { ok: false; error: string } {
  const title = trimmed(input.title, 120);
  if (!title) return { ok: false, error: "Ge passet ett namn." };
  if (!LIBRARY_SPORTS.includes(input.sport)) {
    return { ok: false, error: "Välj gren." };
  }
  if (!BASES_FOR_SPORT[input.sport].includes(input.basis)) {
    return {
      ok: false,
      error: `${basisName(input.basis)} går inte som bas för ${input.sport}.`,
    };
  }
  const check = (raw: string, name: string) => {
    const structure = raw.trim();
    if (!structure) {
      return { ok: false as const, error: `Skriv ${name}.` };
    }
    if (structure.length > 2000) {
      return {
        ok: false as const,
        error: `${name[0].toUpperCase()}${name.slice(1)} är för lång.`,
      };
    }
    if (structure.includes("@") && input.basis !== "MP") {
      return {
        ok: false as const,
        error:
          "Zoner som @LO och @HM står mot maratonfart – välj Maratonfart som bas, eller skriv procent.",
      };
    }
    const parsed = parseStructure(structure);
    if (!parsed.ok) {
      return {
        ok: false as const,
        error: `${name[0].toUpperCase()}${name.slice(1)}: ${parsed.error}`,
      };
    }
    return { ok: true as const, structure, blocks: parsed.blocks };
  };

  let levels: LibraryLevel[] = [];
  let main: { structure: string; blocks: WorkoutBlock[] };
  if (input.levels.length > 0) {
    for (const { key } of LIBRARY_LEVELS) {
      const raw = input.levels.find((l) => l.key === key)?.structure ?? "";
      const level = check(raw, `strukturen på nivå ${key}`);
      if (!level.ok) return level;
      levels.push({ key, structure: level.structure, blocks: level.blocks });
    }
    main = levels[1];
  } else {
    const only = check(input.structure, "passets struktur");
    if (!only.ok) return only;
    main = only;
    levels = [];
  }

  const phaseKeys = TRAINING_PHASES.map((p) => p.key);
  const phases = phaseKeys.filter((key) => input.phases.includes(key));

  return {
    ok: true,
    value: {
      title,
      sport: input.sport,
      kind: trimmed(input.kind, 60),
      intensity: trimmed(input.intensity, 40),
      purpose: trimmed(input.purpose, 1000),
      description: trimmed(input.description, 2000),
      progression: trimmed(input.progression, 1000),
      adaptations: trimmed(input.adaptations, 1000),
      fueling: trimmed(input.fueling, 600),
      timing: trimmed(input.timing, 600),
      phases,
      basis: input.basis,
      structure: main.structure,
      blocks: main.blocks,
      levels,
    },
  };
}

/** Raden och blocken på en nivå – passets egna när nivån saknas. */
export function levelOf(
  pass: Pick<LibrarySession, "structure" | "blocks" | "levels">,
  key: LibraryLevelKey | null,
): { structure: string; blocks: WorkoutBlock[] } {
  const level = key ? pass.levels.find((l) => l.key === key) : undefined;
  return level ?? { structure: pass.structure, blocks: pass.blocks };
}

/** Rubrikerna i passets förklaring, i den ordning de läses. */
const EDUCATION: [
  keyof Pick<
    LibrarySession,
    | "purpose"
    | "description"
    | "adaptations"
    | "fueling"
    | "timing"
    | "progression"
  >,
  string,
][] = [
  ["purpose", "Syfte"],
  ["description", "Utförande"],
  ["adaptations", "Anpassningar"],
  ["fueling", "Energi"],
  ["timing", "När passet passar"],
  ["progression", "Så byggs det på"],
];

/**
 * Passets förklaring som text: en rubrik per stycke, rubriken på egen rad.
 * Det är vad adepten läser under "Därför det här passet".
 */
export function educationText(
  pass: Pick<
    LibrarySession,
    | "purpose"
    | "description"
    | "adaptations"
    | "fueling"
    | "timing"
    | "progression"
  >,
): string {
  return EDUCATION.filter(([field]) => pass[field].trim())
    .map(([field, heading]) => `${heading}\n${pass[field].trim()}`)
    .join("\n\n");
}

/** Passets längd: sekunderna i stegen angivna i tid, metrarna i resten. */
export function blockTotals(blocks: WorkoutBlock[]): {
  seconds: number;
  metres: number;
} {
  let seconds = 0;
  let metres = 0;
  for (const block of blocks) {
    const steps = block.type === "steg" ? [block.step] : block.steps;
    const times = block.type === "steg" ? 1 : block.times;
    for (const step of steps) {
      if (step.durationSeconds) seconds += step.durationSeconds * times;
      else if (step.distanceM) metres += step.distanceM * times;
    }
  }
  return { seconds, metres };
}

const sv1 = (v: number) =>
  (Math.round(v * 10) / 10).toString().replace(".", ",");

/** "12,4 km", "1 h 15 min" eller "8 km + 20 min". */
export function amountText(blocks: WorkoutBlock[]): string {
  const { seconds, metres } = blockTotals(blocks);
  const parts: string[] = [];
  if (metres > 0) {
    parts.push(metres >= 1000 ? `${sv1(metres / 1000)} km` : `${metres} m`);
  }
  if (seconds > 0) {
    const minutes = Math.round(seconds / 60);
    parts.push(
      minutes >= 60
        ? `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`
        : `${minutes} min`,
    );
  }
  return parts.join(" + ");
}

/**
 * Ett pass ur passbyggaren som biblioteksspass. Motiveringen blir syftet och
 * sammanfattningen instruktionen; raden skrivs i zoner när basen är
 * maratonfart.
 */
export function fromWorkout(workout: Workout): LibraryInput {
  return {
    title: workout.title,
    sport: workout.sport,
    kind: "",
    intensity: "",
    purpose: workout.rationale,
    description: workout.summary,
    progression: "",
    adaptations: "",
    fueling: "",
    timing: "",
    phases: [],
    basis: workout.basis,
    structure: formatStructure(workout.blocks, {
      zones: workout.basis === "MP",
    }),
    levels: [],
  };
}

/** Det adeptens pass räknas mot i passbyggaren. */
export type AdeptTarget = {
  sport: Sport;
  basis: TargetBasis | null;
  /** I W eller m/s. */
  reference: number | null;
};

const round3 = (v: number) => Math.round(v * 1000) / 1000;

function scaleStep(step: WorkoutStep, factor: number): WorkoutStep {
  return {
    ...step,
    low: round3(step.low * factor),
    high: round3(step.high * factor),
  };
}

function scaleBlocks(blocks: WorkoutBlock[], factor: number): WorkoutBlock[] {
  if (factor === 1) return blocks;
  return blocks.map((b) =>
    b.type === "steg"
      ? { type: "steg", step: scaleStep(b.step, factor) }
      : { ...b, steps: b.steps.map((s) => scaleStep(s, factor)) },
  );
}

const paceText = (speed: number) => {
  const s = Math.round(1000 / speed);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}/km`;
};

/**
 * Ett biblioteksspass som pass på en adept.
 *
 * Passbyggaren räknar procenten mot adeptens tröskel (CS, LT2, FTP, CP,
 * CSS). Ett löppass i zoner eller loppfart räknas därför om: stegets fart
 * är andelen gånger adeptens fart på basen, ur formuppskattningen, och den
 * farten uttrycks som andel av tröskeln. Det som tränas är detsamma; bara
 * procenttalet byter referens.
 */
export function toAdeptWorkout(
  pass: Pick<
    LibrarySession,
    | "title"
    | "sport"
    | "kind"
    | "intensity"
    | "basis"
    | "structure"
    | "blocks"
    | "levels"
    | "purpose"
    | "description"
    | "progression"
    | "adaptations"
    | "fueling"
    | "timing"
  >,
  target: AdeptTarget,
  speeds: ReferenceSpeeds = {},
  /** Nivån passet ges på; utan nivåer används passets enda rad. */
  level: LibraryLevelKey | null = null,
):
  | { ok: true; workout: Workout; note: string | null }
  | { ok: false; error: string } {
  if (pass.sport !== target.sport) {
    return {
      ok: false,
      error: `Passet är för ${pass.sport}, och adeptens underlag är för ${target.sport}.`,
    };
  }
  if (!target.basis || !target.reference || !(target.reference > 0)) {
    return {
      ok: false,
      error:
        "Adepten saknar en tröskel att räkna passet mot. Lägg in ett test först.",
    };
  }

  let factor = 1;
  let note: string | null = null;
  if (pass.basis !== target.basis) {
    const runningPass =
      RACE_BASES.includes(pass.basis) ||
      pass.basis === "CS" ||
      pass.basis === "LT2";
    if (runningPass) {
      const from = speeds[pass.basis];
      if (!from || !(from > 0)) {
        return {
          ok: false,
          error: `Passet står i ${BASIS_LABEL[pass.basis]}, och adepten saknar en formuppskattning att räkna den ur. Skriv in en lopptid under adeptens plan, eller lägg in ett test.`,
        };
      }
      factor = from / target.reference;
      note = `Räknat om från ${BASIS_LABEL[pass.basis]} (${paceText(from)}) till ${target.basis} (${paceText(target.reference)}).`;
    } else {
      note = `Procenten av ${pass.basis} läggs mot adeptens ${target.basis}.`;
    }
  }

  const chosen = pass.levels.some((l) => l.key === level) ? level : null;
  const { blocks } = levelOf(pass, chosen);
  const summary = [
    pass.kind,
    pass.intensity,
    chosen && `nivå ${chosen}`,
    amountText(blocks),
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    ok: true,
    note,
    workout: {
      title: pass.title,
      sport: pass.sport,
      summary,
      rationale: educationText(pass),
      basis: target.basis,
      blocks: scaleBlocks(blocks, factor),
    },
  };
}

/** Faserna i ord: "Grundperiod, Uppbyggnad". */
export const phasesText = (phases: TrainingPhase[]) =>
  TRAINING_PHASES.filter((p) => phases.includes(p.key))
    .map((p) => p.label)
    .join(", ");
