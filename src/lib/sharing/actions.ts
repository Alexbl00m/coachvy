"use server";

import { revalidatePath } from "next/cache";

import { getSessionUser } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

import { listShares } from "./queries";
import {
  choiceError,
  planShares,
  type Share,
  type ShareChoice,
  type ShareKind,
} from "./shares";

/**
 * Delningens åtgärder. Ägaren väljer mottagare, admin granskar det som
 * delas med alla medlemmar. Databasen kontrollerar igen: att det är ägaren,
 * att en utvald adept är ägarens och att medlemsdelningen granskas.
 */

export type ShareResult =
  | { ok: true; shares: Share[] }
  | { ok: false; error: string };

const fail = (error: string) => ({ ok: false as const, error });

const dbError = (error: { message?: string; code?: string }) =>
  error.code === "42501" || error.code === "23514"
    ? fail(error.message ?? "Det gick inte.")
    : fail(`Det gick inte att spara: ${error.message ?? "okänt fel"}.`);

function refresh(kind: ShareKind) {
  if (kind === "pass") {
    revalidatePath(routes.sessionLibrary);
  } else {
    revalidatePath(routes.planLibrary, "layout");
    revalidatePath(routes.planTemplates, "layout");
  }
  revalidatePath(routes.admin);
}

/** Sparar vem som ser passet eller planen. */
export async function saveShares(input: {
  kind: ShareKind;
  id: string;
  choice: ShareChoice;
}): Promise<ShareResult> {
  const user = await getSessionUser();
  if (!user) return fail("Logga in igen.");
  if (user.profile?.role !== "coach" && !user.isAdmin) {
    return fail("Det är coacher som delar pass och planer.");
  }
  if (input.kind === "plan" && !user.isAdmin && user.coach?.plan !== "medlem") {
    return fail("Att bygga och dela planer ingår i medlemskapet för coacher.");
  }
  const invalid = choiceError(input.choice);
  if (invalid) return fail(invalid);

  const current = await listShares(input.kind, input.id);
  const { add, remove } = planShares(current, input.choice);
  const supabase = await createClient();

  if (remove.length > 0) {
    const { error } = await supabase
      .from("library_shares")
      .delete()
      .in("id", remove);
    if (error) return dbError(error);
  }
  if (add.length > 0) {
    const { error } = await supabase.from("library_shares").insert(
      add.map((a) => ({
        session_id: input.kind === "pass" ? input.id : null,
        template_id: input.kind === "plan" ? input.id : null,
        audience: a.audience,
        adept_id: a.adeptId ?? null,
        coach_id: a.coachId ?? null,
        created_by: user.id,
      })),
    );
    if (error) return dbError(error);
  }

  refresh(input.kind);
  return { ok: true, shares: await listShares(input.kind, input.id) };
}

/** En coach att dela med, på exakt e-postadress. */
export async function findCoach(
  email: string,
): Promise<
  { ok: true; id: string; name: string } | { ok: false; error: string }
> {
  const user = await getSessionUser();
  if (!user || (user.profile?.role !== "coach" && !user.isAdmin)) {
    return fail("Det är coacher som delar med andra coacher.");
  }
  const address = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    return fail("Skriv coachens e-postadress.");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("find_coach_by_email", {
    p_email: address,
  });
  if (error) return dbError(error);
  const found = data?.[0];
  if (!found?.id) {
    return fail(
      "Ingen coach i Coachvy har den adressen. Kontrollera stavningen, eller be coachen skapa ett konto.",
    );
  }
  return { ok: true, id: found.id, name: found.name ?? address };
}

/** Admin godkänner eller avslår en delning med alla medlemmar. */
export async function reviewShare(input: {
  shareId: string;
  approve: boolean;
  note: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user?.isAdmin) return fail("Bara admin granskar.");
  const note = input.note.trim().slice(0, 500);
  if (!input.approve && !note) {
    return fail("Skriv varför, så att coachen vet vad som behöver ändras.");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_library_share", {
    p_share: input.shareId,
    p_approve: input.approve,
    p_note: note,
  });
  if (error) return dbError(error);
  refresh("pass");
  refresh("plan");
  return { ok: true };
}
