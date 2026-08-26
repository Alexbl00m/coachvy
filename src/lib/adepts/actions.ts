"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireCoach } from "@/lib/auth/session";
import { field, optionalField, type FormState } from "@/lib/form-state";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

function readAdeptForm(formData: FormData) {
  return {
    full_name: field(formData, "full_name"),
    email: optionalField(formData, "email"),
    sport: optionalField(formData, "sport"),
    goal: optionalField(formData, "goal"),
    current_level: optionalField(formData, "current_level"),
  };
}

function echo(formData: FormData): Record<string, string> {
  return {
    full_name: field(formData, "full_name"),
    email: field(formData, "email"),
    sport: field(formData, "sport"),
    goal: field(formData, "goal"),
    current_level: field(formData, "current_level"),
  };
}

export async function createAdept(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const coach = await requireCoach();
  const values = readAdeptForm(formData);

  if (!values.full_name) {
    return { error: "Adepten behöver ett namn.", values: echo(formData) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("adepts")
    .insert({ ...values, coach_id: coach.id })
    .select("id")
    .single();

  if (error) {
    return {
      error: `Kunde inte spara adepten: ${error.message}`,
      values: echo(formData),
    };
  }

  revalidatePath(routes.adepts);
  revalidatePath(routes.dashboard);
  redirect(`${routes.adepts}/${data.id}`);
}

export async function updateAdept(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireCoach();

  const id = field(formData, "id");
  const values = readAdeptForm(formData);

  if (!id) {
    return { error: "Adepten saknas.", values: echo(formData) };
  }
  if (!values.full_name) {
    return { error: "Adepten behöver ett namn.", values: echo(formData) };
  }

  const supabase = await createClient();
  // RLS scopes this to the signed-in coach's own adepts, so a forged id
  // updates nothing rather than someone else's row.
  const { data, error } = await supabase
    .from("adepts")
    .update(values)
    .eq("id", id)
    .select("id");

  if (error) {
    return {
      error: `Kunde inte spara ändringarna: ${error.message}`,
      values: echo(formData),
    };
  }
  if (!data || data.length === 0) {
    return {
      error: "Adepten hittades inte, eller så är den inte din.",
      values: echo(formData),
    };
  }

  revalidatePath(`${routes.adepts}/${id}`);
  revalidatePath(routes.adepts);
  return { notice: "Ändringarna är sparade." };
}
