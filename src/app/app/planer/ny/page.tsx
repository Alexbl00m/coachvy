import { redirect } from "next/navigation";

import { routes } from "@/lib/routes";

/**
 * "Skapa ny plan" i sidhuvudet. Planen byggs i säsongsplanen, så knappen
 * leder dit med formuläret för en ny period öppet.
 */
export default function NyPlanPage() {
  redirect(`${routes.plans}?ny=period`);
}
