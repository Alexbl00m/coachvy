"use server";

import { revalidatePath } from "next/cache";

import { requireCoach } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { listBlocks } from "@/lib/season/queries";
import { blockOn, todayIso } from "@/lib/season/season";
import { createClient } from "@/lib/supabase/server";
import type { Effort } from "./analysis";
import { saveTestSession } from "./session-actions";
import type { ZoneSport, ZoneSuggestion } from "./zone-suggestion";
import { zoneSuggestionsFor } from "./zone-suggestion-queries";

type Result = { ok: true; sessionId?: string } | { ok: false; error: string };

const SPORTS: ZoneSport[] = ["cykling", "löpning"];

/** Förslaget som det ser ut i databasen nu, inte som klienten minns det. */
async function currentSuggestion(
  adeptId: string,
  sport: ZoneSport,
): Promise<
  | { ok: true; suggestion: ZoneSuggestion; weightKg: number | null }
  | { ok: false; error: string }
> {
  if (!SPORTS.includes(sport)) return { ok: false, error: "Okänd gren." };
  const { suggestions, weightKg } = await zoneSuggestionsFor(
    adeptId,
    todayIso(),
  );
  const suggestion = suggestions.find((s) => s.sport === sport);
  if (!suggestion) {
    return {
      ok: false,
      error: "Förslaget gäller inte längre – sidan visar det senaste läget.",
    };
  }
  return { ok: true, suggestion, weightKg };
}

/** Insatserna som testets rader, med varje insats eget datum. */
function effortsOf(s: ZoneSuggestion): Effort[] {
  return s.efforts.map((p, ordinal) => ({
    ordinal,
    intensity: s.kind === "power" ? Math.round(p.value) : null,
    durationSeconds: p.span,
    distanceM:
      s.kind === "speed" ? Math.round(p.value * p.span * 10) / 10 : null,
    lactate: null,
    heartRate: null,
    performedOn: p.date,
    comment: `Ur passet ${p.name}`,
  }));
}

/**
 * Coachen godkänner: insatserna sparas som ett CP-test (cykling) eller
 * CS-test (löpning) daterat i dag, och beslutet sparas med testet. Zonerna,
 * passbyggaren och progressionen läser sedan testet som vilket test som helst.
 */
export async function acceptZoneSuggestion(
  adeptId: string,
  sport: ZoneSport,
): Promise<Result> {
  await requireCoach();
  const current = await currentSuggestion(adeptId, sport);
  if (!current.ok) return current;
  const { suggestion: s, weightKg } = current;

  const today = todayIso();
  const phase = blockOn(await listBlocks(adeptId), today)?.phase ?? null;
  const saved = await saveTestSession({
    adeptId,
    protocol: s.kind === "power" ? "critical-power" : "critical-speed",
    sport,
    unit: s.kind === "power" ? "W" : "km/h",
    performedOn: today,
    weightKg,
    trainingPhase: phase,
    notes:
      "Ur träningen: de bästa insatserna på 3–20 minuter de senaste 90 dagarna, godkända av coachen som nytt underlag för zonerna.",
    efforts: effortsOf(s),
  });
  if (!saved.ok) return saved;

  const supabase = await createClient();
  const { error } = await supabase.from("zone_reviews").insert({
    adept_id: adeptId,
    sport,
    decision: "godkänd",
    proposed_critical: s.critical,
    proposed_reserve: s.reserve,
    previous_critical: s.previous,
    session_id: saved.sessionId,
  });
  // Testet är sparat och gäller; beslutet är bara historik.
  if (error) console.error("zone_reviews:", error.message);

  revalidatePath(`${routes.adepts}/${adeptId}`, "layout");
  return { ok: true, sessionId: saved.sessionId };
}

/** Coachen avvisar: förslaget kommer inte tillbaka förrän träningen visar mer. */
export async function dismissZoneSuggestion(
  adeptId: string,
  sport: ZoneSport,
): Promise<Result> {
  await requireCoach();
  const current = await currentSuggestion(adeptId, sport);
  if (!current.ok) return current;
  const { suggestion: s } = current;

  const supabase = await createClient();
  const { error } = await supabase.from("zone_reviews").insert({
    adept_id: adeptId,
    sport,
    decision: "avvisad",
    proposed_critical: s.critical,
    proposed_reserve: s.reserve,
    previous_critical: s.previous,
  });
  if (error) return { ok: false, error: `Kunde inte spara: ${error.message}` };

  revalidatePath(`${routes.adepts}/${adeptId}`, "layout");
  return { ok: true };
}
