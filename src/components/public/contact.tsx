import { ContactForm } from "@/components/public/contact-form";
import { Section, SectionHeading } from "@/components/public/section";
import { site } from "@/lib/site";

const steps = [
  "Du skickar ett meddelande eller ringer.",
  "Vi bokar ett kostnadsfritt samtal.",
  "Vi går igenom dina mål och behov.",
  "Du får ett upplägg som passar dig.",
];

export function Contact() {
  return (
    <Section id="kontakt">
      <SectionHeading
        label="Kontakt"
        title="Låt oss prata."
        continuation="Det första samtalet kostar ingenting."
        description="Är du redo att ta nästa steg? Berätta var du står och vart du vill, så pratar vi om hur vi tar oss dit."
      />

      <div className="mt-14 grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
        <div>
          <dl className="max-w-md border-t border-line text-[15px]">
            {[
              ["E-post", site.email, `mailto:${site.email}`],
              ["Telefon", site.phoneLabel, `tel:${site.phone}`],
              ["Plats", site.location, null],
            ].map(([label, value, href]) => (
              <div
                key={label}
                className="flex items-baseline justify-between gap-6 border-b border-line py-3.5"
              >
                <dt className="text-text-subtle">{label}</dt>
                <dd className="min-w-0 truncate">
                  {href ? (
                    <a
                      href={href}
                      className="text-text transition-colors hover:text-accent-text"
                    >
                      {value}
                    </a>
                  ) : (
                    <span className="text-text">{value}</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>

          <h3 className="mt-12 text-[15px] font-semibold text-text">
            Så går det till
          </h3>
          <ol className="mt-4 space-y-3">
            {steps.map((step, index) => (
              <li
                key={step}
                className="flex items-baseline gap-4 text-[15px] text-text-muted"
              >
                <span className="font-mono text-[12px] text-text-subtle">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <div className="lift self-start rounded-xl border border-line-strong bg-surface p-6 sm:p-8">
          <h3 className="mb-6 text-[15px] font-semibold text-text">
            Skicka ett meddelande
          </h3>
          <ContactForm />
        </div>
      </div>
    </Section>
  );
}
