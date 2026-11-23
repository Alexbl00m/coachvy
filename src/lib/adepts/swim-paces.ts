import "server-only";

import type { SwimPaces } from "@/lib/workouts/swim-pace";

import { getAdeptProfile } from "./profile";

/** Adeptens tävlingsfart i simning, s/100 m, ur profilen. */
export async function adeptSwimRace(
  adeptId: string,
): Promise<Pick<SwimPaces, "im" | "half">> {
  const profile = await getAdeptProfile(adeptId).catch(() => null);
  const num = (v: number | string | null | undefined) =>
    v === null || v === undefined ? null : Number(v);
  return {
    im: num(profile?.swim_im_pace),
    half: num(profile?.swim_703_pace),
  };
}

/**
 * Adeptens simfarter för passraden: CSS ur testerna (m/s, som referensen i
 * simpassen) och tävlingsfarten ur profilen. Null utan CSS.
 */
export async function adeptSwimPaces(
  adeptId: string,
  cssSpeed: number | null,
): Promise<SwimPaces | null> {
  if (!(cssSpeed !== null && cssSpeed > 0)) return null;
  return { css: 100 / cssSpeed, ...(await adeptSwimRace(adeptId)) };
}
