import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { BikePowerCalculator } from "@/components/calculators/bike-power-calculator";
import { PageHeader } from "@/components/page-header";
import { requireCoach } from "@/lib/auth/session";
import { routes } from "@/lib/routes";

export const metadata = { title: "Effekt och fart" };

export default async function CykeleffektPage() {
  await requireCoach();

  return (
    <>
      <Link
        href={routes.calculators}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-subtle hover:text-text"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Kalkyler
      </Link>

      <PageHeader
        title="Effekt och fart"
        description="Vid konstant fart går all effekt åt till rullmotstånd, stigning och luft. Ange två av effekt, fart och tid – modellen räknar fram den tredje."
      />

      <BikePowerCalculator />
    </>
  );
}
