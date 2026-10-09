/**
 * Ett pass struktur som en rad text, och tillbaka.
 *
 *   15 min 65%; 5x(4 min 105% + 2 min 60%); 10 min 60%
 *   2 km 75-80%; 8x(400 m 105% + 200 m 60%); 1 km 70%
 *
 * Mallarna har många pass i flera nivåer, och ett formulär per steg blir
 * långsamt att fylla i. Raden tolkas till samma block som passbyggarens pass
 * (mål som andel av basen), så att profilen, zonfärgerna och exporten
 * fungerar för planernas pass som för alla andra.
 *
 * Steg skiljs med semikolon, plus eller radbrytning. En repetition skrivs
 * `5x(…)`. Längd i s, min, h, m eller km, eller som 1:30. Målet i procent,
 * ett tal eller ett spann – eller en namngiven zon, `@LO`, `@MT`, `@S`,
 * `@I`, `@WK`, `@RK` (andel av maratonfart, se zones.ts). Efter målet får en
 * etikett stå; är den ett
 * av stegtyperna (uppvärmning, intervall, vila, distans, nedvarvning) blir
 * den stegets typ. Annars gissas typen: först uppvärmning, sist
 * nedvarvning, i en repetition är det hårdaste intervall och resten vila.
 *
 * Modulen är ren.
 */

import { zoneByKey, zoneForRange, type Zone } from "./zones";
import {
  STEP_KINDS,
  type StepKind,
  type WorkoutBlock,
  type WorkoutStep,
} from "@/lib/workouts/schema";

export type StructureResult =
  | { ok: true; blocks: WorkoutBlock[] }
  | { ok: false; error: string };

const MAX_STEPS = 60;

/** Delar på avskiljare som inte står inom parentes. */
function splitTop(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (depth === 0 && (ch === ";" || ch === "+" || ch === "\n")) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

const num = (raw: string) => Number(raw.replace(",", "."));

type RawStep = Omit<WorkoutStep, "kind"> & {
  kind: StepKind | null;
  /** Zonen steget angavs som, för att gissa typen. */
  zone?: Zone;
};

function parseStep(raw: string): RawStep | string {
  const text = raw.trim().replace(/\s+/g, " ");
  // Längden: 1:30 / 1:30:00, eller tal och enhet.
  const clock = text.match(/^(\d+):(\d{2})(?::(\d{2}))?\b/);
  const amount = text.match(/^(\d+(?:[.,]\d+)?)\s*(sek|s|min|h|tim|km|m)\b/i);
  let durationSeconds: number | null = null;
  let distanceM: number | null = null;
  let rest: string;
  if (clock) {
    durationSeconds = clock[3]
      ? Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3])
      : Number(clock[1]) * 60 + Number(clock[2]);
    rest = text.slice(clock[0].length);
  } else if (amount) {
    const value = num(amount[1]);
    const unit = amount[2].toLowerCase();
    if (unit === "s" || unit === "sek") durationSeconds = value;
    else if (unit === "min") durationSeconds = value * 60;
    else if (unit === "h" || unit === "tim") durationSeconds = value * 3600;
    else if (unit === "km") distanceM = value * 1000;
    else distanceM = value;
    rest = text.slice(amount[0].length);
  } else {
    return `"${raw.trim()}" saknar längd – skriv till exempel 10 min eller 400 m.`;
  }
  if (durationSeconds !== null) durationSeconds = Math.round(durationSeconds);
  if (distanceM !== null) distanceM = Math.round(distanceM);
  if (!(durationSeconds ?? distanceM ?? 0)) {
    return `"${raw.trim()}" har ingen längd.`;
  }

  const zoneMatch = rest.match(/^\s*@\s*([A-Za-z]{1,2})\b/);
  if (zoneMatch) {
    const zone = zoneByKey(zoneMatch[1]);
    if (!zone) {
      return `"${raw.trim()}": zonen @${zoneMatch[1]} finns inte – välj RK, LO, MT, S, I eller WK.`;
    }
    const label = rest.slice(zoneMatch[0].length).trim();
    const kind = STEP_KINDS.find((k) => k === label.toLowerCase()) ?? null;
    return {
      kind,
      label: kind ? "" : label.slice(0, 60),
      durationSeconds,
      distanceM,
      low: zone.low,
      high: zone.high,
      zone,
    };
  }

  const target = rest.match(
    /^\s*@?\s*(\d+(?:[.,]\d+)?)\s*(?:%\s*)?(?:[-–]\s*(\d+(?:[.,]\d+)?)\s*)?%/,
  );
  if (!target) {
    return `"${raw.trim()}" saknar mål – skriv till exempel 65%, 90-95% eller @LO.`;
  }
  const low = num(target[1]) / 100;
  const high = target[2] ? num(target[2]) / 100 : low;
  if (low < 0.2 || high > 2.5) {
    return `"${raw.trim()}": målet ska ligga mellan 20 och 250 %.`;
  }
  const label = rest.slice(target[0].length).trim();
  const kind = STEP_KINDS.find((k) => k === label.toLowerCase()) ?? null;
  return {
    kind,
    label: kind ? "" : label.slice(0, 60),
    durationSeconds,
    distanceM,
    low: Math.min(low, high),
    high: Math.max(low, high),
  };
}

export function parseStructure(text: string): StructureResult {
  const items = splitTop(text);
  if (items.length === 0) return { ok: false, error: "Strukturen är tom." };

  type RawBlock =
    | { type: "steg"; step: RawStep }
    | { type: "repetition"; times: number; steps: RawStep[] };
  const raw: RawBlock[] = [];
  let count = 0;

  for (const item of items) {
    const repeat = item.match(/^(\d+)\s*[x×]\s*\(([\s\S]*)\)$/i);
    if (repeat) {
      const times = Number(repeat[1]);
      if (times < 1 || times > 50) {
        return { ok: false, error: `${times} varv går inte – välj 1–50.` };
      }
      const steps: RawStep[] = [];
      for (const part of splitTop(repeat[2])) {
        const step = parseStep(part);
        if (typeof step === "string") return { ok: false, error: step };
        steps.push(step);
      }
      if (steps.length === 0) {
        return { ok: false, error: `Repetitionen "${item}" är tom.` };
      }
      count += times * steps.length;
      raw.push(
        times === 1
          ? { type: "steg", step: steps[0] }
          : { type: "repetition", times, steps },
      );
      if (times === 1 && steps.length > 1) {
        raw.pop();
        for (const step of steps) raw.push({ type: "steg", step });
      }
    } else {
      if (/[()]/.test(item)) {
        return {
          ok: false,
          error: `"${item}" – en repetition skrivs som 5x(4 min 105% + 2 min 60%).`,
        };
      }
      const step = parseStep(item);
      if (typeof step === "string") return { ok: false, error: step };
      count += 1;
      raw.push({ type: "steg", step });
    }
    if (count > MAX_STEPS) {
      return { ok: false, error: `Högst ${MAX_STEPS} steg i ett pass.` };
    }
  }

  return { ok: true, blocks: inferKinds(raw) };
}

/** Typen för steg som inte fått någon, ur stegets plats och mål. */
function inferKinds(
  raw: (
    | { type: "steg"; step: RawStep }
    | { type: "repetition"; times: number; steps: RawStep[] }
  )[],
): WorkoutBlock[] {
  const last = raw.length - 1;
  return raw.map((block, index): WorkoutBlock => {
    if (block.type === "repetition") {
      const hardest = Math.max(...block.steps.map((s) => s.high));
      return {
        type: "repetition",
        times: block.times,
        steps: block.steps.map((s) => {
          const { zone: _zone, ...step } = s;
          void _zone;
          return {
            ...step,
            kind:
              s.kind ??
              (s.high === hardest && block.steps.length > 1
                ? "intervall"
                : block.steps.length === 1
                  ? "intervall"
                  : "vila"),
          };
        }),
      };
    }
    const s = block.step;
    const kind: StepKind =
      s.kind ??
      (raw.length > 1 && index === 0
        ? "uppvärmning"
        : raw.length > 1 && index === last
          ? "nedvarvning"
          : (s.zone ? s.zone.hard : s.high >= 0.9)
            ? "intervall"
            : "distans");
    const { zone: _zone, ...step } = s;
    void _zone;
    return { type: "steg", step: { ...step, kind } };
  });
}

const sv = (v: number) =>
  (Math.round(v * 100) / 100).toString().replace(".", ",");

/** Stegets längd: "4 min", "1:30", "1,5 km" eller "400 m". */
export function formatAmount(step: WorkoutStep): string {
  if (step.durationSeconds) {
    const s = step.durationSeconds;
    if (s % 3600 === 0) return `${s / 3600} h`;
    if (s % 60 === 0) return `${s / 60} min`;
    if (s < 60) return `${s} s`;
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }
  const m = step.distanceM ?? 0;
  return m >= 1000 && m % 100 === 0 ? `${sv(m / 1000)} km` : `${m} m`;
}

function formatStep(
  step: WorkoutStep,
  inferred: StepKind,
  zones: boolean,
): string {
  const low = sv(step.low * 100);
  const high = sv(step.high * 100);
  const zone = zones ? zoneForRange(step.low, step.high) : null;
  const target = zone
    ? `@${zone.key}`
    : low === high
      ? `${low}%`
      : `${low}-${high}%`;
  const label = step.label || (step.kind !== inferred ? step.kind : "");
  return [formatAmount(step), target, label].filter(Boolean).join(" ");
}

/**
 * Blocken som en rad, i samma form som `parseStructure` läser. Med `zones`
 * skrivs mål som ligger exakt på en zon som `@LO` – bara rätt för pass som
 * räknas mot maratonfart.
 */
export function formatStructure(
  blocks: WorkoutBlock[],
  options: { zones?: boolean } = {},
): string {
  const zones = options.zones ?? false;
  // Typerna som raden skulle få utan etiketter, för att bara skriva ut de
  // som avviker.
  const bare = inferKinds(
    blocks.map((b) =>
      b.type === "steg"
        ? { type: "steg" as const, step: { ...b.step, kind: null } }
        : {
            type: "repetition" as const,
            times: b.times,
            steps: b.steps.map((s) => ({ ...s, kind: null })),
          },
    ),
  );
  return blocks
    .map((block, i) => {
      const plain = bare[i];
      if (block.type === "steg" && plain.type === "steg") {
        return formatStep(block.step, plain.step.kind, zones);
      }
      if (block.type === "repetition" && plain.type === "repetition") {
        return `${block.times}x(${block.steps
          .map((s, j) => formatStep(s, plain.steps[j].kind, zones))
          .join(" + ")})`;
      }
      return "";
    })
    .filter(Boolean)
    .join("; ");
}

/** Passets tid i sekunder, när alla steg är angivna i tid. */
export function structureSeconds(blocks: WorkoutBlock[]): number | null {
  let total = 0;
  for (const block of blocks) {
    const steps = block.type === "steg" ? [block.step] : block.steps;
    const times = block.type === "steg" ? 1 : block.times;
    for (const step of steps) {
      if (!step.durationSeconds) return null;
      total += step.durationSeconds * times;
    }
  }
  return total;
}
