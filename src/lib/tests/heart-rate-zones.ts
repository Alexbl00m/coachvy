/**
 * Pulszoner.
 *
 * Bäst är zoner ur atletens egen pulskurva: ett stegtest med puls på varje
 * steg säger vilken puls varje belastning faktiskt gav, och den pulsen läses
 * av vid zonernas gränser. Det görs i zontabellen, inte här.
 *
 * Utan stegtest är tröskelpulsen nästbäst – den från ett 20-minuterstest,
 * ett 5 km-test eller ett lopp på 15–30 minuter. Zonerna är då Friels, i
 * procent av tröskelpulsen, med olika gränser för cykel och löpning: pulsen
 * ligger lägre på cykeln vid samma relativa ansträngning. Procent av maxpuls
 * används inte – maxpulsen säger inget om var tröskeln ligger.
 */

import type { Sport } from "@/lib/calculators/lactate";

export type HeartRateZone = {
  zone: string;
  min: number | null;
  max: number | null;
  description: string;
};

type Spec = {
  zone: string;
  pct: [number | null, number | null];
  description: string;
};

/** Friel, cykel. */
const BIKE: Spec[] = [
  { zone: "Z1 – Återhämtning", pct: [null, 81], description: "Återhämtning" },
  { zone: "Z2 – Aerob", pct: [81, 89], description: "Grunduthållighet" },
  { zone: "Z3 – Tempo", pct: [90, 93], description: "Tempo" },
  {
    zone: "Z4 – Subtröskel",
    pct: [94, 99],
    description: "Strax under tröskeln",
  },
  {
    zone: "Z5a – Supratröskel",
    pct: [100, 102],
    description: "Vid och strax över tröskeln",
  },
  {
    zone: "Z5b – Aerob kapacitet",
    pct: [103, 106],
    description: "VO2max-intervaller",
  },
  {
    zone: "Z5c – Anaerob kapacitet",
    pct: [106, null],
    description: "Korta maximala insatser",
  },
];

/** Friel, löpning – och simning, som saknar en egen tabell. */
const RUN: Spec[] = [
  { zone: "Z1 – Återhämtning", pct: [null, 85], description: "Återhämtning" },
  { zone: "Z2 – Aerob", pct: [85, 89], description: "Grunduthållighet" },
  { zone: "Z3 – Tempo", pct: [90, 94], description: "Tempo" },
  {
    zone: "Z4 – Subtröskel",
    pct: [95, 99],
    description: "Strax under tröskeln",
  },
  {
    zone: "Z5a – Supratröskel",
    pct: [100, 102],
    description: "Vid och strax över tröskeln",
  },
  {
    zone: "Z5b – Aerob kapacitet",
    pct: [103, 106],
    description: "VO2max-intervaller",
  },
  {
    zone: "Z5c – Anaerob kapacitet",
    pct: [106, null],
    description: "Korta maximala insatser",
  },
];

export function thresholdHeartRateZones(
  lthr: number,
  sport: Sport,
): HeartRateZone[] {
  if (!(lthr > 0)) return [];
  const spec = sport === "cykling" ? BIKE : RUN;
  return spec.map(({ zone, pct, description }) => ({
    zone,
    min: pct[0] === null ? null : Math.round((lthr * pct[0]) / 100),
    max: pct[1] === null ? null : Math.round((lthr * pct[1]) / 100),
    description,
  }));
}
