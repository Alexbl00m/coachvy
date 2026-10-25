import { PageHeader } from "@/components/page-header";
import { LibraryView } from "@/components/session-library/library-view";
import { listAdepts } from "@/lib/adepts/queries";
import { isMember } from "@/lib/auth/membership";
import { requireSessionUser } from "@/lib/auth/session";
import { listLibrary } from "@/lib/session-library/queries";

export const metadata = { title: "Passbibliotek" };

/**
 * Coachens egna pass att återanvända: kvalitetsformaten ett block bygger
 * på, med syfte och progression. Hämtas till planmallar och till adepter i
 * passbyggaren, och delas med adepter, medlemmar eller coacher.
 *
 * En adept ser det som delats med hen: av sin coach och av Coachvy.
 */
export default async function SessionLibraryPage({
  searchParams,
}: PageProps<"/app/passbibliotek">) {
  const user = await requireSessionUser();
  const query = await searchParams;
  const initialQuery = typeof query.sok === "string" ? query.sok : "";
  const coach = user.profile?.role === "coach" || user.isAdmin;

  const [sessions, adepts] = await Promise.all([
    listLibrary(),
    user.profile?.role === "coach" ? listAdepts() : Promise.resolve([]),
  ]);

  if (!coach) {
    const self = user.adept
      ? {
          id: user.adept.id,
          full_name: user.adept.full_name,
          canSchedule: isMember(user),
        }
      : null;
    return (
      <>
        <PageHeader
          title="Passbibliotek"
          description="Pass från din coach och från Coachvy, med syfte, utförande och hur de byggs på."
        />
        <LibraryView
          sessions={sessions}
          adepts={[]}
          isAdmin={false}
          self={self ?? { id: "", full_name: "", canSchedule: false }}
          initialQuery={initialQuery}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Passbibliotek"
        description="Dina återkommande pass, med syfte och hur de byggs på. Lägg dem direkt i en adepts kalender, där zonerna räknas om mot adeptens egna värden, hämta dem till en planmall, eller dela dem."
      />
      <LibraryView
        sessions={sessions}
        adepts={adepts.map((a) => ({ id: a.id, full_name: a.full_name }))}
        isAdmin={user.isAdmin}
        initialQuery={initialQuery}
      />
    </>
  );
}
