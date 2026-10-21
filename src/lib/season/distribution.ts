/**
 * Intensitetsfördelningen: hur periodens pass fördelar sig på lugnt, medel
 * och högt, och vad fasen brukar ha.
 *
 * Passen räknas efter sitt huvudsyfte, inte efter minuter i zon (filosofin,
 * avsnitt 19). Ett VO2max-pass är ett högintensivt pass även om det mest är
 * uppvärmning och vila; ett distanspass med stegringar är lugnt. Det är så
 * fördelningen beskrivs i studierna (Seiler & Kjerland 2006; Sylta m.fl.
 * 2014), och det säger mer om vad passet kostar i återhämtning.
 *
 * Tre zoner med LT1 och LT2 som gränser motsvarar ungefär zon 1–2, 3–4 och
 * 5–6 i passens sexzonsskala.
 */

import type { AdeptRaceRow, TrainingBlockRow } from "@/lib/types/database";
import { zoneOf } from "@/lib/workouts/intensity";
import {
  flattenWorkout,
  type Workout,
  type WorkoutStep,
} from "@/lib/workouts/schema";

export type SessionGoal = "lugn" | "medel" | "hög";

export const SESSION_GOALS: { key: SessionGoal; label: string }[] = [
  { key: "lugn", label: "Lugnt" },
  { key: "medel", label: "Medel" },
  { key: "hög", label: "Högt" },
];

/** Sexzonsskalans zon i tre: under LT1, mellan trösklarna, över LT2. */
const goalOfZone = (zone: number): SessionGoal =>
  zone <= 2 ? "lugn" : zone <= 4 ? "medel" : "hög";

/**
 * Passets huvudsyfte ur dess steg.
 *
 * Huvuddelen är intervallstegen; ett pass utan intervaller räknas på sina
 * distanssteg, liksom ett distanspass med några korta stegringar.
 * Uppvärmning, vila och nedvarvning räknas inte – stegringar i uppvärmningen
 * gör inte ett distanspass hårt. Den zon som har mest tid i
 * huvuddelen avgör, och vid lika väger den högre tyngst.
 *
 * Steg i meter får sin tid ur farten, som i resten av passbyggaren. Saknas
 * referensen räknas sträckan grovt om med 4 m/s; det är bara vikten mellan
 * stegen som behövs.
 */
export function sessionGoal(
  workout: Pick<Workout, "basis" | "blocks">,
  reference: number,
): SessionGoal | null {
  const steps = flattenWorkout(workout as Workout).map((f) => f.step);
  const secondsOf = (step: WorkoutStep) => {
    if (step.durationSeconds && step.durationSeconds > 0)
      return step.durationSeconds;
    if (step.distanceM && step.distanceM > 0) {
      const mid = (step.low + step.high) / 2;
      return step.distanceM / (reference > 0 && mid > 0 ? mid * reference : 4);
    }
    return 0;
  };
  const sum = (list: WorkoutStep[]) =>
    list.reduce((total, s) => total + secondsOf(s), 0);

  const intervals = steps.filter((s) => s.kind === "intervall");
  const distance = steps.filter((s) => s.kind === "distans");
  // Stegringar efter ett distanspass: några minuter fart på en timme lugnt
  // gör inte passet hårt. Backsprinter utan distansdel är däremot passet.
  const strides = sum(intervals) < 180 && sum(distance) >= 10 * sum(intervals);
  const main =
    intervals.length > 0 && !strides
      ? intervals
      : steps.filter(
          (s) =>
            s.kind !== "intervall" &&
            s.kind !== "uppvärmning" &&
            s.kind !== "nedvarvning" &&
            s.kind !== "vila",
        );
  if (main.length === 0) return null;

  const time: Record<SessionGoal, number> = { lugn: 0, medel: 0, hög: 0 };
  for (const step of main) {
    const seconds = secondsOf(step);
    if (!(seconds > 0)) continue;
    const mid = (step.low + step.high) / 2;
    time[goalOfZone(zoneOf(mid, workout.basis))] += seconds;
  }

  let best: SessionGoal | null = null;
  for (const goal of ["lugn", "medel", "hög"] as SessionGoal[]) {
    if (time[goal] <= 0) continue;
    if (!best || time[goal] >= time[best]) best = goal;
  }
  return best;
}

export type Distribution = Record<SessionGoal, number> & { total: number };

export function distribution(goals: (SessionGoal | null)[]): Distribution {
  const counts: Distribution = { lugn: 0, medel: 0, hög: 0, total: 0 };
  for (const goal of goals) {
    if (!goal) continue;
    counts[goal] += 1;
    counts.total += 1;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Tävlingens karaktär
// ---------------------------------------------------------------------------

/**
 * Var tävlingen avgörs: lång går mest mellan trösklarna, kort över LT2,
 * mellan nära LT2. Styr vilken kvalitet som växer i den specifika perioden.
 */
export type RaceDemand = "lång" | "mellan" | "kort";

export const RACE_DEMAND_TEXT: Record<RaceDemand, string> = {
  lång: "en lång tävling – kvaliteten flyttas mot tävlingsfart och tröskel, med högt som underhåll",
  mellan:
    "en tävling nära tröskeln – kvaliteten delas mellan tröskel och VO₂max",
  kort: "en kort tävling som avgörs över tröskeln – andelen högt växer",
};

/** Kilometer ur fri text: "21,1 km", "160km". Meter räknas om. */
function kilometres(text: string): number | null {
  const km = text.match(/(\d+(?:[.,]\d+)?)\s*km\b/);
  if (km) return Number(km[1].replace(",", "."));
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*m\b/);
  if (m) return Number(m[1].replace(",", ".")) / 1000;
  const mil = text.match(/(\d+(?:[.,]\d+)?)\s*mil\b/);
  if (mil) return Number(mil[1].replace(",", ".")) * 10;
  return null;
}

/**
 * Tävlingens karaktär ur gren, distans och namn. Null när texten inte säger
 * tillräckligt – då beskrivs regeln i stället för att gissas.
 */
export function raceDemand(
  race: Pick<AdeptRaceRow, "sport" | "distance" | "name">,
): RaceDemand | null {
  const text = `${race.distance ?? ""} ${race.name}`.toLowerCase();

  if (
    /ironman|70\.3|halv-?ironman|half|\bim\b|långdistans|full distans/.test(
      text,
    )
  )
    return "lång";
  if (
    /ultra|marat|halvmara|vasalopp|vätternrund|långlopp|gran fondo|gravel/.test(
      text,
    )
  )
    return "lång";
  if (/olymp|standard|kvartsironman/.test(text)) return "mellan";
  if (/sprint|kriterium|crit|backlopp|bergslopp|hill ?climb/.test(text))
    return "kort";

  const km = kilometres(text);
  if (km === null) return null;
  switch (race.sport) {
    case "löpning":
      return km >= 15 ? "lång" : "kort";
    case "cykling":
      return km >= 80 ? "lång" : km >= 30 ? "mellan" : "kort";
    case "simning":
      return km >= 3 ? "lång" : km >= 1.5 ? "mellan" : "kort";
    case "triathlon":
      return km >= 70 ? "lång" : km >= 40 ? "mellan" : "kort";
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Fasens riktmärken
// ---------------------------------------------------------------------------

/** Andel av passen, 0–1. */
export type Band = { min: number; max: number };

export type PhaseTarget = {
  /** "Polariserad", "Pyramidal, tävlingsfart" … */
  model: string;
  /** En mening om vad fasen ska ha. */
  text: string;
  /** Riktmärken per zon; null i toppningen, där volymen styr och inte andelen. */
  bands: Record<SessionGoal, Band> | null;
};

const band = (min: number, max: number): Band => ({ min, max });

/** Blockets egenskap ur fokustexten: VO2max eller tröskel. */
function blockKind(focus: string | null): "vo2" | "tröskel" | null {
  const text = (focus ?? "").toLowerCase();
  if (/vo2|vo₂|syreupptag|aerob kraft|aerob effekt/.test(text)) return "vo2";
  if (
    /tröskel|threshold|lt2|ftp|sweet ?spot|tempo|tävlingsfart|målfart/.test(
      text,
    )
  )
    return "tröskel";
  return null;
}

/**
 * Riktmärkena för en period, ur filosofins tabell (avsnitt 19). De är till
 * för att upptäcka glidning, inte för att styra varje vecka.
 */
export function phaseTarget(
  block: Pick<TrainingBlockRow, "phase" | "focus">,
  demand: RaceDemand | null,
): PhaseTarget {
  switch (block.phase) {
    case "grund":
      return {
        model: "Polariserad",
        text: "Mest lugnt, utvald hög intensitet och lite mellanintensitet.",
        bands: {
          lugn: band(0.8, 1),
          medel: band(0, 0.1),
          hög: band(0.1, 0.2),
        },
      };
    case "uppbyggnad": {
      const kind = blockKind(block.focus);
      if (kind === "vo2")
        return {
          model: "VO₂max-block",
          text: "Ett eller två återkommande VO₂max-format, resten lugnt.",
          bands: {
            lugn: band(0.75, 0.85),
            medel: band(0, 0.1),
            hög: band(0.1, 0.2),
          },
        };
      if (kind === "tröskel")
        return {
          model: "Tröskelblock",
          text: "Ett eller två återkommande tröskelformat, resten lugnt.",
          bands: {
            lugn: band(0.75, 0.85),
            medel: band(0.1, 0.2),
            hög: band(0, 0.1),
          },
        };
      return {
        model: "Blockets egenskap styr",
        text: "Kvaliteten följer blockets mål – skriv VO₂max eller tröskel i fokus så jämförs perioden mot rätt riktmärke.",
        bands: {
          lugn: band(0.75, 0.85),
          medel: band(0, 0.2),
          hög: band(0, 0.2),
        },
      };
    }
    case "specifik":
      if (demand === "lång")
        return {
          model: "Pyramidal, tävlingsfart",
          text: `Inför ${RACE_DEMAND_TEXT.lång}.`,
          bands: {
            lugn: band(0.7, 0.8),
            medel: band(0.15, 0.25),
            hög: band(0, 0.1),
          },
        };
      if (demand === "kort")
        return {
          model: "Pyramidal, över tröskeln",
          text: `Inför ${RACE_DEMAND_TEXT.kort}.`,
          bands: {
            lugn: band(0.7, 0.8),
            medel: band(0.05, 0.15),
            hög: band(0.15, 0.2),
          },
        };
      return {
        model: "Pyramidal",
        text:
          demand === "mellan"
            ? `Inför ${RACE_DEMAND_TEXT.mellan}.`
            : "Kvaliteten flyttas mot den intensitet tävlingen avgörs i. Lägg in loppets distans så jämförs perioden mot rätt riktmärke.",
        bands: {
          lugn: band(0.7, 0.8),
          medel: band(0.05, 0.25),
          hög: band(0, 0.2),
        },
      };
    case "topp":
      return {
        model: "Volym ned, intensitet kvar",
        text: "Andelen lugnt blir lägre än vanligt när volymen sjunker – det är väntat.",
        bands: null,
      };
    case "vila":
      return {
        model: "Lugnt",
        text: "Återhämtning och övergång: nästan allt lugnt.",
        bands: { lugn: band(0.9, 1), medel: band(0, 0.1), hög: band(0, 0.1) },
      };
  }
}

/** Under så här många pass säger andelarna för lite för att jämföras. */
export const MIN_SESSIONS = 6;

const pct = (share: number) => `${Math.round(share * 100)} %`;

/**
 * Var perioden avviker från riktmärkena, i ord. Tom när den ligger inom dem,
 * när passen är för få, eller i toppningen.
 */
export function distributionNotes(
  counts: Distribution,
  target: PhaseTarget,
): string[] {
  if (!target.bands || counts.total < MIN_SESSIONS) return [];
  const notes: string[] = [];
  for (const { key, label } of SESSION_GOALS) {
    const share = counts[key] / counts.total;
    const { min, max } = target.bands[key];
    // En halv procentenhets marginal, så att 10 % av 10 pass inte blir "över".
    if (share > max + 0.005) {
      notes.push(`${label} ${pct(share)} – över riktmärket ${pct(max)}.`);
    } else if (share < min - 0.005) {
      notes.push(`${label} ${pct(share)} – under riktmärket ${pct(min)}.`);
    }
  }
  return notes;
}

/** Ett pass som perioden ska räkna: dagen och huvudsyftet. */
export type PlannedGoal = { date: string; goal: SessionGoal | null };

/** Passen i en period, räknade. */
export function blockDistribution(
  block: Pick<TrainingBlockRow, "starts_on" | "ends_on">,
  planned: PlannedGoal[],
): Distribution {
  return distribution(
    planned
      .filter((p) => block.starts_on <= p.date && p.date <= block.ends_on)
      .map((p) => p.goal),
  );
}

/** Ett genomfört pass som perioden ska räkna. */
export type DoneGoalLike = {
  date: string;
  goal: SessionGoal | null;
  isRace: boolean;
};

/**
 * De genomförda passen i en period, räknade som de planerade. Tävlingar
 * räknas för sig – riktmärkena gäller träningen – liksom pass utan klassning
 * (simning, pass utan zoner).
 */
export function doneDistribution(
  block: Pick<TrainingBlockRow, "starts_on" | "ends_on">,
  done: DoneGoalLike[],
): { counts: Distribution; races: number; unclassified: number } {
  const inBlock = done.filter(
    (d) => block.starts_on <= d.date && d.date <= block.ends_on,
  );
  const training = inBlock.filter((d) => !d.isRace);
  return {
    counts: distribution(training.map((d) => d.goal)),
    races: inBlock.length - training.length,
    unclassified: training.filter((d) => d.goal === null).length,
  };
}
