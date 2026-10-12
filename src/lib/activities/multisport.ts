/**
 * Multisport: ett triathlon, en duathlon eller en annan fil med flera grenar.
 *
 * Klockan delar loppet i sessioner – en per gren och en per växling. Varje
 * gren sparas som en egen aktivitet med sin egen analys, och alla delar samma
 * sammanfattning så att loppet går att läsa som helhet.
 *
 * Modulen är ren.
 */

import type { ActivitySport } from "./analysis";

export type MultisportKind = "triathlon" | "duathlon" | "multisport";

export type MultisportPart = {
  kind: "gren" | "växling";
  /** Grenen, eller null för en växling. */
  sport: ActivitySport | null;
  startedAt: string;
  seconds: number;
  distanceM: number | null;
};

export type MultisportSummary = {
  /** Gemensamt för grenarna i samma lopp. */
  id: string;
  kind: MultisportKind;
  /** Grenens plats bland grenarna, från 0. Sätts per aktivitet. */
  leg: number;
  parts: MultisportPart[];
  totalS: number;
  distanceM: number;
};

export const KIND_NAME: Record<MultisportKind, string> = {
  triathlon: "Triathlon",
  duathlon: "Duathlon",
  multisport: "Multisport",
};

/** Grenen i ett namn: "Sala Silverman · cykel". */
export const LEG_NAME: Record<ActivitySport, string> = {
  simning: "simning",
  cykling: "cykel",
  löpning: "löpning",
  annat: "gren",
};

/** Kort etikett för remsan: Sim, T1, Cykel, T2, Löpning. */
export const PART_LABEL: Record<ActivitySport, string> = {
  simning: "Sim",
  cykling: "Cykel",
  löpning: "Löpning",
  annat: "Gren",
};

export function kindOf(sports: ActivitySport[]): MultisportKind {
  const s = sports.join(",");
  if (s === "simning,cykling,löpning") return "triathlon";
  if (s === "löpning,cykling,löpning") return "duathlon";
  return "multisport";
}

/** Namnet på en gren ur loppets namn. */
export const legName = (base: string, sport: ActivitySport) =>
  `${base} · ${LEG_NAME[sport]}`.slice(0, 120);

/** Växlingarna numrerade: T1, T2. */
export function partLabels(parts: MultisportPart[]): string[] {
  let t = 0;
  return parts.map((p) =>
    p.kind === "växling" ? `T${++t}` : PART_LABEL[p.sport ?? "annat"],
  );
}

type Span = { startedAt: string; seconds: number };

/** Hur stor del av det kortare passet som överlappar det andra, 0–1. */
export function overlapShare(a: Span, b: Span): number {
  const a0 = Date.parse(a.startedAt);
  const b0 = Date.parse(b.startedAt);
  const a1 = a0 + a.seconds * 1000;
  const b1 = b0 + b.seconds * 1000;
  const overlap = Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
  const shorter = Math.min(a.seconds, b.seconds) * 1000;
  return shorter > 0 ? overlap / shorter : 0;
}

/** Samma gren inspelad två gånger – klockan och cykeldatorn. */
export const sameSession = (a: Span, b: Span) => overlapShare(a, b) >= 0.5;

/**
 * En tidigare import av hela filen som ett enda pass: samma start som den
 * första grenen och ungefär hela loppets längd.
 */
export function isUnsplitCopy(
  existing: { startedAt: string; seconds: number | null; multisport: unknown },
  summary: Pick<MultisportSummary, "totalS" | "parts">,
): boolean {
  if (existing.multisport) return false;
  const first = summary.parts[0];
  if (!first || existing.seconds === null) return false;
  const sameStart =
    Math.abs(Date.parse(existing.startedAt) - Date.parse(first.startedAt)) <
    5000;
  return sameStart && existing.seconds >= summary.totalS * 0.8;
}
