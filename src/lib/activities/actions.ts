"use server";

import { revalidatePath } from "next/cache";

import { requireSessionUser } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import type { ActivityRow } from "@/lib/types/database";
import type { Reference, Streams, Summary } from "./analysis";
import { DISPLAY_POINTS } from "./analysis";
import { IMPORT_BATCH } from "./prepare";

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
 * Raden som sparas, eller vad som är fel. Analysen görs i webbläsaren; här
 * kontrolleras bara att det som kommer är rimligt.
 */
type ActivityInsert = Omit<
  ActivityRow,
  "id" | "note" | "created_at" | "updated_at"
>;

function rowOf(
  input: SaveActivityInput,
  userId: string,
): { error: string } | { row: ActivityInsert } {
  const name = input.name.trim().slice(0, 120);
  if (!name) return { error: "Ge aktiviteten ett namn." };
  if (!SPORTS.includes(input.sport)) return { error: "Okänd gren." };
  const started = new Date(input.startedAt);
  if (Number.isNaN(started.getTime()))
    return { error: "Filen saknar starttid." };
  if (!validStreams(input.streams)) {
    return { error: "Serien i filen gick inte att spara." };
  }
  const s = input.summary;
  if (
    !s ||
    typeof s.elapsedS !== "number" ||
    JSON.stringify(s).length > 200_000
  ) {
    return { error: "Analysen gick inte att spara." };
  }

  // Dagen i svensk tid – ett morgonlopp klockan ett ska inte hamna på gårdagen.
  const performedOn = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(started);

  return {
    row: {
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
      created_by: userId,
    },
  };
}

/** Sparar en analyserad aktivitet. RLS avgör vilken adept. */
export async function saveActivity(
  input: SaveActivityInput,
): Promise<ActivityResult> {
  const user = await requireSessionUser();
  const built = rowOf(input, user.id);
  if ("error" in built) return { ok: false, error: built.error };
  const started = new Date(built.row.started_at);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .insert(built.row)
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

export type ImportResult = {
  ok: boolean;
  saved: number;
  duplicates: number;
  failed: number;
  error?: string;
};

/**
 * Historikimport: en omgång analyserade pass. Pass som redan finns – samma
 * adept och starttid – hoppas över i databasen, så att samma export går att
 * importera igen utan dubbletter.
 *
 * Bara för adepter som godkänt att hälsouppgifter behandlas: en historik är
 * år av puls och GPS, inte ett enstaka lopp.
 */
export async function importActivities(
  adeptId: string,
  items: SaveActivityInput[],
): Promise<ImportResult> {
  const user = await requireSessionUser();
  const fail = (error: string): ImportResult => ({
    ok: false,
    saved: 0,
    duplicates: 0,
    failed: items.length,
    error,
  });
  if (items.length === 0)
    return { ok: true, saved: 0, duplicates: 0, failed: 0 };
  if (items.length > IMPORT_BATCH) return fail("För många pass i en omgång.");

  const supabase = await createClient();
  const { data: adept } = await supabase
    .from("adepts")
    .select("id, profile_id")
    .eq("id", adeptId)
    .maybeSingle();
  if (!adept) return fail("Adepten hittades inte.");
  if (adept.profile_id !== user.id) {
    const { data: profile } = adept.profile_id
      ? await supabase
          .from("profiles")
          .select("health_consent_at")
          .eq("id", adept.profile_id)
          .maybeSingle()
      : { data: null };
    if (!profile?.health_consent_at) {
      return fail(
        "Historiken kan importeras när adepten har godkänt att hälsouppgifter behandlas.",
      );
    }
  }

  const rows = [];
  let failed = 0;
  for (const item of items) {
    const built = rowOf({ ...item, adeptId, raceId: null, laps: [] }, user.id);
    if ("error" in built) failed += 1;
    else rows.push(built.row);
  }
  if (rows.length === 0) return { ok: true, saved: 0, duplicates: 0, failed };

  const { data, error } = await supabase
    .from("activities")
    .upsert(rows, { onConflict: "adept_id,started_at", ignoreDuplicates: true })
    .select("id");
  if (error) return fail(`Kunde inte spara: ${error.message}`);

  const saved = data?.length ?? 0;
  return { ok: true, saved, duplicates: rows.length - saved, failed };
}

/** Efter en import: listor, kalender och översikt läses om en gång. */
export async function finishImport(adeptId: string): Promise<void> {
  await requireSessionUser();
  revalidateActivity(adeptId);
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
