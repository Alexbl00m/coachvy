"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireCoach } from "@/lib/auth/session";
import { sendEmail } from "@/lib/email/send";
import { siteOrigin } from "@/lib/site-origin";
import { field, optionalField, type FormState } from "@/lib/form-state";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import {
  inviteLink,
  inviteSubject,
  inviteText,
  type InviteKind,
} from "./invite-text";
import { getAdept } from "./queries";

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

/**
 * Noterar att coachen skickat inbjudan – när texten kopieras eller mejlet
 * öppnas. Appen kan inte veta att den faktiskt skickades, bara att coachen
 * tog den med sig; det räcker för att se vem som inte fått någon.
 */
export async function markInvited(
  adeptId: string,
): Promise<{ at: string | null }> {
  await requireCoach();
  const at = new Date().toISOString();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("adepts")
    .update({ invited_at: at })
    .eq("id", adeptId)
    .is("profile_id", null)
    .select("id");
  // Kolumnen saknas innan migrationen för inbjudningar körts: inbjudan
  // fungerar ändå, den noteras bara inte.
  if (error || !data || data.length === 0) return { at: null };
  revalidatePath(routes.adepts);
  return { at };
}

/**
 * Mejlar inbjudan eller påminnelsen om samtycke till adepten, från appen.
 *
 * Texten byggs här ur databasen, inte ur det som står i rutan, så att ingen
 * kan skicka annat än appens text i Coachvys namn. Svar går till coachen.
 */
export async function emailAdept(
  adeptId: string,
  kind: InviteKind,
): Promise<{ ok: boolean; error?: string; at?: string }> {
  const user = await requireCoach();
  const adept = await getAdept(adeptId);
  if (!adept || adept.coach_id !== user.id) {
    return { ok: false, error: "Adepten hittades inte." };
  }
  if (!adept.email) {
    return { ok: false, error: "Adepten saknar e-postadress." };
  }
  if (kind === "inbjudan" && adept.profile_id) {
    return { ok: false, error: "Adepten har redan ett konto." };
  }
  if (kind === "samtycke" && !adept.profile_id) {
    return {
      ok: false,
      error: "Adepten har inget konto än – skicka en inbjudan.",
    };
  }
  // Ett dubbelklick ska inte bli två mejl.
  if (
    kind === "inbjudan" &&
    adept.invited_at &&
    Date.now() - new Date(adept.invited_at).getTime() < 10 * 60_000
  ) {
    return {
      ok: false,
      error: "Inbjudan skickades nyss. Vänta en stund innan du skickar igen.",
    };
  }

  const origin = await siteOrigin();
  const coachName = user.profile?.full_name ?? "din coach";
  const target = { name: adept.full_name, email: adept.email };
  const result = await sendEmail({
    to: adept.email,
    subject: inviteSubject(kind),
    text: inviteText(kind, target, coachName, null),
    replyTo: user.email,
    action: {
      label: kind === "inbjudan" ? "Skapa konto" : "Öppna Inställningar",
      href: inviteLink(kind, origin, target),
    },
  });
  if (!result.ok) return result;

  if (kind === "inbjudan") {
    const { at } = await markInvited(adeptId);
    return { ok: true, at: at ?? undefined };
  }
  return { ok: true };
}
