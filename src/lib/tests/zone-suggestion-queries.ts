import { listActivities } from "@/lib/activities/queries";
import { candidatesFrom, pickReference } from "@/lib/activities/reference";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { protocolByKey } from "./protocols";
import { listSessions } from "./session-queries";
import {
  suggestZones,
  type ZoneReview,
  type ZoneSport,
  type ZoneSuggestion,
} from "./zone-suggestion";

/** Coachens tidigare beslut om zonförslag, nyast först. */
export async function listZoneReviews(adeptId: string): Promise<ZoneReview[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("zone_reviews")
    .select("sport, decision, proposed_critical, created_at")
    .eq("adept_id", adeptId)
    .order("created_at", { ascending: false });
  // Migrationen är inte körd: inga beslut, men förslagen syns ändå.
  if (error) return [];
  return (data ?? []).map((r) => ({
    ...r,
    proposed_critical: Number(r.proposed_critical),
  }));
}

export type ZoneSuggestionContext = {
  suggestions: ZoneSuggestion[];
  /** Senaste vikten ur testerna, så att CP per kg och VO2max räknas. */
  weightKg: number | null;
};

/**
 * Förslagen för cykling och löpning ur adeptens pass, tester och tidigare
 * beslut. Räknas här på servern både när kortet visas och när coachen
 * godkänner, så att det som sparas är det som räknades ur databasen.
 */
export async function zoneSuggestionsFor(
  adeptId: string,
  today: string,
): Promise<ZoneSuggestionContext> {
  const [activities, sessions, reviews] = await Promise.all([
    listActivities(adeptId),
    listSessions(adeptId),
    listZoneReviews(adeptId),
  ]);
  const candidates = candidatesFrom(
    sessions,
    (key) => protocolByKey(key)?.label ?? key,
  );
  const sources = activities.map((a) => ({
    id: a.id,
    name: a.name,
    sport: a.sport,
    performed_on: a.performed_on,
    curve: a.curve,
    best: null,
  }));
  const suggestions = (["cykling", "löpning"] as ZoneSport[]).flatMap(
    (sport) => {
      const ref = pickReference(candidates, today, sport);
      const previous = sport === "cykling" ? ref.cp : ref.cs;
      const s = suggestZones({
        sport,
        sources,
        today,
        previous,
        testedOn: ref.testedOn,
        reviews,
      });
      return s ? [s] : [];
    },
  );
  const weighed = sessions.find((s) => s.weight_kg !== null && s.weight_kg > 0);
  return {
    suggestions,
    weightKg: weighed ? Number(weighed.weight_kg) : null,
  };
}
