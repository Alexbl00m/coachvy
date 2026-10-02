import { FlaskConical, Handshake, Puzzle, User } from "lucide-react";

import { Section } from "@/components/public/section";

const principles = [
  {
    icon: User,
    title: "Utgår från dig",
    text: "Varje person är unik och tränar därefter. Planen bygger på din nuvarande status, dina behov och dina mål – inte på en mall.",
  },
  {
    icon: FlaskConical,
    title: "Mätt, inte gissat",
    text: "Laktattester ger zoner som bygger på hur just din kropp svarar. Nästa test visar om träningen gjorde det den skulle.",
  },
  {
    icon: Puzzle,
    title: "En del av livet",
    text: "Träningen är en bit i ett större pussel. Jobb, familj, sömn och återhämtning ska gå ihop, och planen ändras när livet gör det.",
  },
  {
    icon: Handshake,
    title: "En relation",
    text: "Coaching är mer än ett schema. Vi pratar, justerar och tar oss förbi hindren tillsammans – hela vägen till start.",
  },
];

/** Hållningen bakom coachingen, i samma ord som Lindblom Coaching alltid använt. */
export function Approach() {
  return (
    <Section>
      <p className="max-w-4xl text-[24px] leading-[1.3] font-medium tracking-[-0.018em] text-balance text-text-muted sm:text-[32px]">
        <span className="text-text">
          Jag har alltid drömt om att hjälpa människor nå sina mål.
        </span>{" "}
        Därför börjar coachingen med dig och ditt liv – inte med ett färdigt
        program. Sedan mäter vi, planerar och följer upp, tillsammans.
      </p>

      <ul className="mt-16 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {principles.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.title} className="bg-canvas p-6 sm:p-7">
              <Icon aria-hidden className="size-5 text-text-muted" />
              <h3 className="mt-6 text-[15px] font-semibold text-text">
                {item.title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-text-muted">
                {item.text}
              </p>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
