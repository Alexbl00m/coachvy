import { redirect } from "next/navigation";

import { AdeptPhaseQueue } from "@/components/plan-library/adept-phase-queue";
import { SeasonPlan } from "@/components/season/season-plan";
import { loadWorkspace } from "@/lib/adepts/workspace";
import { adeptHref, routes } from "@/lib/routes";

export const metadata = { title: "Plan" };

export default async function AdeptSeasonPage({
  params,
  searchParams,
}: PageProps<"/app/adepter/[id]/plan">) {
  const { adept, canEdit, isSelf, asAdept, isCoach } =
    await loadWorkspace(params);
  const query = await searchParams;
  const search = new URLSearchParams(
    Object.entries(query).flatMap(([k, v]) =>
      typeof v === "string" ? [[k, v]] : [],
    ),
  ).toString();

  // Planen ur biblioteket låg tidigare på den här adressen.
  if (query.plan || query.vecka || query.vy === "hela") {
    redirect(`${adeptHref(adept.id, "bibliotek")}?${search}`);
  }

  // Adepten själv har säsongsplanen i sin egen app.
  if (asAdept) redirect(`${routes.plans}${search ? `?${search}` : ""}`);

  return (
    <>
      {/* Coachen lägger planer på adepten som faser, efter varandra. */}
      {isCoach && (
        <AdeptPhaseQueue
          adept={adept}
          query={{
            fas: typeof query.fas === "string" ? query.fas : undefined,
            fokus: typeof query.fokus === "string" ? query.fokus : undefined,
            mall: typeof query.mall === "string" ? query.mall : undefined,
          }}
        />
      )}
      <SeasonPlan
        adept={adept}
        // Coachen planerar; en adept utan coach planerar sin egen säsong.
        canPlan={canEdit || (isSelf && adept.coach_id === null)}
        basePath={adeptHref(adept.id, "plan")}
        fran={typeof query.fran === "string" ? query.fran : undefined}
        openNew={query.ny === "period"}
      />
    </>
  );
}
