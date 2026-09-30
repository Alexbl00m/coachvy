"use server";

import { revalidatePath } from "next/cache";

import { requireSessionUser } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { phaseLabel, TRAINING_PHASES } from "@/lib/tests/phases";
import type {
  RacePriority,
  RaceSport,
  TrainingBlockRow,
} from "@/lib/types/database";
import { listBlocks } from "./queries";
import { RACE_SPORTS, daysBetween, overlapping, shortDate } from "./season";

export type SeasonResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/** RLS släpper inte igenom raden, eller så är den redan borttagen. */
const NOT_FOUND = "Hittades inte – den kan redan vara borttagen.";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (value: string) =>
  ISO_DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

const trimmed = (value: string | null, max: number) => {
  const text = (value ?? "").trim().slice(0, max);
  return text.length > 0 ? text : null;
};

/** Allt som visar säsongen, så att en ändring syns överallt direkt. */
function revalidateSeason(adeptId: string) {
  revalidatePath(routes.plans);
  revalidatePath(routes.calendar);
  revalidatePath(routes.dashboard);
  revalidatePath(routes.adepts);
  revalidatePath(`${routes.adepts}/${adeptId}`);
}

export type SaveRaceInput = {
  id?: string | null;
  adeptId: string;
  name: string;
  raceDate: string;
  sport: RaceSport | null;
  distance: string | null;
  priority: RacePriority;
  target: string | null;
  note: string | null;
};

/**
 * Sparar en tävling. Både coachen och adepten får: det är atletens kalender.
 * RLS avgör vilken adept.
 */
export async function saveRace(input: SaveRaceInput): Promise<SeasonResult> {
  const user = await requireSessionUser();

  const name = trimmed(input.name, 120);
  if (!name) return { ok: false, error: "Ge tävlingen ett namn." };
  if (!isDate(input.raceDate)) return { ok: false, error: "Välj ett datum." };
  if (!["A", "B", "C"].includes(input.priority)) {
    return { ok: false, error: "Prioriteten är A, B eller C." };
  }
  if (input.sport !== null && !RACE_SPORTS.some((s) => s.key === input.sport)) {
    return { ok: false, error: "Okänd gren." };
  }

  const row = {
    adept_id: input.adeptId,
    name,
    race_date: input.raceDate,
    sport: input.sport,
    distance: trimmed(input.distance, 80),
    priority: input.priority,
    target: trimmed(input.target, 200),
    note: trimmed(input.note, 1000),
  };

  const supabase = await createClient();
  const { data, error } = input.id
    ? await supabase
        .from("adept_races")
        .update(row)
        .eq("id", input.id)
        .eq("adept_id", input.adeptId)
        .select("id")
        .single()
    : await supabase
        .from("adept_races")
        .insert({ ...row, created_by: user.id })
        .select("id")
        .single();

  if (error || !data) {
    return {
      ok: false,
      error:
        error?.code === "PGRST116"
          ? NOT_FOUND
          : `Kunde inte spara tävlingen: ${error?.message ?? "okänt fel"}`,
    };
  }

  revalidateSeason(input.adeptId);
  return { ok: true, id: data.id };
}

export async function deleteRace(
  id: string,
  adeptId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireSessionUser();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("adept_races")
    .delete()
    .eq("id", id)
    .eq("adept_id", adeptId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: NOT_FOUND };

  revalidateSeason(adeptId);
  return { ok: true };
}

export type SaveBlockInput = {
  id?: string | null;
  adeptId: string;
  phase: TrainingBlockRow["phase"];
  startsOn: string;
  endsOn: string;
  focus: string | null;
};

/**
 * Sparar en period i säsongsplanen.
 *
 * Perioder får inte överlappa: en dag ska ligga i en fas, annars går det inte
 * att säga vilken fas ett test togs i. Kollen görs här, mot de perioder som
 * redan finns, och felet säger vilken period som krockar.
 */
export async function saveBlock(input: SaveBlockInput): Promise<SeasonResult> {
  const user = await requireSessionUser();

  if (!TRAINING_PHASES.some((p) => p.key === input.phase)) {
    return { ok: false, error: "Välj en fas." };
  }
  if (!isDate(input.startsOn) || !isDate(input.endsOn)) {
    return { ok: false, error: "Välj start- och slutdatum." };
  }
  const length = daysBetween(input.startsOn, input.endsOn) + 1;
  if (length < 1) {
    return { ok: false, error: "Perioden slutar innan den börjar." };
  }
  if (length > 366) {
    return {
      ok: false,
      error: "En period är längst ett år. Dela upp den i faser.",
    };
  }

  const existing = await listBlocks(input.adeptId);
  const clash = overlapping(existing, {
    id: input.id,
    starts_on: input.startsOn,
    ends_on: input.endsOn,
  });
  if (clash) {
    return {
      ok: false,
      error: `Krockar med ${phaseLabel(clash.phase)?.toLowerCase()} ${shortDate(clash.starts_on)}–${shortDate(clash.ends_on)}. Perioderna får inte överlappa.`,
    };
  }

  const row = {
    adept_id: input.adeptId,
    phase: input.phase,
    starts_on: input.startsOn,
    ends_on: input.endsOn,
    focus: trimmed(input.focus, 300),
  };

  const supabase = await createClient();
  const { data, error } = input.id
    ? await supabase
        .from("training_blocks")
        .update(row)
        .eq("id", input.id)
        .eq("adept_id", input.adeptId)
        .select("id")
        .single()
    : await supabase
        .from("training_blocks")
        .insert({ ...row, created_by: user.id })
        .select("id")
        .single();

  if (error || !data) {
    return {
      ok: false,
      error:
        error?.code === "42501" || error?.code === "PGRST116"
          ? "Säsongsplanen görs av coachen."
          : `Kunde inte spara perioden: ${error?.message ?? "okänt fel"}`,
    };
  }

  revalidateSeason(input.adeptId);
  return { ok: true, id: data.id };
}

export async function deleteBlock(
  id: string,
  adeptId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireSessionUser();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("training_blocks")
    .delete()
    .eq("id", id)
    .eq("adept_id", adeptId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: NOT_FOUND };

  revalidateSeason(adeptId);
  return { ok: true };
}
