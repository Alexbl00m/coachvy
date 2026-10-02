import "server-only";

import { headers } from "next/headers";

/**
 * Sajtens adress, för länkar i mejl. `NEXT_PUBLIC_SITE_URL` vinner; annars
 * härleds den ur anropet, så att länkar från en förhandsversion pekar dit.
 */
export async function siteOrigin(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol =
    headerList.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") ? "http" : "https");

  return host ? `${protocol}://${host}` : "http://localhost:3000";
}
