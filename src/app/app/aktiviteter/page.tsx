import { redirect } from "next/navigation";

import { AdeptActivities } from "@/components/activities/adept-activities";
import { PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { getMyAdeptRow, listAdepts } from "@/lib/adepts/queries";
import { requireSessionUser } from "@/lib/auth/session";
import { adeptHref, routes } from "@/lib/routes";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Lopp och aktiviteter" };

/** Senaste träningsdagen per adept, för att välja adept när ingen anges. */
async function latestActivity(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!isSupabaseConfigured()) return out;
  const supabase = await createClient();
  const { data } = await supabase
    .from("activities")
    .select("adept_id, performed_on");
  for (const row of data ?? []) {
    const current = out.get(row.adept_id);
    if (!current || current < row.performed_on) {
      out.set(row.adept_id, row.performed_on);
    }
  }
  return out;
}

/**
 * Lopp och aktiviteter för adepten själv. Coachen har dem i adeptens
 * arbetsyta under Träning, så gamla länkar hit leder dit.
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

  if (user.profile?.role === "coach") {
    const [adepts, latest] = await Promise.all([
      listAdepts(),
      latestActivity(),
    ]);
    const own = adepts.filter((a) => a.coach_id === user.id);
    if (own.length === 0) {
      return (
        <>
          {header}
          <EmptyState
            title="Inga adepter ännu"
            description="Lägg upp en adept, så kan pass och lopp laddas upp här."
            action={
              <ButtonLink href={routes.adepts}>Till adepterna</ButtonLink>
            }
          />
        </>
      );
    }
    // Utan val: den adept som tränade senast.
    const requested = typeof query.adept === "string" ? query.adept : null;
    const current =
      own.find((a) => a.id === requested) ??
      [...own].sort((a, b) =>
        (latest.get(b.id) ?? "").localeCompare(latest.get(a.id) ?? ""),
      )[0];
    redirect(`${adeptHref(current.id, "traning")}${showAll ? "?alla=1" : ""}`);
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
