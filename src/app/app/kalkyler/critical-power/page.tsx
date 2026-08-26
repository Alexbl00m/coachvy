import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CriticalPowerCalculator } from "@/components/calculators/critical-power-calculator";
import { PageHeader } from "@/components/page-header";
import { requireCoach } from "@/lib/auth/session";
import { routes } from "@/lib/routes";

export const metadata = { title: "Critical power" };

export default async function CriticalPowerPage() {
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
        title="Critical power"
        description="Arbetet växer linjärt med tiden: W = CP·t + W'. Lutningen är den effekt som teoretiskt kan hållas hur länge som helst, skärningen den ändliga kapaciteten över den."
      />

      <CriticalPowerCalculator />
    </>
  );
}
