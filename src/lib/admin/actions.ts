"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export type SetPlanResult = { ok: true } | { ok: false; error: string };

/**
 * Slår på eller av medlemskap för ett konto – coach eller adept.
 *
 * Kontrollen görs två gånger: här, så att den som inte är admin inte ens når
 * databasen, och i `admin_set_member_plan`, som vägrar oavsett vem som anropar.
 */
export async function setMemberPlan(
  memberId: string,
  plan: "bas" | "medlem",
): Promise<SetPlanResult> {
  await requireAdmin();
  if (plan !== "bas" && plan !== "medlem") return { ok: false, error: "Okänd plan." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_member_plan", {
    member: memberId,
    new_plan: plan,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(routes.admin);
  return { ok: true };
}
