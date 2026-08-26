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
 * Adepts linked to the signed-in coach. Row Level Security scopes this to the
 * coach's own adepts, so no extra filter is needed here.
 */
export async function listMyAdepts(): Promise<Adept[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("adepts")
    .select("*")
    .order("created_at", { ascending: false });

  return data ?? [];
}
