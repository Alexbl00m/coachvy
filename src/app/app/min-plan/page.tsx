import Link from "next/link";
import { redirect } from "next/navigation";
import { Library } from "lucide-react";

import { MembersOnly } from "@/components/members-only";
import { PageHeader } from "@/components/page-header";
import { PlanPage } from "@/components/plan-library/plan/plan-page";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardTitle, EmptyState } from "@/components/ui/card";
import { isMember } from "@/lib/auth/membership";
import { requireSessionUser } from "@/lib/auth/session";
import {
  canEditPlan,
  listWorkoutOptions,
  loadPlanView,
} from "@/lib/plan-library/plan-view";
import { listInstances } from "@/lib/plan-library/queries";
import { routes } from "@/lib/routes";
import { todayIso } from "@/lib/season/season";

export const metadata = { title: "Min plan" };

const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));

/**
 * Medlemmens plan ur biblioteket. Planen ligger fast; medlemmen loggar,
 * flyttar pass och byter nivå själv.
 */
export default async function MyPlanPage({
  searchParams,
}: PageProps<"/app/min-plan">) {
  const user = await requireSessionUser();
  if (user.profile?.role !== "adept" || !user.adept)
    redirect(routes.planLibrary);
  const query = await searchParams;
  const today = todayIso();

  const instances = await listInstances(user.adept.id);
  const chosen =
    instances.find((i) => i.id === query.plan) ??
    instances.find((i) => i.status === "aktiv");

  // Utan medlemskap och utan plan: det finns inget att visa än.
  if (!chosen && !isMember(user)) {
    return (
      <>
        <PageHeader title="Min plan" />
        <MembersOnly
          feature="Planbiblioteket"
          description="Som medlem väljer du en färdig plan mot ditt mål och följer den här, vecka för vecka."
        />
      </>
    );
  }

  const past = instances.filter((i) => i.id !== chosen?.id);
  const pastList = past.length > 0 && (
    <Card className="mt-6">
      <CardTitle>Tidigare planer</CardTitle>
      <ul className="divide-y divide-line">
        {past.map((i) => (
          <li key={i.id}>
            <Link
              href={`${routes.myPlan}?plan=${i.id}`}
              className="flex justify-between gap-3 py-2.5 text-sm hover:text-accent"
            >
              <span>{i.title}</span>
              <span className="text-text-subtle">
                {shortDate(i.start_date)} · {i.status}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );

  if (!chosen) {
    return (
      <>
        <PageHeader title="Min plan" />
        <EmptyState
          title="Ingen aktiv plan"
          description="Välj en plan mot ditt mål i planbiblioteket. Du väljer längd och nivå när du startar."
          action={
            <ButtonLink href={routes.planLibrary}>
              <Library aria-hidden className="size-4" />
              Till planbiblioteket
            </ButtonLink>
          }
        />
        {pastList}
      </>
    );
  }

  const [view, canEdit, workouts] = await Promise.all([
    loadPlanView(chosen.id, today),
    canEditPlan(user.adept.id),
    listWorkoutOptions(user.adept.id),
  ]);
  if (!view) redirect(routes.planLibrary);

  const weekParam = Number(query.vecka);
  return (
    <>
      <PageHeader
        title="Min plan"
        description="Planen ligger fast. Du loggar passen, flyttar dem när veckan kräver det och byter nivå själv – från nästa vecka, stegvis eller tillfälligt."
      />
      <PlanPage
        view={view}
        basePath={
          chosen.status === "aktiv"
            ? routes.myPlan
            : `${routes.myPlan}?plan=${chosen.id}`
        }
        weekParam={
          Number.isFinite(weekParam) && weekParam > 0 ? weekParam : null
        }
        mode={query.vy === "hela" ? "hela" : "vecka"}
        canEdit={canEdit}
        workouts={workouts}
        today={today}
      />
      {pastList}
    </>
  );
}
