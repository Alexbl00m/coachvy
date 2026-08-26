import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Logo } from "@/components/logo";

export const metadata = { title: "Integritetspolicy & villkor" };

const sections = [
  "Personuppgiftsansvarig",
  "Vilka uppgifter vi behandlar",
  "Ändamål och rättslig grund",
  "Lagringstid",
  "Dina rättigheter",
  "Cookies",
  "Användarvillkor",
  "Kontakt",
];

export default function IntegritetspolicyPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-ink-800 px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Link href="/" className="rounded-md">
            <Logo />
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-ink-300 hover:text-ink-50"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Tillbaka
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
        <h1 className="text-3xl font-semibold tracking-tight text-ink-50">
          Integritetspolicy & villkor
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-300">
          Den här sidan är en platshållare. Det juridiska innehållet skrivs i en
          senare fas – rubrikerna nedan visar vilken struktur sidan är tänkt att
          få.
        </p>

        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section}>
              <h2 className="text-base font-semibold text-ink-100">
                {section}
              </h2>
              <p className="mt-1.5 text-sm text-ink-500">Innehåll kommer.</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
