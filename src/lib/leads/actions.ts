"use server";

import { field, optionalField, type FormState } from "@/lib/form-state";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const MAX_MESSAGE = 5000;

function echo(formData: FormData): Record<string, string> {
  return {
    first_name: field(formData, "first_name"),
    last_name: field(formData, "last_name"),
    email: field(formData, "email"),
    message: field(formData, "message"),
  };
}

/**
 * Contact form on the public site. Writes to `public.leads`, which anonymous
 * visitors may insert into but only a coach may read back.
 */
export async function submitLead(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = echo(formData);

  // Honeypot: a real person never fills a field they cannot see. Answer as if
  // it worked so a bot learns nothing from the response.
  if (field(formData, "company")) {
    return { notice: "Tack! Jag hör av mig så snart jag kan." };
  }

  if (!values.first_name) {
    return { error: "Fyll i ditt förnamn.", values };
  }
  if (!values.email || !values.email.includes("@")) {
    return { error: "Fyll i en giltig e-postadress.", values };
  }
  if (!values.message) {
    return { error: "Skriv några rader om vad du vill ha hjälp med.", values };
  }
  if (values.message.length > MAX_MESSAGE) {
    return { error: "Meddelandet är för långt.", values };
  }

  if (!isSupabaseConfigured()) {
    return {
      error:
        "Formuläret är inte kopplat till någon databas ännu. Hör av dig på mail eller telefon så länge.",
      values,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("leads").insert({
    first_name: values.first_name,
    last_name: optionalField(formData, "last_name"),
    email: values.email,
    message: values.message,
    source: "webbformular",
  });

  if (error) {
    return {
      error:
        "Något gick fel när meddelandet skulle skickas. Försök igen, eller mejla mig direkt.",
      values,
    };
  }

  return {
    notice:
      "Tack för ditt meddelande! Jag återkommer så snart jag kan, oftast inom ett dygn.",
  };
}
