import { AdeptActivities } from "@/components/activities/adept-activities";
import { PageHeader } from "@/components/page-header";
import { AdeptPicker } from "@/components/progression/adept-picker";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import {
  getHealthConsent,
  getMyAdeptRow,
  listAdepts,
} from "@/lib/adepts/queries";
import { requireSessionUser } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Lopp och aktiviteter" };

/** Antal aktiviteter och senaste dag per adept, för väljaren och förvalet. */
async function activityCounts(): Promise<
  Map<string, { count: number; latest: string }>
> {
  const out = new Map<string, { count: number; latest: string }>();
  if (!isSupabaseConfigured()) return out;
  const supabase = await createClient();
  const { data } = await supabase
    .from("activities")
    .select("adept_id, performed_on");
  for (const row of data ?? []) {
    const current = out.get(row.adept_id);
    out.set(row.adept_id, {
      count: (current?.count ?? 0) + 1,
      latest:
        current && current.latest > row.performed_on
          ? current.latest
          : row.performed_on,
    });
  }
  return out;
}

/**
 * Lopp och aktiviteter i menyn: samma innehåll som fliken på adeptsidan, med
 * en adeptväljare för coachen. En adept ser sina egna.
 */
export default async function ActivitiesPage({
  searchParams,
}: PageProps<"/app/aktiviteter">) {
  const user = await requireSessionUser();
  const query = await searchParams;
  const showAll = query.alla === "1";

  const header = (
    <PageHeader
      title="Lopp och aktiviteter"
      description="Pass och tävlingar ur klockan, utvecklingen i text och profilen ur träningen."
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
    return (
      <>
        {header}
        <AdeptActivities
          adept={{ id: adept.id, full_name: adept.full_name }}
          canUpload
          consentGiven
          showAll={showAll}
          moreHref={`${routes.activities}?alla=1`}
        />
      </>
    );
  }

  const [adepts, counts] = await Promise.all([listAdepts(), activityCounts()]);
  const own = adepts.filter((a) => a.coach_id === user.id);
  if (own.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          title="Inga adepter ännu"
          description="Lägg upp en adept, så kan pass och lopp laddas upp här."
          action={<ButtonLink href={routes.adepts}>Till adepterna</ButtonLink>}
        />
      </>
    );
  }

  // Utan val: den adept som tränade senast.
  const requested = typeof query.adept === "string" ? query.adept : null;
  const current =
    own.find((a) => a.id === requested) ??
    [...own].sort((a, b) =>
      (counts.get(b.id)?.latest ?? "").localeCompare(
        counts.get(a.id)?.latest ?? "",
      ),
    )[0];
  const consent = current.profile_id
    ? await getHealthConsent(current.profile_id)
    : null;

  return (
    <>
      {header}
      <div className="mb-6">
        <AdeptPicker
          current={current.id}
          basePath={routes.activities}
          adepts={own.map((a) => ({
            id: a.id,
            name: a.full_name,
            tests: counts.get(a.id)?.count ?? 0,
          }))}
        />
      </div>
      <AdeptActivities
        key={current.id}
        adept={{ id: current.id, full_name: current.full_name }}
        canUpload
        consentGiven={Boolean(consent)}
        showAll={showAll}
        moreHref={`${routes.activities}?adept=${current.id}&alla=1`}
      />
    </>
  );
}
