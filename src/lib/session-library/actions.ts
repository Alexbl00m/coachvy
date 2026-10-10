"use server";

import { revalidatePath } from "next/cache";

import { getSessionUser } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/plan-library.generated";

import { validateLibraryInput, type LibraryInput } from "./library";

/**
 * Passbibliotekets åtgärder. Coacher och admin skriver i sitt eget bibliotek;
 * bara admin delar ett pass med alla coacher. RLS säger detsamma igen.
 */

export type LibraryResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

const fail = (error: string): LibraryResult => ({ ok: false, error });

async function libraryUser() {
  const user = await getSessionUser();
  if (!user) return null;
  if (user.profile?.role !== "coach" && !user.isAdmin) return null;
  return user;
}

function refresh() {
  revalidatePath(routes.sessionLibrary);
  revalidatePath(routes.planTemplates, "layout");
}

/** Sparar ett pass: ett nytt utan id, annars ändras det egna. */
export async function saveLibrarySession(
  input: LibraryInput & { id?: string | null },
): Promise<LibraryResult> {
  const user = await libraryUser();
  if (!user) return fail("Passbiblioteket är till för coacher.");
  const checked = validateLibraryInput(input);
  if (!checked.ok) return fail(checked.error);
  const v = checked.value;
  if (v.shared && !user.isAdmin) {
    return fail("Bara en admin kan dela pass med alla coacher.");
  }

  const row = {
    title: v.title,
    sport: v.sport,
    kind: v.kind || null,
    intensity: v.intensity || null,
    purpose: v.purpose || null,
    description: v.description || null,
    progression: v.progression || null,
    phases: v.phases,
    basis: v.basis,
    structure: v.structure,
    blocks: v.blocks as unknown as Json,
    shared: v.shared,
  };

  const supabase = await createClient();
  if (input.id) {
    const { data, error } = await supabase
      .from("session_library")
      .update(row)
      .eq("id", input.id)
      .eq("owner_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) return fail(`Det gick inte att spara: ${error.message}`);
    if (!data) return fail("Passet finns inte bland dina pass.");
    refresh();
    return { ok: true, id: data.id };
  }

  const { data, error } = await supabase
    .from("session_library")
    .insert({ ...row, owner_id: user.id })
    .select("id")
    .single();
  if (error || !data) {
    return fail(`Det gick inte att spara: ${error?.message ?? "okänt fel"}`);
  }
  refresh();
  return { ok: true, id: data.id };
}

/** En kopia i det egna biblioteket – av ett eget pass eller ett delat. */
export async function copyLibrarySession(id: string): Promise<LibraryResult> {
  const user = await libraryUser();
  if (!user) return fail("Passbiblioteket är till för coacher.");
  const supabase = await createClient();
  const { data: source, error } = await supabase
    .from("session_library")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !source) return fail("Passet hittades inte.");

  const { id: _id, owner_id: _owner, created_at: _c, updated_at: _u, ...rest } =
    source;
  void _id;
  void _owner;
  void _c;
  void _u;
  const own = source.owner_id === user.id;
  const { data, error: insertError } = await supabase
    .from("session_library")
    .insert({
      ...rest,
      title: own ? `${source.title} (kopia)`.slice(0, 120) : source.title,
      shared: false,
      owner_id: user.id,
    })
    .select("id")
    .single();
  if (insertError || !data) {
    return fail(`Det gick inte att kopiera: ${insertError?.message ?? "okänt fel"}`);
  }
  refresh();
  return { ok: true, id: data.id };
}

export async function deleteLibrarySession(id: string): Promise<LibraryResult> {
  const user = await libraryUser();
  if (!user) return fail("Passbiblioteket är till för coacher.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session_library")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) return fail(`Det gick inte att ta bort: ${error.message}`);
  if (!data) return fail("Passet finns inte bland dina pass.");
  refresh();
  return { ok: true, id };
}
