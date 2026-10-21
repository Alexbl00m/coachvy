import { notFound } from "next/navigation";

import { getAdept } from "@/lib/adepts/queries";
import { isMember } from "@/lib/auth/membership";
import { requireSessionUser, type SessionUser } from "@/lib/auth/session";
import type { Adept } from "@/lib/types/database";

export type Workspace = {
  user: SessionUser;
  adept: Adept;
  isCoach: boolean;
  /** Adeptens egen coach: får ändra allt. */
  canEdit: boolean;
  /** Adepten själv tittar. */
  isSelf: boolean;
  /** En medlemsadept registrerar egna tester och bygger egna pass. */
  selfMember: boolean;
};

/**
 * Adepten och vem som tittar, för en sida i adeptens arbetsyta.
 *
 * RLS bestämmer vad som syns: en coach ser sina egna adepter, en adept bara
 * sin egen rad. Allt annat kommer tillbaka tomt och blir "finns inte". Både
 * sessionen och adepten är cachade per förfrågan, så att layouten och fliken
 * delar på samma uppslag.
 */
export async function loadWorkspace(
  params: Promise<{ id: string }>,
): Promise<Workspace> {
  const user = await requireSessionUser();
  const { id } = await params;
  const adept = await getAdept(id);
  if (!adept) notFound();
  const isCoach = user.profile?.role === "coach";
  const isSelf = adept.profile_id === user.id;
  return {
    user,
    adept,
    isCoach,
    canEdit: isCoach && adept.coach_id === user.id,
    isSelf,
    selfMember: isSelf && isMember(user),
  };
}
