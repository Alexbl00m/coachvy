import { WorkspaceSubnav } from "@/components/adepts/workspace-tabs";
import { loadWorkspace } from "@/lib/adepts/workspace";
import { adeptHref } from "@/lib/routes";

export default async function AdeptPlanLayout({
  params,
  children,
}: LayoutProps<"/app/adepter/[id]/plan">) {
  const { adept, isCoach, asAdept } = await loadWorkspace(params);
  if (asAdept) return children;
  return (
    <>
      <WorkspaceSubnav
        label="Plan"
        items={[
          { href: adeptHref(adept.id, "plan"), label: "Säsong" },
          // Planen ur planbiblioteket vecka för vecka: adepten själv har den
          // under Min plan.
          ...(isCoach
            ? [{ href: adeptHref(adept.id, "bibliotek"), label: "Veckoplan" }]
            : []),
          { href: adeptHref(adept.id, "pass"), label: "Egna pass" },
        ]}
      />
      {children}
    </>
  );
}
