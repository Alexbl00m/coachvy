import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PlanPage } from "@/components/plan-library/plan/plan-page";
import { PhaseQueue } from "@/components/plan-library/phase-queue";
import { PlanSuggestions } from "@/components/plan-library/plan-suggestions";
import { loadWorkspace } from "@/lib/adepts/workspace";
import {
  canEditPlan,
  listWorkoutOptions,
  loadPlanView,
} from "@/lib/plan-library/plan-view";
import { loadRunningFitness } from "@/lib/plan-library/fitness";
import { focusLabel } from "@/lib/plan-library/focus";
import { listInstances, listLibrary } from "@/lib/plan-library/queries";
import { phaseEnd, queueOf } from "@/lib/plan-library/queue";
import { planSuggestions } from "@/lib/plan-library/suggestions";
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

  const [instances, suggestions, library] = await Promise.all([
    listInstances(id),
    planSuggestions(id),
    listLibrary(),
  ]);

  // Faserna: den aktiva och de som står i kö, och planerna att välja bland.
  const queue = (
    <PhaseQueue
      adeptId={id}
      today={today}
      items={queueOf(instances).map((i) => ({
        id: i.id,
        title: i.title,
        status: i.status as "aktiv" | "kommande",
        startDate: i.start_date,
        endDate: phaseEnd(i),
        weeks: i.weeks,
      }))}
      options={library.map((e) => ({
        versionId: e.version.id,
        title: e.version.title,
        group: [e.category?.name, focusLabel(e.template.focus)]
          .filter(Boolean)
          .join(" · ") || "Övrigt",
        minWeeks: e.version.min_weeks,
        maxWeeks: e.version.max_weeks,
        levels: [...e.levels]
          .sort((a, b) => b.rank - a.rank)
          .map((l) => ({ id: l.id, key: l.key, name: l.name })),
      }))}
    />
  );
  const chosen =
    instances.find((i) => i.id === query.plan) ??
    instances.find((i) => i.status === "aktiv") ??
    instances[0];

  const header = (
    <p className="mb-4 max-w-2xl text-sm text-text-muted">
      {chosen?.access === "coach"
        ? "Planen adepten följer, delad av dig. Du kan byta nivå och flytta pass åt adepten."
        : adept.plan === "medlem"
          ? "Planen adepten följer ur planbiblioteket. Du kan byta nivå och flytta pass åt adepten."
          : "Planen ingår i medlemskapet, som adepten inte har just nu. Därför är den skrivskyddad."}
    </p>
  );

  if (!chosen) {
    return (
      <>
        {header}
        <PlanSuggestions suggestions={suggestions} forCoach />
        {queue}
      </>
    );
  }

  const [view, canEdit, workouts, fitness] = await Promise.all([
    loadPlanView(chosen.id, today),
    canEditPlan(chosen.id),
    listWorkoutOptions(id),
    loadRunningFitness(id),
  ]);
  if (!view) notFound();
  const weekParam = Number(query.vecka);

  return (
    <>
      {header}
      {chosen.status !== "aktiv" && (
        <PlanSuggestions suggestions={suggestions} forCoach />
      )}
      {queue}
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
