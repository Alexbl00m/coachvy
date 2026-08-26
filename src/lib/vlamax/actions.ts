"use server";

import { revalidatePath } from "next/cache";

import { requireCoach } from "@/lib/auth/session";
import { field, type FormState } from "@/lib/form-state";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

function num(formData: FormData, key: string): number {
  return Number(field(formData, key).replace(",", "."));
}

function echo(formData: FormData): Record<string, string> {
  const keys = [
    "label",
    "sex",
    "weight_kg",
    "body_fat_pct",
    "height_cm",
    "age",
    "sprint_seconds",
    "watt_avg",
    "watt_peak",
    "vlamax",
  ];
  return Object.fromEntries(keys.map((k) => [k, field(formData, k)]));
}

/**
 * Lägger till en egen referensrad. Motsvarar "Testdatenbank erweitern" i
 * Streamlit-appen, som skrev till en CSV; här blir raden coachens egen och
 * modellen tränas om automatiskt nästa gång sidan laddas.
 */
export async function addVlamaxSample(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const coach = await requireCoach();
  const values = echo(formData);

  const label = field(formData, "label");
  const sex = field(formData, "sex");
  if (!label) return { error: "Ge raden ett namn eller en etikett.", values };
  if (sex !== "man" && sex !== "kvinna") {
    return { error: "Välj kön.", values };
  }

  const numeric = {
    weight_kg: num(formData, "weight_kg"),
    body_fat_pct: num(formData, "body_fat_pct"),
    sprint_seconds: num(formData, "sprint_seconds"),
    watt_avg: num(formData, "watt_avg"),
    watt_peak: num(formData, "watt_peak"),
    vlamax: num(formData, "vlamax"),
  };

  for (const [key, value] of Object.entries(numeric)) {
    if (!Number.isFinite(value)) {
      return { error: `Fältet "${key}" måste vara ett tal.`, values };
    }
  }

  const heightRaw = field(formData, "height_cm");
  const ageRaw = field(formData, "age");

  const supabase = await createClient();
  const { error } = await supabase.from("vlamax_samples").insert({
    coach_id: coach.id,
    label,
    sex,
    height_cm: heightRaw ? num(formData, "height_cm") : null,
    age: ageRaw ? Math.round(num(formData, "age")) : null,
    ...numeric,
  });

  if (error) {
    // Databasens CHECK-villkor fångar orimliga värden innan de förgiftar modellen.
    const outOfRange = error.code === "23514";
    return {
      error: outOfRange
        ? "Något värde ligger utanför rimligt spann. Kontrollera vikt, kroppsfett, sprintlängd, effekt och VLamax."
        : `Kunde inte spara referensraden: ${error.message}`,
      values,
    };
  }

  revalidatePath(routes.vlamax);
  return { notice: `${label} är tillagd. Modellen har tränats om.` };
}

/**
 * Sparar en beräknad VLamax som ett vanligt testresultat på en adept, så att
 * den hamnar i adeptens kurva tillsammans med de uppmätta värdena.
 */
export async function saveVlamaxAsTestResult(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const coach = await requireCoach();

  const adeptId = field(formData, "adept_id");
  const value = num(formData, "value");
  const testedOn = field(formData, "tested_on");

  if (!adeptId) return { error: "Välj vilken adept resultatet gäller." };
  if (!Number.isFinite(value)) return { error: "Beräkna ett värde först." };
  if (!testedOn) return { error: "Välj ett datum." };

  const supabase = await createClient();

  const { data: testType, error: typeError } = await supabase
    .from("test_types")
    .select("id, default_unit")
    .eq("label", "VLamax")
    .is("coach_id", null)
    .maybeSingle();

  if (typeError || !testType) {
    return { error: "Hittade ingen testtyp för VLamax." };
  }

  const { error } = await supabase.from("test_results").insert({
    adept_id: adeptId,
    test_type_id: testType.id,
    value,
    unit: testType.default_unit,
    tested_on: testedOn,
    // Märker raden så att en beräknad siffra aldrig förväxlas med en mätning.
    comment: field(formData, "comment") || "Beräknad med VLamax-kalkylen",
    created_by: coach.id,
  });

  if (error) {
    return { error: `Kunde inte spara testresultatet: ${error.message}` };
  }

  revalidatePath(`${routes.adepts}/${adeptId}`);
  return { notice: "Sparat som testresultat på adepten." };
}
