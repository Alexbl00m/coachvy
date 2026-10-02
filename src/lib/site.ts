/** Business details for the public site. One place to change them. */
export const site = {
  name: "Lindblom Coaching",
  tagline: "Individuell träning för triathlon, cykling och löpning",
  email: "alexander@lindblomcoaching.com",
  phone: "+46703330511",
  phoneLabel: "070-333 05 11",
  location: "Norrköping",
  instagram: "https://instagram.com/lindblomcoaching",
  website: "lindblomcoaching.com",

  /**
   * Bilden under Om mig. Byt bild genom att lägga en ny fil i public/brand och
   * ändra src, alt och måtten här – eller sätt `null`, så visas sektionen
   * utan bild.
   */
  aboutImage: {
    src: "/brand/alexander-portrait.jpg",
    alt: "Alexander Lindblom springer mot mål i Ironman Kalmar",
    width: 1200,
    height: 1680,
  } as { src: string; alt: string; width: number; height: number } | null,
} as const;

/**
 * Adresserna är absoluta, inte bara ankare. Headern visas även på
 * verktygssidorna, och där skulle "#kontakt" peka på ett ankare som inte
 * finns på just den sidan i stället för på startsidans kontaktsektion.
 */
export const sections = [
  { href: "/#coaching", label: "Coaching" },
  { href: "/#testning", label: "Testning" },
  { href: "/verktyg", label: "Verktyg" },
  { href: "/#om-mig", label: "Om mig" },
  { href: "/#kontakt", label: "Kontakt" },
] as const;
