"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy, Mail } from "lucide-react";

import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { routes } from "@/lib/routes";

const noop = () => () => {};

/**
 * Inbjudan till en adept som inte har ett konto än.
 *
 * Appen skickar inga mejl själv. Coachen får en färdig text och en länk till
 * registreringen med namn och adress ifyllda, och skickar den som hen vill –
 * mejl, sms eller chatt. När adepten registrerar sig med adressen kopplas
 * kontot till adepten, och samtycket till hälsouppgifter ges i samma steg.
 */
export function InviteCard({
  adeptName,
  email,
  coachName,
}: {
  adeptName: string;
  email: string | null;
  coachName: string;
}) {
  // Adressen sajten körs på, så att länken fungerar både skarpt och lokalt.
  const origin = useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => "",
  );
  const [copied, setCopied] = useState<"text" | "link" | null>(null);

  if (!email) {
    return (
      <Card>
        <CardTitle>Bjud in till appen</CardTitle>
        <p className="text-sm text-text-muted">
          Lägg in adeptens e-postadress under Grundinfo först. Det är adressen
          som kopplar kontot till adepten när hen registrerar sig.
        </p>
      </Card>
    );
  }

  const firstName = adeptName.split(" ")[0] || adeptName;
  const params = new URLSearchParams({
    inbjudan: "adept",
    namn: adeptName,
    epost: email,
  });
  const link = `${origin}${routes.signUp}?${params.toString()}`;
  const subject = "Inbjudan till Coachvy";
  const message = [
    `Hej ${firstName}!`,
    "",
    "Jag har börjat använda Coachvy för dina tester, din säsongsplan och dina pass. Skapa ett konto här, så ser du allt jag lägger upp och kan checka in själv:",
    "",
    link,
    "",
    `Använd ${email} – det är den adressen som kopplar kontot till dig. Vid registreringen får du också godkänna att dina träningsuppgifter, som puls och testvärden, får behandlas i appen. Du kan ta tillbaka det när du vill under Inställningar.`,
    "",
    `Hälsningar ${coachName}`,
  ].join("\n");

  const copy = async (what: "text" | "link") => {
    try {
      await navigator.clipboard.writeText(what === "text" ? message : link);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  };

  return (
    <Card>
      <CardTitle>Bjud in till appen</CardTitle>
      <p className="mb-3 text-sm text-text-muted">
        {firstName} har inget konto än. Skicka texten som mejl eller sms – när
        hen registrerar sig kopplas kontot hit och hen samtycker till att
        hälsouppgifterna behandlas. Har hen redan ett konto syns inbjudan när
        hen loggar in.
      </p>
      <textarea
        readOnly
        aria-label="Inbjudan"
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
        <a
          href={`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`}
          className={buttonClass({ variant: "secondary", size: "sm" })}
        >
          <Mail aria-hidden className="size-3.5" />
          Öppna i mejlprogrammet
        </a>
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
