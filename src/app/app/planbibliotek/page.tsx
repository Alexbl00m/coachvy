import Link from "next/link";
import { ArrowRight, LayoutTemplate } from "lucide-react";

import { MembersOnly } from "@/components/members-only";
import { PageHeader } from "@/components/page-header";
import { PhaseLadder } from "@/components/plan-library/phase-ladder";
import { PillLinks } from "@/components/plan-library/pill-links";
import { PlanSuggestions } from "@/components/plan-library/plan-suggestions";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { listAdepts } from "@/lib/adepts/queries";
import { canBuildPlans, isMember } from "@/lib/auth/membership";
import { requireSessionUser } from "@/lib/auth/session";
import { focusLabel, PLAN_FOCUS } from "@/lib/plan-library/focus";
import { rangeText } from "@/lib/plan-library/labels";
import { getActiveInstance, listLibrary } from "@/lib/plan-library/queries";
import { planSuggestions } from "@/lib/plan-library/suggestions";
import { adeptHref, routes } from "@/lib/routes";

export const metadata = { title: "Planbibliotek" };

/**
 * Biblioteket: planer mot ett mål. Coachvys och andra coachers planer som
 * delats med alla medlemmar ingår i medlemskapet; det adeptens egen coach
 * delat når adepten utan. Adepten väljer plan, längd och nivå och följer
 * den som den är; nivån byter adepten själv när livet kräver det.
 */
export default async function PlanLibraryPage({
  searchParams,
}: PageProps<"/app/planbibliotek">) {
  const user = await requireSessionUser();
  const role = user.profile?.role;
  const query = await searchParams;

  const header = (
    <PageHeader
      title="Planbibliotek"
      description="Färdiga planer mot ett mål, från ospecifikt till specifikt. Välj längd och nivå när du startar, och byt nivå när livet kräver det."
      action={
        canBuildPlans(user) ? (
          <ButtonLink href={routes.planTemplates} variant="secondary" size="sm">
            <LayoutTemplate aria-hidden className="size-4" />
            Planmallar
          </ButtonLink>
        ) : undefined
      }
    />
  );

  const [entries, active, suggestions, adepts] = await Promise.all([
    listLibrary(),
    user.adept ? getActiveInstance(user.adept.id) : Promise.resolve(null),
    // Förslaget gäller adepten själv, och bara när ingen plan är igång.
    user.adept ? planSuggestions(user.adept.id) : Promise.resolve([]),
    // Coachen som kom hit från en adept väljer plan åt den.
    role === "coach" && typeof query.adept === "string" ? listAdepts() : Promise.resolve([]),
  ]);
  const forAdept =
    adepts.find((a) => a.id === query.adept && a.coach_id === user.id) ?? null;

  // Utan medlemskap ser adepten bara det coachen delat med hen.
  const memberless = role === "adept" && !isMember(user);
  if (memberless && entries.length === 0) {
    return (
      <>
        {header}
        <MembersOnly
          feature="Planbiblioteket"
          description="Som medlem väljer du en färdig plan mot ditt mål, för maraton, triathlon, cykel eller simning, i den längd och nivå som passar dig. Planer din coach delar med dig når du utan medlemskap."
        />
      </>
    );
  }

  const categories = [
    ...new Map(
      entries
        .filter((e) => e.category)
        .map((e) => [e.category!.key, e.category!]),
    ).values(),
  ];
  const chosen = typeof query.mal === "string" ? query.mal : "alla";
  // Fokus: vad planen utvecklar. Filtren kombineras.
  const focuses = PLAN_FOCUS.filter((f) =>
    entries.some((e) => e.template.focus === f.key),
  );
  const chosenFocus = typeof query.fokus === "string" ? query.fokus : "alla";
  const shown = entries.filter(
    (e) =>
      (chosen === "alla" || e.category?.key === chosen) &&
      (chosenFocus === "alla" || e.template.focus === chosenFocus),
  );
  const href = (mal: string, fokus: string) => {
    const params = new URLSearchParams();
    if (forAdept) params.set("adept", forAdept.id);
    if (mal !== "alla") params.set("mal", mal);
    if (fokus !== "alla") params.set("fokus", fokus);
    const qs = params.toString();
    return qs ? `${routes.planLibrary}?${qs}` : routes.planLibrary;
  };

  return (
    <>
      {header}

      {active && (
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-text">
              Du följer {active.title}
            </p>
            <p className="text-[0.8125rem] text-text-muted">
              En plan i taget. Avsluta den aktiva för att starta en ny.
            </p>
          </div>
          <ButtonLink href={routes.myPlan} size="sm">
            Till min plan
            <ArrowRight aria-hidden className="size-4" />
          </ButtonLink>
        </Card>
      )}

      {!active && <PlanSuggestions suggestions={suggestions} forCoach={false} />}

      {forAdept && (
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-text">
              Du väljer plan för {forAdept.full_name}
            </p>
            <p className="text-[0.8125rem] text-text-muted">
              Öppna en plan och lägg på den därifrån. Den hamnar sist i
              adeptens faser.
            </p>
          </div>
          <ButtonLink
            href={`${adeptHref(forAdept.id, "plan")}?fas=valj`}
            size="sm"
            variant="secondary"
          >
            Tillbaka till {forAdept.full_name.split(" ")[0]}
          </ButtonLink>
        </Card>
      )}

      {memberless && (
        <p className="mb-5 text-[0.8125rem] text-text-muted">
          Planerna din coach delat med dig. Som medlem når du hela
          planbiblioteket.
        </p>
      )}

      {entries.length === 0 ? (
        <EmptyState
          title="Inga planer ännu"
          description="Biblioteket fylls på med planer för Ironman, 70.3, maraton, cykel och simning."
        />
      ) : (
        <>
          {(categories.length > 1 || focuses.length > 1) && (
            <div className="mb-5 space-y-3">
              {categories.length > 1 && (
                <PillLinks
                  label="Mål"
                  active={chosen}
                  items={[
                    { key: "alla", label: "Alla", href: href("alla", chosenFocus) },
                    ...categories.map((c) => ({
                      key: c.key,
                      label: c.name,
                      href: href(c.key, chosenFocus),
                    })),
                  ]}
                />
              )}
              {focuses.length > 1 && (
                <PillLinks
                  label="Fokus"
                  active={chosenFocus}
                  items={[
                    { key: "alla", label: "Alla", href: href(chosen, "alla") },
                    ...focuses.map((f) => ({
                      key: f.key,
                      label: f.label,
                      href: href(chosen, f.key),
                    })),
                  ]}
                />
              )}
            </div>
          )}
          {shown.length === 0 && (
            <p className="text-sm text-text-muted">Inga planer med de valen.</p>
          )}
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {shown.map(
              ({
                template,
                version,
                category,
                levels,
                phases,
                own,
                author,
              }) => {
                const weeks =
                  version.min_weeks === version.max_weeks
                    ? `${version.max_weeks} veckor`
                    : `${version.min_weeks}–${version.max_weeks} veckor`;
                const lows = levels.flatMap(
                  (l) => l.hours_min ?? l.hours_max ?? [],
                );
                const highs = levels.flatMap(
                  (l) => l.hours_max ?? l.hours_min ?? [],
                );
                const hours =
                  lows.length > 0
                    ? rangeText(
                        Math.min(...lows),
                        Math.max(...highs),
                        "h/vecka",
                      )
                    : "";
                return (
                  <li key={template.id}>
                    <Link
                      href={`${routes.planLibrary}/${template.slug}${forAdept ? `?adept=${forAdept.id}` : ""}`}
                      className="lift flex h-full flex-col rounded-lg border border-line bg-surface p-5 transition-colors hover:border-line-strong"
                    >
                      <span className="text-[0.75rem] text-text-subtle">
                        {[
                          own ? "Din plan" : author,
                          category?.name,
                          focusLabel(template.focus),
                          weeks,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      <span className="mt-1 text-base font-semibold text-text">
                        {version.title}
                      </span>
                      {version.summary && (
                        <span className="mt-1 text-sm leading-relaxed text-text-muted">
                          {version.summary}
                        </span>
                      )}
                      <span className="mt-auto pt-5">
                        <PhaseLadder
                          phases={phases}
                          showLabels={false}
                          className="opacity-90"
                        />
                        <span className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[0.75rem] text-text-muted">
                          <span>
                            {levels.length}{" "}
                            {levels.length === 1 ? "nivå" : "nivåer"}:{" "}
                            {levels.map((l) => l.key).join(", ")}
                          </span>
                          {hours && !hours.includes("Infinity") && (
                            <span>{hours}</span>
                          )}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              },
            )}
          </ul>
        </>
      )}
    </>
  );
}
