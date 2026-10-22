import { WorkspaceSubnav } from "@/components/adepts/workspace-tabs";
import { loadWorkspace } from "@/lib/adepts/workspace";
import { adeptHref } from "@/lib/routes";

export default async function AdeptTestsLayout({
  params,
  children,
}: LayoutProps<"/app/adepter/[id]/tester">) {
  const { adept, asAdept } = await loadWorkspace(params);
  const id = adept.id;
  // Adeptens egen app har undersidorna i sin egen meny.
  if (asAdept) return children;
  return (
    <>
      <WorkspaceSubnav
        label="Tester"
        items={[
          { href: adeptHref(id, "tester"), label: "Testtillfällen" },
          { href: adeptHref(id, "progression"), label: "Progression" },
          { href: adeptHref(id, "varden"), label: "Enstaka värden" },
          { href: adeptHref(id, "bikefit"), label: "Bikefit" },
        ]}
      />
      {children}
    </>
  );
}
