import { redirect } from "next/navigation";

import { SeasonPlan } from "@/components/season/season-plan";
import { loadWorkspace } from "@/lib/adepts/workspace";
import { adeptHref } from "@/lib/routes";

export const metadata = { title: "Plan" };

export default async function AdeptSeasonPage({
  params,
  searchParams,
}: PageProps<"/app/adepter/[id]/plan">) {
  const { adept, canEdit, isSelf } = await loadWorkspace(params);
  const query = await searchParams;

  // Planen ur biblioteket låg tidigare på den här adressen.
  if (query.plan || query.vecka || query.vy === "hela") {
    const search = new URLSearchParams(
      Object.entries(query).flatMap(([k, v]) =>
        typeof v === "string" ? [[k, v]] : [],
      ),
    ).toString();
    redirect(`${adeptHref(adept.id, "bibliotek")}?${search}`);
  }

  return (
    <SeasonPlan
      adept={adept}
      // Coachen planerar; en adept utan coach planerar sin egen säsong.
      canPlan={canEdit || (isSelf && adept.coach_id === null)}
      basePath={adeptHref(adept.id, "plan")}
      fran={typeof query.fran === "string" ? query.fran : undefined}
      openNew={query.ny === "period"}
    />
  );
}
