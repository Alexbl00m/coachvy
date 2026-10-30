/**
 * Säsongen när adepten följer en plan ur biblioteket: planens faser blir
 * perioder, och de perioder coachen lagt in för hand gäller bara utanför
 * planens datum. Så räknar tidslinjen, läget, översikten och fördelningen
 * på det adepten faktiskt ska göra, utan att säsongen matas in två gånger.
 *
 * Modulen är ren: perioder och planer in, perioder ut.
 */

import type { TrainingBlockRow } from "@/lib/types/database";

import { addDays } from "./season";

/** En period på säsongen, inlagd för hand eller ur en plan. */
export type SeasonBlock = TrainingBlockRow & {
  /** Perioden är en fas i en plan ur biblioteket och ändras i planen. */
  plan?: { instanceId: string; title: string };
};

/** En startad plan och dess faser med datum (spansFromWeekMap). */
export type PlanForSeason = {
  id: string;
  adept_id: string;
  title: string;
  start_date: string;
  weeks: number;
  spans: {
    name: string;
    seasonPhase: TrainingBlockRow["phase"] | null;
    fromWeek: number;
    startsOn: string;
    endsOn: string;
  }[];
};

/** Planens faser som perioder. En fas utan säsongsfas blir ingen period. */
export function planBlocks(plan: PlanForSeason): SeasonBlock[] {
  return plan.spans.flatMap((span) =>
    span.seasonPhase
      ? [
          {
            id: `plan-${plan.id}-${span.fromWeek}`,
            adept_id: plan.adept_id,
            phase: span.seasonPhase,
            name: span.name,
            starts_on: span.startsOn,
            ends_on: span.endsOn,
            focus: null,
            created_by: null,
            created_at: "",
            updated_at: "",
            plan: { instanceId: plan.id, title: plan.title },
          },
        ]
      : [],
  );
}

/** Planens första och sista dag. */
export const planRange = (plan: Pick<PlanForSeason, "start_date" | "weeks">) => ({
  start: plan.start_date,
  end: addDays(plan.start_date, plan.weeks * 7 - 1),
});

/**
 * Perioden utan de dagar planerna täcker: hel, kortad, delad i två eller
 * borta.
 */
export function clipToRanges<T extends Pick<TrainingBlockRow, "id" | "starts_on" | "ends_on">>(
  block: T,
  ranges: { start: string; end: string }[],
): T[] {
  let pieces: T[] = [block];
  for (const r of ranges) {
    pieces = pieces.flatMap((p) => {
      if (r.end < p.starts_on || r.start > p.ends_on) return [p];
      const out: T[] = [];
      if (p.starts_on < r.start) out.push({ ...p, ends_on: addDays(r.start, -1) });
      if (p.ends_on > r.end) out.push({ ...p, starts_on: addDays(r.end, 1) });
      return out;
    });
  }
  // Delas en period i två får den andra halvan ett eget id, för listornas nycklar.
  return pieces.map((p, i) => (i === 0 ? p : { ...p, id: `${p.id}-${i + 1}` }));
}

/**
 * Säsongens perioder för en adept: planernas faser, och perioderna för hand
 * där ingen plan gäller. I datumordning.
 */
export function seasonBlocks(
  manual: TrainingBlockRow[],
  plans: PlanForSeason[],
): SeasonBlock[] {
  const ranges = plans.map(planRange);
  return [
    ...manual.flatMap((b) => clipToRanges(b, ranges)),
    ...plans.flatMap(planBlocks),
  ].sort((a, b) => a.starts_on.localeCompare(b.starts_on));
}
