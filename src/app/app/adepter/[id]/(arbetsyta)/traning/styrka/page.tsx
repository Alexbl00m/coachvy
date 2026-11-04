import { redirect } from "next/navigation";

import { StrengthSection } from "@/components/strength/strength-section";
import { loadWorkspace } from "@/lib/adepts/workspace";
import { adeptHref, routes } from "@/lib/routes";

export const metadata = { title: "Styrka" };

export default async function AdeptStrengthPage({
  params,
  searchParams,
}: PageProps<"/app/adepter/[id]/traning/styrka">) {
  const { adept, asAdept } = await loadWorkspace(params);
  const query = await searchParams;
  const value = (key: string) =>
    typeof query[key] === "string" ? (query[key] as string) : null;
  if (asAdept) {
    // Ändra, logga och planera följer med till adeptens egen styrkesida.
    const forward = new URLSearchParams();
    for (const key of ["andra", "logga", "planera"]) {
      const v = value(key);
      if (v) forward.set(key, v);
    }
    const search = forward.toString();
    redirect(`${routes.strength}${search ? `?${search}` : ""}`);
  }
  return (
    <StrengthSection
      adeptId={adept.id}
      basePath={adeptHref(adept.id, "styrka")}
      editingId={value("andra")}
      loggingId={value("logga")}
      planDate={value("planera")}
    />
  );
}
