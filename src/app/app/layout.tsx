import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { listAdepts } from "@/lib/adepts/queries";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Every page in this group reads the session, so nothing here may be
 * prerendered — not even when the build runs without Supabase credentials.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Coachvy", template: "%s · Coachvy" },
};

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getSessionUser();
  // Coachens adepter till sökningen i sidhuvudet: namn och id räcker.
  const adepts =
    user?.profile?.role === "coach"
      ? (await listAdepts())
          .filter((a) => a.coach_id === user.id)
          .map((a) => ({ id: a.id, name: a.full_name }))
      : [];

  // `src/proxy.ts` already redirects signed-out visitors. When Supabase has no
  // credentials yet the shell still renders so the skeleton can be reviewed.
  const shellUser = user
    ? {
        name: user.profile?.full_name ?? user.email,
        email: user.email,
        role: user.profile?.role ?? null,
        roleLabel: user.isAdmin
          ? "Admin"
          : user.profile?.role === "coach"
            ? "Coach"
            : "Adept",
        isAdmin: user.isAdmin,
        adeptId: user.adept?.id ?? null,
        adepts,
      }
    : {
        name: "Demoläge",
        email: "",
        role: null,
        roleLabel: isSupabaseConfigured() ? "Okänd roll" : "Supabase saknas",
      };

  return <AppShell user={shellUser}>{children}</AppShell>;
}
