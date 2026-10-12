"use server";

import { revalidatePath } from "next/cache";

import { requireSessionUser } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import type { ActivityRow } from "@/lib/types/database";
import type { Reference, Streams, Summary } from "./analysis";
import { DISPLAY_POINTS } from "./analysis";
import {
  isUnsplitCopy,
  sameSession,
  type MultisportSummary,
} from "./multisport";
import { IMPORT_BATCH } from "./prepare";

export type SaveActivityInput = {
  adeptId: string;
  name: string;
  sport: "cykling" | "löpning" | "simning" | "annat";
  startedAt: string;
  device: string | null;
  raceId: string | null;
  /** En tävling, också utan en planerad att koppla till. */
  isRace?: boolean;
  summary: Summary;
  reference: Reference;
  streams: Streams;
  laps: unknown[];
  /** En gren i ett multisportlopp. */
  multisport?: MultisportSummary | null;
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

const KINDS = ["triathlon", "duathlon", "multisport"];

/** Multisportsammanfattningen som den sparas, eller null om den inte håller. */
function cleanMultisport(raw: unknown): MultisportSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Partial<MultisportSummary>;
  if (typeof m.id !== "string" || !/^[0-9a-f-]{36}$/i.test(m.id)) return null;
  if (!KINDS.includes(m.kind as string)) return null;
  if (!Array.isArray(m.parts) || m.parts.length < 2 || m.parts.length > 15)
    return null;
  const parts: MultisportSummary["parts"] = [];
  for (const p of m.parts) {
    const t = Date.parse(String(p?.startedAt));
    const seconds = Number(p?.seconds);
    if (Number.isNaN(t) || !Number.isFinite(seconds) || seconds < 0)
      return null;
    const transition = p.kind === "växling";
    parts.push({
      kind: transition ? "växling" : "gren",
      sport: transition
        ? null
        : SPORTS.includes(p.sport as string)
          ? (p.sport as MultisportSummary["parts"][number]["sport"])
          : "annat",
      startedAt: new Date(t).toISOString(),
      seconds,
      distanceM:
        typeof p.distanceM === "number" && Number.isFinite(p.distanceM)
          ? p.distanceM
          : null,
    });
  }
  return {
    id: m.id.toLowerCase(),
    kind: m.kind as MultisportSummary["kind"],
    leg: Math.max(0, Math.min(14, Math.round(Number(m.leg) || 0))),
    parts,
    totalS: parts.reduce((sum, p) => sum + p.seconds, 0),
    distanceM: parts.reduce((sum, p) => sum + (p.distanceM ?? 0), 0),
  };
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
      // En kopplad tävling är alltid en tävling.
      is_race: Boolean(input.isRace) || input.raceId !== null,
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
      multisport: cleanMultisport(input.multisport),
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

  // Samma gren som i ett redan uppladdat triathlon – cykeldatorns fil efter
  // klockans. Har den nya effekt och grenen inte, tar den grenens plats.
  const legs = await legsAround(supabase, input.adeptId, [built.row]);
  const leg = matchingLeg(legs, built.row);
  if (leg) {
    if (!betterThan(built.row, leg)) {
      return {
        ok: false,
        error: "Grenen finns redan i ett uppladdat multisportlopp.",
        existingId: leg.id,
      };
    }
    const replaced = await replaceLeg(supabase, leg, built.row);
    if (!replaced.ok) return replaced;
    revalidateActivity(input.adeptId);
    return { ok: true, id: leg.id };
  }

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


type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Det som behövs av en befintlig aktivitet för att jämföra den med en ny. */
type Existing = {
  id: string;
  sport: string;
  started_at: string;
  duration_s: number | null;
  name: string;
  race_id: string | null;
  is_race: boolean;
  note: string | null;
  multisport: MultisportSummary | null;
  avg_power: number | null;
};

const EXISTING_COLUMNS =
  "id, sport, started_at, duration_s, name, race_id, is_race, note, multisport, avg_power:summary->avgPower";

/** Namnet en uppladdning får om ingen ändrar det. */
const DEFAULT_NAME = /^(Cykelpass|Löppass|Simpass|Pass) \d{4}-\d{2}-\d{2}$/;

const spanOf = (r: { started_at: string; duration_s: number | null }) => ({
  startedAt: r.started_at,
  seconds: Number(r.duration_s ?? 0),
});

/** Aktiviteterna kring några rader, från tolv timmar före till ett dygn efter. */
async function existingAround(
  supabase: Supabase,
  adeptId: string,
  rows: { started_at: string }[],
  legsOnly = false,
): Promise<Existing[]> {
  const times = rows.map((r) => Date.parse(r.started_at));
  const from = new Date(Math.min(...times) - 12 * 3600_000).toISOString();
  const to = new Date(Math.max(...times) + 24 * 3600_000).toISOString();
  let query = supabase
    .from("activities")
    .select(EXISTING_COLUMNS)
    .eq("adept_id", adeptId)
    .gte("started_at", from)
    .lte("started_at", to);
  if (legsOnly) query = query.not("multisport", "is", null);
  const { data } = await query;
  return ((data ?? []) as unknown as Existing[]).map((e) => ({
    ...e,
    duration_s: e.duration_s === null ? null : Number(e.duration_s),
    avg_power: typeof e.avg_power === "number" ? e.avg_power : null,
  }));
}

const legsAround = (supabase: Supabase, adeptId: string, rows: ActivityInsert[]) =>
  existingAround(supabase, adeptId, rows, true);

/** En multisportgren i samma gren och tid som raden. */
const matchingLeg = (legs: Existing[], row: ActivityInsert) =>
  legs.find(
    (l) =>
      l.multisport &&
      l.sport === row.sport &&
      sameSession(spanOf(l), spanOf(row)),
  ) ?? null;

/** Den nya inspelningen är bättre: den har effekt, den gamla inte. */
const betterThan = (row: ActivityInsert, existing: Existing) =>
  row.summary?.avgPower != null && existing.avg_power === null;

/**
 * En gren får en bättre inspelning – cykeldatorns i stället för klockans.
 * Grenens plats i loppet, namnet och kopplingen till tävlingen står kvar.
 */
async function replaceLeg(
  supabase: Supabase,
  leg: Existing,
  row: ActivityInsert,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from("activities")
    .update({
      started_at: row.started_at,
      performed_on: row.performed_on,
      device: row.device,
      duration_s: row.duration_s,
      moving_s: row.moving_s,
      distance_m: row.distance_m,
      ascent_m: row.ascent_m,
      summary: row.summary,
      reference: row.reference,
      streams: row.streams,
      laps: row.laps,
    })
    .eq("id", leg.id);
  return error
    ? { ok: false, error: `Kunde inte spara: ${error.message}` }
    : { ok: true };
}

export type MultisportResult =
  | {
      ok: true;
      /** Första grenen, att visa. */
      id: string;
      saved: number;
      /** Pass som redan fanns och blev en gren – cykeldatorns. */
      linked: number;
      /** En tidigare import av hela filen som ett pass, som ersattes. */
      replaced: boolean;
    }
  | { ok: false; error: string; existingId?: string };

/**
 * Sparar grenarna i ett multisportlopp.
 *
 * - En tidigare import av hela filen som ett enda pass tas bort, och dess
 *   tävling och anteckning följer med till grenarna.
 * - Ett pass som redan finns i samma gren och tid – cykeldatorns – blir
 *   grenen i stället för klockans inspelning, om det inte saknar effekt när
 *   klockans har det.
 * - En gren som redan är sparad hoppas över.
 */
async function storeMultisport(
  supabase: Supabase,
  adeptId: string,
  rows: ActivityInsert[],
): Promise<MultisportResult> {
  const summary = rows[0]?.multisport;
  if (!summary || rows.some((r) => r.multisport?.id !== summary.id)) {
    return { ok: false, error: "Grenarna hör inte till samma lopp." };
  }
  const existing = await existingAround(supabase, adeptId, rows);

  const unsplit = existing.find((e) =>
    isUnsplitCopy(
      { startedAt: e.started_at, seconds: e.duration_s, multisport: e.multisport },
      summary,
    ),
  );
  if (unsplit) {
    const { error } = await supabase
      .from("activities")
      .delete()
      .eq("id", unsplit.id);
    if (error) return { ok: false, error: `Kunde inte ersätta: ${error.message}` };
  }
  const others = existing.filter((e) => e.id !== unsplit?.id);
  const carry = (row: ActivityInsert): ActivityInsert =>
    unsplit && !row.race_id && !row.is_race
      ? { ...row, race_id: unsplit.race_id, is_race: unsplit.is_race }
      : row;

  let firstId: string | null = null;
  let saved = 0;
  let linked = 0;
  for (const raw of rows) {
    const row = carry(raw);
    const legSpan = spanOf(row);
    const sameStart = others.find(
      (e) => Math.abs(Date.parse(e.started_at) - Date.parse(row.started_at)) < 1000,
    );
    if (sameStart?.multisport) {
      firstId ??= sameStart.id;
      continue;
    }
    const twin =
      sameStart ??
      others.find(
        (e) =>
          !e.multisport && e.sport === row.sport && sameSession(spanOf(e), legSpan),
      );
    if (twin) {
      // Ett pass som redan finns blir grenen. Har klockans inspelning effekt
      // och det befintliga inte, tar klockans dess plats.
      const patch: Partial<ActivityInsert> = {
        multisport: row.multisport,
        // Ett standardnamn ("Cykelpass 2026-08-22") blir grenens namn; ett
        // eget namn står kvar.
        ...(DEFAULT_NAME.test(twin.name) ? { name: row.name } : {}),
        ...(twin.race_id || twin.is_race
          ? {}
          : { race_id: row.race_id, is_race: row.is_race }),
      };
      if (betterThan(row, twin)) {
        const replaced = await replaceLeg(supabase, twin, row);
        if (!replaced.ok) return replaced;
      }
      const { error } = await supabase
        .from("activities")
        .update(patch)
        .eq("id", twin.id);
      if (error) return { ok: false, error: `Kunde inte koppla: ${error.message}` };
      linked += 1;
      firstId ??= twin.id;
      continue;
    }
    const { data, error } = await supabase
      .from("activities")
      .insert(row)
      .select("id")
      .single();
    if (error?.code === "23505") continue;
    if (error || !data) {
      return { ok: false, error: `Kunde inte spara: ${error?.message ?? "okänt fel"}` };
    }
    saved += 1;
    firstId ??= data.id;
  }

  if (saved === 0 && linked === 0 && !unsplit) {
    return {
      ok: false,
      error: "Det här loppet är redan uppladdat.",
      existingId: firstId ?? undefined,
    };
  }
  return { ok: true, id: firstId!, saved, linked, replaced: Boolean(unsplit) };
}

/** Sparar ett multisportlopp ur en fil: en aktivitet per gren. */
export async function saveMultisport(
  adeptId: string,
  legs: SaveActivityInput[],
): Promise<MultisportResult> {
  const user = await requireSessionUser();
  if (legs.length < 2 || legs.length > 10)
    return { ok: false, error: "Loppet ska ha två till tio grenar." };
  const rows: ActivityInsert[] = [];
  for (const leg of legs) {
    const built = rowOf({ ...leg, adeptId }, user.id);
    if ("error" in built) return { ok: false, error: built.error };
    if (!built.row.multisport)
      return { ok: false, error: "Grenen saknar loppets sammanfattning." };
    rows.push(built.row);
  }
  const supabase = await createClient();
  const result = await storeMultisport(supabase, adeptId, rows);
  if (result.ok) revalidateActivity(adeptId);
  return result;
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

  let rows: ActivityInsert[] = [];
  const groups = new Map<string, ActivityInsert[]>();
  let failed = 0;
  for (const item of items) {
    const built = rowOf({ ...item, adeptId, raceId: null, laps: [] }, user.id);
    if ("error" in built) failed += 1;
    else if (built.row.multisport) {
      const id = built.row.multisport.id;
      groups.set(id, [...(groups.get(id) ?? []), built.row]);
    } else rows.push(built.row);
  }

  // Multisportloppen grenvis, med samma regler som en enstaka uppladdning.
  let saved = 0;
  let duplicates = 0;
  for (const legs of groups.values()) {
    const result = await storeMultisport(supabase, adeptId, legs);
    if (result.ok) saved += result.saved + result.linked;
    else if (result.existingId) duplicates += legs.length;
    else failed += legs.length;
  }

  // Enstaka pass som är en gren i ett redan sparat lopp: cykeldatorns fil
  // ersätter klockans gren när den har effekt, annars är den en dubblett.
  if (rows.length > 0) {
    const legs = await legsAround(supabase, adeptId, rows);
    const rest: ActivityInsert[] = [];
    for (const row of rows) {
      const leg = matchingLeg(legs, row);
      if (!leg) rest.push(row);
      else if (betterThan(row, leg)) {
        const replaced = await replaceLeg(supabase, leg, row);
        if (replaced.ok) saved += 1;
        else failed += 1;
      } else duplicates += 1;
    }
    rows = rest;
  }
  if (rows.length === 0) return { ok: true, saved, duplicates, failed };

  const { data, error } = await supabase
    .from("activities")
    .upsert(rows, { onConflict: "adept_id,started_at", ignoreDuplicates: true })
    .select("id");
  if (error) return fail(`Kunde inte spara: ${error.message}`);

  const inserted = data?.length ?? 0;
  return {
    ok: true,
    saved: saved + inserted,
    duplicates: duplicates + rows.length - inserted,
    failed,
  };
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
  changes: {
    name?: string;
    note?: string | null;
    raceId?: string | null;
    isRace?: boolean;
  },
): Promise<{ ok: boolean; error?: string }> {
  await requireSessionUser();
  const patch: Partial<
    Pick<ActivityRow, "name" | "note" | "race_id" | "is_race">
  > = {};
  if (changes.name !== undefined) {
    const name = changes.name.trim().slice(0, 120);
    if (!name) return { ok: false, error: "Ge aktiviteten ett namn." };
    patch.name = name;
  }
  if (changes.note !== undefined)
    patch.note = changes.note?.trim().slice(0, 2000) || null;
  if (changes.raceId !== undefined) patch.race_id = changes.raceId;
  if (changes.isRace !== undefined) patch.is_race = changes.isRace;
  // En kopplad tävling är alltid en tävling, och ett träningspass hör inte
  // till någon planerad.
  if (patch.race_id) patch.is_race = true;
  if (patch.is_race === false) patch.race_id = null;

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
