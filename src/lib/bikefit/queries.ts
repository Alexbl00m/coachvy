import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { BikeFitRow } from "@/lib/types/database";
import { BUCKET } from "./storage";

/** En adepts fits, nyast först. Databasen avgör vad den inloggade ser. */
export async function listFits(adeptId: string): Promise<BikeFitRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bike_fits")
    .select("*")
    .eq("adept_id", adeptId)
    .order("performed_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function getFit(id: string): Promise<BikeFitRow | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("bike_fits")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}

/** Tidsbegränsade länkar till fitens video och bild. */
export async function fitMediaUrls(
  fit: Pick<BikeFitRow, "video_path" | "frame_path">,
): Promise<{ video: string | null; frame: string | null }> {
  if (!isSupabaseConfigured()) return { video: null, frame: null };
  const supabase = await createClient();
  const sign = async (path: string | null) => {
    if (!path) return null;
    const { data } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60);
    return data?.signedUrl ?? null;
  };
  const [video, frame] = await Promise.all([
    sign(fit.video_path),
    sign(fit.frame_path),
  ]);
  return { video, frame };
}
