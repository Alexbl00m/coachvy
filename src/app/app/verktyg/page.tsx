import { Bot, ChartBarBig, Dumbbell, Gauge } from "lucide-react";

import { HubGrid } from "@/components/hub-grid";
import { PageHeader } from "@/components/page-header";
import { requireCoach } from "@/lib/auth/session";
import { routes } from "@/lib/routes";

export const metadata = { title: "Verktyg" };

/** Verktygen coachen arbetar med, oavsett adept. */
export default async function ToolsPage() {
  await requireCoach();
  return (
    <>
      <PageHeader
        title="Verktyg"
        description="Bygg pass, planera mot ett lopp, räkna på testdata och resonera med AI-coachen."
      />
      <HubGrid
        items={[
          {
            href: routes.workoutBuilder,
            icon: Dumbbell,
            title: "Passbyggare",
            description:
              "Bygg ett pass åt en adept ur zonerna, med AI eller för hand, och exportera till klockan.",
          },
          {
            href: routes.runningPlanner,
            icon: ChartBarBig,
            title: "Löpplanerare",
            description:
              "Vägen till ett lopp vecka för vecka: volym, långpass och tempon ur formen och måltiden.",
          },
          {
            href: routes.calculators,
            icon: Gauge,
            title: "Kalkyler",
            description:
              "Trösklar, critical power och speed, metabol profil, VLamax och effekt på cykel.",
          },
          {
            href: routes.aiCoach,
            icon: Bot,
            title: "AI-coach",
            description:
              "Resonera om en adept med hela underlaget – tester, säsong och träning – utifrån din filosofi.",
          },
        ]}
      />
    </>
  );
}
