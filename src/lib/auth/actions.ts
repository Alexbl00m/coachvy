"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { routes } from "@/lib/routes";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { AccountRole } from "@/lib/types/database";

export type AuthFormState = {
  error?: string;
  /** Shown on success when no redirect happens, e.g. "confirm your email". */
  notice?: string;
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

async function siteOrigin(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol =
    headerList.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") ? "http" : "https");

  return host ? `${protocol}://${host}` : "http://localhost:3000";
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
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Fel e-post eller lösenord.", values: { email } };
  }

  revalidatePath("/", "layout");
  redirect(safeNext(text(formData, "next")) ?? routes.dashboard);
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

  const values: AuthFormState["values"] = {
    full_name: fullName,
    email,
    company_name: text(formData, "company_name"),
    sport: text(formData, "sport"),
    goal: text(formData, "goal"),
    current_level: text(formData, "current_level"),
    accepted_terms: acceptedTerms,
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

  const supabase = await createClient();
  const origin = await siteOrigin();

  // Read by the `handle_new_user` trigger, which fills profiles + coaches/adepts.
  const metadata: Record<string, string | boolean> = {
    role,
    full_name: fullName,
    accepted_terms: true,
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
    return { error: error.message, values };
  }

  // No session yet when e-mail confirmation is enabled on the Supabase project.
  if (!data.session) {
    return {
      notice:
        "Kontot är skapat. Vi har skickat en bekräftelselänk till din e-post – klicka på den för att logga in.",
    };
  }

  revalidatePath("/", "layout");
  redirect(routes.dashboard);
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  revalidatePath("/", "layout");
  redirect(routes.signIn);
}
