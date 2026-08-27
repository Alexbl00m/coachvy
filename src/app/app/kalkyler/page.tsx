import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Bike,
  Droplet,
  Gauge,
  LineChart,
  Waves,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { requireCoach } from "@/lib/auth/session";
import { routes } from "@/lib/routes";

export const metadata = { title: "Kalkyler" };

const calculators = [
  {
    href: routes.lactateThresholds,
    icon: Droplet,
    title: "Laktattrösklar",
    description:
      "LT1 och LT2 ur ett stegtest med sjutton etablerade metoder – Log-log, OBLA, Bsln+, Dmax, LTP och LTratio – plus zonerna de ger.",
    inputs: "Belastning, laktat och puls per steg",
  },
  {
    href: routes.bikePower,
    icon: Bike,
    title: "Effekt och fart",
    description:
      "Effektbalansen på cykel: rullmotstånd, stigning och luft. Räknar fram effekt, fart eller måltid – och vad aero, vikt och däck är värda i tid.",
    inputs: "Vikt, sträcka, väder och position",
  },
  {
    href: routes.criticalPower,
    icon: Gauge,
    title: "Critical power",
    description:
      "CP och W' från två eller fler maxtester på cykel, med träningszoner, intervallzoner och tid till utmattning.",
    inputs: "Testlängd och medeleffekt",
  },
  {
    href: routes.criticalSpeed,
    icon: Activity,
    title: "Critical speed",
    description:
      "CS och D' från tidtagna distanser, med tempozoner och loppprognoser. Fungerar för både löpning och simning.",
    inputs: "Tid och distans",
  },
  {
    href: routes.metabolicProfile,
    icon: LineChart,
    title: "Metabol profil",
    description:
      "Laktatproduktion mot laktatförbränning enligt Mader-modellen. Ger anaerob tröskel, FatMax och substratomsättning.",
    inputs: "VO2max, VLamax och effekt vid VO2max",
  },
  {
    href: routes.vlamax,
    icon: Waves,
    title: "VLamax",
    description:
      "Skattar VLamax från ett sprinttest, tränad på atleter där värdet mätts med INSCYD.",
    inputs: "Kroppssammansättning och sprinteffekt",
  },
];

export default async function KalkylerPage() {
  await requireCoach();

  return (
    <>
      <PageHeader
        title="Kalkyler"
        description="Räkna fram trösklar, zoner och prognoser från testdata. Resultaten kan sparas på en adept."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {calculators.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-lg border border-line bg-surface p-6 transition-colors hover:border-accent"
            >
              <Icon aria-hidden className="size-6 text-accent" />
              <h2 className="mt-4 flex items-center gap-2 text-lg font-semibold text-text">
                {item.title}
                <ArrowRight
                  aria-hidden
                  className="size-4 text-text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                />
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">
                {item.description}
              </p>
              <p className="mt-4 text-[12px] uppercase tracking-[0.1em] text-text-subtle">
                In: {item.inputs}
              </p>
            </Link>
          );
        })}
      </div>
    </>
  );
}
