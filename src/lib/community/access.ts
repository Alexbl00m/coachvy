import { isMember } from "@/lib/auth/membership";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Är kontot med i communityn? Samma regel som databasens can_use_community():
 * admin och medlemmar, coacher som adepter. Databasen avgör ändå – det här
 * styr bara vad sidan visar.
 */
export function canUseCommunity(user: SessionUser | null): boolean {
  return isMember(user);
}
