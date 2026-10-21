import { redirect } from "next/navigation";

import { ProgressionSection } from "@/components/progression/progression-section";
import { loadWorkspace } from "@/lib/adepts/workspace";
import { adeptHref, routes } from "@/lib/routes";

export const metadata = { title: "Progression" };

export default async function AdeptProgressionPage({
  params,
  searchParams,
}: PageProps<"/app/adepter/[id]/tester/progression">) {
  const { adept, canEdit, asAdept } = await loadWorkspace(params);
  const query = await searchParams;
  if (asAdept) {
    const search = new URLSearchParams(
      Object.entries(query).flatMap(([k, v]) =>
        typeof v === "string" ? [[k, v]] : [],
      ),
    ).toString();
    redirect(`${routes.progression}${search ? `?${search}` : ""}`);
  }
  return (
    <ProgressionSection
      adept={adept}
      canEdit={canEdit}
      basePath={adeptHref(adept.id, "progression")}
      gren={typeof query.gren === "string" ? query.gren : undefined}
      vy={typeof query.vy === "string" ? query.vy : undefined}
    />
  );
}
