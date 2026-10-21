import { WorkspaceSubnav } from "@/components/adepts/workspace-tabs";
import { adeptHref } from "@/lib/routes";

export default async function AdeptTrainingLayout({
  params,
  children,
}: LayoutProps<"/app/adepter/[id]/traning">) {
  const { id } = await params;
  return (
    <>
      <WorkspaceSubnav
        label="Träning"
        items={[
          { href: adeptHref(id, "traning"), label: "Lopp och aktiviteter" },
          { href: adeptHref(id, "styrka"), label: "Styrka" },
        ]}
      />
      {children}
    </>
  );
}
