import "server-only";

import { isMember } from "@/lib/auth/membership";
import { requireSessionUser, type SessionUser } from "@/lib/auth/session";

/**
 * Vem får bygga pass, och på vilken adept.
 *
 * En coach bygger på sina adepter – vilka som är hans eller hennes avgör
 * databasen. En adept som är medlem bygger på sig själv och ingen annan.
 * Övriga får inte bygga alls.
 */
export async function requireWorkoutAuthor(
  adeptId: string | null,
): Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }> {
  const user = await requireSessionUser();

  if (user.profile?.role === "coach") return { ok: true, user };

  if (user.profile?.role === "adept") {
    if (!isMember(user)) {
      return { ok: false, error: "Passbyggaren ingår i medlemskapet." };
    }
    if (!user.adept || adeptId !== user.adept.id) {
      return { ok: false, error: "Du kan bara bygga pass åt dig själv." };
    }
    return { ok: true, user };
  }

  return {
    ok: false,
    error: "Passbyggaren kräver ett coach- eller medlemskonto.",
  };
}
