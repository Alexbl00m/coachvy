/**
 * Ord och format för planbiblioteket, så att mallverktygen, biblioteket och
 * planvyn säger samma sak.
 */

import { phaseLabel } from "@/lib/tests/phases";

import type {
  ChangeKind,
  ChangeReason,
  ChangeSource,
  SeasonPhase,
  WeekKind,
} from "./types";

/** Dag 0 är veckans första dag, måndag om inget annat valts. */
export const DAY_SHORT = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
export const DAY_LONG = [
  "måndag",
  "tisdag",
  "onsdag",
  "torsdag",
  "fredag",
  "lördag",
  "söndag",
];

/** Kortnamnet för en dag i en plan vars veckor börjar på `weekStart`. */
export const dayShort = (day: number, weekStart = 0) =>
  DAY_SHORT[(day + weekStart) % 7];

export const WEEK_KINDS: { key: WeekKind; label: string }[] = [
  { key: "normal", label: "Vanlig vecka" },
  { key: "avlastning", label: "Avlastning" },
  { key: "test", label: "Testvecka" },
  { key: "tävling", label: "Tävlingsvecka" },
];

export const weekKindLabel = (kind: WeekKind) =>
  WEEK_KINDS.find((k) => k.key === kind)?.label ?? kind;

export const seasonPhaseLabel = (phase: SeasonPhase | null) =>
  phase ? (phaseLabel(phase) ?? phase) : null;

export const SPECIFICITY_LABEL: Record<number, string> = {
  1: "Ospecifik",
  2: "Allmän",
  3: "Riktad",
  4: "Specifik",
  5: "Tävlingsspecifik",
};

export const REASON_LABEL: Record<ChangeReason, string> = {
  "eget val": "Eget val",
  form: "Formen",
  resa: "Resa",
  sjukdom: "Sjukdom",
  skada: "Skada",
  arbete: "Arbete eller stress",
  familj: "Familj",
  uppehåll: "Uppehåll",
  återstart: "Återstart",
};

export const KIND_LABEL: Record<ChangeKind, string> = {
  byte: "Byte",
  stegvis: "Stegvis",
  tillfällig: "Tillfällig sänkning",
  återgång: "Återgång",
  återstart: "Återstart",
};

export const SOURCE_LABEL: Record<ChangeSource, string> = {
  medlem: "Medlemmen",
  coach: "Coachen",
  ai: "AI-förslag",
};

/** "1 h 15 min", "45 min". */
export function hoursMinutes(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "";
  const minutes = Math.round(seconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** "12,5 km", "800 m". */
export function distanceText(metres: number | null): string {
  if (!metres || metres <= 0) return "";
  return metres >= 1000
    ? `${(Math.round(metres / 100) / 10).toString().replace(".", ",")} km`
    : `${metres} m`;
}

/** "6–8 h", "8 h", "". */
export function rangeText(
  min: number | null,
  max: number | null,
  unit: string,
): string {
  const f = (v: number) => v.toString().replace(".", ",");
  if (min !== null && max !== null && min !== max) {
    return `${f(min)}–${f(max)} ${unit}`;
  }
  const one = min ?? max;
  return one !== null ? `${f(one)} ${unit}` : "";
}

/** Intensitetsfördelningen som text: "80/10/10". */
export function intensityText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const v = value as Record<string, unknown>;
  const parts = ["låg", "medel", "hög"].map((k) => Number(v[k]) || 0);
  if (parts.every((n) => n === 0)) return "";
  return `${parts.join("/")} låg/medel/hög`;
}

export function intensityParts(
  value: unknown,
): { låg: number; medel: number; hög: number } | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  return {
    låg: Number(v.låg) || 0,
    medel: Number(v.medel) || 0,
    hög: Number(v.hög) || 0,
  };
}
