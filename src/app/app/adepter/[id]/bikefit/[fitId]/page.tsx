import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { FitActions } from "@/components/bikefit/fit-actions";
import { FitReport } from "@/components/bikefit/fit-report";
import { PageHeader } from "@/components/page-header";
import { loadWorkspace } from "@/lib/adepts/workspace";
import { DISCIPLINE_LABEL, previousFit } from "@/lib/bikefit/fit";
import { fitMediaUrls, listFits } from "@/lib/bikefit/queries";
import { adeptHref } from "@/lib/routes";
import { longDate } from "@/lib/season/season";

export const metadata = { title: "Bikefit" };

export default async function BikefitPage({
  params,
}: PageProps<"/app/adepter/[id]/bikefit/[fitId]">) {
  const { fitId } = await params;
  const { adept, canEdit } = await loadWorkspace(params);
  const fits = await listFits(adept.id);
  const fit = fits.find((f) => f.id === fitId);
  if (!fit) notFound();
  const previous = previousFit(fits, fit);
  const media = await fitMediaUrls(fit);

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
        title={`Bikefit, ${DISCIPLINE_LABEL[fit.discipline].toLowerCase()}`}
        description={
          previous
            ? `${longDate(fit.performed_on)} · jämförs med fiten ${longDate(previous.performed_on)}`
            : `${longDate(fit.performed_on)} · den första fiten i grenen`
        }
        action={
          canEdit ? (
            <FitActions
              adeptId={adept.id}
              fitId={fit.id}
              shared={fit.shared_at !== null}
            />
          ) : undefined
        }
      />
      <FitReport fit={fit} previous={previous} media={media} />
    </>
  );
}
