import { LayoutTemplate, Library, LibraryBig } from "lucide-react";

import { HubGrid } from "@/components/hub-grid";
import { PageHeader } from "@/components/page-header";
import { requireCoach } from "@/lib/auth/session";
import { routes } from "@/lib/routes";

export const metadata = { title: "Bibliotek" };

/** Det som återanvänds mellan adepter: pass, planer och mallar. */
export default async function LibraryPage() {
  const user = await requireCoach();
  return (
    <>
      <PageHeader
        title="Bibliotek"
        description="Pass och planer som återanvänds mellan adepterna."
      />
      <HubGrid
        items={[
          {
            href: routes.sessionLibrary,
            icon: LibraryBig,
            title: "Passbibliotek",
            description:
              "Färdiga pass i tre nivåer, med syfte, energisystem och när de passar i säsongen. Läggs in på en adept via passbyggaren.",
          },
          {
            href: routes.planLibrary,
            icon: Library,
            title: "Planbibliotek",
            description:
              "Hela planer mot ett lopp, som medlemmar startar själva och du kan följa och justera i adeptens arbetsyta.",
          },
          ...(user.isAdmin
            ? [
                {
                  href: routes.planTemplates,
                  icon: LayoutTemplate,
                  title: "Planmallar",
                  description:
                    "Mallarna planbiblioteket bygger på: veckor, nyckelpass, tempon och nivåer.",
                },
              ]
            : []),
        ]}
      />
    </>
  );
}
