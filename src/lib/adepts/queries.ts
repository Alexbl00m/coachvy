import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { Adept } from "@/lib/types/database";
import { consentStateOf, type ConsentState } from "./consent-state";

/**
 * Every query here leans on Row Level Security rather than filtering by hand:
 * a coach only ever sees rows whose `coach_id` is their own, and an adept only
 * ever sees the row whose `profile_id` is theirs. See the phase 2 migration.
 */

export async function listAdepts(): Promise<Adept[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("adepts")
    .select("*")
    .order("full_name", { ascending: true });

  if (error) throw new Error(`Kunde inte hämta adepter: ${error.message}`);
  return data ?? [];
}

export async function getAdept(id: string): Promise<Adept | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("adepts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Kunde inte hämta adepten: ${error.message}`);
  return data ?? null;
}

/** The adept row belonging to the signed-in adept account, if there is one. */
export async function getMyAdeptRow(profileId: string): Promise<Adept | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("adepts")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) throw new Error(`Kunde inte hämta din adeptprofil: ${error.message}`);
  return data ?? null;
}

/**
 * När ett adeptkonto samtyckte till behandling av hälsouppgifter.
 *
 * `null` betyder att samtycket saknas eller har tagits tillbaka. `undefined`
 * betyder att profilen inte gick att läsa – då visas ingenting hellre än en
 * felaktig varning.
 */
export async function getHealthConsent(
  profileId: string,
): Promise<string | null | undefined> {
  if (!isSupabaseConfigured()) return undefined;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("health_consent_at")
    .eq("id", profileId)
    .maybeSingle();

  if (error || !data) return undefined;
  return data.health_consent_at;
}

/**
 * Samtycket för flera adepters konton på en gång, för listor. Nyckeln är
 * profilens id; en profil som inte gick att läsa saknas i kartan.
 */
export async function consentByProfile(
  profileIds: string[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (!isSupabaseConfigured() || profileIds.length === 0) return map;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, health_consent_at")
    .in("id", profileIds);
  for (const row of data ?? []) map.set(row.id, row.health_consent_at);
  return map;
}

/** Adeptens läge i kontakten och samtycket. */
export async function getConsentState(adept: Adept): Promise<ConsentState> {
  const consent = adept.profile_id
    ? await getHealthConsent(adept.profile_id)
    : null;
  return consentStateOf(adept, consent);
}
