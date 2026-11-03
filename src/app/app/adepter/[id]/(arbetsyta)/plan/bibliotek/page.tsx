import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { PillLinks } from "@/components/plan-library/pill-links";
import { PlanPage } from "@/components/plan-library/plan/plan-page";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { loadWorkspace } from "@/lib/adepts/workspace";
import {
  canEditPlan,
  listWorkoutOptions,
  loadPlanView,
} from "@/lib/plan-library/plan-view";
import { loadRunningFitness } from "@/lib/plan-library/fitness";
import { INSTANCE_STATUS_LABEL } from "@/lib/plan-library/labels";
import { listInstances } from "@/lib/plan-library/queries";
import { TRACK_LABEL } from "@/lib/plan-library/queue";
import { adeptHref, routes } from "@/lib/routes";
import { todayIso } from "@/lib/season/season";

export const metadata = { title: "Veckoplan" };

/**
 * Veckoplanen: adeptens plan ur biblioteket vecka för vecka, för coachen.
 * Coachen ser samma vy som medlemmen och kan byta nivå och flytta pass åt
 * adepten; bytena står som coachens i historiken. Faserna läggs in under
 * Säsong.
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
  const season = adeptHref(id, "plan");
  // En plan per gren kan pågå samtidigt; den som började först visas först.
  const activePlans = instances
    .filter((i) => i.status === "aktiv")
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const chosen =
    instances.find((i) => i.id === query.plan) ?? activePlans[0] ?? instances[0];

  if (!chosen) {
    return (
      <EmptyState
        title="Ingen plan igång"
        description="Lägg in den första fasen under Säsong, så visas veckorna här."
        action={
          <ButtonLink href={season}>
            Till Säsong
            <ArrowRight aria-hidden className="size-4" />
          </ButtonLink>
        }
      />
    );
  }

  const header = (
    <p className="mb-4 max-w-2xl text-sm text-text-muted">
      {chosen.access === "coach"
        ? "Planen adepten följer, lagd av dig. Du kan byta nivå och flytta pass åt adepten."
        : adept.plan === "medlem"
          ? "Planen adepten följer ur planbiblioteket. Du kan byta nivå och flytta pass åt adepten."
          : "Planen ingår i medlemskapet, som adepten inte har just nu. Därför är den skrivskyddad."}{" "}
      <Link
        href={season}
        className="font-medium text-text underline decoration-line-strong underline-offset-2 hover:decoration-text"
      >
        Faserna lägger du in under Säsong.
      </Link>
    </p>
  );

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
      {/* En plan per gren kan pågå samtidigt: löpning och cykel var för sig. */}
      {activePlans.length > 1 && (
        <div className="mb-4">
          <PillLinks
            label="Pågående planer"
            active={chosen.id}
            items={activePlans.map((i) => ({
              key: i.id,
              label: `${TRACK_LABEL[i.track]} · ${i.title}`,
              href: `${base}?plan=${i.id}`,
            }))}
          />
        </div>
      )}
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
                  {i.title} ({INSTANCE_STATUS_LABEL[i.status] ?? i.status})
                </Link>
              </span>
            ))}
        </p>
      )}
      <PlanPage
        view={view}
        basePath={chosen.id === activePlans[0]?.id ? base : `${base}?plan=${chosen.id}`}
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
