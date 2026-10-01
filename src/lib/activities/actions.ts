"use server";

import { revalidatePath } from "next/cache";

import { requireSessionUser } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import type { ActivityRow } from "@/lib/types/database";
import type { Reference, Streams, Summary } from "./analysis";
import { DISPLAY_POINTS } from "./analysis";

export type SaveActivityInput = {
  adeptId: string;
  name: string;
  sport: "cykling" | "löpning" | "simning" | "annat";
  startedAt: string;
  device: string | null;
  raceId: string | null;
  summary: Summary;
  reference: Reference;
  streams: Streams;
  laps: unknown[];
};

export type ActivityResult =
  | { ok: true; id: string }
  | { ok: false; error: string; existingId?: string };

const SPORTS = ["cykling", "löpning", "simning", "annat"];

/** Serien ska vara lika långa listor av tal eller null, och inte för många. */
function validStreams(streams: Streams): boolean {
  const n = streams?.t?.length ?? 0;
  if (n === 0 || n > DISPLAY_POINTS + 10) return false;
  const lists: unknown[][] = [
    streams.t,
    streams.km,
    streams.lat,
    streams.lon,
    streams.alt,
    streams.power,
    streams.hr,
    streams.speed,
    streams.cadence,
    ...(streams.balance ? [streams.balance] : []),
  ];
  return lists.every(
    (list) =>
      Array.isArray(list) &&
      list.length === n &&
      list.every(
        (v) => v === null || (typeof v === "number" && Number.isFinite(v)),
      ),
  );
}

function revalidateActivity(adeptId: string) {
  revalidatePath(`${routes.adepts}/${adeptId}`);
  revalidatePath(routes.calendar);
  revalidatePath(routes.plans);
  revalidatePath(routes.dashboard);
}

/**
 * Sparar en analyserad aktivitet. Analysen görs i webbläsaren; här kontrolleras
 * bara att det som kommer är rimligt, och RLS avgör vilken adept.
 */
export async function saveActivity(
  input: SaveActivityInput,
): Promise<ActivityResult> {
  const user = await requireSessionUser();

  const name = input.name.trim().slice(0, 120);
  if (!name) return { ok: false, error: "Ge aktiviteten ett namn." };
  if (!SPORTS.includes(input.sport)) return { ok: false, error: "Okänd gren." };
  const started = new Date(input.startedAt);
  if (Number.isNaN(started.getTime()))
    return { ok: false, error: "Filen saknar starttid." };
  if (!validStreams(input.streams)) {
    return { ok: false, error: "Serien i filen gick inte att spara." };
  }
  const s = input.summary;
  if (
    !s ||
    typeof s.elapsedS !== "number" ||
    JSON.stringify(s).length > 200_000
  ) {
    return { ok: false, error: "Analysen gick inte att spara." };
  }

  // Dagen i svensk tid – ett morgonlopp klockan ett ska inte hamna på gårdagen.
  const performedOn = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(started);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .insert({
      adept_id: input.adeptId,
      race_id: input.raceId,
      name,
      sport: input.sport,
      started_at: started.toISOString(),
      performed_on: performedOn,
      device: input.device?.slice(0, 120) ?? null,
      duration_s: s.elapsedS,
      moving_s: s.movingS,
      distance_m: s.distanceM,
      ascent_m: s.ascentM,
      summary: s,
      reference: input.reference,
      streams: input.streams,
      laps: Array.isArray(input.laps) ? input.laps.slice(0, 200) : null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error?.code === "23505") {
    const { data: existing } = await supabase
      .from("activities")
      .select("id")
      .eq("adept_id", input.adeptId)
      .eq("started_at", started.toISOString())
      .maybeSingle();
    return {
      ok: false,
      error: "Den här filen är redan uppladdad.",
      existingId: existing?.id,
    };
  }
  if (error || !data) {
    return {
      ok: false,
      error:
        error?.code === "PGRST205" || error?.code === "42P01"
          ? "Aktiviteter kräver att databasen uppdaterats – kör migrationen för aktiviteter."
          : `Kunde inte spara: ${error?.message ?? "okänt fel"}`,
    };
  }

  revalidateActivity(input.adeptId);
  return { ok: true, id: data.id };
}

/** Byter namn, anteckning eller kopplat lopp. */
export async function updateActivity(
  id: string,
  adeptId: string,
  changes: { name?: string; note?: string | null; raceId?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  await requireSessionUser();
  const patch: Partial<Pick<ActivityRow, "name" | "note" | "race_id">> = {};
  if (changes.name !== undefined) {
    const name = changes.name.trim().slice(0, 120);
    if (!name) return { ok: false, error: "Ge aktiviteten ett namn." };
    patch.name = name;
  }
  if (changes.note !== undefined)
    patch.note = changes.note?.trim().slice(0, 2000) || null;
  if (changes.raceId !== undefined) patch.race_id = changes.raceId;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .update(patch)
    .eq("id", id)
    .eq("adept_id", adeptId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0)
    return { ok: false, error: "Aktiviteten hittades inte." };

  revalidateActivity(adeptId);
  revalidatePath(`${routes.adepts}/${adeptId}/aktivitet/${id}`);
  return { ok: true };
}

export async function deleteActivity(
  id: string,
  adeptId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireSessionUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .delete()
    .eq("id", id)
    .eq("adept_id", adeptId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0)
    return { ok: false, error: "Aktiviteten hittades inte." };
  revalidateActivity(adeptId);
  return { ok: true };
}
