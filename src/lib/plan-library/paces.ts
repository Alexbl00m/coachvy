/**
 * Tempona i en löpplan, ur löparens formuppskattning.
 *
 * Planen anger passen i procent av en loppfart (5 km, 10 km, halvmaraton,
 * maraton), CS eller LT2, eller i zoner. De procenten ändras aldrig. Det som
 * ändras är formuppskattningen: ett nytt test, ett lopp eller en tid löparen
 * själv anger ger nya tempon med samma relation till farterna.
 *
 * Formuppskattningen är en tid på var och en av de fyra distanserna. Den
 * som saknas räknas ur den angivna tid som ligger närmast i distans – ju
 * kortare steg, desto mindre fel (Riegel, 1,06). Ligger distansen mellan
 * två angivna tider används löparens egen exponent mellan dem. Maraton ur
 * en kort insats är ökänt optimistiskt, så en 10 km- eller halvmaratontid
 * slår 5 km-tiden för de längre loppen.
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

import {
  MARATHON_M,
  RACE_FACTOR,
  RACES,
  raceByKey,
  raceByMetres,
  type RaceKey,
} from "./races";
import { formatAmount } from "./structure";
import { zoneLabel } from "./zones";

export const FIVE_K_M = 5000;
export { MARATHON_M };

/** En insats på minst så här lång tid räcker för att lita på exponenten mot maraton. */
const LONG_EFFORT_S = 40 * 60;

/** Egen exponent mellan två tider hålls inom rimliga gränser. */
const EXPONENT_RANGE: [number, number] = [1.02, 1.15];

/** Tiden på `toM` ur tiden på `fromM`. */
export const riegel = (
  seconds: number,
  fromM: number,
  toM: number,
  exponent = RIEGEL_EXPONENT,
) => seconds * (toM / fromM) ** exponent;

export type FitnessEstimate = {
  /** Tiden på varje distans i sekunder, angiven eller uträknad. */
  times: Record<RaceKey, number>;
  /** Distanserna vars tid är uträknad ur de andra. */
  derived: RaceKey[];
  source: "manuell" | "test";
  /** Dagen uppskattningen gäller från. */
  date: string;
  note?: string | null;
};

/**
 * Tiden på `metres` ur de angivna tiderna: från den närmaste distansen, med
 * löparens egen exponent när distansen ligger mellan två angivna.
 */
export function predictTime(
  given: { metres: number; seconds: number }[],
  metres: number,
  exponent = RIEGEL_EXPONENT,
): number | null {
  const points = given.filter((g) => g.seconds > 0 && g.metres > 0);
  if (points.length === 0) return null;
  const gap = (m: number) => Math.abs(Math.log(metres / m));
  const sorted = [...points].sort((a, b) => gap(a.metres) - gap(b.metres));
  const near = sorted[0];
  if (gap(near.metres) < 1e-6) return near.seconds;
  // Den närmaste tiden på andra sidan om distansen, om någon.
  const side = Math.sign(near.metres - metres);
  const other = sorted.find((p) => Math.sign(p.metres - metres) === -side);
  let e = exponent;
  if (other) {
    const own =
      Math.log(other.seconds / near.seconds) /
      Math.log(other.metres / near.metres);
    if (Number.isFinite(own)) {
      e = Math.min(EXPONENT_RANGE[1], Math.max(EXPONENT_RANGE[0], own));
    }
  }
  return riegel(near.seconds, near.metres, metres, e);
}

/** Gör en uppskattning hel: de tider som saknas räknas ur de angivna. */
export function completeEstimate(
  input: {
    times: Partial<Record<RaceKey, number | null | undefined>>;
    source: FitnessEstimate["source"];
    date: string;
    note?: string | null;
  },
  exponent = RIEGEL_EXPONENT,
): FitnessEstimate | null {
  const given = RACES.filter((r) => {
    const t = input.times[r.key];
    return typeof t === "number" && t > 0;
  }).map((r) => ({
    key: r.key,
    metres: r.metres,
    seconds: input.times[r.key]!,
  }));
  if (given.length === 0) return null;
  const times = {} as Record<RaceKey, number>;
  const derived: RaceKey[] = [];
  for (const race of RACES) {
    const own = given.find((g) => g.key === race.key);
    if (own) {
      times[race.key] = own.seconds;
    } else {
      times[race.key] = predictTime(given, race.metres, exponent)!;
      derived.push(race.key);
    }
  }
  return {
    times,
    derived,
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
 * Uppskattningen ur testerna och loppen: 5 och 10 km ur löparens egen
 * kurva, och halvmaraton och maraton ur samma kurva bara när den bygger på
 * en lång insats. Annars räknas de ur 10 km-tiden.
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
    times: {
      "5K": fiveK,
      "10K": predict(raceByKey("10K").metres),
      HM: long ? predict(raceByKey("HM").metres) : null,
      M: long ? predict(MARATHON_M) : null,
    },
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

/**
 * Farterna ur en uppskattning. `MP` är farten zonerna räknas mot: för ett
 * maraton maratonfarten, för en plan mot ett kortare lopp loppfarten delad
 * med loppets faktor (races.ts) – så att @HM i en halvmaratonplan blir
 * exakt halvmaratonfarten.
 */
export function referenceSpeeds(
  estimate: FitnessEstimate | null,
  measured: { cs?: number | null; lt2?: number | null } = {},
  raceMetres: number | null = null,
): ReferenceSpeeds {
  const out: ReferenceSpeeds = {};
  if (estimate) {
    const speed = (key: RaceKey) => raceByKey(key).metres / estimate.times[key];
    out["5K"] = speed("5K");
    out["10K"] = speed("10K");
    out.HM = speed("HM");
    const race = raceByMetres(raceMetres);
    out.MP =
      race && race.key !== "M"
        ? speed(race.key) / RACE_FACTOR[race.key]
        : speed("M");
  }
  if (measured.cs && measured.cs > 0) out.CS = measured.cs;
  if (measured.lt2 && measured.lt2 > 0) out.LT2 = measured.lt2;
  return out;
}

/** Löpbaserna – de andra är watt eller simfart. */
export const RUNNING_BASES: TargetBasis[] = [
  "5K",
  "10K",
  "HM",
  "MP",
  "CS",
  "LT2",
];

export type PacedStep = {
  kind: StepKind;
  label: string;
  /** "4 min" eller "1 km". */
  amount: string;
  /** "105 %" eller "70–75 %". */
  percent: string;
  /** Zonen steget ligger på, "LO" eller "HM-10K", när passet står i zoner. */
  zone: string | null;
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
  basis: TargetBasis | null = null,
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
      zone:
        basis === "MP"
          ? zoneLabel(
              Math.min(step.low, step.high),
              Math.max(step.low, step.high),
            )
          : null,
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
