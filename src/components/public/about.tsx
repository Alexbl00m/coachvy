import Image from "next/image";
import { Award, Heart, Target } from "lucide-react";

import { Section, SectionHeading } from "@/components/public/section";
import { ButtonLink } from "@/components/ui/button";

const credentials = [
  {
    icon: Award,
    text: "Uthållighetsträningsspecialist och legitimerad personlig tränare",
  },
  {
    icon: Target,
    text: "Lång erfarenhet av träning för medel- och långdistanstriathlon",
  },
  {
    icon: Heart,
    text: "Starkt förknippad med konditionsidrotter, särskilt cykling och triathlon",
  },
];

export function About() {
  return (
    <Section id="om-mig">
      <SectionHeading
        eyebrow="Om mig"
        title="Kort om"
        accent="mig"
        description="Jag har alltid drömt om att hjälpa människor nå sina mål."
      />

      <div className="mt-14 grid items-center gap-8 md:grid-cols-2">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-surface-2">
          <Image
            src="/brand/alexander-running.jpg"
            alt="Alexander Lindblom under löppass"
            fill
            sizes="(min-width: 768px) 32rem, 100vw"
            className="object-cover"
          />
        </div>

        <div className="rounded-2xl border border-line bg-surface p-8">
          <h3 className="text-lg font-bold text-text">Min resa</h3>
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-text-muted">
            <p>
              Redan i ung ålder insåg jag att jag brann för att stödja och guida
              andra på deras väg mot framgång. Jag började som hockeytränare,
              och där fick jag utveckla inte bara unga spelares färdigheter utan
              även deras mentala och känslomässiga välbefinnande.
            </p>
            <p>
              Min starka kärlek till cykelsporten ledde mig till att dagligen
              fördjupa mig i träning och cykling. Det var början på min resa som
              coach. År 2022 utbildade jag mig till personlig tränare med
              inriktning på konditionsträning.
            </p>
          </div>
        </div>
      </div>

      <ul className="mt-8 grid gap-4 md:grid-cols-3">
        {credentials.map((item) => {
          const Icon = item.icon;
          return (
            <li
              key={item.text}
              className="flex items-start gap-3 rounded-xl border border-line bg-surface p-5 text-sm text-text"
            >
              <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-accent" />
              {item.text}
            </li>
          );
        })}
      </ul>

      <div className="mt-8 rounded-2xl bg-accent px-8 py-10 text-center">
        <h3 className="text-xl font-bold text-accent-on">Min filosofi</h3>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-accent-on/90">
          Coaching är inte bara träningsplanering — det handlar om att skapa en
          relation. Träningen är en del av det större pusslet i ditt liv, och
          allt ska samspela harmoniskt. Tillsammans navigerar vi genom hinder,
          sätter konkreta mål och utformar strategier för att nå framgång.
        </p>
        <ButtonLink
          href="#kontakt"
          variant="secondary"
          className="mt-7 border-transparent bg-canvas font-semibold text-accent hover:bg-canvas hover:text-accent-strong"
        >
          Låt oss börja din resa
        </ButtonLink>
      </div>
    </Section>
  );
}
