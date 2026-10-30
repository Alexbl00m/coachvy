import { focusLabel } from "@/lib/plan-library/focus";
import { levelOptionLabel, rangeText } from "@/lib/plan-library/labels";
import { levelKeyOf, listInstances, listLibrary } from "@/lib/plan-library/queries";
import { nextMonday, phaseEnd, queueOf } from "@/lib/plan-library/queue";
import { categoriesForSport } from "@/lib/plan-library/sports";
import { planSuggestions } from "@/lib/plan-library/suggestions";
import { todayIso } from "@/lib/season/season";

import { PhaseQueue } from "./phase-queue";

/**
 * Adeptens faser i kö, med planväljaren. Planerna för adeptens gren kommer
 * först och förslagen ur testet och huvudloppet överst. `?fas=valj` öppnar
 * väljaren, `fokus` och `mall` pekar ut ett fokus eller en plan.
 */
export async function AdeptPhaseQueue({
  adept,
  query,
}: {
  adept: { id: string; full_name: string; sport: string | null };
  query: { fas?: string; fokus?: string; mall?: string };
}) {
  const [instances, library, suggestions] = await Promise.all([
    listInstances(adept.id),
    listLibrary(),
    planSuggestions(adept.id),
  ]);
  const queue = queueOf(instances);
  const last = queue.at(-1);
  const previousLevelKey = last ? await levelKeyOf(last.start_level_id) : null;
  const categories = categoriesForSport(adept.sport);
  const forSport = (key: string | undefined) =>
    categories !== null && key !== undefined && categories.includes(key);

  const plans = library
    .map((e) => {
      const lows = e.levels.flatMap((l) => l.hours_min ?? l.hours_max ?? []);
      const highs = e.levels.flatMap((l) => l.hours_max ?? l.hours_min ?? []);
      return {
        versionId: e.version.id,
        slug: e.template.slug,
        title: e.version.title,
        summary: e.version.summary,
        category: e.category?.name ?? null,
        focus: e.template.focus,
        focusLabel: focusLabel(e.template.focus) ?? null,
        forSport: forSport(e.category?.key),
        minWeeks: e.version.min_weeks,
        maxWeeks: e.version.max_weeks,
        hours: lows.length ? rangeText(Math.min(...lows), Math.max(...highs), "h/vecka") : "",
        phases: e.phases.map((p) => ({
          id: p.id,
          name: p.name,
          weeks: p.weeks,
          specificity: p.specificity,
        })),
        levels: [...e.levels]
          .sort((a, b) => b.rank - a.rank)
          .map((l) => ({ id: l.id, key: l.key, label: levelOptionLabel(l) })),
      };
    })
    // Adeptens gren först, sedan i bibliotekets ordning.
    .sort((a, b) => Number(b.forSport) - Number(a.forSport));

  return (
    <PhaseQueue
      adept={{ id: adept.id, firstName: adept.full_name.split(" ")[0] }}
      items={queue.map((i) => ({
        id: i.id,
        title: i.title,
        status: i.status as "aktiv" | "kommande",
        startDate: i.start_date,
        endDate: phaseEnd(i),
        weeks: i.weeks,
      }))}
      plans={plans}
      suggestions={suggestions.map((s) => ({
        focus: s.focus,
        label: s.label,
        reason: s.reason,
        versionIds: s.plans.map((p) => p.version.id),
      }))}
      sportName={categories ? (adept.sport?.trim().toLowerCase() ?? null) : null}
      defaultStart={nextMonday(todayIso())}
      previousLevelKey={previousLevelKey}
      initial={{
        open: query.fas === "valj",
        focus: query.fokus ?? null,
        versionId: query.mall ?? null,
      }}
    />
  );
}
