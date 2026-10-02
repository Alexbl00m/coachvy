import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { tools } from "@/components/public/tools";
import { ButtonLink } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import { site } from "@/lib/site";

export const metadata = {
  title: "Verktyg",
  description:
    "Fria räknare för löpning och cykel: loppprognos, träningszoner och effekt mot fart. Samma modeller som används i coachingen.",
};


export default function ToolsPage() {
  return (
    <>
      <p className="font-mono text-[12px] text-text-subtle">Fria verktyg</p>
      <h1 className="mt-5 max-w-3xl text-[40px] leading-[1.05] font-semibold tracking-[-0.035em] text-balance text-text sm:text-[56px]">
        Räkna på din träning
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-text-muted">
        Samma modeller som jag använder med mina adepter, fria att använda.
        Ingen inloggning, inget konto – skriv in dina siffror och se vad de
        säger.
      </p>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.href}
              href={tool.href}
              className="group rounded-xl border border-line bg-surface p-6 transition-colors duration-120 hover:border-line-strong hover:bg-surface-2"
            >
              <Icon aria-hidden className="size-5 text-text-muted" />
              <h2 className="mt-4 flex items-center gap-2 text-lg font-semibold text-text">
                {tool.title}
                <ArrowRight
                  aria-hidden
                  className="size-4 text-text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-text"
                />
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">
                {tool.description}
              </p>
              <p className="mt-4 font-mono text-[12px] text-text-subtle">
                In: {tool.inputs}
              </p>
            </Link>
          );
        })}
      </div>

      <div className="mt-14 rounded-xl border border-line bg-surface p-8 sm:p-10">
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
