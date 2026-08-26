/** Business details for the public site. One place to change them. */
export const site = {
  name: "Lindblom Coaching",
  tagline: "Individuell träning för triathlon, cykling och löpning",
  email: "alexander@lindblomcoaching.com",
  phone: "+46703330511",
  phoneLabel: "070-333 05 11",
  location: "Norrköping",
  instagram: "https://instagram.com/lindblomcoaching",

  /** Figures shown in the hero. Edit here, not in the markup. */
  activeAdepts: "320+",
  openSpots: 8,
} as const;

export const sections = [
  { href: "#coaching", label: "Coaching" },
  { href: "#testning", label: "Testning" },
  { href: "#om-mig", label: "Om mig" },
  { href: "#kontakt", label: "Kontakt" },
] as const;
