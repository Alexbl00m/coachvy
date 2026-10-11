/**
 * Zonerna i tempo, för listen under en plan: RK, LO, MT, tröskel,
 * intervall och loppets egen fart.
 *
 * Modulen är ren.
 */

import {
  completeEstimate,
  referenceSpeeds,
  type FitnessEstimate,
} from "@/lib/plan-library/paces";
import { raceByKey, type RaceKey } from "@/lib/plan-library/races";
import { ZONES, type ZoneKey } from "@/lib/plan-library/zones";

export type ZonePace = {
  key: ZoneKey;
  name: string;
  /** "4:08–4:36" eller "3:48", snabbast först. */
  pace: string;
};

const perKm = (speed: number) => {
  const s = Math.round(1000 / speed);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Zonerna som visas för ett lopp: de breda och loppets egen fart. */
export function zoneKeysFor(
  race: RaceKey | null,
  extra: ZoneKey[] = [],
): ZoneKey[] {
  const own: ZoneKey | null =
    race === "M"
      ? "WK"
      : race === "HM"
        ? "HM"
        : race === "10K"
          ? "10K"
          : race === "5K"
            ? "5K"
            : null;
  return ["RK", "LO", "MT", "S", "I", ...(own ? [own] : []), ...extra];
}

/**
 * Tempona för zonerna. `anchor` är farten zonerna står mot i m/s –
 * maratonfarten, eller loppfarten delad med loppets faktor.
 */
export function zonePaces(anchor: number, keys: ZoneKey[]): ZonePace[] {
  return ZONES.filter((z) => keys.includes(z.key)).map((z) => ({
    key: z.key,
    name: z.name,
    pace:
      z.low === z.high
        ? perKm(anchor * z.low)
        : `${perKm(anchor * z.high)}–${perKm(anchor * z.low)}`,
  }));
}

/**
 * Farten zonerna står mot, ur en tid på en distans eller en hel
 * uppskattning. För ett lopp kortare än maraton räknas den ur loppets fart,
 * så att loppets zon blir exakt dess fart.
 */
export function zoneAnchor(
  source: { estimate: FitnessEstimate } | { race: RaceKey; seconds: number },
  planRace: RaceKey | null,
): number | null {
  const estimate =
    "estimate" in source
      ? source.estimate
      : completeEstimate({
          times: { [source.race]: source.seconds },
          source: "manuell",
          date: "",
        });
  if (!estimate) return null;
  const refs = referenceSpeeds(
    estimate,
    {},
    planRace ? raceByKey(planRace).metres : null,
  );
  return refs.MP ?? null;
}
