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
  if (asAdept) {
    const andra = typeof query.andra === "string" ? query.andra : null;
    redirect(`${routes.strength}${andra ? `?andra=${andra}` : ""}`);
  }
  return (
    <StrengthSection
      adeptId={adept.id}
      basePath={adeptHref(adept.id, "styrka")}
      editingId={typeof query.andra === "string" ? query.andra : null}
    />
  );
}
