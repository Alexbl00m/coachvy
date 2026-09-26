"use server";

import { isMember } from "@/lib/auth/membership";
import { getSessionUser } from "@/lib/auth/session";
import type { AnalysisArgs, SessionAnalysis } from "./analysis";
import { analyseSessionOnServer } from "./metabolic-profile";
import { protocolByKey } from "./protocols";

const locked = (message: string): SessionAnalysis => ({
  metrics: [],
  zones: [],
  zoneUnit: "W",
  warnings: [message],
});

/**
 * Förhandsvisning av ett protokoll som bara räknas på servern.
 *
 * Formuläret anropar den medan coachen skriver. Resultatet skickas tillbaka,
 * beräkningen stannar här. Samma kontroll som när testet sparas: inloggad
 * coach med medlemskap.
 */
export async function previewOnServer(args: AnalysisArgs): Promise<SessionAnalysis> {
  const spec = protocolByKey(args.protocol);
  if (!spec) return locked("Okänt protokoll.");

  const user = await getSessionUser();
  if (user?.profile?.role !== "coach") {
    return locked("Logga in som coach för att räkna ut det här protokollet.");
  }
  if (spec.membersOnly && !isMember(user)) {
    return locked(`${spec.label} ingår i medlemskapet.`);
  }

  // Ett formulär har som mest ett fåtal rader. Allt större är inte ett test.
  if (!Array.isArray(args.efforts) || args.efforts.length > 40) {
    return locked("För många rader.");
  }

  return analyseSessionOnServer(args, { members: isMember(user) });
}
