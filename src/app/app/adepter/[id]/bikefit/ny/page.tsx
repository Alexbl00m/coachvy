import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { NewFit } from "@/components/bikefit/new-fit";
import { PageHeader } from "@/components/page-header";
import { loadWorkspace } from "@/lib/adepts/workspace";
import { listFits } from "@/lib/bikefit/queries";
import { adeptHref } from "@/lib/routes";
import { todayIso } from "@/lib/season/season";

export const metadata = { title: "Ny bikefit" };

export default async function NewBikefitPage({
  params,
}: PageProps<"/app/adepter/[id]/bikefit/ny">) {
  const { adept, canEdit } = await loadWorkspace(params);
  if (!canEdit) redirect(adeptHref(adept.id, "bikefit"));
  const fits = await listFits(adept.id);

  return (
    <>
      <Link
        href={adeptHref(adept.id, "bikefit")}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-subtle hover:text-text"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {adept.full_name}
      </Link>
      <PageHeader
        title="Ny bikefit"
        description="Välj gren, mät vinklarna ur en video eller för in dem själv, och fyll i cykelns mått. Bedömningen räknas ut medan du fyller i."
      />
      <NewFit
        adeptId={adept.id}
        today={todayIso()}
        previous={fits[0] ?? null}
      />
    </>
  );
}
