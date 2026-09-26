import type { SessionUser } from "./session";

/**
 * Har kontot medlemskap?
 *
 * Läser bara kolumnen; att den inte kan ändras av användaren själv sköts av en
 * trigger i databasen. Utan Supabase konfigurerad finns inga konton alls, och
 * då finns heller inget medlemskap.
 */
export function isMember(user: SessionUser | null): boolean {
  return user?.coach?.plan === "medlem";
}
