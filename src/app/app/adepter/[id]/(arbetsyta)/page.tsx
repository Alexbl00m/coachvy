import { redirect } from "next/navigation";

import { AdeptStatus } from "@/components/adepts/adept-status";
import { getAdept } from "@/lib/adepts/queries";
import { loadWorkspace } from "@/lib/adepts/workspace";
import { adeptHref, LEGACY_ADEPT_VIEWS, routes } from "@/lib/routes";
import { todayIso } from "@/lib/season/season";

export async function generateMetadata({
  params,
}: PageProps<"/app/adepter/[id]">) {
  const { id } = await params;
  const adept = await getAdept(id);
  return { title: adept?.full_name ?? "Adept" };
}

/** Första fliken: behöver jag göra något med den här adepten? */
export default async function AdeptLagePage({
  params,
  searchParams,
}: PageProps<"/app/adepter/[id]">) {
  const { user, adept, asAdept } = await loadWorkspace(params);
  const query = await searchParams;

  // Flikarna låg tidigare i `?vy=`; gamla länkar och bokmärken leder rätt.
  const legacy =
    typeof query.vy === "string" ? LEGACY_ADEPT_VIEWS[query.vy] : undefined;
  if (legacy && legacy !== "lage") {
    redirect(
      `${adeptHref(adept.id, legacy)}${query.alla === "1" ? "?alla=1" : ""}`,
    );
  }

  // Adepten själv har Idag i stället för coachens läge.
  if (asAdept) redirect(routes.dashboard);

  return <AdeptStatus adept={adept} viewerId={user.id} today={todayIso()} />;
}
