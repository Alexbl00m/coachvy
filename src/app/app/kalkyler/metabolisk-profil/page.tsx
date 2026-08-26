import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { MetabolicCalculator } from "@/components/calculators/metabolic-calculator";
import { PageHeader } from "@/components/page-header";
import { requireCoach } from "@/lib/auth/session";
import { routes } from "@/lib/routes";

export const metadata = { title: "Metabol profil" };

export default async function MetaboliskProfilPage() {
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
        title="Metabol profil"
        description="Laktatproduktion mot laktatförbränning enligt Mader-modellen. Ger anaerob tröskel, FatMax och substratomsättning från VO2max och VLamax."
      />

      <MetabolicCalculator />
    </>
  );
}
