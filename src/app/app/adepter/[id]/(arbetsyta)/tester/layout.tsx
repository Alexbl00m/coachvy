import { WorkspaceSubnav } from "@/components/adepts/workspace-tabs";
import { adeptHref } from "@/lib/routes";

export default async function AdeptTestsLayout({
  params,
  children,
}: LayoutProps<"/app/adepter/[id]/tester">) {
  const { id } = await params;
  return (
    <>
      <WorkspaceSubnav
        label="Tester"
        items={[
          { href: adeptHref(id, "tester"), label: "Testtillfällen" },
          { href: adeptHref(id, "progression"), label: "Progression" },
          { href: adeptHref(id, "varden"), label: "Enstaka värden" },
        ]}
      />
      {children}
    </>
  );
}
