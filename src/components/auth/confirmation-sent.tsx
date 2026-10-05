"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { MailCheck } from "lucide-react";

import { ResendConfirmation } from "@/components/auth/resend-confirmation";
import { routes } from "@/lib/routes";

const ROLE_NAME: Record<string, string> = {
  coach: "coachkonto",
  adept: "adeptkonto",
};

const longDate = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));

/**
 * Det som står kvar när kontot är skapat: formuläret är borta, så att ingen
 * tror att något gick fel och fyller i det igen.
 */
export function ConfirmationSent({
  email,
  role,
  existing,
  onRestart,
}: {
  email: string;
  /** Kontotypen som valdes i formuläret. */
  role: string;
  existing?: { since: string; role: string | null };
  onRestart: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);

  // På mobilen har man skrollat ned till knappen; vyn ska börja överst, och
  // skärmläsaren ska hamna på rubriken.
  useEffect(() => {
    window.scrollTo({ top: 0 });
    heading.current?.focus();
  }, []);

  const otherRole =
    existing?.role && existing.role !== role ? existing.role : null;

  return (
    <div className="enter">
      <span className="flex size-11 items-center justify-center rounded-lg border border-line-strong bg-surface-2">
        <MailCheck aria-hidden className="size-5 text-text" />
      </span>

      <h1
        ref={heading}
        tabIndex={-1}
        className="mt-6 text-2xl font-semibold tracking-tight text-text outline-none"
      >
        Kolla din inkorg
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">
        Vi har skickat en bekräftelselänk till{" "}
        <span className="font-medium break-all text-text">{email}</span>. Klicka
        på länken i mejlet för att aktivera kontot och logga in.
      </p>

      {existing && (
        <p className="mt-4 rounded-md border border-line-strong bg-surface-2 px-3 py-2.5 text-[13px] leading-relaxed text-text-muted">
          Adressen registrerades redan {longDate(existing.since)} men har inte
          bekräftats, så vi skickade länken igen.
          {otherRole && (
            <>
              {" "}
              Kontot skapades då som{" "}
              <span className="text-text">
                {ROLE_NAME[otherRole] ?? otherRole}
              </span>
              . Stämmer inte det – vänta med länken och hör av dig till din
              coach.
            </>
          )}
        </p>
      )}

      <div className="mt-8 border-t border-line pt-6">
        <h2 className="text-[13px] font-medium text-text">
          Hittar du inget mejl?
        </h2>
        <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-text-muted">
          <li>Det kan ta en minut eller två.</li>
          <li>
            Titta i skräpposten och under Kampanjer – första mejlet från en ny
            avsändare hamnar ibland där. Det kommer från Coachvy.
          </li>
        </ul>
        <ResendConfirmation email={email} className="mt-5" />
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <Link
          href={routes.signIn}
          className="font-medium text-accent-text hover:text-accent-hover"
        >
          Till inloggningen
        </Link>
        <button
          type="button"
          onClick={onRestart}
          className="text-text-muted transition-colors hover:text-text"
        >
          Fel adress? Börja om
        </button>
      </div>
    </div>
  );
}
