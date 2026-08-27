import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { LactateCalculator } from "@/components/calculators/lactate-calculator";
import { PageHeader } from "@/components/page-header";
import { requireCoach } from "@/lib/auth/session";
import { routes } from "@/lib/routes";

export const metadata = { title: "Laktattrösklar" };

export default async function LaktattrosklarPage() {
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
        title="Laktattrösklar"
        description="Sjutton etablerade metoder på samma stegtest. Ett test ger inte ett tröskelvärde utan ett spann – här ser du hela det spannet, och medianen för LT1 och LT2."
      />

      <LactateCalculator />
    </>
  );
}
