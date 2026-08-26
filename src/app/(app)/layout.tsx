import { AppShell } from "@/components/app-shell";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Every page in this group reads the session, so nothing here may be
 * prerendered — not even when the build runs without Supabase credentials.
 */
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getSessionUser();

  // `src/proxy.ts` already redirects signed-out visitors. When Supabase has no
  // credentials yet the shell still renders so the skeleton can be reviewed.
  const shellUser = user
    ? {
        name: user.profile?.full_name ?? user.email,
        email: user.email,
        roleLabel: user.profile?.role === "coach" ? "Coach" : "Adept",
      }
    : {
        name: "Demoläge",
        email: "",
        roleLabel: isSupabaseConfigured() ? "Okänd roll" : "Supabase saknas",
      };

  return <AppShell user={shellUser}>{children}</AppShell>;
}
