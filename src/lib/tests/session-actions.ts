"use server";

import { revalidatePath } from "next/cache";

import { isMember } from "@/lib/auth/membership";
import {
  requireCoach,
  requireSessionUser,
  type SessionUser,
} from "@/lib/auth/session";
import type { IntensityUnit, Sport } from "@/lib/calculators/lactate";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import type { Effort, TestFinish } from "./analysis";
import { analyseSessionOnServer } from "./metabolic-profile";
import { protocolByKey, type ProtocolKey } from "./protocols";

export type SaveSessionInput = {
  adeptId: string;
  protocol: ProtocolKey;
  sport: Sport;
  unit: IntensityUnit;
  performedOn: string;
  weightKg: number | null;
  /** Kroppsfett och kön – bara för protokoll som räknar per fettfri massa. */
  bodyFatPct?: number | null;
  sex?: "man" | "kvinna" | null;
  /** Slutet på ett stegtest: Vmax/Wmax, uppmätt VO2max, maxlaktat, maxpuls. */
  finish?: TestFinish | null;
  /** Perioden testet togs i. Gör progressionskurvan läsbar. */
  trainingPhase: string | null;
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
/**
 * Vem får registrera tester på en adept: coachen, eller adepten själv om hen
 * är medlem. Vilka adepter en coach äger avgör databasen.
 */
async function requireTestAuthor(
  adeptId: string,
): Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }> {
  const user = await requireSessionUser();
  if (user.profile?.role === "coach") return { ok: true, user };
  if (user.profile?.role === "adept" && isMember(user) && user.adept?.id === adeptId) {
    return { ok: true, user };
  }
  return {
    ok: false,
    error:
      user.profile?.role === "adept"
        ? "Att registrera egna tester ingår i medlemskapet."
        : "Bara coachen kan registrera tester här.",
  };
}

type Prepared = {
  ok: true;
  spec: NonNullable<ReturnType<typeof protocolByKey>>;
  efforts: Effort[];
  bodyFatPct: number | null;
  sex: "man" | "kvinna" | null;
  finish: TestFinish | null;
  analysis: ReturnType<typeof analyseSessionOnServer>;
};

/**
 * Kontrollerar ett testtillfälle och räknar ut det. Delas av Spara och Ändra,
 * så att ett ändrat test går igenom samma kontroller som ett nytt.
 */
function prepareSession(
  input: SaveSessionInput,
  user: SessionUser,
): Prepared | { ok: false; error: string } {
  const spec = protocolByKey(input.protocol);
  if (!spec) return { ok: false as const, error: "Okänt protokoll." };
  if (spec.membersOnly && !isMember(user)) {
    return { ok: false as const, error: `${spec.label} ingår i medlemskapet.` };
  }

  // En rad med bara en längd är en förifylld mall, ingen insats. I protokoll
  // med fasta rader räcker pulsen: vilan i LSCT har ingen belastning.
  const efforts = input.efforts.filter(
    (e) =>
      e.intensity !== null ||
      e.distanceM !== null ||
      e.lactate !== null ||
      (Boolean(spec.rowLabels) && e.heartRate !== null),
  );
  if (
    efforts.some(
      (e) =>
        e.rpe !== null &&
        e.rpe !== undefined &&
        !(Number.isInteger(e.rpe) && e.rpe >= 1 && e.rpe <= 20),
    )
  ) {
    return { ok: false as const, error: "RPE anges som ett heltal, 1–10." };
  }

  if (efforts.length < spec.minEfforts) {
    return {
      ok: false,
      error: `${spec.label} kräver minst ${spec.minEfforts} ${
        spec.shape.lactate ? "steg" : "insatser"
      }.`,
    };
  }

  if (!input.performedOn) return { ok: false as const, error: "Välj ett datum." };
  const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
  if (efforts.some((e) => e.performedOn && !isDate(e.performedOn))) {
    return { ok: false as const, error: "Ett av insatsernas datum går inte att läsa." };
  }

  // Sparas bara där de används; ett CP-test ska inte bära ett kroppsfett som
  // ingen beräkning läst.
  const bodyFatPct = spec.needsBodyComposition ? (input.bodyFatPct ?? null) : null;
  const sex = spec.needsBodyComposition ? (input.sex ?? null) : null;
  if (bodyFatPct !== null && !(bodyFatPct > 0 && bodyFatPct < 60)) {
    return { ok: false as const, error: "Kroppsfettet ska vara en procentsats mellan 0 och 60." };
  }
  if (sex !== null && sex !== "man" && sex !== "kvinna") {
    return { ok: false as const, error: "Okänt kön." };
  }

  const finish = spec.hasFinish ? (input.finish ?? null) : null;
  if (finish) {
    const checks: [number | null, number, number, string][] = [
      [finish.peakIntensity, 0, 5000, "Toppen"],
      [finish.vo2max, 10, 100, "VO2max"],
      [finish.peakLactate, 0, 40, "Maxlaktatet"],
      [finish.peakHeartRate, 60, 250, "Maxpulsen"],
    ];
    for (const [value, min, max, label] of checks) {
      if (value !== null && !(value > min && value < max)) {
        return { ok: false as const, error: `${label} ligger utanför ett rimligt spann.` };
      }
    }
  }

  const analysis = analyseSessionOnServer({
    protocol: input.protocol,
    sport: input.sport,
    unit: input.unit,
    efforts,
    weightKg: input.weightKg,
    bodyFatPct,
    sex,
    finish,
  }, { members: isMember(user) });

  if (analysis.metrics.length === 0) {
    return {
      ok: false,
      error:
        analysis.warnings[0] ??
        "Testet gick inte att räkna ut. Kontrollera värdena.",
    };
  }

  return { ok: true, spec, efforts, bodyFatPct, sex, finish, analysis };
}

export async function saveTestSession(
  input: SaveSessionInput,
): Promise<SaveSessionResult> {
  const access = await requireTestAuthor(input.adeptId);
  if (!access.ok) return access;
  const { user } = access;

  const prepared = prepareSession(input, user);
  if (!prepared.ok) return prepared;
  const { spec, efforts, bodyFatPct, sex, finish, analysis } = prepared;

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
      body_fat_pct: bodyFatPct,
      sex,
      peak_intensity: finish?.peakIntensity ?? null,
      vo2max: finish?.vo2max ?? null,
      peak_lactate: finish?.peakLactate ?? null,
      peak_heart_rate: finish?.peakHeartRate ? Math.round(finish.peakHeartRate) : null,
      zone_scheme: spec.zoneScheme,
      training_phase: input.trainingPhase,
      notes: input.notes,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (sessionError || !session) {
    return {
      ok: false,
      error: `Kunde inte spara testtillfället: ${sessionError?.message ?? "okänt fel"}`,
    };
  }

  const { error: effortError } = await supabase
    .from("test_efforts")
    .insert(effortRows(session.id, input, efforts));

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

  revalidatePath(`${routes.adepts}/${input.adeptId}`, "layout");
  return { ok: true, sessionId: session.id };
}

/** Raderna som sparas för ett tillfälle, ur det kontrollerade underlaget. */
function effortRows(sessionId: string, input: SaveSessionInput, efforts: Effort[]) {
  return efforts.map((e, index) => ({
    session_id: sessionId,
    ordinal: e.ordinal ?? index,
    intensity: e.intensity,
    duration_seconds: e.durationSeconds,
    distance_m: e.distanceM,
    lactate: e.lactate,
    heart_rate: e.heartRate === null ? null : Math.round(e.heartRate),
    heart_rate_max:
      e.heartRateMax === null || e.heartRateMax === undefined
        ? null
        : Math.round(e.heartRateMax),
    performed_on:
      e.performedOn && e.performedOn !== input.performedOn ? e.performedOn : null,
    comment: e.comment ? e.comment.slice(0, 500) : null,
    rpe: e.rpe ?? null,
  }));
}

/**
 * Ändrar ett sparat testtillfälle: rådatan byts och värdena räknas om.
 *
 * Bara adeptens egen coach ändrar, också när coachen är admin. Går något fel
 * på vägen läggs det gamla testet tillbaka som det var.
 */
export async function updateTestSession(
  sessionId: string,
  input: SaveSessionInput,
): Promise<SaveSessionResult> {
  const user = await requireCoach();
  const supabase = await createClient();

  const { data: current } = await supabase
    .from("test_sessions")
    .select("id, adept_id, adepts(coach_id)")
    .eq("id", sessionId)
    .maybeSingle();
  const owner = (current as { adepts: { coach_id: string | null } | null } | null)
    ?.adepts?.coach_id;
  if (!current || current.adept_id !== input.adeptId || owner !== user.id) {
    return { ok: false, error: "Bara adeptens coach kan ändra testet." };
  }

  const prepared = prepareSession(input, user);
  if (!prepared.ok) return prepared;
  const { spec, efforts, bodyFatPct, sex, finish, analysis } = prepared;

  // Stegen och värdena är unika per test, så de gamla tas bort innan de nya
  // sparas. De hämtas först i sin helhet och läggs tillbaka om något går fel.
  const [{ data: oldEfforts, error: readEffortError }, { data: oldMetrics, error: readMetricError }] =
    await Promise.all([
      supabase.from("test_efforts").select("*").eq("session_id", sessionId),
      supabase.from("test_metrics").select("*").eq("session_id", sessionId),
    ]);
  if (readEffortError || readMetricError || !oldEfforts || !oldMetrics) {
    return { ok: false, error: "Kunde inte läsa testet som ska ändras." };
  }

  const clear = () =>
    Promise.all([
      supabase.from("test_efforts").delete().eq("session_id", sessionId),
      supabase.from("test_metrics").delete().eq("session_id", sessionId),
    ]);
  const restore = async (message: string): Promise<SaveSessionResult> => {
    await clear();
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      oldEfforts.length
        ? supabase.from("test_efforts").insert(oldEfforts)
        : Promise.resolve({ error: null }),
      oldMetrics.length
        ? supabase.from("test_metrics").insert(oldMetrics)
        : Promise.resolve({ error: null }),
    ]);
    return {
      ok: false,
      error:
        e1 || e2
          ? `${message} Det gamla testet gick inte att återställa helt: ${(e1 ?? e2)?.message}`
          : message,
    };
  };

  const cleared = await clear();
  const clearError = cleared.find((r) => r.error)?.error;
  if (clearError) return restore(`Kunde inte ändra testet: ${clearError.message}`);

  const { error: effortError } = await supabase
    .from("test_efforts")
    .insert(effortRows(sessionId, input, efforts));
  if (effortError) return restore(`Kunde inte spara stegen: ${effortError.message}`);

  const { error: metricError } = await supabase.from("test_metrics").insert(
    analysis.metrics.map((m) => ({
      session_id: sessionId,
      key: m.key,
      value: m.value,
      unit: m.unit,
      method: m.method ?? null,
      is_primary: m.isPrimary,
    })),
  );
  if (metricError) return restore(`Kunde inte spara värdena: ${metricError.message}`);

  const { error: sessionError } = await supabase
    .from("test_sessions")
    .update({
      protocol: input.protocol,
      sport: input.sport,
      intensity_unit: input.unit,
      performed_on: input.performedOn,
      weight_kg: input.weightKg,
      body_fat_pct: bodyFatPct,
      sex,
      peak_intensity: finish?.peakIntensity ?? null,
      vo2max: finish?.vo2max ?? null,
      peak_lactate: finish?.peakLactate ?? null,
      peak_heart_rate: finish?.peakHeartRate ? Math.round(finish.peakHeartRate) : null,
      zone_scheme: spec.zoneScheme,
      training_phase: input.trainingPhase,
      notes: input.notes,
    })
    .eq("id", sessionId);
  if (sessionError) return restore(`Kunde inte spara testet: ${sessionError.message}`);

  revalidatePath(`${routes.adepts}/${input.adeptId}`, "layout");
  return { ok: true, sessionId };
}

export async function deleteTestSession(
  sessionId: string,
  adeptId: string,
): Promise<{ ok: boolean; error?: string }> {
  // En medlemsadept tar bort de tester hen själv registrerat; databasen
  // släpper inte igenom något annat.
  const access = await requireTestAuthor(adeptId);
  if (!access.ok) return access;

  const supabase = await createClient();
  const { error } = await supabase
    .from("test_sessions")
    .delete()
    .eq("id", sessionId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`${routes.adepts}/${adeptId}`, "layout");
  return { ok: true };
}

/**
 * Räknar om alla testtillfällen för en adept med dagens metoder.
 *
 * Värdena i `test_metrics` är facit för vad som räknades när testet sparades.
 * När metoderna förbättras – ModDmax som LT2 i stället för medianen, 2 och 4
 * mmol för tester med tre steg – blir gamla tester annars kvar på den gamla
 * versionen, och då jämför progressionen två versioner av appen. Rådatan rörs
 * inte; bara det som räknas ur den byts.
 */
export async function recomputeAdeptSessions(
  adeptId: string,
): Promise<{ ok: true; updated: number } | { ok: false; error: string }> {
  const user = await requireCoach();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("test_sessions")
    .select(
      "id, protocol, sport, intensity_unit, weight_kg, body_fat_pct, sex, peak_intensity, vo2max, peak_lactate, peak_heart_rate, test_metrics(key), test_efforts(ordinal, intensity, duration_seconds, distance_m, lactate, heart_rate, rpe)",
    )
    .eq("adept_id", adeptId);

  if (error) return { ok: false, error: `Kunde inte hämta testerna: ${error.message}` };

  type Row = {
    id: string;
    protocol: ProtocolKey;
    sport: Sport;
    intensity_unit: IntensityUnit;
    weight_kg: number | null;
    body_fat_pct: number | null;
    sex: "man" | "kvinna" | null;
    peak_intensity: number | null;
    vo2max: number | null;
    peak_lactate: number | null;
    peak_heart_rate: number | null;
    test_metrics: { key: string }[];
    test_efforts: {
      ordinal: number;
      intensity: number | null;
      duration_seconds: number | null;
      distance_m: number | null;
      lactate: number | null;
      heart_rate: number | null;
      rpe: number | null;
    }[];
  };

  const n = (v: number | string | null) => (v === null ? null : Number(v));
  let updated = 0;

  for (const s of (data ?? []) as unknown as Row[]) {
    const analysis = analyseSessionOnServer(
      {
        protocol: s.protocol,
        sport: s.sport,
        unit: s.intensity_unit,
        efforts: [...s.test_efforts]
          .sort((a, b) => a.ordinal - b.ordinal)
          .map((e) => ({
            ordinal: e.ordinal,
            intensity: n(e.intensity),
            durationSeconds: n(e.duration_seconds),
            distanceM: n(e.distance_m),
            lactate: n(e.lactate),
            heartRate: n(e.heart_rate),
            rpe: n(e.rpe),
          })),
        weightKg: n(s.weight_kg),
        bodyFatPct: n(s.body_fat_pct),
        sex: s.sex,
        finish: {
          peakIntensity: n(s.peak_intensity),
          vo2max: n(s.vo2max),
          peakLactate: n(s.peak_lactate),
          peakHeartRate: n(s.peak_heart_rate),
        },
      },
      // Medlemsdelarna följer med om coachen är medlem nu, eller om testet
      // redan hade dem – ett betalt resultat ska inte försvinna vid omräkning.
      { members: isMember(user) || s.test_metrics.some((m) => m.key === "VLamax") },
    );

    // Ger dagens metoder ingenting behålls det som fanns.
    if (analysis.metrics.length === 0) continue;

    const { error: deleteError } = await supabase
      .from("test_metrics")
      .delete()
      .eq("session_id", s.id);
    if (deleteError) return { ok: false, error: `Kunde inte räkna om: ${deleteError.message}` };

    const { error: insertError } = await supabase.from("test_metrics").insert(
      analysis.metrics.map((m) => ({
        session_id: s.id,
        key: m.key,
        value: m.value,
        unit: m.unit,
        method: m.method ?? null,
        is_primary: m.isPrimary,
      })),
    );
    if (insertError) return { ok: false, error: `Kunde inte spara värdena: ${insertError.message}` };
    updated += 1;
  }

  revalidatePath(`${routes.adepts}/${adeptId}`, "layout");
  revalidatePath(routes.progression);
  return { ok: true, updated };
}
