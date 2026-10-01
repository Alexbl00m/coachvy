/**
 * Var en adept står i kontakten och samtycket, som ett läge.
 *
 * Hälsouppgifter får behandlas på uttryckligt samtycke, och det ges när
 * adepten registrerar sig eller under Inställningar. Utan konto finns inget
 * samtycke att visa – då är det inbjudan som är nästa steg.
 */
export type ConsentState =
  | { kind: "godkänt"; at: string }
  | { kind: "konto-utan-samtycke" }
  | { kind: "inbjuden"; at: string }
  | { kind: "ej-inbjuden" };

export function consentStateOf(
  adept: { profile_id: string | null; invited_at?: string | null },
  consentAt: string | null | undefined,
): ConsentState {
  if (adept.profile_id) {
    return consentAt
      ? { kind: "godkänt", at: consentAt }
      : { kind: "konto-utan-samtycke" };
  }
  return adept.invited_at
    ? { kind: "inbjuden", at: adept.invited_at }
    : { kind: "ej-inbjuden" };
}

const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));

/** Lägets text i listor: kort, och med datum där det finns ett. */
export function consentLabel(state: ConsentState): string {
  switch (state.kind) {
    case "godkänt":
      return "Godkänt";
    case "konto-utan-samtycke":
      return "Konto, ej godkänt";
    case "inbjuden":
      return `Inbjuden ${shortDate(state.at)}`;
    case "ej-inbjuden":
      return "Ej inbjuden";
  }
}

/**
 * Meddelandet när AI-funktionerna inte får användas för adepten. `self` när
 * det är adepten själv som försöker – då är svaret var hen godkänner.
 */
export function aiBlockedMessage(
  name: string,
  state: ConsentState,
  self = false,
): string {
  if (self) {
    return "Passbyggaren skickar dina testvärden och din belastning till Anthropic och används bara med ditt samtycke. Godkänn att hälsouppgifter behandlas under Inställningar.";
  }
  const first = name.split(" ")[0] || name;
  const next =
    state.kind === "konto-utan-samtycke"
      ? `Be ${first} godkänna det under Inställningar i appen.`
      : `Bjud in ${first} till appen från adeptsidan – samtycket ges vid registreringen.`;
  return `${first} har inte godkänt att hälsouppgifter behandlas i Coachvy. AI-funktionerna skickar adeptens värden till Anthropic och används därför bara med samtycke. ${next}`;
}
