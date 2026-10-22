import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PlanPage } from "@/components/plan-library/plan/plan-page";
import { EmptyState } from "@/components/ui/card";
import { loadWorkspace } from "@/lib/adepts/workspace";
import {
  canEditPlan,
  listWorkoutOptions,
  loadPlanView,
} from "@/lib/plan-library/plan-view";
import { loadRunningFitness } from "@/lib/plan-library/fitness";
import { listInstances } from "@/lib/plan-library/queries";
import { adeptHref, routes } from "@/lib/routes";
import { todayIso } from "@/lib/season/season";

export const metadata = { title: "Planbiblioteket" };

/**
 * Adeptens plan ur biblioteket, för coachen. Coachen ser samma vy som
 * medlemmen och kan byta nivå och flytta pass åt adepten; bytena står
 * som coachens i historiken.
 */
export default async function AdeptPlanPage({
  params,
  searchParams,
}: PageProps<"/app/adepter/[id]/plan/bibliotek">) {
  const { user, adept, isCoach } = await loadWorkspace(params);
  // Adepten själv har planen under Min plan.
  if (!isCoach) redirect(routes.myPlan);
  const query = await searchParams;
  const id = adept.id;
  const today = todayIso();
  const base = adeptHref(id, "bibliotek");

  const instances = await listInstances(id);
  const chosen =
    instances.find((i) => i.id === query.plan) ??
    instances.find((i) => i.status === "aktiv") ??
    instances[0];

  const header = (
    <p className="mb-4 max-w-2xl text-sm text-text-muted">
      {adept.plan === "medlem"
        ? "Planen adepten följer ur planbiblioteket. Du kan byta nivå och flytta pass åt adepten."
        : "Adepten är inte medlem just nu, så planen är skrivskyddad."}
    </p>
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

  const [view, canEdit, workouts, fitness] = await Promise.all([
    loadPlanView(chosen.id, today),
    canEditPlan(id),
    listWorkoutOptions(id),
    loadRunningFitness(id),
  ]);
  if (!view) notFound();
  const weekParam = Number(query.vecka);

  return (
    <>
      {header}
      {instances.length > 1 && (
        <p className="mb-4 text-[0.8125rem] text-text-muted">
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
        fitness={fitness}
        userId={user.id}
      />
    </>
  );
}
