"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy, Mail } from "lucide-react";

import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { markInvited } from "@/lib/adepts/actions";
import { routes } from "@/lib/routes";

const noop = () => () => {};

const longDate = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));

/**
 * Inbjudan till appen, eller en påminnelse om samtycket.
 *
 * Appen skickar inga mejl själv. Coachen får en färdig text och skickar den
 * som hen vill – mejl, sms eller chatt.
 *
 * - **Inget konto:** texten har en länk till registreringen med namn och
 *   adress ifyllda. När adepten registrerar sig med adressen kopplas kontot
 *   hit, och samtycket till hälsouppgifter ges i samma steg.
 * - **Konto utan samtycke:** texten ber adepten logga in och godkänna under
 *   Inställningar.
 */
export function InviteCard({
  adeptId,
  adeptName,
  email,
  coachName,
  mode,
  invitedAt: initialInvitedAt,
}: {
  adeptId: string;
  adeptName: string;
  email: string | null;
  coachName: string;
  mode: "inbjudan" | "samtycke";
  invitedAt: string | null;
}) {
  // Adressen sajten körs på, så att länken fungerar både skarpt och lokalt.
  const origin = useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => "",
  );
  const [copied, setCopied] = useState<"text" | "link" | null>(null);
  const [invitedAt, setInvitedAt] = useState(initialInvitedAt);

  const firstName = adeptName.split(" ")[0] || adeptName;
  const title = mode === "inbjudan" ? "Bjud in till appen" : "Samtycke saknas";

  if (mode === "inbjudan" && !email) {
    return (
      <Card>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-text-muted">
          Lägg in adeptens e-postadress under Grundinfo först. Det är adressen
          som kopplar kontot till adepten när hen registrerar sig.
        </p>
      </Card>
    );
  }

  const params = new URLSearchParams({
    inbjudan: "adept",
    namn: adeptName,
    epost: email ?? "",
  });
  const link =
    mode === "inbjudan"
      ? `${origin}${routes.signUp}?${params.toString()}`
      : `${origin}${routes.settings}`;
  const subject =
    mode === "inbjudan"
      ? "Inbjudan till Coachvy"
      : "Ditt godkännande i Coachvy";
  const message = (
    mode === "inbjudan"
      ? [
          `Hej ${firstName}!`,
          "",
          "Jag har börjat använda Coachvy för dina tester, din säsongsplan och dina pass. Skapa ett konto här, så ser du allt jag lägger upp och kan checka in själv:",
          "",
          link,
          "",
          `Använd ${email} – det är den adressen som kopplar kontot till dig. Vid registreringen får du också godkänna att dina träningsuppgifter, som puls och testvärden, får behandlas i appen. Du kan ta tillbaka det när du vill under Inställningar.`,
        ]
      : [
          `Hej ${firstName}!`,
          "",
          "För att jag ska kunna använda dina träningsuppgifter i Coachvy – som puls, testvärden och dina pass – behöver du godkänna det. Logga in och kryssa i samtycket under Inställningar:",
          "",
          link,
          "",
          "Du kan ta tillbaka det när du vill, på samma ställe.",
        ]
  )
    .concat(["", `Hälsningar ${coachName}`])
    .join("\n");

  const noteSent = () => {
    if (mode !== "inbjudan") return;
    void markInvited(adeptId).then(({ at }) => {
      if (at) setInvitedAt(at);
    });
  };

  const copy = async (what: "text" | "link") => {
    try {
      await navigator.clipboard.writeText(what === "text" ? message : link);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
      noteSent();
    } catch {
      setCopied(null);
    }
  };

  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <p className="mb-3 text-sm text-text-muted">
        {mode === "inbjudan"
          ? `${firstName} har inget konto än. Skicka texten som mejl eller sms – när hen registrerar sig kopplas kontot hit och hen samtycker till att hälsouppgifterna behandlas. Har hen redan ett konto syns inbjudan när hen loggar in.`
          : `${firstName} har ett konto men har inte godkänt att hälsouppgifter behandlas. Tills dess används inte AI-funktionerna för ${firstName}. Skicka en påminnelse:`}
      </p>
      {mode === "inbjudan" && (
        <p className="mb-3 text-[13px] text-text-subtle" role="status">
          {invitedAt
            ? `Inbjudan skickad ${longDate(invitedAt)}.`
            : "Ingen inbjudan skickad än."}
        </p>
      )}
      <textarea
        readOnly
        aria-label={mode === "inbjudan" ? "Inbjudan" : "Påminnelse"}
        value={origin ? message : ""}
        rows={9}
        className="w-full resize-y rounded-md border border-line-strong bg-surface-2 px-3 py-2 text-[13px] leading-relaxed text-text"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => copy("text")} disabled={!origin}>
          {copied === "text" ? (
            <Check aria-hidden className="size-3.5" />
          ) : (
            <Copy aria-hidden className="size-3.5" />
          )}
          {copied === "text" ? "Kopierat" : "Kopiera texten"}
        </Button>
        {email && (
          <a
            href={`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`}
            onClick={noteSent}
            className={buttonClass({ variant: "secondary", size: "sm" })}
          >
            <Mail aria-hidden className="size-3.5" />
            Öppna i mejlprogrammet
          </a>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => copy("link")}
          disabled={!origin}
        >
          {copied === "link" ? "Länken kopierad" : "Kopiera bara länken"}
        </Button>
      </div>
    </Card>
  );
}
