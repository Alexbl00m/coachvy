import { redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { LibraryView } from "@/components/session-library/library-view";
import { listAdepts } from "@/lib/adepts/queries";
import { requireSessionUser } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { listLibrary } from "@/lib/session-library/queries";

export const metadata = { title: "Passbibliotek" };

/**
 * Coachens egna pass att återanvända: kvalitetsformaten ett block bygger
 * på, med syfte och progression. Hämtas till planmallar och till adepter i
 * passbyggaren.
 */
export default async function SessionLibraryPage() {
  const user = await requireSessionUser();
  const coach = user.profile?.role === "coach";
  if (!coach && !user.isAdmin) redirect(routes.dashboard);

  const [sessions, adepts] = await Promise.all([
    listLibrary(),
    coach ? listAdepts() : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        title="Passbibliotek"
        description="Dina återkommande pass, med syfte och hur de byggs på. Hämta dem till en planmall eller öppna dem för en adept i passbyggaren, där zonerna räknas om mot adeptens egna värden."
      />
      <LibraryView
        sessions={sessions}
        adepts={adepts.map((a) => ({ id: a.id, full_name: a.full_name }))}
        isAdmin={user.isAdmin}
      />
    </>
  );
}
