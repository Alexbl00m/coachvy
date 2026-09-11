/**
 * Ett pass som struktur, inte som text.
 *
 * Skillnaden är hela poängen. "4×8 min i tröskelfart" som text går att läsa
 * men inte att räkna på. Samma pass som steg med längd och mål går att lägga
 * mot atletens mätta CP och W′ och säga om det går att genomföra – vilket är
 * det enda ett genererat pass egentligen behöver bevisa.
 *
 * Målen sparas som *andel av en referens*, aldrig som absoluta watt eller
 * fart. Ett pass på 105 % av tröskeln är samma pass i februari och i juli;
 * ett pass på 285 W är det inte. När atleten testar om följer passet med.
 *
 * För löpning och simning är referensen alltid en **fart**, aldrig ett tempo.
 * Tempo går åt andra hållet – 110 % av tröskeltempot är långsammare, inte
 * snabbare – och den inversionen är precis den sortens detalj som tyst blir
 * fel i ett genererat pass. Tempo räknas fram vid visning i stället.
 */

import type { Sport } from "@/lib/calculators/lactate";

/** Vad steget är till för. Styr läsning och färg, inte beräkning. */
export type StepKind =
  | "uppvärmning"
  | "intervall"
  | "vila"
  | "distans"
  | "nedvarvning";

export const STEP_KINDS: StepKind[] = [
  "uppvärmning",
  "intervall",
  "vila",
  "distans",
  "nedvarvning",
];

/** Vad procenttalen räknas mot. Alla finns som mätta värden i appen. */
export type TargetBasis = "FTP" | "CP" | "CS" | "CSS" | "LT2";

export const TARGET_BASES: TargetBasis[] = ["FTP", "CP", "CS", "CSS", "LT2"];

export type WorkoutStep = {
  kind: StepKind;
  /** Fri etikett, till exempel "Stigande" eller "Frisim". */
  label: string;
  /**
   * Längden anges på ett av två sätt. Sekunder vinner när båda är satta.
   * Simning och löpning tänks oftast i meter, cykling alltid i tid.
   */
  durationSeconds: number | null;
  distanceM: number | null;
  /** Målet som andel av referensen. `low === high` ger ett enda tal. */
  low: number;
  high: number;
};

export type WorkoutBlock =
  | { type: "steg"; step: WorkoutStep }
  | { type: "repetition"; times: number; steps: WorkoutStep[] };

export type Workout = {
  title: string;
  sport: Sport;
  /** En mening om vad passet är. */
  summary: string;
  /** "Därför det här passet" – motiveringen bakom upplägget. */
  rationale: string;
  basis: TargetBasis;
  blocks: WorkoutBlock[];
};

/** Enheten belastningen redovisas i för en gren. */
export function unitForSport(sport: Sport): "W" | "m/s" {
  return sport === "cykling" ? "W" : "m/s";
}

/**
 * Ett steg utrullat ur sina repetitioner.
 *
 * Adressen tillbaka in i blocklistan följer med så att redigering i tabellen
 * kan träffa rätt steg utan att passet behöver plattas ut permanent.
 */
export type FlatStep = {
  step: WorkoutStep;
  blockIndex: number;
  /** Index inom repetitionen. 0 för ett fristående steg. */
  stepIndex: number;
  /** Vilket varv, 0-baserat. 0 för ett fristående steg. */
  rep: number;
};

export function flattenWorkout(workout: Workout): FlatStep[] {
  const flat: FlatStep[] = [];

  workout.blocks.forEach((block, blockIndex) => {
    if (block.type === "steg") {
      flat.push({ step: block.step, blockIndex, stepIndex: 0, rep: 0 });
      return;
    }
    for (let rep = 0; rep < block.times; rep += 1) {
      block.steps.forEach((step, stepIndex) => {
        flat.push({ step, blockIndex, stepIndex, rep });
      });
    }
  });

  return flat;
}

/** Ett steg med målen omräknade till belastningens egen enhet. */
export type ResolvedStep = {
  kind: StepKind;
  label: string;
  seconds: number;
  /** Sträckan steget täcker, när den går att räkna fram. */
  metres: number | null;
  /** Målet i watt eller m/s. */
  low: number;
  high: number;
  /** Mittvärdet, som modellen räknar på. */
  target: number;
  /** Andelen av referensen, oförändrad. */
  lowFraction: number;
  highFraction: number;
};

/**
 * Steget i absoluta tal.
 *
 * Ett steg angivet i meter behöver en fart för att få en längd i tid, och den
 * farten är målet självt. Det är cirkulärt bara i skenet: ett intervall på
 * 400 m i 105 % av CS tar exakt så lång tid som den farten ger, och det är
 * också vad atleten kommer att göra.
 */
export function resolveStep(
  step: WorkoutStep,
  reference: number,
  sport: Sport,
): ResolvedStep | null {
  if (!(reference > 0)) return null;

  const lowFraction = Math.min(step.low, step.high);
  const highFraction = Math.max(step.low, step.high);
  const low = lowFraction * reference;
  const high = highFraction * reference;
  const target = (low + high) / 2;

  let seconds: number | null = null;
  let metres: number | null = null;

  if (step.durationSeconds !== null && step.durationSeconds > 0) {
    seconds = step.durationSeconds;
    // På cykel är belastningen watt och säger ingenting om sträcka.
    metres = sport === "cykling" ? null : seconds * target;
  } else if (step.distanceM !== null && step.distanceM > 0) {
    if (sport === "cykling" || !(target > 0)) return null;
    metres = step.distanceM;
    seconds = step.distanceM / target;
  }

  if (seconds === null || !(seconds > 0)) return null;

  return {
    kind: step.kind,
    label: step.label,
    seconds,
    metres,
    low,
    high,
    target,
    lowFraction,
    highFraction,
  };
}

export type ResolvedWorkout = {
  steps: ResolvedStep[];
  totalSeconds: number;
  /** Summan av sträckorna, när grenen mäter i meter. */
  totalMetres: number | null;
  /** Steg som inte gick att lösa upp, till exempel utan längd. */
  dropped: number;
};

export function resolveWorkout(
  workout: Workout,
  reference: number,
): ResolvedWorkout {
  const flat = flattenWorkout(workout);
  const steps: ResolvedStep[] = [];
  let dropped = 0;

  for (const { step } of flat) {
    const resolved = resolveStep(step, reference, workout.sport);
    if (resolved) steps.push(resolved);
    else dropped += 1;
  }

  const totalSeconds = steps.reduce((sum, s) => sum + s.seconds, 0);
  const totalMetres =
    workout.sport === "cykling" || steps.some((s) => s.metres === null)
      ? null
      : steps.reduce((sum, s) => sum + (s.metres as number), 0);

  return { steps, totalSeconds, totalMetres, dropped };
}

/** "1:30:00" eller "8:00". */
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Fart i m/s till tempo som min:sek per kilometer respektive per 100 m. */
export function formatPace(metresPerSecond: number, sport: Sport): string {
  if (!(metresPerSecond > 0)) return "–";
  const per = sport === "simning" ? 100 : 1000;
  const seconds = per / metresPerSecond;
  const suffix = sport === "simning" ? "/100 m" : "/km";
  return `${formatDuration(seconds)}${suffix}`;
}

/**
 * Ett sparat pass, som raden ser ut i databasen.
 *
 * Typen och omvandlingen bor här och inte i frågemodulen: en klientkomponent
 * som listar pass behöver båda, och frågemodulen drar in Supabase-klienten
 * som bara finns på servern.
 */
export type SavedWorkout = {
  id: string;
  adept_id: string;
  title: string;
  sport: Sport;
  summary: string | null;
  rationale: string | null;
  basis: TargetBasis;
  /** Referensen passet byggdes mot, i W eller m/s. */
  reference: number;
  critical: number | null;
  reserve: number | null;
  blocks: WorkoutBlock[];
  prompt: string | null;
  scheduled_for: string | null;
  created_at: string;
};

/** Den sparade raden tillbaka till den form resten av koden räknar på. */
export function toWorkout(saved: SavedWorkout): Workout {
  return {
    title: saved.title,
    sport: saved.sport,
    summary: saved.summary ?? "",
    rationale: saved.rationale ?? "",
    basis: saved.basis,
    blocks: saved.blocks,
  };
}
