import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { PlanPage } from "@/components/plan-library/plan/plan-page";
import { EmptyState } from "@/components/ui/card";
import { getAdept } from "@/lib/adepts/queries";
import { requireCoach } from "@/lib/auth/session";
import {
  canEditPlan,
  listWorkoutOptions,
  loadPlanView,
} from "@/lib/plan-library/plan-view";
import { listInstances } from "@/lib/plan-library/queries";
import { routes } from "@/lib/routes";
import { todayIso } from "@/lib/season/season";

export const metadata = { title: "Plan" };

/**
 * Adeptens plan ur biblioteket, för coachen. Coachen ser samma vy som
 * medlemmen och kan byta nivå och flytta pass åt adepten; bytena står
 * som coachens i historiken.
 */
export default async function AdeptPlanPage({
  params,
  searchParams,
}: PageProps<"/app/adepter/[id]/plan">) {
  await requireCoach();
  const { id } = await params;
  const query = await searchParams;
  const adept = await getAdept(id);
  if (!adept) notFound();
  const today = todayIso();
  const base = `${routes.adepts}/${id}/plan`;

  const instances = await listInstances(id);
  const chosen =
    instances.find((i) => i.id === query.plan) ??
    instances.find((i) => i.status === "aktiv") ??
    instances[0];

  const header = (
    <>
      <Link
        href={`${routes.adepts}/${id}`}
        className="mb-3 inline-flex items-center gap-1 text-[13px] text-text-muted hover:text-text"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {adept.full_name}
      </Link>
      <PageHeader
        title={`Plan · ${adept.full_name}`}
        description={
          adept.plan === "medlem"
            ? "Planen adepten följer ur planbiblioteket. Du kan byta nivå och flytta pass åt adepten."
            : "Adepten är inte medlem just nu, så planen är skrivskyddad."
        }
      />
    </>
  );

  if (!chosen) {
    return (
      <>
        {header}
        <EmptyState
          title="Ingen plan ur biblioteket"
          description="Adepten startar en plan själv i planbiblioteket, som medlem."
        />
      </>
    );
  }

  const [view, canEdit, workouts] = await Promise.all([
    loadPlanView(chosen.id, today),
    canEditPlan(id),
    listWorkoutOptions(id),
  ]);
  if (!view) notFound();
  const weekParam = Number(query.vecka);

  return (
    <>
      {header}
      {instances.length > 1 && (
        <p className="mb-4 text-[13px] text-text-muted">
          Andra planer:{" "}
          {instances
            .filter((i) => i.id !== chosen.id)
            .map((i, n) => (
              <span key={i.id}>
                {n > 0 && ", "}
                <Link
                  href={`${base}?plan=${i.id}`}
                  className="underline decoration-line-strong underline-offset-2 hover:text-text"
                >
                  {i.title} ({i.status})
                </Link>
              </span>
            ))}
        </p>
      )}
      <PlanPage
        view={view}
        basePath={base}
        weekParam={
          Number.isFinite(weekParam) && weekParam > 0 ? weekParam : null
        }
        mode={query.vy === "hela" ? "hela" : "vecka"}
        canEdit={canEdit}
        workouts={workouts}
        today={today}
      />
    </>
  );
}
