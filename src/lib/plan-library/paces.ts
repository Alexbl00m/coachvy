/**
 * Tempona i en löpplan, ur löparens formuppskattning.
 *
 * Planen anger passen i procent av 5 km-fart, maratonfart, CS eller LT2. De
 * procenten ändras aldrig. Det som ändras är formuppskattningen: ett nytt
 * test, ett lopp eller en tid löparen själv anger ger nya tempon med samma
 * relation till farterna.
 *
 * Formuppskattningen är en 5 km-tid och en maratontid. Saknas den ena
 * räknas den ur den andra med Riegels formel – med löparens egen exponent
 * när den bygger på en lång insats, annars med 1,06. Maraton ur en kort
 * insats är ökänt optimistiskt, så en egen maratontid vinner alltid.
 *
 * Den nyaste uppskattningen gäller, oavsett om den kommer ur ett test eller
 * är inskriven; samma dag vinner den inskrivna.
 *
 * Modulen är ren.
 */

import { RIEGEL_EXPONENT } from "@/lib/calculators/race-prediction";
import {
  resolveWorkout,
  type ResolvedStep,
  type StepKind,
  type TargetBasis,
  type WorkoutBlock,
  type WorkoutStep,
} from "@/lib/workouts/schema";
import { targetText } from "@/lib/workouts/target-text";

import { formatAmount } from "./structure";

export const FIVE_K_M = 5000;
export const MARATHON_M = 42195;

/** En insats på minst så här lång tid räcker för att lita på exponenten mot maraton. */
const LONG_EFFORT_S = 40 * 60;

/** Tiden på `toM` ur tiden på `fromM`. */
export const riegel = (
  seconds: number,
  fromM: number,
  toM: number,
  exponent = RIEGEL_EXPONENT,
) => seconds * (toM / fromM) ** exponent;

export type FitnessEstimate = {
  fiveKSeconds: number;
  marathonSeconds: number;
  /** Vilken av tiderna som är uträknad ur den andra. Null: båda angivna. */
  derived: "5K" | "MP" | null;
  source: "manuell" | "test";
  /** Dagen uppskattningen gäller från. */
  date: string;
  note?: string | null;
};

/** Gör en uppskattning hel: den tid som saknas räknas ur den andra. */
export function completeEstimate(
  input: {
    fiveKSeconds?: number | null;
    marathonSeconds?: number | null;
    source: FitnessEstimate["source"];
    date: string;
    note?: string | null;
  },
  exponent = RIEGEL_EXPONENT,
): FitnessEstimate | null {
  const five =
    input.fiveKSeconds && input.fiveKSeconds > 0 ? input.fiveKSeconds : null;
  const mar =
    input.marathonSeconds && input.marathonSeconds > 0
      ? input.marathonSeconds
      : null;
  if (!five && !mar) return null;
  return {
    fiveKSeconds: five ?? riegel(mar!, MARATHON_M, FIVE_K_M, exponent),
    marathonSeconds: mar ?? riegel(five!, FIVE_K_M, MARATHON_M, exponent),
    derived: five && mar ? null : five ? "MP" : "5K",
    source: input.source,
    date: input.date,
    note: input.note ?? null,
  };
}

/** Det fartprofilen (`speedProfile`) behöver ge för en uppskattning. */
export type ProfileForEstimate = {
  /** T = scale · D^exponent. */
  scale: number;
  exponent: number;
  individual: boolean;
  used: { performedOn: string; seconds: number }[];
};

/**
 * Uppskattningen ur testerna och loppen: 5 km ur löparens egen kurva, och
 * maraton ur samma kurva bara när den bygger på en lång insats.
 */
export function estimateFromProfile(
  profile: ProfileForEstimate | null,
): FitnessEstimate | null {
  if (!profile || profile.used.length === 0) return null;
  const predict = (m: number) => profile.scale * m ** profile.exponent;
  const fiveK = predict(FIVE_K_M);
  if (!(fiveK > 0) || !Number.isFinite(fiveK)) return null;
  const long =
    profile.individual && profile.used.some((p) => p.seconds >= LONG_EFFORT_S);
  const date = profile.used.reduce(
    (d, p) => (p.performedOn > d ? p.performedOn : d),
    "",
  );
  return completeEstimate({
    fiveKSeconds: fiveK,
    marathonSeconds: long ? predict(MARATHON_M) : null,
    source: "test",
    date,
  });
}

/** Den nyaste uppskattningen. Samma dag vinner den inskrivna. */
export function currentEstimate(
  ...estimates: (FitnessEstimate | null | undefined)[]
): FitnessEstimate | null {
  let best: FitnessEstimate | null = null;
  for (const e of estimates) {
    if (!e) continue;
    if (
      !best ||
      e.date > best.date ||
      (e.date === best.date &&
        e.source === "manuell" &&
        best.source !== "manuell")
    ) {
      best = e;
    }
  }
  return best;
}

/** Farterna procenten räknas mot, i m/s. Det som saknas är utelämnat. */
export type ReferenceSpeeds = Partial<Record<TargetBasis, number>>;

export function referenceSpeeds(
  estimate: FitnessEstimate | null,
  measured: { cs?: number | null; lt2?: number | null } = {},
): ReferenceSpeeds {
  const out: ReferenceSpeeds = {};
  if (estimate) {
    out["5K"] = FIVE_K_M / estimate.fiveKSeconds;
    out.MP = MARATHON_M / estimate.marathonSeconds;
  }
  if (measured.cs && measured.cs > 0) out.CS = measured.cs;
  if (measured.lt2 && measured.lt2 > 0) out.LT2 = measured.lt2;
  return out;
}

/** Löpbaserna – de andra är watt eller simfart. */
export const RUNNING_BASES: TargetBasis[] = ["5K", "MP", "CS", "LT2"];

export type PacedStep = {
  kind: StepKind;
  label: string;
  /** "4 min" eller "1 km". */
  amount: string;
  /** "105 %" eller "70–75 %". */
  percent: string;
  /** "3:58/km". Null utan referens. */
  pace: string | null;
  metres: number | null;
  seconds: number;
};

export type PacedBlock = { times: number; steps: PacedStep[] };

const percentOf = (low: number, high: number) => {
  const l = Math.round(low * 100);
  const h = Math.round(high * 100);
  return l === h ? `${l} %` : `${l}–${h} %`;
};

/**
 * Passets block med tempo per steg. Utan referens får stegen bara sina
 * procent – passet går att läsa ändå.
 */
export function pacedBlocks(
  blocks: WorkoutBlock[] | null,
  reference: number | null | undefined,
): PacedBlock[] {
  if (!blocks) return [];
  const ref = reference && reference > 0 ? reference : null;
  const resolve = (step: WorkoutStep): PacedStep => {
    let resolved: ResolvedStep | null = null;
    if (ref) {
      resolved =
        resolveWorkout(
          {
            title: "",
            sport: "löpning",
            summary: "",
            rationale: "",
            basis: "CS",
            blocks: [{ type: "steg", step: { ...step } }],
          },
          ref,
        ).steps[0] ?? null;
    }
    return {
      kind: step.kind,
      label: step.label,
      amount: formatAmount(step),
      percent: percentOf(
        Math.min(step.low, step.high),
        Math.max(step.low, step.high),
      ),
      pace: resolved ? targetText(resolved, "löpning") : null,
      metres: resolved?.metres ?? step.distanceM ?? null,
      seconds: resolved?.seconds ?? step.durationSeconds ?? 0,
    };
  };
  return blocks.map((b) =>
    b.type === "steg"
      ? { times: 1, steps: [resolve(b.step)] }
      : { times: b.times, steps: b.steps.map(resolve) },
  );
}

/** Passets sträcka i meter med löparens tempon. Null när den inte går att räkna. */
export function blocksMetres(
  blocks: WorkoutBlock[] | null,
  reference: number | null | undefined,
): number | null {
  if (!blocks || !reference || !(reference > 0)) return null;
  const resolved = resolveWorkout(
    {
      title: "",
      sport: "löpning",
      summary: "",
      rationale: "",
      basis: "CS",
      blocks,
    },
    reference,
  );
  return resolved.dropped > 0 ? null : resolved.totalMetres;
}

/** "18:30" för 5 km, "3:12:05" för maraton. */
export function raceTimeText(seconds: number): string {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * Läser en tid som "18:30", "3:12:05" eller "3.12.05" till sekunder. Null
 * när den inte går att läsa.
 */
export function parseRaceTime(text: string): number | null {
  const parts = text.trim().replace(/\./g, ":").split(":");
  if (parts.length < 2 || parts.length > 3) return null;
  if (!parts.every((p) => /^\d{1,3}$/.test(p))) return null;
  const nums = parts.map(Number);
  const [h, m, s] = nums.length === 3 ? nums : [0, nums[0], nums[1]];
  if (m >= 60 && nums.length === 3) return null;
  if (s >= 60) return null;
  const total = h * 3600 + m * 60 + s;
  return total > 0 ? total : null;
}

/**
 * Ett pass längd och tid med löparens tempon: angiven sträcka och tid
 * först, annars räknad ur strukturen. Null där det inte går att räkna.
 */
export function sessionAmount(
  variant: {
    distanceM: number | null;
    durationS: number | null;
    basis: TargetBasis | null;
    blocks: WorkoutBlock[] | null;
  },
  refs: ReferenceSpeeds,
): { metres: number | null; seconds: number | null } {
  const ref = variant.basis ? refs[variant.basis] : undefined;
  const resolved =
    variant.blocks && ref
      ? resolveWorkout(
          {
            title: "",
            sport: "löpning",
            summary: "",
            rationale: "",
            basis: "CS",
            blocks: variant.blocks,
          },
          ref,
        )
      : null;
  const complete = resolved && resolved.dropped === 0 ? resolved : null;
  return {
    metres: variant.distanceM ?? complete?.totalMetres ?? null,
    seconds: variant.durationS ?? complete?.totalSeconds ?? null,
  };
}
