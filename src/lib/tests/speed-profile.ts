/**
 * Fartprofilen: hur mycket fart en löpare tappar när distansen växer.
 *
 * Varje maximal löpinsats – ett CS-test, ett 5 km-test, ett 20-minuterstest,
 * ett lopp – är en punkt på atletens egen kurva. Två eller fler punkter på
 * olika distans ger kurvans lutning, och den säger mer om löparen än något
 * enskilt test:
 *
 *   Utmattningsexponenten b i T = a·D^b (Riegel). Riegel satte 1,06 ur
 *   tiotusentals lopp. Lägre b = tappar lite fart med distansen (uthållig),
 *   högre = tappar mycket (snabbhetsbetonad, eller otränad på längre lopp).
 *
 *   Fart-tapp per dubblad distans: 1 − 2^(1−b). Samma sak i ett tal en
 *   adept förstår: med b = 1,06 går varje dubblad distans ca 4 % långsammare.
 *
 * Bredvid kurvan: CS och D′ ur punkterna på 2–20 minuter, och VDOT ur den
 * bästa prestationen. Tre modeller med olika styrkor – CS för de korta
 * loppen, VDOT och den egna kurvan för de långa – och där de är oense är
 * det värt att veta.
 */

import {
  buildPredictionModel,
  RIEGEL_EXPONENT,
  STANDARD_DISTANCES,
} from "@/lib/calculators/race-prediction";
import { timeFromVdot, vdotFromPerformance } from "@/lib/calculators/daniels";
import { CS_RANGE_SECONDS } from "@/lib/calculators/critical-speed";
import { linearFit } from "@/lib/calculators/regression";
import { LAP_PROTOCOLS, type ProtocolKey } from "./protocols";
import type { FullSession } from "./session-queries";

export type RunPoint = {
  sessionId: string;
  performedOn: string;
  protocol: string;
  seconds: number;
  metres: number;
};

/** Löpinsatserna ur testtillfällena, en punkt per maximal insats. */
export function runningPoints(sessions: FullSession[]): RunPoint[] {
  const points: RunPoint[] = [];
  for (const s of sessions) {
    if (s.sport !== "löpning") continue;
    const rows = s.test_efforts.filter(
      (e) =>
        e.duration_seconds !== null &&
        e.distance_m !== null &&
        Number(e.duration_seconds) > 0 &&
        Number(e.distance_m) > 0,
    );
    if (rows.length === 0) continue;
    const date = (e: (typeof rows)[number]) => e.performed_on ?? s.performed_on;

    if (LAP_PROTOCOLS.includes(s.protocol as ProtocolKey)) {
      // Varven summerade: testet är en insats.
      points.push({
        sessionId: s.id,
        performedOn: date(rows[0]),
        protocol: s.protocol,
        seconds: rows.reduce((sum, e) => sum + Number(e.duration_seconds), 0),
        metres: rows.reduce((sum, e) => sum + Number(e.distance_m), 0),
      });
    } else if (s.protocol === "cs-3min") {
      // Kumulativa delintervall: bara helheten är en maxinsats.
      const last = rows.reduce((a, b) =>
        Number(b.duration_seconds) > Number(a.duration_seconds) ? b : a,
      );
      points.push({
        sessionId: s.id,
        performedOn: date(last),
        protocol: s.protocol,
        seconds: Number(last.duration_seconds),
        metres: Number(last.distance_m),
      });
    } else if (s.protocol === "critical-speed" || s.protocol === "cs-3-5min") {
      for (const e of rows) {
        points.push({
          sessionId: s.id,
          performedOn: date(e),
          protocol: s.protocol,
          seconds: Number(e.duration_seconds),
          metres: Number(e.distance_m),
        });
      }
    }
  }
  return points.sort((a, b) => a.performedOn.localeCompare(b.performedOn));
}

/** Durationsband för bästa insats per band, i sekunder. */
const BANDS = [120, 300, 600, 1200, 2400, 4800, Number.POSITIVE_INFINITY];

export type ProfileLabel = "Uthållig" | "Balanserad" | "Snabbhetsbetonad";

export type SpeedProfile = {
  /** Punkterna kurvan bygger på: bästa per durationsband det senaste året. */
  used: RunPoint[];
  /** Alla punkter, också äldre och slagna – för diagrammet. */
  all: RunPoint[];
  /** Utmattningsexponenten b, och om den är atletens egen. */
  exponent: number;
  individual: boolean;
  rSquared: number | null;
  /** a i T = a·D^b, så att klienten kan räkna på valfri distans. */
  scale: number;
  /** Fart som tappas per dubblad distans, %. */
  lossPerDoubling: number;
  label: ProfileLabel | null;
  reading: string;
  cs: { speed: number; dPrime: number; points: number } | null;
  vdot: { value: number; point: RunPoint } | null;
  predictions: {
    label: string;
    metres: number;
    /** Egen kurva (eller Riegel 1,06 med en punkt). */
    personal: number;
    /** Daniels ur bästa VDOT. */
    vdot: number | null;
    /** CS-modellen, bara där den gäller (ca 2–20 min). */
    cs: number | null;
  }[];
  warnings: string[];
};

export const lossPerDoubling = (exponent: number) =>
  (1 - 2 ** (1 - exponent)) * 100;

export function speedProfile(sessions: FullSession[]): SpeedProfile | null {
  const all = runningPoints(sessions);
  if (all.length === 0) return null;

  // Ett år bakåt från den senaste insatsen – inte från i dag, så att en
  // adept som inte testat på ett tag ändå får sin senaste kurva.
  const latest = all[all.length - 1].performedOn;
  const cutoff = new Date(latest);
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const recent = all.filter(
    (p) => p.performedOn >= cutoff.toISOString().slice(0, 10),
  );

  const used: RunPoint[] = [];
  for (let b = 0; b < BANDS.length - 1; b += 1) {
    const inBand = recent.filter(
      (p) => p.seconds >= BANDS[b] && p.seconds < BANDS[b + 1],
    );
    if (inBand.length === 0) continue;
    used.push(
      inBand.reduce((x, y) =>
        y.metres / y.seconds > x.metres / x.seconds ? y : x,
      ),
    );
  }
  if (used.length === 0) return null;

  const warnings: string[] = [];
  const model = buildPredictionModel(
    used.map((p) => ({ metres: p.metres, seconds: p.seconds })),
  );
  if (!model) return null;
  warnings.push(...model.warnings);

  const exponent = model.exponent;
  const loss = lossPerDoubling(exponent);
  let label: ProfileLabel | null = null;
  let reading: string;
  if (!model.individual) {
    reading = `En distans räcker inte för en egen kurva, så prognoserna använder Riegels 1,06 – ungefär ${loss.toFixed(1).replace(".", ",")} % långsammare per dubblad distans. Ett test eller lopp på en klart annan distans (t.ex. 3 min och 5 km, eller 5 och 10 km) ger atletens egen.`;
  } else if (exponent < 1.04) {
    label = "Uthållig";
    reading = `Tappar lite fart när distansen växer: ${loss.toFixed(1).replace(".", ",")} % per dubblad distans, mot ungefär 4 % för de flesta. Styrkan är de långa loppen – snabbheten och VO2max har mest att hämta.`;
  } else if (exponent <= 1.08) {
    label = "Balanserad";
    reading = `Tappar fart som de flesta: ${loss.toFixed(1).replace(".", ",")} % per dubblad distans (Riegels normalvärde ger ungefär 4 %).`;
  } else {
    label = "Snabbhetsbetonad";
    reading = `Tappar mycket fart när distansen växer: ${loss.toFixed(1).replace(".", ",")} % per dubblad distans, mot ungefär 4 % för de flesta. Farten finns – det är uthålligheten, tröskeln och de långa passen som har mest att hämta. Kontrollera också att det långa loppet var ett riktigt försök: värme, backar eller en otränad distans ger samma bild.`;
  }

  // CS och D′ ur punkterna på 2–20 minuter: d = CS·t + D′.
  const [csMin, csMax] = CS_RANGE_SECONDS;
  const csPoints = used.filter((p) => p.seconds >= csMin && p.seconds <= csMax);
  let cs: SpeedProfile["cs"] = null;
  if (
    csPoints.length >= 2 &&
    new Set(csPoints.map((p) => Math.round(p.seconds))).size >= 2
  ) {
    const fit = linearFit(
      csPoints.map((p) => p.seconds),
      csPoints.map((p) => p.metres),
    );
    if (fit && fit.slope > 0 && fit.intercept > 0) {
      cs = { speed: fit.slope, dPrime: fit.intercept, points: csPoints.length };
    }
  }

  // Bästa VDOT ur insatser där Daniels ekvationer gäller.
  let vdot: SpeedProfile["vdot"] = null;
  for (const p of recent) {
    if (p.seconds < 210 || p.seconds > 4 * 3600) continue;
    const v = vdotFromPerformance(p.metres, p.seconds);
    if (v !== null && (!vdot || v > vdot.value)) vdot = { value: v, point: p };
  }

  const predictions = STANDARD_DISTANCES.filter((d) => d.metres >= 1500).map(
    (d) => {
      const csSeconds = cs ? (d.metres - cs.dPrime) / cs.speed : null;
      return {
        label: d.label,
        metres: d.metres,
        personal: model.predict(d.metres),
        vdot: vdot ? timeFromVdot(vdot.value, d.metres) : null,
        cs:
          csSeconds !== null && csSeconds >= csMin && csSeconds <= csMax
            ? csSeconds
            : null,
      };
    },
  );

  if (model.individual && exponent < RIEGEL_EXPONENT - 0.08) {
    warnings.push(
      "Exponenten är ovanligt låg. Ofta betyder det att den korta insatsen inte var maximal – kontrollera den innan kurvan används för långa prognoser.",
    );
  }

  return {
    used,
    all,
    exponent,
    individual: model.individual,
    rSquared: model.rSquared,
    scale: model.predict(1),
    lossPerDoubling: loss,
    label,
    reading,
    cs,
    vdot,
    predictions,
    warnings,
  };
}
