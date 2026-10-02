import { Bike, FlaskConical, Gauge, Timer } from "lucide-react";

/** De fria verktygen: på verktygssidan och som en rad på startsidan. */
export const tools = [
  {
    href: "/verktyg/testberakning",
    icon: FlaskConical,
    title: "Testberäkning",
    description:
      "Elva protokoll för cykel, löpning och simning: CP och W′, FTP, critical speed och laktattrösklar. Ta med dig resultatet som PDF.",
    inputs: "Ditt testresultat",
  },
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
