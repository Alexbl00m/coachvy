/**
 * Loppdistanserna formuppskattningen och planerna räknar med: 5 km, 10 km,
 * halvmaraton och maraton.
 *
 * En plan leder fram till ett lopp (`plan_templates.race_distance_m`).
 * Måltiden gäller den distansen, och zonerna räknas ur farten på den.
 *
 * Modulen är ren.
 */

export type RaceKey = "5K" | "10K" | "HM" | "M";

export type Race = {
  key: RaceKey;
  metres: number;
  /** "5 km", "halvmaraton". */
  name: string;
  /** En tid som exempel, för fältens platshållare. */
  example: string;
  /** Rimliga gränser i sekunder: världsrekordet och en promenad. */
  min: number;
  max: number;
};

export const RACES: Race[] = [
  {
    key: "5K",
    metres: 5000,
    name: "5 km",
    example: "22:30",
    min: 12 * 60,
    max: 90 * 60,
  },
  {
    key: "10K",
    metres: 10000,
    name: "10 km",
    example: "46:30",
    min: 25 * 60,
    max: 3 * 3600,
  },
  {
    key: "HM",
    metres: 21097.5,
    name: "halvmaraton",
    example: "1:45:00",
    min: 56 * 60,
    max: 4 * 3600,
  },
  {
    key: "M",
    metres: 42195,
    name: "maraton",
    example: "3:45:00",
    min: 2 * 3600,
    max: 8 * 3600,
  },
];

export const MARATHON_M = 42195;

/** Loppet en löpkategori i biblioteket självklart leder fram till. */
export const CATEGORY_RACE: Record<string, RaceKey> = {
  maraton: "M",
  halvmaraton: "HM",
  "10-km": "10K",
};

const BY_KEY = new Map(RACES.map((r) => [r.key, r]));

export const raceByKey = (key: RaceKey): Race => BY_KEY.get(key)!;

/** Loppet för en distans i meter, eller null när den inte är en av dem. */
export function raceByMetres(metres: number | null | undefined): Race | null {
  if (!metres) return null;
  return RACES.find((r) => Math.abs(r.metres - metres) < 1) ?? null;
}

/**
 * Hur mycket snabbare loppet är än maraton, med Riegels exponent 1,06,
 * avrundat: halvmaraton 1,0425, 10 km 1,0902, 5 km 1,1365. Zonerna står som
 * andel av maratonfarten, så farten på planens lopp delas med faktorn för
 * att få farten zonerna räknas mot.
 */
export const RACE_FACTOR: Record<RaceKey, number> = {
  "5K": 1.1365,
  "10K": 1.0902,
  HM: 1.0425,
  M: 1,
};
