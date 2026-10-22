/**
 * Trösklarna i korthet: senaste värdet, förändringen mot testet före och
 * påståendet sidan Utveckling inleds med – "Tröskeln har flyttat sig 30
 * watt." Ren modul.
 */

import type { Sport } from "@/lib/calculators/lactate";
import { formatDuration } from "@/lib/calculators/time";
import { digitsForMetric } from "@/lib/format";
import { daysBetween, monthName } from "@/lib/season/season";

import {
  displayValue,
  paceDistance,
  paceUnit,
  showsPace,
  toMetresPerSecond,
} from "./pace";
import { protocolLabel, type Trend, type TrendPoint } from "./progression";

/** Trösklarna som visas, per gren, i den ordning de är värda att se. */
export const THRESHOLD_KEYS: Record<Sport, string[]> = {
  cykling: ["LT2", "LT1", "CP", "FTP"],
  löpning: ["LT2", "LT1", "CS"],
  simning: ["CS", "LT2", "LT1"],
};

export type Change = {
  /** "+12 W", "−0:04". */
  text: string;
  /** Framåt, bakåt eller utan riktning (VLamax). */
  tone: "good" | "bad" | "neutral";
  /** Förändringen i procent av det tidigare värdet. */
  percent: number;
};

/** Tempo i sekunder per km (löpning) eller 100 m (simning). */
const paceSeconds = (value: number, unit: string, sport: Sport) => {
  const mps = toMetresPerSecond(value, unit);
  return mps && mps > 0 ? paceDistance(sport) / mps : null;
};

const svFixed = (value: number, digits: number) =>
  value.toFixed(digits).replace(".", ",").replace("-", "−");

/** Förändringen mellan två punkter, i tempo där grenen tänker i tempo. */
export function changeBetween(
  trend: Trend,
  from: TrendPoint,
  to: TrendPoint,
  sport: Sport,
): Change | null {
  if (from.value === 0) return null;
  const percent = ((to.value - from.value) / from.value) * 100;
  const up = to.value > from.value;
  const flat = Math.abs(percent) < 0.05;
  const tone: Change["tone"] =
    flat || trend.higherIsBetter === null
      ? "neutral"
      : up === trend.higherIsBetter
        ? "good"
        : "bad";

  if (showsPace(sport, trend.unit)) {
    const a = paceSeconds(from.value, trend.unit, sport);
    const b = paceSeconds(to.value, trend.unit, sport);
    if (a === null || b === null) return null;
    const diff = Math.round(b - a);
    const sign = diff > 0 ? "+" : diff < 0 ? "−" : "±";
    return { text: `${sign}${formatDuration(Math.abs(diff))}`, tone, percent };
  }
  const digits = digitsForMetric(trend.key, trend.unit);
  const diff = to.value - from.value;
  const sign = diff > 0 ? "+" : "";
  return {
    text: `${sign}${svFixed(diff, digits)} ${trend.unit}`.trim(),
    tone,
    percent,
  };
}

export type Latest = {
  last: TrendPoint;
  shown: { value: string; unit: string };
  previous: TrendPoint | null;
  previousShown: string | null;
  change: Change | null;
};

/** Senaste värdet och förändringen mot närmast tidigare test. */
export function latestOf(trend: Trend, sport: Sport): Latest {
  const digits = digitsForMetric(trend.key, trend.unit);
  const last = trend.points[trend.points.length - 1];
  // Jämför med ett tidigare test, inte med ett annat protokoll samma dag.
  const previous =
    [...trend.points].reverse().find((p) => p.performedOn < last.performedOn) ??
    null;
  const shown = displayValue(last.value, trend.unit, sport, digits);
  return {
    last,
    shown: { value: shown.value, unit: shown.unit },
    previous,
    previousShown: previous
      ? displayValue(previous.value, trend.unit, sport, digits).value
      : null,
    change: previous ? changeBetween(trend, previous, last, sport) : null,
  };
}

const monthYear = (iso: string) =>
  `${monthName(Number(iso.slice(5, 7)) - 1)} ${iso.slice(0, 4)}`;

const COUNT_WORDS = ["", "ett", "två", "tre", "fyra", "fem", "sex", "sju"];
const countText = (n: number) => COUNT_WORDS[n] ?? String(n);

export type Insight = { title: string; lead: string };

/**
 * Påståendet om tröskeln: hur långt den flyttat sig från första till senaste
 * test, och i ledet under hur det räknats. Null när grenen saknar trösklar.
 */
export function thresholdInsight(
  trends: Trend[],
  sport: Sport,
): Insight | null {
  const trend = THRESHOLD_KEYS[sport]
    .map((key) => trends.find((t) => t.key === key && t.points.length > 0))
    .find((t): t is Trend => Boolean(t));
  if (!trend) return null;

  const digits = digitsForMetric(trend.key, trend.unit);
  const name = trend.label.split(" – ")[0];
  const first = trend.points[0];
  const last = trend.points[trend.points.length - 1];
  const shown = (p: TrendPoint) =>
    displayValue(p.value, trend.unit, sport, digits);
  const unitText = (p: TrendPoint) => {
    const s = shown(p);
    return `${s.value} ${s.unit}`.trim();
  };

  if (trend.points.length === 1 || first.performedOn === last.performedOn) {
    return {
      title: `${name} ligger på ${unitText(last)}.`,
      lead: `Ett test hittills, ${protocolLabel(last.protocol).toLowerCase()} ${monthYear(last.performedOn)}. Nästa test visar riktningen.`,
    };
  }

  const months = Math.max(
    1,
    Math.round(daysBetween(first.performedOn, last.performedOn) / 30.4),
  );
  const years = daysBetween(first.performedOn, last.performedOn) / 365.25;
  const percent = ((last.value - first.value) / first.value) * 100;
  const perYear =
    years >= 0.25
      ? ` – ungefär ${percent / years > 0 ? "+" : ""}${svFixed(percent / years, 0)} % per år`
      : "";

  let title: string;
  if (showsPace(sport, trend.unit)) {
    const a = paceSeconds(first.value, trend.unit, sport) ?? 0;
    const b = paceSeconds(last.value, trend.unit, sport) ?? 0;
    const diff = Math.round(a - b);
    const per = paceUnit(sport).replace("/", "per ");
    title =
      Math.abs(diff) < 1
        ? "Tröskeln står still."
        : diff > 0
          ? `Tröskeln är ${diff} sekunder snabbare ${per}.`
          : `Tröskeln har tappat ${-diff} sekunder ${per}.`;
  } else {
    const diff = last.value - first.value;
    const amount =
      trend.unit === "W"
        ? `${Math.round(Math.abs(diff))} watt`
        : `${svFixed(Math.abs(diff), digits)} ${trend.unit}`;
    title =
      Math.abs(percent) < 0.5
        ? "Tröskeln står still."
        : diff > 0
          ? `Tröskeln har flyttat sig ${amount}.`
          : `Tröskeln har backat ${amount}.`;
  }

  const n = trend.points.length;
  return {
    title,
    lead: `${name} från ${unitText(first)} till ${unitText(last)} på ${months} ${months === 1 ? "månad" : "månader"}${perYear}. Räknat ur ${countText(n)} tester${n === 2 ? "," : " mellan"} ${monthYear(first.performedOn)} och ${monthYear(last.performedOn)}.`,
  };
}

/** Förändringen från första till senaste punkt, i procent. */
const firstToLast = (trend: Trend | undefined) => {
  if (!trend || trend.points.length < 2) return null;
  const a = trend.points[0].value;
  const b = trend.points[trend.points.length - 1].value;
  return a === 0 ? null : ((b - a) / a) * 100;
};

/**
 * Rubriken över den korta analysen: vad som hänt med tröskeln, och med
 * spurtkraften (VLamax) när den är mätt – de två som tillsammans säger om
 * motorn eller glykolysen har flyttat sig (filosofin, avsnitt 7.4).
 */
export function analysisHeadline(trends: Trend[], sport: Sport): string {
  const threshold = THRESHOLD_KEYS[sport]
    .map((key) => trends.find((t) => t.key === key && t.points.length > 1))
    .find(Boolean);
  // Tempo: farten är värdet, så högre är bättre även här.
  const t = firstToLast(threshold);
  const v = firstToLast(trends.find((x) => x.key === "VLamax"));
  const up = t !== null && t >= 0.5;
  const down = t !== null && t <= -0.5;
  const vUp = v !== null && v >= 5;
  const vDown = v !== null && v <= -5;

  if (vUp && up) return "Mer spurtkraft, och tröskeln följer med.";
  if (vDown && up) return "Uthålligare profil, högre tröskel.";
  if (vUp && down) return "Mer spurtkraft, men tröskeln har backat.";
  if (vDown && down) return "Mindre spurtkraft, och tröskeln har backat.";
  if (vUp) return "Mer spurtkraft, tröskeln står still.";
  if (vDown) return "Uthålligare profil, tröskeln står still.";
  if (up) return "Tröskeln går framåt.";
  if (down) return "Tröskeln har backat.";
  if (t !== null) return "Tröskeln står still.";
  return "Så har testerna rört sig.";
}
