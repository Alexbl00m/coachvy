import Link from "next/link";
import { ArrowRight, Bike, Gauge, Timer } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import { site } from "@/lib/site";

export const metadata = {
  title: "Verktyg",
  description:
    "Fria räknare för löpning och cykel: loppprognos, träningszoner och effekt mot fart. Samma modeller som används i coachingen.",
};

const tools = [
  {
    href: "/verktyg/loppprognos",
    icon: Timer,
    title: "Loppprognos",
    description:
      "Vad ditt 10 km-lopp säger om halvmaraton. Med två lopp räknas din egen utmattningsexponent fram, inte en schablon.",
    inputs: "Distans och tid",
  },
  {
    href: "/verktyg/traningszoner",
    icon: Gauge,
    title: "Träningszoner",
    description:
      "Zoner ur FTP, tröskeltempo eller critical speed. Tre olika modeller, för de utgår från olika slags test.",
    inputs: "Ett tröskelvärde",
  },
  {
    href: "/verktyg/cykeleffekt",
    icon: Bike,
    title: "Effekt och fart",
    description:
      "Vad en sträcka kostar i watt, och vad aero, vikt och däck är värda i tid. Hela effektbalansen på cykel.",
    inputs: "Vikt, sträcka, väder och position",
  },
];

export default function ToolsPage() {
  return (
    <>
      <p className="text-[13px] font-medium uppercase tracking-[0.12em] text-accent">
        Fria verktyg
      </p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-text sm:text-5xl">
        Räkna på din träning
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-text-muted">
        Samma modeller som jag använder med mina adepter, fria att använda.
        Ingen inloggning, inget konto – skriv in dina siffror och se vad de
        säger.
      </p>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.href}
              href={tool.href}
              className="group rounded-lg border border-line bg-surface p-6 transition-colors hover:border-accent"
            >
              <Icon aria-hidden className="size-6 text-accent" />
              <h2 className="mt-4 flex items-center gap-2 text-lg font-semibold text-text">
                {tool.title}
                <ArrowRight
                  aria-hidden
                  className="size-4 text-text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                />
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">
                {tool.description}
              </p>
              <p className="mt-4 text-[12px] uppercase tracking-[0.1em] text-text-subtle">
                In: {tool.inputs}
              </p>
            </Link>
          );
        })}
      </div>

      <div className="mt-14 rounded-lg border border-line bg-surface-2 p-8 sm:p-10">
        <h2 className="text-xl font-semibold text-text">
          Siffrorna är en början, inte ett svar
        </h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-text-muted">
          En prognos säger vad du klarar om allt stämmer. Vad du ska träna för
          att flytta den är en annan fråga – och den är svår att svara på
          själv. Vill du att vi tittar på dina siffror tillsammans?
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href={routes.contact}>Hör av dig</ButtonLink>
          <ButtonLink href={routes.testing} variant="secondary">
            Läs om testning
          </ButtonLink>
        </div>
        <p className="mt-6 text-[12px] text-text-subtle">
          {site.name} · {site.location}
        </p>
      </div>
    </>
  );
}
