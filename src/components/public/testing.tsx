import { Section, SectionHeading } from "@/components/public/section";
import { ButtonLink } from "@/components/ui/button";

const tests = [
  {
    title: "Laktattest – cykel",
    duration: "ca 1,5–2 h",
    price: "1 500 kr",
    description:
      "Laktatnivåerna i blodet ger dina tränings- och tävlingszoner, så att du får ut det mesta av cykelträningen.",
    features: [
      "Aerob tröskel (LT1)",
      "Anaerob tröskel (LT2/MLSS)",
      "Effektzoner 1–5",
      "Pulszoner 1–5",
      "Uppskattad VO2max",
      "Träningsråd utifrån resultaten",
    ],
  },
  {
    title: "Laktattest – löpning",
    duration: "ca 1,5–2 h",
    price: "1 500 kr",
    description:
      "Samma underlag för löpningen: zoner som ser till att träningen ligger där den gör mest nytta.",
    features: [
      "Aerob tröskel (LT1)",
      "Anaerob tröskel (LT2/MLSS)",
      "Fartzoner 1–5",
      "Pulszoner 1–5",
      "Uppskattad VO2max",
      "Träningsråd utifrån resultaten",
    ],
  },
  {
    title: "VLamax – anaerob kapacitet",
    duration: "ca 1 h",
    price: "1 500 kr",
    description:
      "Hur snabbt du kan bilda laktat. För långa distanser vill man ha ett lågt VLamax, för korta attacker ett högre.",
    features: [
      "Maximal anaerob kapacitet",
      "Laktathantering efter maxsprint",
      "Träningsråd utifrån resultaten och dina mål",
    ],
  },
];

export function Testing() {
  return (
    <Section id="testning">
      <SectionHeading
        label="Testning"
        title="Träna på dina egna siffror."
        continuation="Inte på en tabell."
        description="Konditionstester i Norrköping som skräddarsyr träningen och visar utvecklingen över tid. Resultaten hamnar i din egen vy i Coachvy, så att du kan följa kurvan test för test."
      />

      <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3">
        {tests.map((test) => (
          <article key={test.title} className="flex flex-col bg-canvas p-7">
            <h3 className="text-[15px] font-semibold text-text">
              {test.title}
            </h3>
            <p className="mt-1.5 font-mono text-[12px] text-text-subtle">
              {test.price} · {test.duration}
            </p>
            <p className="mt-4 text-[14px] leading-relaxed text-text-muted">
              {test.description}
            </p>
            <p className="mt-6 text-[12px] font-medium text-text-subtle">
              Du får
            </p>
            <ul className="mt-2 space-y-1.5">
              {test.features.map((feature) => (
                <li key={feature} className="text-[14px] text-text">
                  {feature}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <ButtonLink href="#kontakt">Boka ett test</ButtonLink>
        <p className="text-[14px] text-text-subtle">
          Varje test avslutas med träningsråd utifrån resultaten.
        </p>
      </div>
    </Section>
  );
}
