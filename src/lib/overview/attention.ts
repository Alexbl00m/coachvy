/**
 * Adepter som är värda en titt, för coachens översikt.
 *
 * Varje punkt är ett konstaterande med sitt tal, inte en diagnos. Appen säger
 * att återhämtningen ligger under adeptens vanliga nivå eller att veckan
 * ligger 40 % över månaden före – vad det betyder för just den atleten är
 * coachens bedömning. Därför jämförs måendet mot adeptens egen baslinje och
 * inte mot en gräns som gäller alla: 12 av 20 är en dålig dag för den som
 * brukar ligga på 17 och en vanlig dag för den som brukar ligga på 12.
 *
 * Gränserna nedan bestämmer bara vad som är stort nog att lyfta fram, så att
 * listan inte drunknar i vardagsbrus. De är inga riskgränser.
 */

import type { AdeptRaceRow, TrainingBlockRow } from "@/lib/types/database";
import {
  buildLoadSeries,
  readRatio,
  readinessScore,
  READINESS_MAX,
  type Checkin,
} from "@/lib/training/load";
import { addDays, countdownText, daysBetween } from "@/lib/season/season";

export type AttentionKind =
  | "återhämtning"
  | "belastning"
  | "tystnad"
  | "meddelanden"
  | "toppning"
  | "tävling";

export type Attention = {
  kind: AttentionKind;
  /** 3 lyfts först. */
  weight: 1 | 2 | 3;
  text: string;
  /** Vilken flik på adeptsidan, eller säsongsplanen, som visar mer. */
  target: "maende" | "meddelanden" | "plan";
};

/** Hur långt under sitt snitt en dag ska ligga för att nämnas, poäng. */
const MIN_DIP = 2;
/** Minst så många dagar med poäng den senaste månaden för en baslinje. */
const BASELINE_DAYS = 7;
/** Förändring i belastning som nämns: ±30 % mot månaden före. */
const LOAD_CHANGE = 0.3;
/** Tystnad som nämns: ingen incheckning på en vecka. */
const QUIET_DAYS = 7;

const sv = (v: number) => v.toFixed(1).replace(".", ",").replace(",0", "");

function mean(values: number[]) {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function sd(values: number[]) {
  const m = mean(values);
  return Math.sqrt(
    values.reduce((s, v) => s + (v - m) ** 2, 0) /
      Math.max(values.length - 1, 1),
  );
}

export type ReadinessSummary = {
  score: number;
  date: string;
  /** Snittet månaden före, utan dagen själv. null med för få mätningar. */
  baseline: number | null;
  spread: number | null;
};

/** Senaste återhämtningspoängen och adeptens egen baslinje. */
export function readinessSummary(checkins: Checkin[]): ReadinessSummary | null {
  const scored = checkins
    .map((c) => ({ date: c.performedOn, score: readinessScore(c) }))
    .filter((c): c is { date: string; score: number } => c.score !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
  const latest = scored[scored.length - 1];
  if (!latest) return null;

  // Baslinjen: månaden före den senaste mätningen, utan den själv.
  const since = addDays(latest.date, -28);
  const baseline = scored
    .filter((c) => c.date >= since && c.date < latest.date)
    .map((c) => c.score);
  const enough = baseline.length >= BASELINE_DAYS;
  return {
    score: latest.score,
    date: latest.date,
    baseline: enough ? mean(baseline) : null,
    spread: enough ? sd(baseline) : null,
  };
}

/** "i dag", "i går" eller "för 4 dagar sedan". */
export function daysAgo(date: string, today: string): string {
  const days = daysBetween(date, today);
  if (days <= 0) return "i dag";
  if (days === 1) return "i går";
  if (days === 2) return "i förrgår";
  return `för ${days} dagar sedan`;
}

/** Återhämtningen mot adeptens egen baslinje. */
export function recoveryAttention(
  checkins: Checkin[],
  today: string,
): Attention | null {
  const latest = readinessSummary(checkins);
  if (!latest || daysBetween(latest.date, today) > 2) return null;

  const when = daysAgo(latest.date, today);

  if (latest.baseline !== null && latest.spread !== null) {
    const m = latest.baseline;
    const spread = latest.spread;
    if (latest.score <= m - Math.max(spread, MIN_DIP)) {
      return {
        kind: "återhämtning",
        weight: 3,
        text: `Återhämtning ${latest.score} av ${READINESS_MAX} ${when} – brukar ligga runt ${sv(m)}.`,
        target: "maende",
      };
    }
    return null;
  }

  // Utan baslinje nämns bara en riktigt tung dag.
  if (latest.score <= 8) {
    return {
      kind: "återhämtning",
      weight: 3,
      text: `Återhämtning ${latest.score} av ${READINESS_MAX} ${when}.`,
      target: "maende",
    };
  }
  return null;
}

/** Den senaste veckan mot månaden före, när den skiljer sig mycket. */
export function loadAttention(
  checkins: Checkin[],
  today: string,
): Attention | null {
  const series = buildLoadSeries(checkins, {
    days: 1,
    today: new Date(`${today}T12:00:00Z`),
  });
  const ratio = series.latest?.ratio ?? null;
  if (ratio === null || series.coverage < 14) return null;
  if (Math.abs(ratio - 1) < LOAD_CHANGE) return null;
  return {
    kind: "belastning",
    weight: ratio > 1 ? 2 : 1,
    text: readRatio(ratio),
    target: "maende",
  };
}

/** Ingen incheckning på en vecka, hos en adept som brukar checka in. */
export function quietAttention(
  checkins: Checkin[],
  today: string,
): Attention | null {
  const dates = checkins.map((c) => c.performedOn).sort();
  const last = dates[dates.length - 1];
  if (!last) return null;
  const days = daysBetween(last, today);
  if (days < QUIET_DAYS) return null;
  return {
    kind: "tystnad",
    weight: 1,
    text: `Ingen incheckning på ${days} dagar.`,
    target: "maende",
  };
}

/** Lopp nära, och ett A-lopp utan toppning i planen. */
export function raceAttention(
  races: Pick<AdeptRaceRow, "name" | "race_date" | "priority">[],
  blocks: Pick<TrainingBlockRow, "phase" | "starts_on" | "ends_on">[],
  today: string,
): Attention[] {
  const out: Attention[] = [];
  for (const race of races) {
    const days = daysBetween(today, race.race_date);
    if (days < 0) continue;
    if (race.priority === "A" && days <= 21 && blocks.length > 0) {
      const windowStart = addDays(race.race_date, -21);
      const tapered = blocks.some(
        (b) =>
          b.phase === "topp" &&
          b.ends_on >= windowStart &&
          b.starts_on <= race.race_date,
      );
      if (!tapered) {
        out.push({
          kind: "toppning",
          weight: 2,
          text: `${race.name} ${countdownText(days)} – ingen toppning inlagd i planen.`,
          target: "plan",
        });
        continue;
      }
    }
    if (race.priority !== "C" && days <= 14) {
      out.push({
        kind: "tävling",
        weight: 1,
        text: `${race.priority}-lopp ${countdownText(days)}: ${race.name}.`,
        target: "plan",
      });
    }
  }
  return out;
}

/** Allt värt en titt för en adept, viktigast först. */
export function attentionFor(input: {
  checkins: Checkin[];
  unread: number;
  races: Pick<AdeptRaceRow, "name" | "race_date" | "priority">[];
  blocks: Pick<TrainingBlockRow, "phase" | "starts_on" | "ends_on">[];
  today: string;
}): Attention[] {
  const items: Attention[] = [];
  const recovery = recoveryAttention(input.checkins, input.today);
  if (recovery) items.push(recovery);
  const load = loadAttention(input.checkins, input.today);
  if (load) items.push(load);
  if (input.unread > 0) {
    items.push({
      kind: "meddelanden",
      weight: 2,
      text: `${input.unread} ${input.unread === 1 ? "oläst meddelande" : "olästa meddelanden"}.`,
      target: "meddelanden",
    });
  }
  const quiet = quietAttention(input.checkins, input.today);
  if (quiet) items.push(quiet);
  items.push(...raceAttention(input.races, input.blocks, input.today));
  return items.sort((a, b) => b.weight - a.weight);
}
