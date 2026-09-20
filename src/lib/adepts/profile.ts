import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { AdeptProfileRow } from "@/lib/types/database";

const COLUMNS =
  "adept_id, birth_year, sex, height_cm, training_years, weekly_hours, weekly_sessions, injuries, medical, strengths, weaknesses, goal, goal_date, created_at, updated_at";

export async function getAdeptProfile(
  adeptId: string,
): Promise<AdeptProfileRow | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("adept_profiles")
    .select(COLUMNS)
    .eq("adept_id", adeptId)
    .maybeSingle();

  if (error) throw new Error(`Kunde inte hämta adeptprofilen: ${error.message}`);
  return (data ?? null) as AdeptProfileRow | null;
}

/**
 * Profilen som text, för prompten.
 *
 * Det här är vad coachen annars hade skrivit om i varje prompt: att atleten är
 * på väg tillbaka från en hälsena, att hon tränar sex timmar i veckan, att
 * loppet är om tre veckor. Står det i profilen behöver det inte upprepas.
 *
 * Tomma fält utelämnas helt i stället för att skickas som "okänt" – en lista
 * med tomma rader är brus som drar uppmärksamheten från det som faktiskt står.
 */
export function profileToPrompt(
  profile: AdeptProfileRow | null,
  today = new Date(),
): string | null {
  if (!profile) return null;

  const lines: string[] = [];
  const add = (label: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined) return;
    const text = String(value).trim();
    if (text.length > 0) lines.push(`- ${label}: ${text}`);
  };

  if (profile.birth_year) {
    add("Ålder", `${today.getFullYear() - profile.birth_year} år`);
  }
  add("Kön", profile.sex);
  add("Längd", profile.height_cm ? `${profile.height_cm} cm` : null);
  add("Tränat strukturerat", profile.training_years ? `${profile.training_years} år` : null);
  add("Normal veckovolym", profile.weekly_hours ? `${profile.weekly_hours} h` : null);
  add("Pass per vecka", profile.weekly_sessions);
  add("Skador och begränsningar", profile.injuries);
  add("Medicinskt att ta hänsyn till", profile.medical);
  add("Styrkor", profile.strengths);
  add("Att förbättra", profile.weaknesses);

  if (profile.goal) {
    const days = profile.goal_date
      ? Math.round(
          (Date.parse(profile.goal_date) -
            Date.parse(today.toISOString().slice(0, 10))) /
            86_400_000,
        )
      : null;
    add(
      "Mål",
      days === null
        ? profile.goal
        : days >= 0
          ? `${profile.goal} (${profile.goal_date}, om ${days} dagar)`
          : `${profile.goal} (${profile.goal_date}, passerat)`,
    );
  }

  return lines.length > 0 ? `Om atleten:\n${lines.join("\n")}` : null;
}
