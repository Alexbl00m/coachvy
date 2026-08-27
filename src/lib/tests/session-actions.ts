"use server";

import { revalidatePath } from "next/cache";

import { requireCoach } from "@/lib/auth/session";
import type { IntensityUnit, Sport } from "@/lib/calculators/lactate";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { analyseSession, type Effort } from "./analysis";
import { protocolByKey, type ProtocolKey } from "./protocols";

export type SaveSessionInput = {
  adeptId: string;
  protocol: ProtocolKey;
  sport: Sport;
  unit: IntensityUnit;
  performedOn: string;
  weightKg: number | null;
  notes: string | null;
  efforts: Effort[];
};

export type SaveSessionResult =
  | { ok: true; sessionId: string }
  | { ok: false; error: string };

/**
 * Sparar ett testtillfälle: rådatan och de värden den ger.
 *
 * Analysen körs här på servern i stället för att lita på det klienten skickar,
 * så att det som hamnar i databasen alltid stämmer med rådatan bredvid.
 */
export async function saveTestSession(
  input: SaveSessionInput,
): Promise<SaveSessionResult> {
  await requireCoach();

  const spec = protocolByKey(input.protocol);
  if (!spec) return { ok: false, error: "Okänt protokoll." };

  const efforts = input.efforts.filter(
    (e) =>
      e.intensity !== null ||
      e.distanceM !== null ||
      e.durationSeconds !== null ||
      e.lactate !== null,
  );

  if (efforts.length < spec.minEfforts) {
    return {
      ok: false,
      error: `${spec.label} kräver minst ${spec.minEfforts} ${
        spec.shape.lactate ? "steg" : "insatser"
      }.`,
    };
  }

  if (!input.performedOn) return { ok: false, error: "Välj ett datum." };

  const analysis = analyseSession({
    protocol: input.protocol,
    sport: input.sport,
    unit: input.unit,
    efforts,
    weightKg: input.weightKg,
  });

  if (analysis.metrics.length === 0) {
    return {
      ok: false,
      error:
        analysis.warnings[0] ??
        "Testet gick inte att räkna ut. Kontrollera värdena.",
    };
  }

  const supabase = await createClient();

  const { data: session, error: sessionError } = await supabase
    .from("test_sessions")
    .insert({
      adept_id: input.adeptId,
      protocol: input.protocol,
      sport: input.sport,
      intensity_unit: input.unit,
      performed_on: input.performedOn,
      weight_kg: input.weightKg,
      zone_scheme: spec.zoneScheme,
      notes: input.notes,
    })
    .select("id")
    .single();

  if (sessionError || !session) {
    return {
      ok: false,
      error: `Kunde inte spara testtillfället: ${sessionError?.message ?? "okänt fel"}`,
    };
  }

  const { error: effortError } = await supabase.from("test_efforts").insert(
    efforts.map((e, index) => ({
      session_id: session.id,
      ordinal: e.ordinal ?? index,
      intensity: e.intensity,
      duration_seconds: e.durationSeconds,
      distance_m: e.distanceM,
      lactate: e.lactate,
      heart_rate: e.heartRate,
    })),
  );

  if (effortError) {
    // Utan rådatan är tillfället värdelöst – då är det bättre att inte finnas.
    await supabase.from("test_sessions").delete().eq("id", session.id);
    return { ok: false, error: `Kunde inte spara stegen: ${effortError.message}` };
  }

  const { error: metricError } = await supabase.from("test_metrics").insert(
    analysis.metrics.map((m) => ({
      session_id: session.id,
      key: m.key,
      value: m.value,
      unit: m.unit,
      method: m.method ?? null,
      is_primary: m.isPrimary,
    })),
  );

  if (metricError) {
    await supabase.from("test_sessions").delete().eq("id", session.id);
    return { ok: false, error: `Kunde inte spara värdena: ${metricError.message}` };
  }

  revalidatePath(`${routes.adepts}/${input.adeptId}`);
  return { ok: true, sessionId: session.id };
}

export async function deleteTestSession(
  sessionId: string,
  adeptId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireCoach();

  const supabase = await createClient();
  const { error } = await supabase
    .from("test_sessions")
    .delete()
    .eq("id", sessionId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`${routes.adepts}/${adeptId}`);
  return { ok: true };
}
