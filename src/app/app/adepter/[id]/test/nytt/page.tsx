import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { NewSessionForm } from "@/components/tests/new-session-form";
import { PageHeader } from "@/components/page-header";
import { getAdeptProfile } from "@/lib/adepts/profile";
import { getAdept } from "@/lib/adepts/queries";
import { isMember } from "@/lib/auth/membership";
import { requireCoach } from "@/lib/auth/session";
import type { Sport } from "@/lib/calculators/lactate";
import { routes } from "@/lib/routes";
import { listSessions } from "@/lib/tests/session-queries";

export const metadata = { title: "Nytt testtillfälle" };

/** Adeptens sport som fritext, mappad till en gren modellen känner igen. */
function sportOf(raw: string | null): Sport {
  const value = (raw ?? "").toLowerCase();
  if (value.includes("löp") || value.includes("run")) return "löpning";
  if (value.includes("sim") || value.includes("swim")) return "simning";
  return "cykling";
}

export default async function NewSessionPage({
  params,
}: PageProps<"/app/adepter/[id]/test/nytt">) {
  const user = await requireCoach();
  const { id } = await params;

  const [adept, profile, sessions] = await Promise.all([
    getAdept(id),
    getAdeptProfile(id),
    listSessions(id),
  ]);
  if (!adept) notFound();

  // Förifyllt ur det senaste test som hade värdet, så att coachen bara
  // behöver ändra det som faktiskt ändrats sedan dess.
  const lastWeight = sessions.find((s) => s.weight_kg != null)?.weight_kg ?? null;
  const lastBodyFat = sessions.find((s) => s.body_fat_pct != null)?.body_fat_pct ?? null;
  const sex =
    profile?.sex === "man" || profile?.sex === "kvinna"
      ? profile.sex
      : (sessions.find((s) => s.sex != null)?.sex ?? null);

  return (
    <>
      <Link
        href={`${routes.adepts}/${adept.id}?vy=testtillfallen`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-subtle hover:text-text"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {adept.full_name}
      </Link>

      <PageHeader
        title="Nytt testtillfälle"
        description="Välj protokoll och fyll i rådatan. Värdena räknas ut medan du skriver – det som sparas är både stegen och det de gav."
      />

      <NewSessionForm
        adeptId={adept.id}
        adeptSport={sportOf(adept.sport)}
        adeptWeight={lastWeight === null ? null : Number(lastWeight)}
        adeptBodyFat={lastBodyFat === null ? null : Number(lastBodyFat)}
        adeptSex={sex}
        member={isMember(user)}
      />
    </>
  );
}
