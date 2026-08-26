import { Check } from "lucide-react";

import { Section, SectionHeading } from "@/components/public/section";
import { ButtonLink } from "@/components/ui/button";

const packages = [
  {
    title: "Individuell coaching",
    price: "2 000 kr",
    period: "/månad",
    description: "Komplett coaching med personlig uppföljning.",
    features: [
      "Personlig träningsplan",
      "Veckovis uppföljning",
      "Direktkontakt via telefon och mail",
      "Kostråd och återhämtning",
      "Tävlingsplanering",
    ],
    featured: true,
  },
  {
    title: "Träningsplan",
    price: "800 kr",
    period: "/månad",
    description: "Skräddarsydd träningsplan utan personlig coaching.",
    features: [
      "Personlig träningsplan",
      "Månadsvis uppdatering",
      "Mailsupport",
      "Grundläggande kostråd",
      "Träningsanalys",
    ],
    featured: false,
  },
];

export function Coaching() {
  return (
    <Section id="coaching">
      <SectionHeading
        eyebrow="Coaching"
        title="Varje person är unik,"
        accent="och tränar därefter"
        description="Min filosofi bygger på att varje person behöver en individuell approach. Genom personlig coaching hjälper jag dig nå dina mål på det mest effektiva sättet."
      />

      <div className="mx-auto mt-14 grid max-w-3xl gap-6 md:grid-cols-2">
        {packages.map((item) => (
          <div
            key={item.title}
            className={
              item.featured
                ? "rounded-2xl border-2 border-accent bg-surface p-7 shadow-sm"
                : "rounded-2xl border border-line bg-surface p-7"
            }
          >
            {item.featured && (
              <p className="mb-3 inline-block rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-accent">
                Populärast
              </p>
            )}
            <h3 className="text-xl font-bold text-text">{item.title}</h3>
            <p className="mt-3 text-3xl font-bold text-accent">
              {item.price}
              <span className="text-base font-normal text-text-muted">
                {item.period}
              </span>
            </p>
            <p className="mt-2 text-sm text-text-muted">{item.description}</p>

            <ul className="mt-6 space-y-2.5">
              {item.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2.5 text-sm text-text"
                >
                  <Check
                    aria-hidden
                    className="mt-0.5 size-4 shrink-0 text-accent"
                  />
                  {feature}
                </li>
              ))}
            </ul>

            <ButtonLink
              href="#kontakt"
              variant={item.featured ? "primary" : "secondary"}
              className="mt-7 w-full font-semibold"
            >
              Kontakta mig
            </ButtonLink>
          </div>
        ))}
      </div>
    </Section>
  );
}
