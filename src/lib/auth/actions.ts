"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { routes } from "@/lib/routes";
import { siteOrigin } from "@/lib/site-origin";
import { touchAdeptActivity } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { AccountRole } from "@/lib/types/database";

export type AuthFormState = {
  error?: string;
  /** Shown on success when no redirect happens, e.g. "confirm your email". */
  notice?: string;
  /**
   * Registreringen lyckades och väntar på bekräftelse: adressen mejlet gick
   * till. Formuläret byts då mot en egen vy, så att ingen fyller i det igen.
   */
  sentTo?: string;
  /** Adressen fanns redan, obekräftad – länken skickades bara igen. */
  existing?: { since: string; role: string | null };
  /** Inloggningen nekades för att adressen inte är bekräftad än. */
  unconfirmed?: boolean;
  /**
   * React resets an uncontrolled form once the action resolves, so failed
   * submissions echo back what was typed. Passwords are never included.
   */
  values?: {
    full_name?: string;
    email?: string;
    company_name?: string;
    sport?: string;
    goal?: string;
    current_level?: string;
    accepted_terms?: boolean;
    health_consent?: boolean;
  };
};

const NOT_CONFIGURED_ERROR =
  "Supabase är inte konfigurerat ännu. Fyll i NEXT_PUBLIC_SUPABASE_URL och NEXT_PUBLIC_SUPABASE_ANON_KEY i .env.local.";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Only allow relative paths back into the app, never absolute URLs. */
function safeNext(value: string): string | null {
  return value.startsWith("/") && !value.startsWith("//") ? value : null;
}

export async function signIn(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = text(formData, "email");
  const password = text(formData, "password");

  if (!isSupabaseConfigured()) {
    return { error: NOT_CONFIGURED_ERROR, values: { email } };
  }

  if (!email || !password) {
    return { error: "Fyll i både e-post och lösenord.", values: { email } };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        error:
          "Du har inte bekräftat din e-postadress än. Klicka på länken i mejlet vi skickade när du skapade kontot.",
        unconfirmed: true,
        values: { email },
      };
    }
    return { error: "Fel e-post eller lösenord.", values: { email } };
  }

  // "Senast aktiv" on the coach's roster is driven by sign-ins. A no-op for
  // coaches, since only adept rows carry the column.
  if (data.user) await touchAdeptActivity(data.user.id);

  revalidatePath("/", "layout");
  redirect(safeNext(text(formData, "next")) ?? routes.dashboard);
}

/** Supabases fel på svenska; okända fel visas som de kommer. */
function signUpError(error: {
  code?: string;
  status?: number;
  message: string;
}) {
  switch (error.code) {
    case "over_email_send_rate_limit":
      return "Ett bekräftelsemejl skickades nyss till adressen. Titta i inkorgen, eller vänta en minut och försök igen.";
    case "over_request_rate_limit":
      return "För många försök på kort tid. Vänta en stund och försök igen.";
    case "email_address_invalid":
      return "E-postadressen ser inte ut att stämma. Kontrollera den och försök igen.";
    case "weak_password":
      return "Lösenordet är för svagt. Välj ett längre, gärna med siffror och tecken.";
    case "signup_disabled":
      return "Det går inte att skapa konton just nu.";
  }
  return error.status === 429
    ? "Ett bekräftelsemejl skickades nyss till adressen. Titta i inkorgen, eller vänta en minut och försök igen."
    : error.message;
}

export async function signUp(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const role = text(formData, "role") as AccountRole;
  const fullName = text(formData, "full_name");
  const email = text(formData, "email");
  const password = text(formData, "password");
  const acceptedTerms = formData.get("accepted_terms") === "on";
  const healthConsent = formData.get("health_consent") === "on";

  const values: AuthFormState["values"] = {
    full_name: fullName,
    email,
    company_name: text(formData, "company_name"),
    sport: text(formData, "sport"),
    goal: text(formData, "goal"),
    current_level: text(formData, "current_level"),
    accepted_terms: acceptedTerms,
    health_consent: healthConsent,
  };

  if (!isSupabaseConfigured()) {
    return { error: NOT_CONFIGURED_ERROR, values };
  }
  if (role !== "coach" && role !== "adept") {
    return { error: "Välj kontotyp: coach eller adept.", values };
  }
  if (!fullName) {
    return { error: "Fyll i ditt namn.", values };
  }
  if (!email) {
    return { error: "Fyll i din e-postadress.", values };
  }
  if (password.length < 8) {
    return { error: "Lösenordet måste vara minst 8 tecken.", values };
  }
  if (!acceptedTerms) {
    return {
      error: "Du behöver godkänna villkoren och integritetspolicyn.",
      values,
    };
  }
  // Hälsouppgifter får bara behandlas på uttryckligt samtycke (GDPR art.
  // 9.2 a), och samtycket ska vara ett eget val – inte en del av villkoren.
  // En adept utan det samtycket har ingenting appen kan göra för hen.
  if (role === "adept" && !healthConsent) {
    return {
      error:
        "Du behöver samtycka till att dina hälsouppgifter behandlas – utan dem går det inte att följa din träning.",
      values,
    };
  }

  const supabase = await createClient();
  const origin = await siteOrigin();

  // Read by the `handle_new_user` trigger, which fills profiles + coaches/adepts.
  const metadata: Record<string, string | boolean> = {
    role,
    full_name: fullName,
    accepted_terms: true,
    health_consent: role === "adept" && healthConsent,
  };

  if (role === "coach") {
    metadata.company_name = values.company_name ?? "";
  } else {
    metadata.sport = values.sport ?? "";
    metadata.goal = values.goal ?? "";
    metadata.current_level = values.current_level ?? "";
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { error: signUpError(error), values };
  }

  // En bekräftad adress ger inget fel – Supabase svarar med en användare utan
  // identiteter, så att ingen kan fiska efter vilka adresser som finns. Ingen
  // ny användare skapas och inget mejl skickas.
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    return {
      error:
        "Det finns redan ett konto med den här adressen. Logga in i stället.",
      values,
    };
  }

  // No session yet when e-mail confirmation is enabled on the Supabase project.
  if (!data.session) {
    // En obekräftad adress som redan fanns får länken igen, men behåller
    // uppgifterna från första försöket – roll och namn ändras inte.
    const created = data.user?.created_at
      ? new Date(data.user.created_at).getTime()
      : Date.now();
    const existing =
      Date.now() - created > 60_000
        ? {
            since: data.user!.created_at,
            role:
              typeof data.user!.user_metadata?.role === "string"
                ? (data.user!.user_metadata.role as string)
                : null,
          }
        : undefined;
    return { sentTo: email, existing };
  }

  revalidatePath("/", "layout");
  redirect(routes.dashboard);
}

/** Skickar bekräftelsemejlet igen, till en adress som inte är bekräftad. */
export async function resendConfirmation(
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const address = email.trim();
  if (!address) return { ok: false, error: "Fyll i din e-postadress." };
  if (!isSupabaseConfigured())
    return { ok: false, error: NOT_CONFIGURED_ERROR };

  const supabase = await createClient();
  const origin = await siteOrigin();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: address,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) {
    return {
      ok: false,
      error:
        error.status === 429 || error.code === "over_email_send_rate_limit"
          ? "Mejlet skickades nyss. Vänta en minut innan du försöker igen."
          : "Mejlet kunde inte skickas. Försök igen om en stund.",
    };
  }
  return { ok: true };
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  revalidatePath("/", "layout");
  redirect(routes.signIn);
}
