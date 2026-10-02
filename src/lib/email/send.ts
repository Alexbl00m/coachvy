import "server-only";

/**
 * Mejl från appen via Resend.
 *
 * Inloggningens mejl – bekräftelse, återställt lösenord – skickas av Supabase
 * genom samma Resend-konto (SMTP, ställs in i Supabase). Det här är appens
 * egna: inbjudningar, påminnelser om samtycke och kontaktformuläret.
 *
 * Inget SDK: ett anrop mot Resends API räcker, och nyckeln lämnar aldrig
 * servern.
 */

/**
 * Avsändaren ur `EMAIL_FROM`, i den form Resend kräver: `namn@domän` eller
 * `Namn <namn@domän>`. Vanliga inklistringsfel rättas: citattecken runt
 * värdet, `EMAIL_FROM=` eller `EMAIL_FROM:` med i värdet, understreck i
 * stället för mellanslag, radbrytningar. Går ingen adress att hitta är svaret
 * `null`.
 */
export function senderFrom(raw: string | undefined): string | null {
  if (!raw) return null;
  const value = raw
    .trim()
    .replace(/^EMAIL_FROM\s*[:=]\s*/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();
  const address = /<?\s*([^\s<>"']+@[^\s<>"']+\.[^\s<>"']+)\s*>?/.exec(value);
  if (!address) return null;
  const name = value
    .slice(0, address.index)
    .replace(/[_"'<>]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return name ? `${name} <${address[1]}>` : address[1];
}

export function isEmailConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() && senderFrom(process.env.EMAIL_FROM),
  );
}

export type EmailResult = { ok: true } | { ok: false; error: string };

export async function sendEmail(input: {
  to: string;
  subject: string;
  /** Stycken; tomma rader blir styckebrytning. */
  text: string;
  /** Svar går hit i stället för till avsändaradressen – coachen, oftast. */
  replyTo?: string | null;
  /** En knapp under texten. */
  action?: { label: string; href: string } | null;
}): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = senderFrom(process.env.EMAIL_FROM);
  if (!key) {
    return {
      ok: false,
      error: "Mejl är inte inställt: RESEND_API_KEY saknas i miljövariablerna.",
    };
  }
  if (!from) {
    return {
      ok: false,
      error:
        "EMAIL_FROM saknas eller innehåller ingen e-postadress. Skriv till exempel: Coachvy <noreply@contact.lindblomcoaching.com>",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.action
          ? `${input.text}\n\n${input.action.label}: ${input.action.href}`
          : input.text,
        html: toHtml(input.text, input.action ?? null),
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      // Resend godkänner bara exakt den domän som är verifierad. Är det en
      // underdomän måste avsändaren ligga på den, inte på huvuddomänen.
      const unverified = /not verified/i.test(detail?.message ?? "")
        ? " Adressen i EMAIL_FROM måste ligga på exakt den domän som är verifierad i Resend – är det en underdomän, till exempel contact.din-doman.com, ska avsändaren vara noreply@contact.din-doman.com."
        : "";
      return {
        ok: false,
        error: `Mejlet kunde inte skickas (${response.status}${detail?.message ? `: ${detail.message}` : ""}). Avsändare: ${from}.${unverified}`,
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Mejlet kunde inte skickas – försök igen." };
  }
}

const escape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * En enkel, ljus mejlkropp: mejlprogram ritar mörka bakgrunder olika och
 * läser inte CSS-variabler, så den följer sajtens ljusa tema med fasta färger.
 */
function toHtml(text: string, action: { label: string; href: string } | null) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:22px;color:#16171b">${escape(p).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
  const button = action
    ? `<p style="margin:8px 0 24px"><a href="${escape(action.href)}" style="display:inline-block;background:#c4532c;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:8px">${escape(action.label)}</a></p>`
    : "";
  return `<!doctype html><html lang="sv"><body style="margin:0;padding:24px;background:#f7f7f8;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif"><div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e9e9ec;border-radius:12px;padding:28px">${paragraphs}${button}<p style="margin:24px 0 0;font-size:12px;line-height:18px;color:#62656d">Skickat från Coachvy.</p></div></body></html>`;
}
