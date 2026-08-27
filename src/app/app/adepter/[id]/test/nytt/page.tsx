import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { NewSessionForm } from "@/components/tests/new-session-form";
import { PageHeader } from "@/components/page-header";
import { getAdept } from "@/lib/adepts/queries";
import { requireCoach } from "@/lib/auth/session";
import type { Sport } from "@/lib/calculators/lactate";
import { routes } from "@/lib/routes";

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
  await requireCoach();
  const { id } = await params;

  const adept = await getAdept(id);
  if (!adept) notFound();

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
        adeptWeight={null}
      />
    </>
  );
}
