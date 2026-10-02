import { Check } from "lucide-react";

import { Section, SectionHeading } from "@/components/public/section";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const packages = [
  {
    title: "Individuell coaching",
    price: "2 000 kr",
    description: "Komplett coaching med personlig uppföljning.",
    features: [
      "Personlig träningsplan",
      "Veckovis uppföljning",
      "Direktkontakt via telefon och mejl",
      "Kostråd och återhämtning",
      "Tävlingsplanering",
    ],
    primary: true,
  },
  {
    title: "Träningsplan",
    price: "800 kr",
    description: "Skräddarsydd träningsplan utan personlig coaching.",
    features: [
      "Personlig träningsplan",
      "Månadsvis uppdatering",
      "Mejlsupport",
      "Grundläggande kostråd",
      "Träningsanalys",
    ],
    primary: false,
  },
];

export function Coaching() {
  return (
    <Section id="coaching">
      <SectionHeading
        label="Coaching"
        title="Varje person är unik."
        continuation="Och tränar därefter."
        description="Två upplägg, samma utgångspunkt: en plan som är din. Vill du ha någon som följer upp varje vecka, eller en plan att köra själv?"
      />

      <div className="mt-14 grid gap-4 md:grid-cols-2">
        {packages.map((item) => (
          <div
            key={item.title}
            className={cn(
              "flex flex-col rounded-xl border p-7 sm:p-8",
              item.primary
                ? "lift border-line-strong bg-surface"
                : "border-line bg-canvas",
            )}
          >
            <h3 className="text-[15px] font-semibold text-text">
              {item.title}
            </h3>
            <p className="mt-1 text-[14px] text-text-muted">
              {item.description}
            </p>
            <p className="mt-6 text-[36px] leading-none font-semibold tracking-[-0.03em] text-text tabular-nums">
              {item.price}
              <span className="ml-1.5 text-[14px] font-normal tracking-normal text-text-subtle">
                per månad
              </span>
            </p>

            <ul className="mt-7 space-y-3 border-t border-line pt-7">
              {item.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-3 text-[14px] text-text-muted"
                >
                  <Check
                    aria-hidden
                    className="mt-0.5 size-4 shrink-0 text-text-subtle"
                  />
                  {feature}
                </li>
              ))}
            </ul>

            <ButtonLink
              href="#kontakt"
              variant={item.primary ? "primary" : "secondary"}
              className="mt-8 w-full"
            >
              {item.primary
                ? "Boka ett samtal om coaching"
                : "Fråga om en plan"}
            </ButtonLink>
          </div>
        ))}
      </div>
    </Section>
  );
}
