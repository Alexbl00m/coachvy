"use server";

import { revalidatePath } from "next/cache";

import { requireCoach } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import type { BikeFitRow } from "@/lib/types/database";
import type { BikeFitAnalysis } from "./fit";
import {
  cleanBody,
  cleanFindings,
  cleanIntake,
  cleanScreening,
  type ScreeningValue,
} from "./protocol";
import { BUCKET } from "./storage";
import {
  DISCIPLINES,
  TEMPLATES,
  type Bands,
  type Discipline,
} from "./templates";

export type FitInput = {
  id?: string;
  adeptId: string;
  performedOn: string;
  discipline: Discipline;
  bike: string;
  method: "video" | "manuell";
  angles: BikeFitRow["angles"];
  anglesAt: "före" | "efter";
  bands: Bands;
  legs: BikeFitRow["legs"];
  /** Efter fiten. */
  measures: Record<string, string | number | null>;
  /** När adepten kom. */
  measuresBefore: Record<string, string | number | null>;
  body: Record<string, number>;
  intake: Record<string, string>;
  screening: Record<string, ScreeningValue>;
  findings: Record<string, string>;
  analysis: BikeFitAnalysis | null;
  checklist: Record<string, boolean>;
  notes: string;
  changes: string;
};

export type FitResult = { ok: true; id: string } | { ok: false; error: string };

const ANGLE_KEYS = ["knee", "trunk", "elbow", "shoulder", "hip"] as const;
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

function cleanBands(bands: Bands): Bands | null {
  const out = {} as Bands;
  for (const key of ["knee", "trunk", "elbow"] as const) {
    const b = bands[key];
    if (!b || !finite(b.min) || !finite(b.max) || b.min >= b.max) return null;
    if (b.min < 0 || b.max > 180) return null;
    out[key] = { min: b.min, max: b.max };
  }
  return out;
}

const revalidateFits = (adeptId: string) => {
  revalidatePath(`${routes.adepts}/${adeptId}`, "layout");
};

/** Sparar en ny fit eller ändrar en befintlig. */
export async function saveFit(input: FitInput): Promise<FitResult> {
  await requireCoach();
  if (!DISCIPLINES.includes(input.discipline))
    return { ok: false, error: "Välj gren." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.performedOn))
    return { ok: false, error: "Välj ett datum." };
  if (input.method !== "video" && input.method !== "manuell")
    return { ok: false, error: "Okänt sätt att mäta." };
  const bands = cleanBands(input.bands);
  if (!bands)
    return {
      ok: false,
      error:
        "Målbanden behöver ett lägsta och ett högsta värde, i den ordningen.",
    };

  const angles: BikeFitRow["angles"] = {};
  for (const key of ANGLE_KEYS) {
    const v = input.angles[key];
    if (v === null || v === undefined) continue;
    if (!finite(v) || v < 0 || v > 180)
      return { ok: false, error: "En vinkel ligger utanför 0–180°." };
    angles[key] = Math.round(v * 10) / 10;
  }
  if (input.method === "manuell" && angles.knee === undefined) {
    return {
      ok: false,
      error: "Fyll i knäböjningen i nedre dödläget – den bär hela bedömningen.",
    };
  }

  const legs: BikeFitRow["legs"] = {};
  for (const key of ["thighMm", "shankMm"] as const) {
    const v = input.legs[key];
    if (v === null || v === undefined) continue;
    if (!finite(v) || v < 200 || v > 700)
      return {
        ok: false,
        error: "Benlängderna ska vara mellan 200 och 700 mm.",
      };
    legs[key] = Math.round(v);
  }
  if (input.legs.source) legs.source = input.legs.source;

  // Bara mallens mått, så att fältet inte blir en soptunna.
  const known = new Set(TEMPLATES[input.discipline].measures.map((m) => m.key));
  const cleanMeasures = (raw: FitInput["measures"]) => {
    const out: Record<string, string | number | null> = {};
    for (const [key, v] of Object.entries(raw ?? {})) {
      if (!known.has(key) || v === null || v === "") continue;
      if (typeof v === "number") {
        if (!Number.isFinite(v) || Math.abs(v) > 5000) return null;
        out[key] = v;
      } else out[key] = String(v).trim().slice(0, 120);
    }
    return out;
  };
  const measures = cleanMeasures(input.measures);
  const measuresBefore = cleanMeasures(input.measuresBefore);
  if (!measures || !measuresBefore)
    return { ok: false, error: "Ett cykelmått går inte att läsa." };
  const body = cleanBody(input.body ?? {});
  if (!body.ok) return body;
  const checklist: Record<string, boolean> = {};
  for (const [key, v] of Object.entries(input.checklist))
    if (v === true) checklist[key.slice(0, 200)] = true;

  const row = {
    adept_id: input.adeptId,
    performed_on: input.performedOn,
    discipline: input.discipline,
    bike: input.bike.trim().slice(0, 120) || null,
    method: input.method,
    angles,
    angles_at:
      input.anglesAt === "före" ? ("före" as const) : ("efter" as const),
    bands,
    legs,
    measures,
    measures_before: measuresBefore,
    body: body.body,
    intake: cleanIntake(input.intake ?? {}),
    screening: cleanScreening(input.screening ?? {}),
    findings: cleanFindings(input.findings ?? {}),
    analysis: input.method === "video" ? input.analysis : null,
    checklist,
    notes: input.notes.trim().slice(0, 4000) || null,
    changes: input.changes.trim().slice(0, 2000) || null,
  };

  const supabase = await createClient();
  const query = input.id
    ? supabase.from("bike_fits").update(row).eq("id", input.id)
    : supabase.from("bike_fits").insert(row);
  const { data, error } = await query.select("id").single();
  if (error || !data)
    return {
      ok: false,
      error: `Kunde inte spara: ${error?.message ?? "okänt fel"}`,
    };
  revalidateFits(input.adeptId);
  return { ok: true, id: data.id };
}

/** Kopplar uppladdade filer till fiten, när de ligger i dess mapp. */
export async function attachFitMedia(input: {
  fitId: string;
  adeptId: string;
  videoPath: string | null;
  framePath: string | null;
}): Promise<FitResult> {
  await requireCoach();
  const prefix = `${input.adeptId}/${input.fitId}/`;
  for (const p of [input.videoPath, input.framePath])
    if (p && !p.startsWith(prefix))
      return { ok: false, error: "Filen ligger inte i fitens mapp." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bike_fits")
    .update({ video_path: input.videoPath, frame_path: input.framePath })
    .eq("id", input.fitId)
    .select("id")
    .single();
  if (error || !data)
    return { ok: false, error: "Kunde inte koppla filerna till fiten." };
  revalidateFits(input.adeptId);
  return { ok: true, id: data.id };
}

/** Delar fiten med adepten, eller slutar dela den. */
export async function shareFit(id: string, share: boolean): Promise<FitResult> {
  await requireCoach();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bike_fits")
    .update({ shared_at: share ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id, adept_id")
    .single();
  if (error || !data) return { ok: false, error: "Kunde inte spara." };
  revalidateFits(data.adept_id);
  return { ok: true, id: data.id };
}

/** Tar bort fiten och dess filer. */
export async function deleteFit(id: string): Promise<FitResult> {
  await requireCoach();
  const supabase = await createClient();
  const { data: fit } = await supabase
    .from("bike_fits")
    .select("id, adept_id, video_path, frame_path")
    .eq("id", id)
    .maybeSingle();
  if (!fit) return { ok: false, error: "Fiten hittades inte." };
  const files = [fit.video_path, fit.frame_path].filter((p): p is string =>
    Boolean(p),
  );
  if (files.length > 0) await supabase.storage.from(BUCKET).remove(files);
  const { error } = await supabase.from("bike_fits").delete().eq("id", id);
  if (error)
    return { ok: false, error: `Kunde inte ta bort: ${error.message}` };
  revalidateFits(fit.adept_id);
  return { ok: true, id };
}
