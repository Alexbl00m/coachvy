"use server";

import { revalidatePath } from "next/cache";

import { requireSessionUser } from "@/lib/auth/session";
import { adeptHref, routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

import { protocolByKey } from "./protocols";

type Result = { ok: true } | { ok: false; error: string };

function refresh(adeptId: string, sessionId?: string, activityId?: string) {
  revalidatePath(routes.calendar);
  revalidatePath(adeptHref(adeptId, "tester"));
  if (sessionId)
    revalidatePath(`${routes.adepts}/${adeptId}/test/${sessionId}`);
  if (activityId)
    revalidatePath(`${routes.adepts}/${adeptId}/aktivitet/${activityId}`);
}

/**
 * Lägger ett genomfört pass i ett test. Samma pass kan ingå i flera test.
 * Vem som får det avgör databasen: testets coach, eller en medlemsadept i
 * sina egna test.
 */
export async function linkTestPass(input: {
  sessionId: string;
  activityId: string;
  adeptId: string;
}): Promise<Result> {
  await requireSessionUser();
  const supabase = await createClient();
  const { error } = await supabase.from("test_activities").insert({
    session_id: input.sessionId,
    activity_id: input.activityId,
  });
  if (error?.code === "23505") return { ok: true };
  if (error) {
    return {
      ok: false,
      error:
        error.code === "42501"
          ? "Bara testets coach kan lägga pass i det."
          : `Kunde inte koppla passet: ${error.message}`,
    };
  }
  refresh(input.adeptId, input.sessionId, input.activityId);
  return { ok: true };
}

/** Tar ett pass ur ett test. Passet och testet ligger kvar. */
export async function unlinkTestPass(input: {
  sessionId: string;
  activityId: string;
  adeptId: string;
}): Promise<Result> {
  await requireSessionUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_activities")
    .delete()
    .eq("session_id", input.sessionId)
    .eq("activity_id", input.activityId)
    .select("session_id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0)
    return { ok: false, error: "Kopplingen gick inte att ta bort." };
  refresh(input.adeptId, input.sessionId, input.activityId);
  return { ok: true };
}

/**
 * Märker ett planerat pass som en del av ett test i ett protokoll, eller tar
 * bort märkningen med null. Passet syns då som test i kalendern och planen.
 */
export async function setWorkoutTest(input: {
  workoutId: string;
  adeptId: string;
  protocol: string | null;
}): Promise<Result> {
  await requireSessionUser();
  if (input.protocol !== null && !protocolByKey(input.protocol)) {
    return { ok: false, error: "Okänt testprotokoll." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workouts")
    .update({ test_protocol: input.protocol })
    .eq("id", input.workoutId)
    .eq("adept_id", input.adeptId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0)
    return { ok: false, error: "Passet går inte att ändra härifrån." };
  revalidatePath(routes.calendar);
  revalidatePath(`${routes.adepts}/${input.adeptId}`, "layout");
  return { ok: true };
}
