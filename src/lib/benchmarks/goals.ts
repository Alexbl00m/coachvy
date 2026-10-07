/**
 * Allt gap-analysen behöver, räknat på ett ställe: adeptens värden, gapen mot
 * målnivån och avståndet till de kommande tävlingsmålen. Sidan och
 * AI-coachens underlag läser samma resultat, så att de inte kan säga olika
 * saker.
 *
 * Modulen är ren; anropen görs av den som anropar.
 */

import {
  bestCurve,
  inPeriod,
  type ProfileSource,
} from "@/lib/activities/profile";
import type { FullSession } from "@/lib/tests/session-queries";
import { speedProfile } from "@/lib/tests/speed-profile";
import type { AdeptRaceRow } from "@/lib/types/database";
import { formatDuration } from "@/lib/workouts/schema";
import type { Sex } from "./coggan";
import { gapsToGroup, readGaps, type MetricGap } from "./gap";
import {
  BIKE_ASSUMPTIONS,
  cyclingGap,
  raceGoal,
  runningGap,
  type CyclingGap,
  type RaceGoal,
  type RunningGap,
} from "./race-goal";
import type { ReferenceGroup, ReferenceLevels } from "./reference-levels";
import { adeptValues, type AdeptValues } from "./values";

export type RaceLine = {
  race: AdeptRaceRow;
  goal: RaceGoal | null;
  gap: RunningGap | CyclingGap | null;
  weeks: number;
  /** Avståndet i ord, eller varför det inte gick att räkna. */
  reading: string;
};

export type Goals = {
  values: AdeptValues;
  sex: Sex;
  target: ReferenceGroup | null;
  gaps: MetricGap[];
  reading: string[];
  races: RaceLine[];
};

const PRIORITY_ORDER = { A: 0, B: 1, C: 2 } as const;
const DAY = 86_400_000;

const sv = (v: number, digits = 0) =>
  v.toFixed(digits).replace(".", ",").replace("-", "−");

function raceReading(
  goal: RaceGoal,
  gap: RunningGap | CyclingGap,
  weeks: number,
  riderKg: number | null,
): string {
  if (gap.kind === "löpning") {
    return `Prognos ur testerna: ${formatDuration(gap.personal)} med den egna fartkurvan${gap.vdot ? `, ${formatDuration(gap.vdot)} med VDOT` : ""}. ${
      gap.marginSeconds <= 0
        ? `Inom räckhåll – prognosen är ${formatDuration(-gap.marginSeconds)} snabbare än målet.`
        : `Målet kräver ${sv(gap.speedGapPct, 1)} % högre fart än prognosen${weeks > 0 ? ` – ungefär ${sv(gap.speedGapPct / weeks, 2)} % i veckan på ${weeks} veckor` : ""}.`
    }`;
  }
  const tt = gap.cda === BIKE_ASSUMPTIONS.cdaTimeTrial;
  return `Solo på platt väg kräver det omkring ${sv(gap.requiredWatts)} W (${tt ? "tempoposition" : "underdel"}, CdA ${sv(gap.cda, 2)}${riderKg ? `, ${sv(riderKg + BIKE_ASSUMPTIONS.equipmentKg)} kg med cykel` : ""}) – ${sv(gap.intensity * 100)} % av FTP ${sv(gap.ftp)} W. Över ${formatDuration(goal.targetSeconds)} brukar omkring ${sv(gap.sustainable * 100)} % av FTP gå att hålla. ${
    gap.powerGapPct <= 0
      ? "Målet ligger inom räckhåll."
      : `Målet kräver ungefär ${sv(gap.powerGapPct)} % mer än så – högre FTP, bättre aerodynamik eller drafting.`
  }${tt ? "" : " I klunga krävs klart mindre."} Backar och vind räknas inte.`;
}

export function computeGoals(input: {
  targetLevel: string | null | undefined;
  sessions: FullSession[];
  profileSex: string | null;
  sources: ProfileSource[];
  races: AdeptRaceRow[];
  levels: ReferenceLevels;
  today: string;
  protocolLabel: (key: string) => string;
}): Goals {
  const { today } = input;

  // Sprinten ur träningen det senaste året, om inget sprinttest finns.
  const yearAgo = new Date(Date.parse(today) - 364 * DAY)
    .toISOString()
    .slice(0, 10);
  const sprint = bestCurve(
    inPeriod(input.sources, "power", yearAgo, today),
    "power",
  ).find((p) => p.span === 20);

  const values = adeptValues(input.sessions, {
    profileSex: input.profileSex,
    trainingSprint: sprint ? { watts: sprint.value, date: sprint.date } : null,
    protocolLabel: input.protocolLabel,
  });
  const sex = values.sex ?? "man";
  const target =
    input.levels.groups.find((g) => g.id === input.targetLevel) ?? null;
  const gaps = target
    ? gapsToGroup(values, input.levels.groups, sex, target.id)
    : [];

  const running = speedProfile(input.sessions);
  const ftp =
    values.ftp?.watts ??
    (values.values.cpPerKg && values.weightKg
      ? values.values.cpPerKg.value * values.weightKg * 0.95
      : null);

  const races = input.races
    .filter((r) => r.race_date >= today && (r.target || r.priority === "A"))
    .sort(
      (a, b) =>
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
        a.race_date.localeCompare(b.race_date),
    )
    .slice(0, 4)
    .map((race): RaceLine => {
      const goal = raceGoal(race);
      const weeks = Math.max(
        0,
        Math.round((Date.parse(race.race_date) - Date.parse(today)) / DAY / 7),
      );
      const line = (
        gap: RunningGap | CyclingGap | null,
        reading: string,
      ): RaceLine => ({ race, goal, gap, weeks, reading });

      if (!goal) {
        return line(
          null,
          "Skriv distansen och målet så att de går att räkna på – till exempel ”42,2 km” och ”under 3:15:00” – så räknas avståndet.",
        );
      }
      if (race.sport === "löpning") {
        if (!running) {
          return line(
            null,
            "Ingen fartprofil ur löptesterna ännu – ett CS-test, ett 5 km-test eller ett lopp ger en prognos att jämföra med.",
          );
        }
        const gap = runningGap(goal, running);
        return line(gap, raceReading(goal, gap, weeks, values.weightKg));
      }
      if (race.sport === "cykling") {
        if (!ftp || !values.weightKg) {
          return line(
            null,
            "FTP eller vikt saknas – ett cykeltest med vikt ger effekten målet kräver.",
          );
        }
        const gap = cyclingGap(goal, ftp, values.weightKg);
        return line(gap, raceReading(goal, gap, weeks, values.weightKg));
      }
      return line(
        null,
        "Avståndet räknas för löp- och cykellopp. För triathlon: sätt ett mål per gren.",
      );
    });

  return {
    values,
    sex,
    target,
    gaps,
    reading: target ? readGaps(gaps, target.name) : [],
    races,
  };
}
