import { NextResponse, type NextRequest } from "next/server";

import { routes } from "@/lib/routes";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for Supabase e-mail confirmation and magic links. Exchanges
 * the one-time code for a session cookie, then sends the user into the app.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const destination =
    next?.startsWith("/") && !next.startsWith("//") ? next : routes.dashboard;

  if (code && isSupabaseConfigured()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(destination, origin));
    }
  }

  const failed = new URL(routes.signIn, origin);
  failed.searchParams.set("error", "bekraftelse");
  return NextResponse.redirect(failed);
}
