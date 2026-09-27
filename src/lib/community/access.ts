import type { SessionUser } from "@/lib/auth/session";

/**
 * Är kontot med i communityn? Samma regel som databasens can_use_community():
 * admin, coacher, och adepter som är kopplade till en coach. Databasen avgör
 * ändå – det här styr bara vad sidan visar.
 */
export function canUseCommunity(user: SessionUser | null): boolean {
  if (!user) return false;
  if (user.isAdmin || user.coach) return true;
  return Boolean(user.adept?.coach_id);
}
