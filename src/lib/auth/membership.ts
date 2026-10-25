import type { SessionUser } from "./session";

/**
 * Har kontot medlemskap?
 *
 * Läser bara kolumnen; att den inte kan ändras av användaren själv sköts av en
 * trigger i databasen. Utan Supabase konfigurerad finns inga konton alls, och
 * då finns heller inget medlemskap.
 */
export function isMember(user: SessionUser | null): boolean {
  // Den som administrerar medlemskapen har tillgång till allt de ger.
  return (
    user?.isAdmin === true ||
    user?.coach?.plan === "medlem" ||
    user?.adept?.plan === "medlem"
  );
}

/**
 * Får kontot bygga egna planer? Coacher med medlemskap och admin. Databasen
 * säger detsamma (can_build_plans).
 */
export function canBuildPlans(user: SessionUser | null): boolean {
  return (
    user?.isAdmin === true ||
    (user?.profile?.role === "coach" && user.coach?.plan === "medlem")
  );
}
