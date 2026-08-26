import { Activity, Bike, Check, Clock, Target } from "lucide-react";

import { Section, SectionHeading } from "@/components/public/section";
import { ButtonLink } from "@/components/ui/button";

const tests = [
  {
    icon: Bike,
    title: "Laktattest – cykel",
    duration: "ca 1,5–2 h",
    price: "1 500 kr",
    description:
      "Genom att mäta laktatnivåer i blodet får vi fram dina optimala tränings- och tävlingsintensitetszoner, så att du får ut det mesta av din cykelträning.",
    features: [
      "Aerob tröskel (LT1)",
      "Anaerob tröskel (LT2/MLSS)",
      "Kraftbaserade intensitetszoner 1–5",
      "Pulsbaserade intensitetszoner 1–5",
      "Uppskattad VO2max",
      "Träningsråd utifrån resultaten",
    ],
  },
  {
    icon: Activity,
    title: "Laktattest – löpning",
    duration: "ca 1,5–2 h",
    price: "1 500 kr",
    description:
      "Samma underlag för löpningen: blodlaktatnivåerna ger dina zoner och säkerställer att träningen ligger där den gör mest nytta.",
    features: [
      "Aerob tröskel (LT1)",
      "Anaerob tröskel (LT2/MLSS)",
      "Hastighetsbaserade intensitetszoner 1–5",
      "Pulsbaserade intensitetszoner 1–5",
      "Uppskattad VO2max",
      "Träningsråd utifrån resultaten",
    ],
  },
  {
    icon: Target,
    title: "VLamax – anaerob kapacitet",
    duration: "ca 1 h",
    price: "1 500 kr",
    description:
      "VLamax är den maximala laktatproduktionstakten. För långa distanser är ett lågt VLamax önskvärt, medan korta attacker kräver ett högre.",
    features: [
      "Maximal anaerob kapacitet",
      "Laktathantering efter maxsprint",
      "Träningsråd utifrån resultaten och dina mål",
    ],
  },
];

export function Testing() {
  return (
    <Section id="testning" tone="sand">
      <SectionHeading
        eyebrow="Testning"
        title="Optimera träningen med"
        accent="gedigen testning"
        description="Konditionstester som skräddarsyr din träning och följer din utveckling över tid. Resultaten hamnar i din egen vy i Coachvy, så att kurvan går att följa test för test."
      />

      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {tests.map((test) => {
          const Icon = test.icon;
          return (
            <div
              key={test.title}
              className="flex flex-col rounded-2xl border border-line bg-surface p-7"
            >
              <Icon aria-hidden className="size-7 text-accent" />
              <h3 className="mt-5 text-lg font-bold text-text">{test.title}</h3>

              <div className="mt-2 flex items-center gap-4 text-sm">
                <span className="font-semibold text-accent">{test.price}</span>
                <span className="flex items-center gap-1.5 text-text-muted">
                  <Clock aria-hidden className="size-3.5" />
                  {test.duration}
                </span>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-text-muted">
                {test.description}
              </p>

              <ul className="mt-5 space-y-2">
                {test.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2.5 text-[13px] text-text"
                  >
                    <Check
                      aria-hidden
                      className="mt-0.5 size-3.5 shrink-0 text-accent"
                    />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="mt-10 text-center">
        <ButtonLink href="#kontakt" className="font-semibold">
          Boka ett test
        </ButtonLink>
      </div>
    </Section>
  );
}
