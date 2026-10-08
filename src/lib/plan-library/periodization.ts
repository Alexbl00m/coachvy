/**
 * Periodiseringsförslaget när en medlem startar en plan.
 *
 * Mallen beskriver planen i sin fulla längd, vecka för vecka, fas för fas.
 * En kortare plan kortas fas för fas i den ordning mallen anger
 * (`trimOrder`, lägst först) och från fasens början – så att det är den
 * ospecifika grunden som blir kortare, medan den specifika fasen och tapern
 * ligger kvar orörda före loppet. Det är tunnelperiodiseringens logik: ju
 * närmare målet, desto mer specifikt, och den delen ska inte kapas.
 *
 * Med ett A-lopp räknas planen bakåt från loppveckan. Utan räknas den framåt
 * från ett startdatum. Medlemmen kan sedan justera veckorna per fas inom
 * fasens gränser innan planen startar.
 *
 * Är det längre till loppet än planen kan vara går den i flera varv
 * (`rounds.ts`): varje varv är planen kortad till varvets längd, och varven
 * läggs efter varandra med loppet i det sista.
 *
 * Modulen är ren: datum in, datum ut, inga klockor.
 */

import { addDays, daysBetween, weekdayIndex } from "@/lib/season/season";

import type { Phase, SeasonPhase, TemplateWeek } from "./types";

export type Goal =
  | {
      mode: "lopp";
      raceDate: string;
      /** Tidigaste dag planen kan börja, i regel i dag. */
      earliest: string;
      /** Veckodagen veckorna börjar på, 0 är måndag. */
      weekStart: number;
    }
  | { mode: "fritt"; startDate: string };

export type PeriodizationInput = {
  phases: Phase[];
  weeks: TemplateWeek[];
  minWeeks: number;
  maxWeeks: number;
  goal: Goal;
  /** Önskad längd. Utelämnad: så lång som mallen och tiden tillåter. */
  length?: number;
  /** Medlemmens egna veckor per fas. Vinner över `length`. */
  counts?: Record<string, number>;
  /** Varvens längd. Fler än ett: planen går i varv och `length` gäller inte. */
  rounds?: number[];
  /** Medlemmens egna veckor per fas i varje varv. Vinner över `rounds`. */
  roundCounts?: (Record<string, number> | null | undefined)[];
};

export type PhaseSpan = {
  phaseId: string;
  name: string;
  seasonPhase: SeasonPhase | null;
  weeks: number;
  /** Veckor som kortats bort ur fasen. */
  trimmed: number;
  fromWeek: number;
  toWeek: number;
  startsOn: string;
  endsOn: string;
};

export type RoundPlan = {
  /** 1 är första varvet. */
  round: number;
  weeks: number;
  fromWeek: number;
  toWeek: number;
  startsOn: string;
  endsOn: string;
  phases: PhaseSpan[];
  /** Fasernas veckor i varvet, för att justera dem. */
  counts: Record<string, number>;
};

export type Periodization =
  | {
      ok: true;
      startDate: string;
      endDate: string;
      length: number;
      /** Planveckan loppet ligger i. Null utan lopp. */
      raceWeek: number | null;
      /** Alla varvens faser i ordning. */
      phases: PhaseSpan[];
      /** Ett varv när planen inte går i varv. */
      rounds: RoundPlan[];
      /** Mallveckornas id i planens ordning. */
      weekMap: string[];
      notes: string[];
    }
  | { ok: false; error: string };

const WEEKDAY_NAMES = [
  "måndag",
  "tisdag",
  "onsdag",
  "torsdag",
  "fredag",
  "lördag",
  "söndag",
];

/** Första dagen i veckan som innehåller `date`, med veckor som börjar på `weekStart`. */
export function weekStartOn(date: string, weekStart: number): string {
  return addDays(date, -((weekdayIndex(date) - weekStart + 7) % 7));
}

/** Första veckostarten på eller efter `date`. */
export function nextWeekStart(date: string, weekStart: number): string {
  return addDays(date, (weekStart - weekdayIndex(date) + 7) % 7);
}

const byPosition = <T extends { position: number }>(a: T, b: T) =>
  a.position - b.position;

/** Hur många veckor varje fas har i full längd, och hur kort den får bli. */
export function phaseBounds(
  phases: Phase[],
  weeks: TemplateWeek[],
): Record<string, { min: number; max: number }> {
  const out: Record<string, { min: number; max: number }> = {};
  for (const phase of phases) {
    const max = weeks.filter((w) => w.phaseId === phase.id).length;
    out[phase.id] = {
      // En fas som aldrig kortas har sin fulla längd som minsta.
      min: phase.trimOrder === null ? max : Math.min(phase.minWeeks, max),
      max,
    };
  }
  return out;
}

/**
 * Kortar planen till `length` veckor: en vecka i taget ur den fas som står
 * först på tur och ännu har veckor över sin minsta längd.
 */
export function trimCounts(
  phases: Phase[],
  weeks: TemplateWeek[],
  length: number,
): Record<string, number> | null {
  const bounds = phaseBounds(phases, weeks);
  const counts: Record<string, number> = {};
  for (const phase of phases) counts[phase.id] = bounds[phase.id].max;
  let total = Object.values(counts).reduce((s, n) => s + n, 0);

  const order = phases
    .filter((p) => p.trimOrder !== null)
    .sort((a, b) => a.trimOrder! - b.trimOrder! || a.position - b.position);

  while (total > length) {
    const next = order.find((p) => counts[p.id] > bounds[p.id].min);
    if (!next) return null;
    counts[next.id] -= 1;
    total -= 1;
  }
  return counts;
}

/** Fasernas veckor ur medlemmens val, kontrollerade mot fasernas gränser. */
function explicitCounts(
  phases: Phase[],
  bounds: Record<string, { min: number; max: number }>,
  wanted: Record<string, number>,
): Record<string, number> | string {
  const counts: Record<string, number> = {};
  for (const phase of phases) {
    const n = wanted[phase.id] ?? bounds[phase.id].max;
    const { min, max } = bounds[phase.id];
    if (n < min || n > max) {
      return min === max
        ? `${phase.name} har ${max} veckor och kortas inte.`
        : `${phase.name} kan vara ${min}–${max} veckor.`;
    }
    counts[phase.id] = n;
  }
  return counts;
}

/**
 * Ett varv lagt från `fromWeek`. Varje fas behåller sina sista veckor:
 * kortningen sker från fasens början.
 */
function layRound(input: {
  round: number;
  phases: Phase[];
  weeks: TemplateWeek[];
  counts: Record<string, number>;
  startDate: string;
  fromWeek: number;
}): { plan: RoundPlan; weekMap: string[] } {
  const { phases, weeks, counts, startDate } = input;
  const weekMap: string[] = [];
  const spans: PhaseSpan[] = [];
  const offset = input.fromWeek - 1;
  for (const phase of phases) {
    const own = weeks.filter((w) => w.phaseId === phase.id);
    const kept = own.slice(own.length - counts[phase.id]);
    if (kept.length === 0) continue;
    const fromWeek = offset + weekMap.length + 1;
    weekMap.push(...kept.map((w) => w.id));
    const toWeek = offset + weekMap.length;
    spans.push({
      phaseId: phase.id,
      name: phase.name,
      seasonPhase: phase.seasonPhase,
      weeks: kept.length,
      trimmed: own.length - kept.length,
      fromWeek,
      toWeek,
      startsOn: addDays(startDate, (fromWeek - 1) * 7),
      endsOn: addDays(startDate, toWeek * 7 - 1),
    });
  }
  const toWeek = offset + weekMap.length;
  return {
    weekMap,
    plan: {
      round: input.round,
      weeks: weekMap.length,
      fromWeek: input.fromWeek,
      toWeek,
      startsOn: addDays(startDate, offset * 7),
      endsOn: addDays(startDate, toWeek * 7 - 1),
      phases: spans,
      counts,
    },
  };
}

const weeksText = (n: number) => `${n} ${n === 1 ? "vecka" : "veckor"}`;

export function proposePeriodization(input: PeriodizationInput): Periodization {
  const phases = [...input.phases].sort(byPosition);
  const weeks = [...input.weeks].sort(byPosition);
  const bounds = phaseBounds(phases, weeks);
  const fullLength = weeks.length;
  const maxWeeks = Math.min(input.maxWeeks, fullLength);
  const { goal } = input;

  // Hur många veckor ryms före loppet?
  let available = Infinity;
  let firstStart: string | null = null;
  let raceWeekStart: string | null = null;
  if (goal.mode === "lopp") {
    firstStart = nextWeekStart(goal.earliest, goal.weekStart);
    raceWeekStart = weekStartOn(goal.raceDate, goal.weekStart);
    if (goal.raceDate < goal.earliest) {
      return { ok: false, error: "Loppet har redan varit." };
    }
    available = Math.floor(daysBetween(firstStart, raceWeekStart) / 7) + 1;
    if (available < input.minWeeks) {
      return {
        ok: false,
        error: `Det är ${weeksText(Math.max(0, available))} kvar till loppet, och planen behöver minst ${input.minWeeks}. Välj ett senare lopp eller starta utan lopp.`,
      };
    }
  }

  // Fasernas veckor, varv för varv.
  const multi = (input.rounds?.length ?? 0) > 1;
  const roundCounts: Record<string, number>[] = [];
  let notes: string[] = [];
  if (multi) {
    const rounds = input.rounds!;
    for (let i = 0; i < rounds.length; i += 1) {
      const own = input.roundCounts?.[i];
      if (own) {
        const counts = explicitCounts(phases, bounds, own);
        if (typeof counts === "string") {
          return { ok: false, error: `Varv ${i + 1}: ${counts}` };
        }
        roundCounts.push(counts);
        continue;
      }
      const r = rounds[i];
      if (!Number.isInteger(r) || r < input.minWeeks || r > maxWeeks) {
        return {
          ok: false,
          error: `Varv ${i + 1} ska vara ${input.minWeeks}–${maxWeeks} veckor, inte ${r}.`,
        };
      }
      const trimmed = trimCounts(phases, weeks, r);
      if (!trimmed) {
        return {
          ok: false,
          error: `Planen kan inte kortas till ${r} veckor.`,
        };
      }
      roundCounts.push(trimmed);
    }
  } else if (input.counts) {
    const counts = explicitCounts(phases, bounds, input.counts);
    if (typeof counts === "string") return { ok: false, error: counts };
    roundCounts.push(counts);
  } else {
    const wanted = Math.min(input.length ?? maxWeeks, maxWeeks, available);
    const trimmed = trimCounts(phases, weeks, wanted);
    if (!trimmed) {
      return {
        ok: false,
        error: `Planen kan inte kortas till ${wanted} veckor.`,
      };
    }
    roundCounts.push(trimmed);
    if (input.length !== undefined && input.length > available) {
      notes.push(
        `Det får plats ${available} veckor före loppet, så planen blev ${wanted} veckor i stället för ${input.length}.`,
      );
    }
  }

  const lengths = roundCounts.map((c) =>
    Object.values(c).reduce((s, n) => s + n, 0),
  );
  for (let i = 0; i < lengths.length; i += 1) {
    if (lengths[i] < input.minWeeks || lengths[i] > maxWeeks) {
      const what = multi ? `Varv ${i + 1}` : "Planen";
      return {
        ok: false,
        error: `${what} ska vara ${input.minWeeks}–${maxWeeks} veckor, inte ${lengths[i]}.`,
      };
    }
  }
  const length = lengths.reduce((s, n) => s + n, 0);
  if (length > 104) {
    return { ok: false, error: "En plan kan vara högst 104 veckor." };
  }
  if (length > available) {
    return {
      ok: false,
      error: `Det får bara plats ${available} veckor före loppet.`,
    };
  }

  const startDate =
    goal.mode === "lopp"
      ? addDays(raceWeekStart!, -(length - 1) * 7)
      : goal.startDate;

  const weekMap: string[] = [];
  const rounds: RoundPlan[] = [];
  for (const [i, counts] of roundCounts.entries()) {
    const laid = layRound({
      round: i + 1,
      phases,
      weeks,
      counts,
      startDate,
      fromWeek: weekMap.length + 1,
    });
    weekMap.push(...laid.weekMap);
    rounds.push(laid.plan);
  }
  const spans = rounds.flatMap((r) => r.phases);

  for (const round of rounds) {
    for (const span of round.phases) {
      if (span.trimmed > 0) {
        notes.push(
          `${multi ? `Varv ${round.round}: ` : ""}${span.name} är ${weeksText(span.weeks)}, ${span.trimmed} kortare än i full längd.`,
        );
      }
    }
  }
  if (multi) {
    notes = [
      `Planen går i ${rounds.length} varv: ${lengths.join(" + ")} veckor. Varven före det sista slutar med ett testlopp.`,
      ...notes,
    ];
  }
  if (goal.mode === "lopp") {
    const wait = Math.round(daysBetween(firstStart!, startDate) / 7);
    notes = [
      `Loppet ligger i vecka ${length}, en ${WEEKDAY_NAMES[weekdayIndex(goal.raceDate)]}.`,
      ...(wait > 0
        ? [
            `Planen börjar om ${weeksText(wait)}. Fram till dess: lugn grundträning.`,
          ]
        : []),
      ...notes,
    ];
  }

  return {
    ok: true,
    startDate,
    endDate: addDays(startDate, length * 7 - 1),
    length,
    raceWeek: goal.mode === "lopp" ? length : null,
    phases: spans,
    rounds,
    weekMap,
    notes,
  };
}

/** Planveckan ett datum ligger i, 1 är första veckan. Utanför planen: 0 eller mer än längden. */
export function planWeekOf(startDate: string, date: string): number {
  return Math.floor(daysBetween(startDate, date) / 7) + 1;
}

/** Första dagen i en planvecka. */
export const planWeekStart = (startDate: string, week: number) =>
  addDays(startDate, (week - 1) * 7);

/** Faserna i en startad plan, ur veckokartan. */
export function spansFromWeekMap(input: {
  startDate: string;
  weekMap: string[];
  weeks: TemplateWeek[];
  phases: Phase[];
}): PhaseSpan[] {
  const weekById = new Map(input.weeks.map((w) => [w.id, w]));
  const phaseById = new Map(input.phases.map((p) => [p.id, p]));
  const full = new Map<string, number>();
  for (const w of input.weeks)
    full.set(w.phaseId, (full.get(w.phaseId) ?? 0) + 1);

  const spans: PhaseSpan[] = [];
  input.weekMap.forEach((id, i) => {
    const phase = phaseById.get(weekById.get(id)?.phaseId ?? "");
    if (!phase) return;
    const week = i + 1;
    const last = spans.at(-1);
    if (last && last.phaseId === phase.id && last.toWeek === week - 1) {
      last.toWeek = week;
      last.weeks += 1;
      last.endsOn = addDays(input.startDate, week * 7 - 1);
      last.trimmed = (full.get(phase.id) ?? 0) - last.weeks;
      return;
    }
    spans.push({
      phaseId: phase.id,
      name: phase.name,
      seasonPhase: phase.seasonPhase,
      weeks: 1,
      trimmed: (full.get(phase.id) ?? 0) - 1,
      fromWeek: week,
      toWeek: week,
      startsOn: addDays(input.startDate, (week - 1) * 7),
      endsOn: addDays(input.startDate, week * 7 - 1),
    });
  });
  return spans;
}
