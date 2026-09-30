import { getSessionUser } from "@/lib/auth/session";
import { todayIso } from "@/lib/season/season";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Mina uppgifter som en fil (dataskyddsförordningen artikel 15 och 20).
 *
 * Allt hämtas med den inloggades egen behörighet, så filen innehåller exakt
 * det RLS låter hen se om sig själv – varken mer eller mindre. En coach får
 * sitt konto; adepternas uppgifter är deras, inte coachens.
 */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return new Response("Supabase är inte konfigurerat.", { status: 503 });
  }
  const user = await getSessionUser();
  if (!user) return new Response("Inte inloggad.", { status: 401 });

  const supabase = await createClient();
  const rows = async <T>(query: PromiseLike<{ data: T[] | null }>) =>
    (await query).data ?? [];

  const data: Record<string, unknown> = {
    exporterat: new Date().toISOString(),
    konto: { id: user.id, epost: user.email },
    profil: user.profile,
  };

  if (user.coach) {
    data.coach = user.coach;
  }

  const adepts = await rows(
    supabase.from("adepts").select("*").eq("profile_id", user.id),
  );
  if (adepts.length > 0) {
    const ids = adepts.map((a: { id: string }) => a.id);
    data.adept = adepts;
    const [
      background,
      sessions,
      results,
      checkins,
      workouts,
      races,
      blocks,
      messages,
    ] = await Promise.all([
      rows(supabase.from("adept_profiles").select("*").in("adept_id", ids)),
      rows(
        supabase
          .from("test_sessions")
          .select("*, test_efforts(*), test_metrics(*)")
          .in("adept_id", ids)
          .order("performed_on"),
      ),
      rows(supabase.from("test_results").select("*").in("adept_id", ids)),
      rows(
        supabase
          .from("adept_checkins")
          .select("*")
          .in("adept_id", ids)
          .order("performed_on"),
      ),
      rows(supabase.from("workouts").select("*").in("adept_id", ids)),
      rows(supabase.from("adept_races").select("*").in("adept_id", ids)),
      rows(supabase.from("training_blocks").select("*").in("adept_id", ids)),
      rows(
        supabase
          .from("coach_messages")
          .select("*")
          .in("adept_id", ids)
          .order("created_at"),
      ),
    ]);
    Object.assign(data, {
      bakgrund: background,
      testtillfallen: sessions,
      testresultat: results,
      incheckningar: checkins,
      pass: workouts,
      tavlingar: races,
      perioder: blocks,
      meddelanden: messages,
    });
  }

  const [posts, comments] = await Promise.all([
    rows(supabase.from("community_posts").select("*").eq("author_id", user.id)),
    rows(
      supabase.from("community_comments").select("*").eq("author_id", user.id),
    ),
  ]);
  data.community = { inlagg: posts, kommentarer: comments };

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="coachvy-mina-uppgifter-${todayIso()}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
