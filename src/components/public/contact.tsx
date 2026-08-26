import { Mail, MapPin, Phone } from "lucide-react";

import { ContactForm } from "@/components/public/contact-form";
import { Section, SectionHeading } from "@/components/public/section";
import { site } from "@/lib/site";

const steps = [
  "Du skickar ett meddelande eller ringer",
  "Vi bokar in ett kostnadsfritt samtal",
  "Vi går igenom dina mål och behov",
  "Du får ett upplägg som passar dig",
];

export function Contact() {
  return (
    <Section id="kontakt" tone="sand">
      <SectionHeading
        eyebrow="Kontakt"
        title="Kontakta"
        accent="mig"
        description="Hör av dig för ett kostnadsfritt samtal om mina tjänster och upplägg."
      />

      <div className="mt-14 grid gap-10 lg:grid-cols-2">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold text-text">Låt oss prata</h3>
            <p className="mt-3 text-sm leading-relaxed text-text-muted">
              Är du redo att ta nästa steg i din träningsresa? Jag erbjuder
              alltid ett kostnadsfritt första samtal där vi kan diskutera dina
              mål och hur jag kan hjälpa dig nå dit.
            </p>
          </div>

          <ul className="space-y-3">
            <li>
              <a
                href={`mailto:${site.email}`}
                className="flex items-center gap-4 rounded-xl border border-line bg-surface p-5 transition-colors hover:border-accent"
              >
                <Mail aria-hidden className="size-5 shrink-0 text-accent" />
                <span>
                  <span className="block text-[13px] text-text-muted">
                    E-post
                  </span>
                  <span className="block text-sm font-medium text-text">
                    {site.email}
                  </span>
                </span>
              </a>
            </li>
            <li>
              <a
                href={`tel:${site.phone}`}
                className="flex items-center gap-4 rounded-xl border border-line bg-surface p-5 transition-colors hover:border-accent"
              >
                <Phone aria-hidden className="size-5 shrink-0 text-accent" />
                <span>
                  <span className="block text-[13px] text-text-muted">
                    Telefon
                  </span>
                  <span className="block text-sm font-medium text-text">
                    {site.phoneLabel}
                  </span>
                </span>
              </a>
            </li>
            <li className="flex items-center gap-4 rounded-xl border border-line bg-surface p-5">
              <MapPin aria-hidden className="size-5 shrink-0 text-accent" />
              <span>
                <span className="block text-[13px] text-text-muted">Plats</span>
                <span className="block text-sm font-medium text-text">
                  {site.location}
                </span>
              </span>
            </li>
          </ul>

          <div className="rounded-xl bg-accent-soft p-6">
            <h4 className="text-sm font-semibold text-text">
              Vad händer härnäst?
            </h4>
            <ol className="mt-3 space-y-2">
              {steps.map((step, index) => (
                <li
                  key={step}
                  className="flex items-start gap-2.5 text-[13px] text-text-muted"
                >
                  <span className="font-semibold text-accent">{index + 1}.</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-7">
          <h3 className="mb-5 text-lg font-bold text-text">Skicka ett meddelande</h3>
          <ContactForm />
        </div>
      </div>
    </Section>
  );
}
