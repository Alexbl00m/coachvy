import { redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { ProgressionSection } from "@/components/progression/progression-section";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { getMyAdeptRow, listAdepts } from "@/lib/adepts/queries";
import { requireSessionUser } from "@/lib/auth/session";
import { adeptHref, routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Progression" };

/** Antal testtillfällen per adept, för att välja adept när ingen anges. */
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

/**
 * Progressionen för adepten själv. Coachen har den i adeptens arbetsyta under
 * Tester, så gamla länkar hit leder dit.
 */
export default async function ProgressionPage({
  searchParams,
}: PageProps<"/app/progression">) {
  const user = await requireSessionUser();
  const query = await searchParams;
  const gren = typeof query.gren === "string" ? query.gren : undefined;
  const vy = typeof query.vy === "string" ? query.vy : undefined;

  const header = (
    <PageHeader
      eyebrow="Utveckling"
      title="Progression"
      description="Utvecklingen ur träningen och testerna över tid, en gren i taget."
    />
  );

  if (user.profile?.role === "coach") {
    const [adepts, counts] = await Promise.all([listAdepts(), countSessions()]);
    const own = adepts.filter((a) => a.coach_id === user.id);
    if (own.length === 0) {
      return (
        <>
          {header}
          <EmptyState
            title="Inga adepter ännu"
            description="Lägg upp en adept och registrera ett test, så syns utvecklingen här."
            action={
              <ButtonLink href={routes.adepts}>Till adepterna</ButtonLink>
            }
          />
        </>
      );
    }
    const requested = typeof query.adept === "string" ? query.adept : null;
    // Utan val: den adept som har flest tester – där finns mest att se.
    const current =
      own.find((a) => a.id === requested) ??
      [...own].sort(
        (a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0),
      )[0];
    const params = new URLSearchParams();
    if (gren) params.set("gren", gren);
    if (vy) params.set("vy", vy);
    const search = params.toString();
    redirect(
      `${adeptHref(current.id, "progression")}${search ? `?${search}` : ""}`,
    );
  }

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
  return (
    <ProgressionSection
      adept={adept}
      canEdit={false}
      basePath={routes.progression}
      gren={gren}
      vy={vy}
      header={{
        eyebrow: "Utveckling",
        title: "Utveckling",
        description: "Utvecklingen ur testerna över tid, en gren i taget.",
      }}
    />
  );
}
