import { StrengthSection } from "@/components/strength/strength-section";
import { loadWorkspace } from "@/lib/adepts/workspace";
import { adeptHref } from "@/lib/routes";

export const metadata = { title: "Styrka" };

export default async function AdeptStrengthPage({
  params,
  searchParams,
}: PageProps<"/app/adepter/[id]/traning/styrka">) {
  const { adept } = await loadWorkspace(params);
  const query = await searchParams;
  return (
    <StrengthSection
      adeptId={adept.id}
      basePath={adeptHref(adept.id, "styrka")}
      editingId={typeof query.andra === "string" ? query.andra : null}
    />
  );
}
