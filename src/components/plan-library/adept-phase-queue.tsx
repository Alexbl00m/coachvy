import { focusLabel } from "@/lib/plan-library/focus";
import { listInstances, listLibrary } from "@/lib/plan-library/queries";
import { phaseEnd, queueOf } from "@/lib/plan-library/queue";
import { todayIso } from "@/lib/season/season";

import { PhaseQueue } from "./phase-queue";

/** Adeptens faser i kö, med planerna coachen kan lägga till. */
export async function AdeptPhaseQueue({ adeptId }: { adeptId: string }) {
  const [instances, library] = await Promise.all([listInstances(adeptId), listLibrary()]);
  return (
    <PhaseQueue
      adeptId={adeptId}
      today={todayIso()}
      items={queueOf(instances).map((i) => ({
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
          .map((l) => ({ id: l.id, key: l.key, name: l.name })),
      }))}
    />
  );
}
