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

export type LibrarySession = {
  id: string;
  /** Ägs av den inloggade, som då kan ändra och ta bort det. */
  own: boolean;
  /** Syns för alla coacher. */
  shared: boolean;
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
  phases: TrainingPhase[];
  basis: TargetBasis;
  structure: string;
  blocks: WorkoutBlock[];
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
  phases: string[];
  basis: TargetBasis;
  structure: string;
  shared: boolean;
};

export type ValidInput = Omit<LibraryInput, "phases"> & {
  phases: TrainingPhase[];
  blocks: WorkoutBlock[];
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
  const structure = input.structure.trim();
  if (!structure) {
    return { ok: false, error: "Skriv passets struktur." };
  }
  if (structure.length > 2000) {
    return { ok: false, error: "Strukturen är för lång." };
  }
  if (structure.includes("@") && input.basis !== "MP") {
    return {
      ok: false,
      error:
        "Zoner som @LO och @HM står mot maratonfart – välj Maratonfart som bas, eller skriv procent.",
    };
  }
  const parsed = parseStructure(structure);
  if (!parsed.ok) return { ok: false, error: parsed.error };

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
      phases,
      basis: input.basis,
      structure,
      shared: input.shared,
      blocks: parsed.blocks,
    },
  };
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
    phases: [],
    basis: workout.basis,
    structure: formatStructure(workout.blocks, {
      zones: workout.basis === "MP",
    }),
    shared: false,
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
  return { ...step, low: round3(step.low * factor), high: round3(step.high * factor) };
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
    "title" | "sport" | "basis" | "blocks" | "purpose" | "description" | "progression"
  >,
  target: AdeptTarget,
  speeds: ReferenceSpeeds = {},
): { ok: true; workout: Workout; note: string | null } | { ok: false; error: string } {
  if (pass.sport !== target.sport) {
    return {
      ok: false,
      error: `Passet är för ${pass.sport}, och adeptens underlag är för ${target.sport}.`,
    };
  }
  if (!target.basis || !target.reference || !(target.reference > 0)) {
    return {
      ok: false,
      error: "Adepten saknar en tröskel att räkna passet mot. Lägg in ett test först.",
    };
  }

  let factor = 1;
  let note: string | null = null;
  if (pass.basis !== target.basis) {
    const runningPass =
      RACE_BASES.includes(pass.basis) || pass.basis === "CS" || pass.basis === "LT2";
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

  const rationale = [pass.purpose, pass.progression && `Så byggs det på: ${pass.progression}`]
    .filter(Boolean)
    .join("\n\n");

  return {
    ok: true,
    note,
    workout: {
      title: pass.title,
      sport: pass.sport,
      summary: pass.description,
      rationale,
      basis: target.basis,
      blocks: scaleBlocks(pass.blocks, factor),
    },
  };
}

/** Faserna i ord: "Grundperiod, Uppbyggnad". */
export const phasesText = (phases: TrainingPhase[]) =>
  TRAINING_PHASES.filter((p) => phases.includes(p.key))
    .map((p) => p.label)
    .join(", ");
