"use client";

import { usePathname } from "next/navigation";

import { PageHeader } from "@/components/page-header";

/** Rubriken på adeptens egna sidor i arbetsytan, ur adressens sista del. */
const TITLES: [suffix: string, title: string, description?: string][] = [
  [
    "/tester/varden",
    "Enstaka värden",
    "Mätvärden som registrerats ett och ett.",
  ],
  ["/tester", "Tester", "Dina testtillfällen och vad de gav."],
  [
    "/maende",
    "Incheckning",
    "Hur passet kändes och hur du mår – så ser din coach hur träningen landar.",
  ],
  ["/meddelanden", "Meddelanden"],
  ["/profil", "Profil"],
  ["/plan/pass", "Pass", "Passen som byggts åt dig."],
];

/**
 * Adeptens egna sidor ligger i arbetsytan men ska se ut som resten av
 * adeptens app: en rubrik för sidan, inte coachens namnrad och flikar.
 */
export function OwnPageTitle() {
  const pathname = usePathname();
  const match = TITLES.find(([suffix]) => pathname.endsWith(suffix));
  if (!match) return null;
  return <PageHeader title={match[1]} description={match[2]} />;
}
