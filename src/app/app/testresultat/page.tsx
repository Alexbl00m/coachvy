import { redirect } from "next/navigation";

import { getMyAdeptRow } from "@/lib/adepts/queries";
import { requireSessionUser } from "@/lib/auth/session";
import { EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/ui/button";
import { routes } from "@/lib/routes";

export const metadata = { title: "Testresultat" };

/**
 * Test results live on an adept, so this entry point routes to the right one:
 * an adept goes straight to their own test tab, a coach picks from the roster.
 */
export default async function TestresultatPage() {
  const user = await requireSessionUser();

  if (user.profile?.role === "adept") {
    const adept = await getMyAdeptRow(user.id);
    if (adept) redirect(`${routes.adepts}/${adept.id}?vy=testresultat`);
  }

  if (user.profile?.role === "coach") {
    redirect(routes.adepts);
  }

  return (
    <>
      <PageHeader
        title="Testresultat"
        description="Tester, mätvärden och underlag för tröskelbestämning."
      />
      <EmptyState
        title="Ingen adeptprofil hittades"
        description="Ditt konto är inte kopplat till någon adeptrad ännu. Be din coach lägga upp dig."
        action={<ButtonLink href={routes.dashboard}>Till översikten</ButtonLink>}
      />
    </>
  );
}
