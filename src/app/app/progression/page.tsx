import { DevelopmentCard } from "@/components/activities/development-card";
import { PageHeader } from "@/components/page-header";
import { AdeptPicker } from "@/components/progression/adept-picker";
import {
  ProgressionView,
  sportFromSlug,
} from "@/components/progression/progression-view";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { developmentFor } from "@/lib/activities/development-queries";
import { getMyAdeptRow, listAdepts } from "@/lib/adepts/queries";
import { requireSessionUser } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { listFullSessions } from "@/lib/tests/session-queries";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Progression" };

/** Antal testtillfällen per adept, för väljaren. */
async function countSessions(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!isSupabaseConfigured()) return counts;
  const supabase = await createClient();
  const { data } = await supabase.from("test_sessions").select("adept_id");
  for (const row of data ?? []) {
    counts.set(row.adept_id, (counts.get(row.adept_id) ?? 0) + 1);
  }
  return counts;
}

export default async function ProgressionPage({
  searchParams,
}: PageProps<"/app/progression">) {
  const user = await requireSessionUser();
  const query = await searchParams;
  const gren = typeof query.gren === "string" ? query.gren : undefined;
  const vy = typeof query.vy === "string" ? query.vy : undefined;

  const header = (
    <PageHeader
      title="Progression"
      description="Utvecklingen ur träningen och testerna över tid, en gren i taget."
    />
  );

  if (user.profile?.role === "adept") {
    const adept = await getMyAdeptRow(user.id);
    if (!adept) {
      return (
        <>
          {header}
          <EmptyState
            title="Ingen adeptprofil hittades"
            description="Ditt konto är inte kopplat till någon coach ännu. Be din coach lägga upp dig."
          />
        </>
      );
    }
    const [sessions, development] = await Promise.all([
      listFullSessions(adept.id),
      developmentFor(adept.id),
    ]);
    return (
      <>
        {header}
        <div className="mb-6">
          <DevelopmentCard reading={development} />
        </div>
        <ProgressionView
          adeptId={adept.id}
          sessions={sessions}
          canEdit={false}
          sport={sportFromSlug(gren)}
          view={vy}
        />
      </>
    );
  }

  const [adepts, counts] = await Promise.all([listAdepts(), countSessions()]);
  const own = adepts.filter((a) => a.coach_id === user.id);
  if (own.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          title="Inga adepter ännu"
          description="Lägg upp en adept och registrera ett test, så syns utvecklingen här."
          action={<ButtonLink href={routes.adepts}>Till adepterna</ButtonLink>}
        />
      </>
    );
  }

  const requested = typeof query.adept === "string" ? query.adept : null;
  // Utan val: den adept som har flest tester – där finns mest att se.
  const current =
    own.find((a) => a.id === requested) ??
    [...own].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))[0];
  const [sessions, development] = await Promise.all([
    listFullSessions(current.id),
    developmentFor(current.id),
  ]);

  return (
    <>
      {header}
      <div className="mb-6">
        <AdeptPicker
          current={current.id}
          adepts={own.map((a) => ({ id: a.id, name: a.full_name, tests: counts.get(a.id) ?? 0 }))}
        />
      </div>
      <div className="mb-6">
        <DevelopmentCard reading={development} />
      </div>
      <ProgressionView
        adeptId={current.id}
        sessions={sessions}
        canEdit
        sport={sportFromSlug(gren)}
        view={vy}
        query={{ adept: current.id }}
      />
    </>
  );
}
