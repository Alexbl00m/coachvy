/**
 * Namngivna tempozoner för löpning, som andel av maratonfart.
 *
 * Planer som anger passen i zoner ("22 km @LO + 7 km @MT") räknar med
 * maratonfarten som bas (`MP`). Zonerna följer Daniels (Jack Daniels,
 * Daniels' Running Formula): lugn distans, maratontempo, tröskel och
 * intervall – uttryckta som andel av maratonfarten i stället för som
 * absoluta tempon, så att de följer löparens egen maratonfart.
 *
 * Gränserna är medelvärden över maratontider från drygt 2:30 till 4:50.
 * Förhållandet mellan zonerna och maratonfarten ändras något med nivån –
 * tröskeln ligger närmare maratonfarten för en långsam löpare – så
 * tempona är en vägledning, inte en exakt tabell.
 *
 * Utöver dem finns loppfarterna HM, 10K och 5K, för planer mot kortare
 * lopp. De står också som andel av maratonfarten (Riegel 1,06, se
 * races.ts), och i en halvmaratonplan räknas maratonfarten ur
 * halvmaratonfarten – så @HM blir exakt löparens halvmaratonfart.
 *
 * Två zoner med bindestreck, `@HM-10K`, är spannet mellan dem: från den
 * långsammare zonens nedre gräns till den snabbares övre.
 *
 * Modulen är ren.
 */

import { RACE_FACTOR } from "./races";

export type ZoneKey =
  | "RK"
  | "LO"
  | "MT"
  | "WK"
  | "S"
  | "HM"
  | "10K"
  | "I"
  | "5K";

export type Zone = {
  key: ZoneKey;
  name: string;
  /** Andel av maratonfarten, långsammaste gränsen. */
  low: number;
  /** Andel av maratonfarten, snabbaste gränsen. */
  high: number;
  description: string;
  /** Räknas som ett hårt steg när typen gissas. */
  hard: boolean;
};

export const ZONES: Zone[] = [
  {
    key: "RK",
    name: "Regeneration",
    low: 0.77,
    high: 0.83,
    description: "Mycket lugnt. Du kan prata i telefon under tiden.",
    hard: false,
  },
  {
    key: "LO",
    name: "Lugn distans",
    low: 0.83,
    high: 0.925,
    description:
      "Hela meningar går att prata. Här sker det mesta av träningen, och långpassen löps här.",
    hard: false,
  },
  {
    key: "MT",
    name: "Maratontempo",
    low: 0.935,
    high: 1.025,
    description: "Rappt men kontrollerat. Korta meningar går att prata.",
    hard: true,
  },
  {
    key: "WK",
    name: "Måltempo maraton",
    low: 1,
    high: 1,
    description: "Exakt det tempo du vill springa maratonloppet i.",
    hard: true,
  },
  {
    key: "S",
    name: "Tröskel",
    low: 1.01,
    high: 1.065,
    description: "Tempot du ungefär klarar i en timme.",
    hard: true,
  },
  {
    key: "HM",
    name: "Halvmaratonfart",
    low: RACE_FACTOR.HM,
    high: RACE_FACTOR.HM,
    description: "Farten du springer en halvmara i.",
    hard: true,
  },
  {
    key: "10K",
    name: "Milfart",
    low: RACE_FACTOR["10K"],
    high: RACE_FACTOR["10K"],
    description: "Farten du springer en mil i.",
    hard: true,
  },
  {
    key: "I",
    name: "Intervall",
    low: 1.125,
    high: 1.18,
    description: "Hårt. Efter tre till fem minuter vill du sluta.",
    hard: true,
  },
  {
    key: "5K",
    name: "5 km-fart",
    low: RACE_FACTOR["5K"],
    high: RACE_FACTOR["5K"],
    description: "Farten du springer 5 km i.",
    hard: true,
  },
];

export const ZONE_KEYS = ZONES.map((z) => z.key);

const BY_KEY = new Map(ZONES.map((z) => [z.key, z]));

export const zoneByKey = (key: string): Zone | undefined =>
  BY_KEY.get(key.toUpperCase() as ZoneKey);

const close = (a: number, b: number) => Math.abs(a - b) < 0.0005;

/** Zonen ett mål ligger exakt på, annars null. */
export function zoneForRange(low: number, high: number): Zone | null {
  return ZONES.find((z) => close(z.low, low) && close(z.high, high)) ?? null;
}

/** Zonerna i ett spann `@A-B`, eller null när det inte är ett. */
export function zoneSpan(
  low: number,
  high: number,
): { from: Zone; to: Zone } | null {
  if (zoneForRange(low, high)) return null;
  const from = ZONES.find((z) => close(z.low, low));
  const to = ZONES.find((z) => close(z.high, high));
  return from && to && from !== to ? { from, to } : null;
}

/** "LO", "HM-10K" – målet som zon, eller null när det inte är en. */
export function zoneLabel(low: number, high: number): string | null {
  const zone = zoneForRange(low, high);
  if (zone) return zone.key;
  const span = zoneSpan(low, high);
  return span ? `${span.from.key}-${span.to.key}` : null;
}

/** Zonen en fart (andel av maratonfart) ligger i, för färg och namn. */
export function zoneAt(fraction: number): Zone | null {
  return (
    ZONES.filter((z) => z.low !== z.high).find(
      (z) => fraction >= z.low - 1e-9 && fraction <= z.high + 1e-9,
    ) ?? null
  );
}

/** Zonerna stegen i blocken står i, i zonernas ordning – spann räknas med. */
export function usedZones(
  blocks: { low: number; high: number }[][],
): ZoneKey[] {
  const keys = new Set<ZoneKey>();
  for (const steps of blocks) {
    for (const step of steps) {
      const low = Math.min(step.low, step.high);
      const high = Math.max(step.low, step.high);
      const zone = zoneForRange(low, high);
      if (zone) {
        keys.add(zone.key);
        continue;
      }
      const span = zoneSpan(low, high);
      if (span) {
        keys.add(span.from.key);
        keys.add(span.to.key);
      }
    }
  }
  return ZONES.map((z) => z.key).filter((k) => keys.has(k));
}
