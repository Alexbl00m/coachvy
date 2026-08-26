import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CriticalSpeedCalculator } from "@/components/calculators/critical-speed-calculator";
import { PageHeader } from "@/components/page-header";
import { requireCoach } from "@/lib/auth/session";
import { routes } from "@/lib/routes";

export const metadata = { title: "Critical speed" };

export default async function CriticalSpeedPage() {
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
        title="Critical speed"
        description="Samma modell som critical power, fast i distans och tid: D = CS·t + D'. Fungerar för löpning och simning."
      />

      <CriticalSpeedCalculator />
    </>
  );
}
