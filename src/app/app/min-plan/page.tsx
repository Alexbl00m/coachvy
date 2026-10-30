import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Library } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { PlanPage } from "@/components/plan-library/plan/plan-page";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardTitle, EmptyState } from "@/components/ui/card";
import { requireSessionUser } from "@/lib/auth/session";
import {
  canEditPlan,
  listWorkoutOptions,
  loadPlanView,
} from "@/lib/plan-library/plan-view";
import { loadRunningFitness } from "@/lib/plan-library/fitness";
import { INSTANCE_STATUS_LABEL } from "@/lib/plan-library/labels";
import { listInstances } from "@/lib/plan-library/queries";
import { routes } from "@/lib/routes";
import { longDate, todayIso, weekdayName } from "@/lib/season/season";

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

  // Faserna coachen lagt i kö, först den som börjar först, och de som är slut.
  const upcoming = instances
    .filter((i) => i.status === "kommande")
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  // Planen som visas, eller fasen som väntar när ingen pågår, står inte i listorna.
  const shownId = chosen?.id ?? upcoming[0]?.id;
  const others = instances.filter((i) => i.id !== shownId);
  const planList = (title: string, list: typeof instances) =>
    list.length > 0 && (
      <Card className="mt-6">
        <CardTitle>{title}</CardTitle>
        <ul className="divide-y divide-line">
          {list.map((i) => (
            <li key={i.id}>
              <Link
                href={`${routes.myPlan}?plan=${i.id}`}
                className="flex justify-between gap-3 py-2.5 text-sm hover:underline"
              >
                <span>{i.title}</span>
                <span className="text-text-subtle">
                  {shortDate(i.start_date)} ·{" "}
                  {INSTANCE_STATUS_LABEL[i.status] ?? i.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    );
  const pastList = (
    <>
      {planList(
        others.some((i) => i.status === "aktiv") ? "Pågår och i kö" : "Nästa faser",
        others
          .filter((i) => i.status === "aktiv" || i.status === "kommande")
          .sort((a, b) => a.start_date.localeCompare(b.start_date)),
      )}
      {planList(
        "Tidigare planer",
        others.filter((i) => i.status !== "kommande" && i.status !== "aktiv"),
      )}
    </>
  );

  // Coachen har lagt in en fas som inte börjat än.
  const next = upcoming[0];
  if (!chosen && next) {
    return (
      <>
        <PageHeader title="Min plan" />
        <EmptyState
          title={`${next.title} börjar ${weekdayName(next.start_date)} ${longDate(next.start_date, today)}`}
          description="Din coach har lagt in planen. Veckorna och passen syns redan, i planen och i kalendern på sina datum."
          action={
            <ButtonLink href={`${routes.myPlan}?plan=${next.id}`}>
              Se planen
              <ArrowRight aria-hidden className="size-4" />
            </ButtonLink>
          }
        />
        {pastList}
      </>
    );
  }

  if (!chosen) {
    return (
      <>
        <PageHeader title="Min plan" />
        <EmptyState
          title="Ingen aktiv plan"
          description="Välj en plan mot ditt mål i planbiblioteket: en din coach delat med dig, eller en ur biblioteket som medlem. Du väljer längd och nivå när du startar."
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

  const [view, canEdit, workouts, fitness] = await Promise.all([
    loadPlanView(chosen.id, today),
    canEditPlan(chosen.id),
    listWorkoutOptions(user.adept.id),
    loadRunningFitness(user.adept.id),
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
        fitness={fitness}
        userId={user.id}
      />
      {pastList}
    </>
  );
}
