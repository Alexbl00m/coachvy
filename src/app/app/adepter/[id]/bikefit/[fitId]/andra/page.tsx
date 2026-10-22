import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { FitForm } from "@/components/bikefit/fit-form";
import { PageHeader } from "@/components/page-header";
import { loadWorkspace } from "@/lib/adepts/workspace";
import { getFit } from "@/lib/bikefit/queries";
import { adeptHref, routes } from "@/lib/routes";
import { todayIso } from "@/lib/season/season";

export const metadata = { title: "Ändra bikefit" };

export default async function EditBikefitPage({
  params,
}: PageProps<"/app/adepter/[id]/bikefit/[fitId]/andra">) {
  const { fitId } = await params;
  const { adept, canEdit } = await loadWorkspace(params);
  if (!canEdit) redirect(adeptHref(adept.id, "bikefit"));
  const fit = await getFit(fitId);
  if (!fit || fit.adept_id !== adept.id) notFound();

  return (
    <>
      <Link
        href={`${routes.adepts}/${adept.id}/bikefit/${fit.id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-subtle hover:text-text"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Tillbaka till fiten
      </Link>
      <PageHeader
        title="Ändra bikefit"
        description={
          fit.method === "video"
            ? "Vinklarna kommer ur videon. Rättar du dem för hand sparas fiten som manuellt mätt; videon och bilden finns kvar."
            : undefined
        }
      />
      <FitForm adeptId={adept.id} today={todayIso()} initial={fit} />
    </>
  );
}
