import { redirect } from "next/navigation";

import { routes } from "@/lib/routes";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { Adept, Coach, Profile } from "@/lib/types/database";

export type SessionUser = {
  id: string;
  email: string;
  profile: Profile | null;
  coach: Coach | null;
  adept: Adept | null;
};

/** The signed-in user plus their role row, or `null` when signed out. */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  let coach: Coach | null = null;
  let adept: Adept | null = null;

  if (profile?.role === "coach") {
    const { data } = await supabase
      .from("coaches")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    coach = data ?? null;
  } else if (profile?.role === "adept") {
    const { data } = await supabase
      .from("adepts")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    adept = data ?? null;
  }

  return {
    id: user.id,
    email: user.email ?? profile?.email ?? "",
    profile: profile ?? null,
    coach,
    adept,
  };
}

/** Same as `getSessionUser`, but sends signed-out visitors to the login page. */
export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(routes.signIn);
  return user;
}

/**
 * The signed-in user, guaranteed to be a coach. Adept accounts are sent to
 * their own overview rather than shown a coach-only page.
 */
export async function requireCoach(): Promise<SessionUser> {
  const user = await requireSessionUser();
  if (user.profile?.role !== "coach") redirect(routes.dashboard);
  return user;
}

/** Marks an adept account as active. Called once per sign-in. */
export async function touchAdeptActivity(profileId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = await createClient();
  await supabase
    .from("adepts")
    .update({ last_active_at: new Date().toISOString() })
    .eq("profile_id", profileId);
}
