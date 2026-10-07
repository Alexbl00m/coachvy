/**
 * Tävlingsmålet som tal, och avståndet dit.
 *
 * Säsongsplanens tävlingar har distans och mål som fri text – "315 km",
 * "under 9 timmar", "10 km", "sub 41:30". Här tolkas texten till meter och
 * sekunder. Ett mål som "2:59" kan vara timmar och minuter eller minuter och
 * sekunder; det som ger en rimlig fart för grenen väljs.
 *
 * Löpning jämförs mot prognosen ur testerna (adeptens egen fartkurva, och
 * VDOT). Cykling har ingen sådan prognos – farten beror på bana, vind och
 * klunga – så där räknas effekten målet kräver solo på platt väg och läggs mot
 * vad som brukar gå att hålla över loppets längd.
 */

import { airDensity, powerForSpeed } from "@/lib/calculators/bike-power";
import { timeFromVdot } from "@/lib/calculators/daniels";
import type { SpeedProfile } from "@/lib/tests/speed-profile";
import type { AdeptRaceRow } from "@/lib/types/database";

export type RaceGoal = {
  id: string;
  name: string;
  date: string;
  sport: AdeptRaceRow["sport"];
  priority: AdeptRaceRow["priority"];
  metres: number;
  targetSeconds: number;
};

/** Rimlig snittfart per gren, m/s – för att välja tolkning av "2:59". */
const PLAUSIBLE: Record<string, [number, number]> = {
  löpning: [1.5, 7],
  cykling: [3, 17],
  simning: [0.4, 2.5],
};

export function parseDistance(text: string | null): number | null {
  if (!text) return null;
  const t = text.toLowerCase().replace(/,/g, ".");
  if (/halvmara/.test(t)) return 21097.5;
  if (/\bmara(ton|thon)\b/.test(t)) return 42195;
  let m = t.match(/(\d+(?:\.\d+)?)\s*km\b/);
  if (m) return Number(m[1]) * 1000;
  m = t.match(/(\d+(?:\.\d+)?)\s*mil\b/);
  if (m) return Number(m[1]) * 10_000;
  m = t.match(/(\d+(?:\.\d+)?)\s*m\b/);
  if (m) return Number(m[1]);
  return null;
}

export function parseTargetSeconds(
  text: string | null,
  metres: number,
  sport: string | null,
): number | null {
  if (!text) return null;
  const t = text.toLowerCase().replace(/,/g, ".");

  let m = t.match(/(\d{1,2}):(\d{2}):(\d{2})/);
  if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);

  m = t.match(/(\d{1,3}):(\d{2})/);
  if (m) {
    const [lo, hi] = PLAUSIBLE[sport ?? ""] ?? [0.4, 17];
    const candidates = [
      Number(m[1]) * 3600 + Number(m[2]) * 60,
      Number(m[1]) * 60 + Number(m[2]),
    ];
    return (
      candidates.find((s) => {
        const v = metres / s;
        return v >= lo && v <= hi;
      }) ?? null
    );
  }

  m = t.match(
    /(\d+(?:\.\d+)?)\s*(?:h|tim(?:me|mar)?)\b(?:\s*(?:och\s*)?(\d+)\s*min)?/,
  );
  if (m) return Number(m[1]) * 3600 + Number(m[2] ?? 0) * 60;

  m = t.match(/(\d+(?:\.\d+)?)\s*min/);
  if (m) return Number(m[1]) * 60;
  return null;
}

/** En tävling med tolkningsbar distans och måltid, annars null. */
export function raceGoal(race: AdeptRaceRow): RaceGoal | null {
  const metres = parseDistance(race.distance) ?? parseDistance(race.name);
  if (!metres) return null;
  const targetSeconds = parseTargetSeconds(race.target, metres, race.sport);
  if (!targetSeconds) return null;
  return {
    id: race.id,
    name: race.name,
    date: race.race_date,
    sport: race.sport,
    priority: race.priority,
    metres,
    targetSeconds,
  };
}

export type RunningGap = {
  kind: "löpning";
  /** Prognosen ur adeptens egen fartkurva, sekunder. */
  personal: number;
  vdot: number | null;
  /** Prognos − mål. Negativt = prognosen är snabbare än målet. */
  marginSeconds: number;
  /** Farten som krävs i förhållande till prognosens, −1. Positivt = snabbare krävs. */
  speedGapPct: number;
};

export function runningGap(goal: RaceGoal, profile: SpeedProfile): RunningGap {
  const personal = profile.scale * goal.metres ** profile.exponent;
  const vdot = profile.vdot
    ? timeFromVdot(profile.vdot.value, goal.metres)
    : null;
  return {
    kind: "löpning",
    personal,
    vdot,
    marginSeconds: personal - goal.targetSeconds,
    speedGapPct: (personal / goal.targetSeconds - 1) * 100,
  };
}

/** Antagandena för cykelns effektberäkning, så att de går att visa. */
export const BIKE_ASSUMPTIONS = {
  /** Underdel, normal – landsväg. */
  cda: 0.32,
  /** Tempoposition med aerobygel, för tempolopp. */
  cdaTimeTrial: 0.25,
  crr: 0.0033,
  /** Cykel, kläder och utrustning. */
  equipmentKg: 9.5,
  drivetrain: 0.975,
};

/** Ett tempolopp körs i tempoposition, ett linjelopp i underdelen. */
export const isTimeTrial = (name: string) =>
  /tempo|\btt\b|time ?trial|tidskörning|kronolopp/i.test(name);

/**
 * Andel av FTP som brukar gå att hålla över en viss tid: hela FTP i en timme,
 * sedan omkring 11 % mindre per fördubblad tid. En grov tumregel som stämmer
 * med vanliga IF-nivåer – ca 0,89 för 2 h, 0,78 för 4 h, 0,65 för 9 h.
 */
export function sustainableFraction(seconds: number): number {
  const hours = seconds / 3600;
  if (hours <= 1) return 1;
  return Math.max(0.5, 1 - 0.11 * Math.log2(hours));
}

export type CyclingGap = {
  kind: "cykling";
  speedKmh: number;
  /** CdA som räknades med: tempoposition eller underdel. */
  cda: number;
  /** Effekten målet kräver solo på platt väg, W. */
  requiredWatts: number;
  ftp: number;
  /** requiredWatts / ftp. */
  intensity: number;
  /** Vad som brukar gå att hålla över loppets längd, som andel av FTP. */
  sustainable: number;
  /** Krävd effekt mot hållbar, −1. Positivt = målet kräver mer. */
  powerGapPct: number;
};

export function cyclingGap(
  goal: RaceGoal,
  ftp: number,
  riderKg: number,
): CyclingGap {
  const speed = goal.metres / goal.targetSeconds;
  const cda = isTimeTrial(goal.name)
    ? BIKE_ASSUMPTIONS.cdaTimeTrial
    : BIKE_ASSUMPTIONS.cda;
  const { riderWatts } = powerForSpeed(speed, {
    totalWeightKg: riderKg + BIKE_ASSUMPTIONS.equipmentKg,
    gradePercent: 0,
    cda,
    crr: BIKE_ASSUMPTIONS.crr,
    windMs: 0,
    airDensityKgM3: airDensity(100, 15),
    drivetrainEfficiency: BIKE_ASSUMPTIONS.drivetrain,
  });
  const sustainable = sustainableFraction(goal.targetSeconds);
  return {
    kind: "cykling",
    speedKmh: speed * 3.6,
    cda,
    requiredWatts: riderWatts,
    ftp,
    intensity: riderWatts / ftp,
    sustainable,
    powerGapPct: (riderWatts / (ftp * sustainable) - 1) * 100,
  };
}
