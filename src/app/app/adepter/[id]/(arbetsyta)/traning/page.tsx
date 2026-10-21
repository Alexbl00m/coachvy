import { redirect } from "next/navigation";

import { AdeptActivities } from "@/components/activities/adept-activities";
import { getHealthConsent } from "@/lib/adepts/queries";
import { loadWorkspace } from "@/lib/adepts/workspace";
import { adeptHref, routes } from "@/lib/routes";

export const metadata = { title: "Träning" };

/** Det adepten har gjort: pass och lopp ur klockan. */
export default async function AdeptTrainingPage({
  params,
  searchParams,
}: PageProps<"/app/adepter/[id]/traning">) {
  const { adept, canEdit, isSelf, asAdept } = await loadWorkspace(params);
  const query = await searchParams;
  if (asAdept) {
    redirect(`${routes.activities}${query.alla === "1" ? "?alla=1" : ""}`);
  }
  const consent =
    !isSelf && adept.profile_id
      ? await getHealthConsent(adept.profile_id)
      : null;
  return (
    <AdeptActivities
      adept={{ id: adept.id, full_name: adept.full_name }}
      canUpload={canEdit || isSelf}
      consentGiven={isSelf || Boolean(consent)}
      showAll={query.alla === "1"}
      moreHref={`${adeptHref(adept.id, "traning")}?alla=1`}
    />
  );
}
