"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { Check, Copy, Mail, Send } from "lucide-react";

import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { emailAdept, markInvited } from "@/lib/adepts/actions";
import {
  inviteLink,
  inviteSubject,
  inviteText,
} from "@/lib/adepts/invite-text";
import { cn } from "@/lib/cn";

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
  canEmail,
}: {
  adeptId: string;
  adeptName: string;
  email: string | null;
  coachName: string;
  mode: "inbjudan" | "samtycke";
  invitedAt: string | null;
  /** Appen kan mejla själv: Resend är inställt. Annars bara kopiera. */
  canEmail: boolean;
}) {
  // Adressen sajten körs på, så att länken fungerar både skarpt och lokalt.
  const origin = useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => "",
  );
  const [copied, setCopied] = useState<"text" | "link" | null>(null);
  const [invitedAt, setInvitedAt] = useState(initialInvitedAt);
  const [sending, startSending] = useTransition();
  const [sent, setSent] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

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

  const target = { name: adeptName, email };
  const link = inviteLink(mode, origin, target);
  const subject = inviteSubject(mode);
  const message = inviteText(mode, target, coachName, link);

  const noteSent = () => {
    if (mode !== "inbjudan") return;
    void markInvited(adeptId).then(({ at }) => {
      if (at) setInvitedAt(at);
    });
  };

  const send = () =>
    startSending(async () => {
      setSendError(null);
      const result = await emailAdept(adeptId, mode);
      if (!result.ok) {
        setSendError(result.error ?? "Mejlet kunde inte skickas.");
        return;
      }
      if (result.at) setInvitedAt(result.at);
      setSent(email);
    });

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
          ? `${firstName} har inget konto än. ${canEmail ? "Skicka inbjudan härifrån, eller kopiera texten till ett sms" : "Skicka texten som mejl eller sms"} – när hen registrerar sig kopplas kontot hit och hen samtycker till att hälsouppgifterna behandlas. Har hen redan ett konto syns inbjudan när hen loggar in.`
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
        {canEmail && email && (
          <Button size="sm" onClick={send} disabled={sending}>
            <Send aria-hidden className="size-3.5" />
            {sending
              ? "Skickar …"
              : mode === "inbjudan"
                ? "Skicka inbjudan"
                : "Skicka påminnelse"}
          </Button>
        )}
        <Button
          size="sm"
          variant={canEmail && email ? "secondary" : "primary"}
          onClick={() => copy("text")}
          disabled={!origin}
        >
          {/* Ikonerna ligger på varandra och tonas över: bocken bekräftar
              att texten kopierades utan att knappen hoppar. */}
          <span aria-hidden className="relative size-3.5">
            <Copy
              className={cn(
                "absolute inset-0 size-3.5 transition-[opacity,transform,filter] duration-150 ease-out motion-reduce:scale-100 motion-reduce:blur-none",
                copied === "text"
                  ? "scale-50 opacity-0 blur-[2px]"
                  : "scale-100 opacity-100 blur-none",
              )}
            />
            <Check
              className={cn(
                "absolute inset-0 size-3.5 transition-[opacity,transform,filter] duration-150 ease-out motion-reduce:scale-100 motion-reduce:blur-none",
                copied === "text"
                  ? "scale-100 opacity-100 blur-none"
                  : "scale-50 opacity-0 blur-[2px]",
              )}
            />
          </span>
          {copied === "text" ? "Kopierat" : "Kopiera texten"}
        </Button>
        {email && !canEmail && (
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
      {(sent || sendError) && (
        <p
          role="status"
          className={cn(
            "mt-3 text-[13px]",
            sendError ? "text-bad" : "text-text-muted",
          )}
        >
          {sendError ?? `Mejlat till ${sent}. Svar kommer till dig.`}
        </p>
      )}
    </Card>
  );
}
