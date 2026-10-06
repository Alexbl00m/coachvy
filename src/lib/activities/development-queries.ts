import "server-only";

import { protocolByKey } from "@/lib/tests/protocols";
import { listSessions } from "@/lib/tests/session-queries";
import { todayIso } from "@/lib/season/season";
import { analyseTraining, type DevelopmentReading } from "./development";
import { listActivities } from "./queries";
import { candidatesFrom, pickReference } from "./reference";

/** Utvecklingen ur en adepts träning, mot testerna som gäller i dag. */
export async function developmentFor(
  adeptId: string,
): Promise<DevelopmentReading | null> {
  const [activities, sessions] = await Promise.all([
    listActivities(adeptId),
    listSessions(adeptId),
  ]);
  const today = todayIso();
  const candidates = candidatesFrom(
    sessions,
    (key) => protocolByKey(key)?.label ?? key,
  );
  return analyseTraining(activities, today, {
    cp: pickReference(candidates, today, "cykling").cp,
    cs: pickReference(candidates, today, "löpning").cs,
  });
}
