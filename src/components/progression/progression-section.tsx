import { ReferenceAndGoals } from "@/components/benchmarks/reference-and-goals";
import {
  ProgressionView,
  sportFromSlug,
} from "@/components/progression/progression-view";
import { listFullSessions } from "@/lib/tests/session-queries";
import type { Adept } from "@/lib/types/database";

/**
 * Utvecklingen ur testerna över tid, en gren i taget. Utvecklingen ur
 * träningen står under Träning, med passen den räknas på.
 */
export async function ProgressionSection({
  adept,
  canEdit,
  basePath,
  gren,
  vy,
  header,
}: {
  adept: Adept;
  canEdit: boolean;
  /** Sidan vyn ligger på; gren och vy läggs till som parametrar. */
  basePath: string;
  gren: string | undefined;
  vy: string | undefined;
  /** Sidans huvud, när avsnittet är hela sidan (se ProgressionView). */
  header?: { eyebrow: string; title: string; description: string };
}) {
  const sessions = await listFullSessions(adept.id);
  return (
    <ProgressionView
      adeptId={adept.id}
      sessions={sessions}
      canEdit={canEdit}
      sport={sportFromSlug(gren)}
      view={vy}
      basePath={basePath}
      header={header}
      goals={
        <ReferenceAndGoals
          adept={adept}
          sessions={sessions}
          canEdit={canEdit}
        />
      }
    />
  );
}
