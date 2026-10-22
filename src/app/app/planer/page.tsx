import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { SeasonPlan } from "@/components/season/season-plan";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { getMyAdeptRow, listAdepts } from "@/lib/adepts/queries";
import { requireSessionUser } from "@/lib/auth/session";
import { adeptHref, routes } from "@/lib/routes";

export const metadata = { title: "Säsongsplan" };

/**
 * Säsongsplanen för adepten själv. Coachen har planen i adeptens arbetsyta,
 * så gamla länkar hit – med eller utan vald adept – leder dit.
 */
export default async function PlanerPage({
  searchParams,
}: PageProps<"/app/planer">) {
  const user = await requireSessionUser();
  const query = await searchParams;
  const fran = typeof query.fran === "string" ? query.fran : undefined;

  if (user.profile?.role === "coach") {
    const own = (await listAdepts()).filter((a) => a.coach_id === user.id);
    if (own.length === 0) {
      return (
        <>
          <PageHeader title="Säsongsplan" />
          <EmptyState
            title="Inga adepter ännu"
            description="Säsongsplanen görs per adept. Lägg till en adept först."
            action={
              <ButtonLink href={routes.newAdept} className="font-semibold">
                <Plus aria-hidden className="size-4" />
                Lägg till adept
              </ButtonLink>
            }
          />
        </>
      );
    }
    const wanted = typeof query.adept === "string" ? query.adept : null;
    const adept = own.find((a) => a.id === wanted) ?? own[0];
    const params = new URLSearchParams();
    if (fran) params.set("fran", fran);
    if (query.ny === "period") params.set("ny", "period");
    const search = params.toString();
    redirect(`${adeptHref(adept.id, "plan")}${search ? `?${search}` : ""}`);
  }

  const adept = await getMyAdeptRow(user.id);
  if (!adept) {
    return (
      <>
        <PageHeader title="Säsongsplan" />
        <EmptyState
          title="Ingen adeptprofil hittades"
          description="Säsongsplanen hör till en adept. Ditt konto är inte kopplat till någon adeptprofil."
        />
      </>
    );
  }

  return (
    <>
      <SeasonPlan
        header={{ eyebrow: "Säsongsplan" }}
        adept={adept}
        canPlan={adept.profile_id === user.id && adept.coach_id === null}
        basePath={routes.plans}
        fran={fran}
        openNew={query.ny === "period"}
      />
    </>
  );
}
