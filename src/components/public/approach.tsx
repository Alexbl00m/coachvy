import { FlaskConical, Handshake, Puzzle, User } from "lucide-react";

import { Section } from "@/components/public/section";

const principles = [
  {
    icon: User,
    title: "Utgår från dig",
    text: "Planen bygger på hur du tränar i dag och vad du vill nå. Ingen mall, ingen färdig plan som någon annan också får.",
  },
  {
    icon: FlaskConical,
    title: "Mätt, inte gissat",
    text: "Laktattestet ger zoner ur hur din kropp svarar. Nästa test visar om träningen gjorde det den skulle.",
  },
  {
    icon: Puzzle,
    title: "En del av livet",
    text: "Träningen är en bit i ett större pussel. Jobb, familj och sömn finns med när planen läggs, och ändras livet ändras planen.",
  },
  {
    icon: Handshake,
    title: "En relation",
    text: "Coaching är mer än ett schema. Vi pratar, justerar planen och löser det som står i vägen, ända fram till start.",
  },
];

/** Hållningen bakom coachingen, i samma ord som Lindblom Coaching alltid använt. */
export function Approach() {
  return (
    <Section>
      <p className="max-w-4xl text-[1.5rem] leading-[1.3] font-medium tracking-[-0.018em] text-balance text-text-muted sm:text-[2rem]">
        <span className="text-text">
          Jag har alltid drömt om att hjälpa människor nå sina mål.
        </span>{" "}
        Därför börjar coachingen med dig och ditt liv, inte med ett färdigt
        program. Sedan testar vi, planerar och följer upp.
      </p>

      <ul className="mt-16 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {principles.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.title} className="bg-canvas p-6 sm:p-7">
              <Icon aria-hidden className="size-5 text-text-muted" />
              <h3 className="mt-6 text-[0.9375rem] font-semibold text-text">
                {item.title}
              </h3>
              <p className="mt-2 text-[0.875rem] leading-relaxed text-text-muted">
                {item.text}
              </p>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
