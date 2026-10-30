import { focusLabel } from "@/lib/plan-library/focus";
import { levelOptionLabel } from "@/lib/plan-library/labels";
import { levelKeyOf, listInstances, listLibrary } from "@/lib/plan-library/queries";
import { nextMonday, phaseEnd, queueOf } from "@/lib/plan-library/queue";
import { planSuggestions } from "@/lib/plan-library/suggestions";
import { todayIso } from "@/lib/season/season";

import { PhaseQueue } from "./phase-queue";
import { PlanSuggestions } from "./plan-suggestions";

/**
 * Adeptens faser i kö, med planerna coachen kan lägga till. Utan pågående
 * fas står förslagen ur testet och huvudloppet först.
 */
export async function AdeptPhaseQueue({ adeptId }: { adeptId: string }) {
  const [instances, library] = await Promise.all([listInstances(adeptId), listLibrary()]);
  const queue = queueOf(instances);
  const last = queue.at(-1);
  const [previousLevelKey, suggestions] = await Promise.all([
    last ? levelKeyOf(last.start_level_id) : Promise.resolve(null),
    queue.some((i) => i.status === "aktiv") ? Promise.resolve([]) : planSuggestions(adeptId),
  ]);

  return (
    <>
      <PlanSuggestions suggestions={suggestions} forCoach />
      <PhaseQueue
        adeptId={adeptId}
        defaultStart={nextMonday(todayIso())}
        previousLevelKey={previousLevelKey}
        items={queue.map((i) => ({
          id: i.id,
          title: i.title,
          status: i.status as "aktiv" | "kommande",
          startDate: i.start_date,
          endDate: phaseEnd(i),
          weeks: i.weeks,
        }))}
        options={library.map((e) => ({
          versionId: e.version.id,
          title: e.version.title,
          group:
            [e.category?.name, focusLabel(e.template.focus)].filter(Boolean).join(" · ") ||
            "Övrigt",
          minWeeks: e.version.min_weeks,
          maxWeeks: e.version.max_weeks,
          levels: [...e.levels]
            .sort((a, b) => b.rank - a.rank)
            .map((l) => ({ id: l.id, key: l.key, label: levelOptionLabel(l) })),
        }))}
      />
    </>
  );
}
