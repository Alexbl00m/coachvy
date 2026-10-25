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
              "Pass i tre nivåer, med syfte, energisystem och när de passar i säsongen. Läggs in på en adept direkt eller via passbyggaren, och delas med adepter, medlemmar eller andra coacher.",
          },
          {
            href: routes.planLibrary,
            icon: Library,
            title: "Planbibliotek",
            description:
              "Hela planer mot ett lopp. Adepterna startar dem själva, och du följer och justerar dem i adeptens arbetsyta.",
          },
          {
            href: routes.planTemplates,
            icon: LayoutTemplate,
            title: "Planmallar",
            description:
              user.isAdmin || user.coach?.plan === "medlem"
                ? "Dina egna planer: veckor, nyckelpass, tempon och nivåer. Du väljer vem som ser dem."
                : "Bygg egna planer och dela dem med dina adepter. Ingår i medlemskapet för coacher.",
          },
        ]}
      />
    </>
  );
}
