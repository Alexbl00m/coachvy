"use server";

import { revalidatePath } from "next/cache";

import { requireCoach } from "@/lib/auth/session";
import { field, optionalField, type FormState } from "@/lib/form-state";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { CUSTOM_TYPE } from "@/lib/tests/constants";

function echo(formData: FormData): Record<string, string> {
  return {
    test_type_id: field(formData, "test_type_id"),
    custom_label: field(formData, "custom_label"),
    custom_unit: field(formData, "custom_unit"),
    value: field(formData, "value"),
    unit: field(formData, "unit"),
    tested_on: field(formData, "tested_on"),
    comment: field(formData, "comment"),
  };
}

export async function createTestResult(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const coach = await requireCoach();
  const values = echo(formData);

  const adeptId = field(formData, "adept_id");
  if (!adeptId) return { error: "Adepten saknas.", values };

  const rawValue = field(formData, "value").replace(",", ".");
  const value = Number(rawValue);
  if (!rawValue || !Number.isFinite(value)) {
    return { error: "Testvärdet måste vara ett tal.", values };
  }

  const testedOn = field(formData, "tested_on");
  if (!testedOn) return { error: "Välj ett datum för testet.", values };

  const supabase = await createClient();
  let testTypeId = field(formData, "test_type_id");

  // "Egen testtyp" creates the type first, owned by this coach.
  if (testTypeId === CUSTOM_TYPE) {
    const label = field(formData, "custom_label");
    const customUnit = field(formData, "custom_unit");

    if (!label) return { error: "Ge den egna testtypen ett namn.", values };
    if (!customUnit) return { error: "Ange en enhet för testtypen.", values };

    const { data: created, error: typeError } = await supabase
      .from("test_types")
      .insert({ label, default_unit: customUnit, coach_id: coach.id })
      .select("id")
      .single();

    if (typeError) {
      const duplicate = typeError.code === "23505";
      return {
        error: duplicate
          ? `Du har redan en testtyp som heter "${label}".`
          : `Kunde inte skapa testtypen: ${typeError.message}`,
        values,
      };
    }
    testTypeId = created.id;
  }

  if (!testTypeId) return { error: "Välj en testtyp.", values };

  const unit = field(formData, "unit");
  if (!unit) return { error: "Ange en enhet.", values };

  // RLS rejects an adept that is not this coach's, so a forged id cannot write
  // into another coach's data.
  const { error } = await supabase.from("test_results").insert({
    adept_id: adeptId,
    test_type_id: testTypeId,
    value,
    unit,
    tested_on: testedOn,
    comment: optionalField(formData, "comment"),
    created_by: coach.id,
  });

  if (error) {
    return { error: `Kunde inte spara testresultatet: ${error.message}`, values };
  }

  revalidatePath(`${routes.adepts}/${adeptId}`);
  return { notice: "Testresultatet är sparat." };
}

export async function deleteTestResult(formData: FormData): Promise<void> {
  await requireCoach();

  const id = field(formData, "id");
  const adeptId = field(formData, "adept_id");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("test_results").delete().eq("id", id);

  revalidatePath(`${routes.adepts}/${adeptId}`);
}
