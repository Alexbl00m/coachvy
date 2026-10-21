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
          { href: adeptHref(adept.id, "pass"), label: "Pass" },
          // Planen ur planbiblioteket: adepten själv har den under Min plan.
          ...(isCoach
            ? [
                {
                  href: adeptHref(adept.id, "bibliotek"),
                  label: "Planbiblioteket",
                },
              ]
            : []),
        ]}
      />
      {children}
    </>
  );
}
