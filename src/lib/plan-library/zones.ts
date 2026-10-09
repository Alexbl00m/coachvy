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
 * Modulen är ren.
 */

export type ZoneKey = "RK" | "LO" | "MT" | "S" | "I" | "WK";

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
    key: "S",
    name: "Tröskel",
    low: 1.01,
    high: 1.065,
    description: "Tempot du ungefär klarar i en timme.",
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
    key: "WK",
    name: "Måltempo",
    low: 1,
    high: 1,
    description: "Exakt det tempo du vill springa loppet i.",
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

/** Zonen en fart (andel av maratonfart) ligger i, för färg och namn. */
export function zoneAt(fraction: number): Zone | null {
  return (
    ZONES.filter((z) => z.key !== "WK").find(
      (z) => fraction >= z.low - 1e-9 && fraction <= z.high + 1e-9,
    ) ?? null
  );
}
