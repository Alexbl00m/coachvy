/**
 * Vem ser ett pass eller en plan. Ren logik: vad ägaren valt, vad som ska
 * läggas till och tas bort, och hur delningen beskrivs.
 *
 * Mottagarna är rader i library_shares (migrationen
 * 20261027090000_library_sharing.sql). Grupper blir en mottagare till;
 * valet får då en grupp-del på samma sätt som adepter och coacher.
 */

/** Pass i passbiblioteket eller plan i planbiblioteket. */
export type ShareKind = "pass" | "plan";

export type Audience = "adepter" | "adept" | "medlemmar" | "coacher" | "coach";

export type ShareStatus = "aktiv" | "granskas" | "avslagen";

export type Share = {
  id: string;
  audience: Audience;
  status: ShareStatus;
  reviewNote: string | null;
  adeptId: string | null;
  adeptName: string | null;
  coachId: string | null;
  coachName: string | null;
};

/** Alla, några utvalda eller inga. */
export type Reach = "inga" | "alla" | "utvalda";

export type ShareChoice = {
  adepts: Reach;
  adeptIds: string[];
  members: boolean;
  coaches: Reach;
  coachIds: string[];
};

export type NewShare = {
  audience: Audience;
  adeptId?: string;
  coachId?: string;
};

export const PRIVATE: ShareChoice = {
  adepts: "inga",
  adeptIds: [],
  members: false,
  coaches: "inga",
  coachIds: [],
};

/** Valet som de befintliga raderna motsvarar. */
export function choiceOf(shares: Share[]): ShareChoice {
  const has = (a: Audience) => shares.some((s) => s.audience === a);
  const ids = (a: Audience, key: "adeptId" | "coachId") =>
    shares.filter((s) => s.audience === a && s[key]).map((s) => s[key]!);
  const reach = (all: Audience, one: Audience): Reach =>
    has(all) ? "alla" : has(one) ? "utvalda" : "inga";
  return {
    adepts: reach("adepter", "adept"),
    adeptIds: ids("adept", "adeptId"),
    members: has("medlemmar"),
    coaches: reach("coacher", "coach"),
    coachIds: ids("coach", "coachId"),
  };
}

/** Raderna valet ger, utan id och status. */
function wantedShares(choice: ShareChoice): NewShare[] {
  const out: NewShare[] = [];
  if (choice.adepts === "alla") out.push({ audience: "adepter" });
  if (choice.adepts === "utvalda") {
    for (const adeptId of new Set(choice.adeptIds)) {
      out.push({ audience: "adept", adeptId });
    }
  }
  if (choice.members) out.push({ audience: "medlemmar" });
  if (choice.coaches === "alla") out.push({ audience: "coacher" });
  if (choice.coaches === "utvalda") {
    for (const coachId of new Set(choice.coachIds)) {
      out.push({ audience: "coach", coachId });
    }
  }
  return out;
}

const keyOf = (s: {
  audience: Audience;
  adeptId?: string | null;
  coachId?: string | null;
}) => `${s.audience}:${s.adeptId ?? s.coachId ?? ""}`;

/**
 * Vad som ska läggas till och tas bort för att gå från raderna till valet.
 * En rad som står kvar rörs inte, så en godkänd medlemsdelning behåller
 * sin granskning.
 */
export function planShares(
  current: Share[],
  choice: ShareChoice,
): { add: NewShare[]; remove: string[] } {
  const wanted = wantedShares(choice);
  const wantedKeys = new Set(wanted.map(keyOf));
  const currentKeys = new Set(current.map(keyOf));
  return {
    add: wanted.filter((w) => !currentKeys.has(keyOf(w))),
    remove: current.filter((c) => !wantedKeys.has(keyOf(c))).map((c) => c.id),
  };
}

/** Är valet giltigt? Utvalda utan någon vald är ett misstag, inte privat. */
export function choiceError(choice: ShareChoice): string | null {
  if (choice.adepts === "utvalda" && choice.adeptIds.length === 0) {
    return "Välj minst en adept, eller välj alla eller inga.";
  }
  if (choice.coaches === "utvalda" && choice.coachIds.length === 0) {
    return "Lägg till minst en coach, eller välj alla eller inga.";
  }
  return null;
}

const names = (list: (string | null)[]) => {
  const shown = list.filter((n): n is string => Boolean(n));
  if (shown.length === 0) return "";
  if (shown.length <= 2) return shown.join(" och ");
  return `${shown.slice(0, 2).join(", ")} och ${shown.length - 2} till`;
};

/**
 * En rad som säger vem som ser det: "Dina adepter · alla medlemmar
 * (granskas) · Dora Lindqvist". Privat när inga rader finns.
 */
export function shareSummary(shares: Share[]): string {
  if (shares.length === 0) return "Bara du";
  const parts: string[] = [];
  const adepts = shares.filter((s) => s.audience === "adept");
  if (shares.some((s) => s.audience === "adepter")) parts.push("Dina adepter");
  else if (adepts.length)
    parts.push(names(adepts.map((s) => s.adeptName)) || "Utvalda adepter");

  const members = shares.find((s) => s.audience === "medlemmar");
  if (members) {
    parts.push(
      members.status === "aktiv"
        ? "Alla medlemmar"
        : members.status === "granskas"
          ? "Alla medlemmar (granskas)"
          : "Alla medlemmar (avslagen)",
    );
  }

  const coaches = shares.filter((s) => s.audience === "coach");
  if (shares.some((s) => s.audience === "coacher")) parts.push("Alla coacher");
  else if (coaches.length)
    parts.push(names(coaches.map((s) => s.coachName)) || "Utvalda coacher");
  return parts.join(" · ");
}

/** Vem som står bakom ett pass eller en plan, som den inloggade ser det. */
export type Author = {
  id: string;
  name: string | null;
  company: string | null;
  coachvy: boolean;
};

export function authorLabel(
  author: Author | undefined,
  viewer: { id: string; coachId: string | null },
): string | null {
  if (!author || author.id === viewer.id) return null;
  if (author.id === viewer.coachId) return "Från din coach";
  if (author.coachvy) return "Coachvy";
  return author.name ?? author.company ?? "En coach";
}
