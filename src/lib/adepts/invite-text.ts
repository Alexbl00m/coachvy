import { routes } from "@/lib/routes";

/**
 * Inbjudan och påminnelsen om samtycke, som text.
 *
 * Samma text används när coachen kopierar den och när appen mejlar den, så
 * att adepten får samma budskap oavsett väg. Länken står på egen rad i den
 * kopierade texten; i mejlet blir den en knapp.
 */
export type InviteKind = "inbjudan" | "samtycke";

export function inviteLink(
  kind: InviteKind,
  origin: string,
  adept: { name: string; email: string | null },
): string {
  if (kind === "samtycke") return `${origin}${routes.settings}`;
  const params = new URLSearchParams({
    inbjudan: "adept",
    namn: adept.name,
    epost: adept.email ?? "",
  });
  return `${origin}${routes.signUp}?${params.toString()}`;
}

export function inviteSubject(kind: InviteKind): string {
  return kind === "inbjudan"
    ? "Inbjudan till Coachvy"
    : "Ditt godkännande i Coachvy";
}

/** Texten. Med `link` står länken i texten; utan den läggs den som knapp. */
export function inviteText(
  kind: InviteKind,
  adept: { name: string; email: string | null },
  coachName: string,
  link: string | null,
): string {
  const first = adept.name.split(" ")[0] || adept.name;
  const lines =
    kind === "inbjudan"
      ? [
          `Hej ${first}!`,
          "",
          "Jag har börjat använda Coachvy för dina tester, din säsongsplan och dina pass. Skapa ett konto här, så ser du allt jag lägger upp och kan checka in själv:",
          ...(link ? ["", link] : []),
          "",
          `Använd ${adept.email} – det är den adressen som kopplar kontot till dig. Vid registreringen får du också godkänna att dina träningsuppgifter, som puls och testvärden, får behandlas i appen. Du kan ta tillbaka det när du vill under Inställningar.`,
        ]
      : [
          `Hej ${first}!`,
          "",
          "För att jag ska kunna använda dina träningsuppgifter i Coachvy – som puls, testvärden och dina pass – behöver du godkänna det. Logga in och kryssa i samtycket under Inställningar:",
          ...(link ? ["", link] : []),
          "",
          "Du kan ta tillbaka det när du vill, på samma ställe.",
        ];
  return [...lines, "", `Hälsningar ${coachName}`].join("\n");
}
