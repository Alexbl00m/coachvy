import Link from "next/link";
import { ArrowRight, LayoutTemplate } from "lucide-react";

import { MembersOnly } from "@/components/members-only";
import { PageHeader } from "@/components/page-header";
import { PhaseLadder } from "@/components/plan-library/phase-ladder";
import { PillLinks } from "@/components/plan-library/pill-links";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { isMember } from "@/lib/auth/membership";
import { requireSessionUser } from "@/lib/auth/session";
import { rangeText } from "@/lib/plan-library/labels";
import { getActiveInstance, listLibrary } from "@/lib/plan-library/queries";
import { routes } from "@/lib/routes";

export const metadata = { title: "Planbibliotek" };

/**
 * Biblioteket: standardiserade planer för ett mål, som ingår i
 * medlemskapet. Medlemmen väljer plan, längd och nivå och följer den som
 * den är; nivån byter medlemmen själv när livet kräver det.
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
      description="Färdiga planer mot ett mål, från ospecifikt till specifikt. Välj längd och nivå när du startar – och byt nivå när livet kräver det."
      action={
        user.isAdmin ? (
          <ButtonLink href={routes.planTemplates} variant="secondary" size="sm">
            <LayoutTemplate aria-hidden className="size-4" />
            Planmallar
          </ButtonLink>
        ) : undefined
      }
    />
  );

  if (role === "adept" && !isMember(user)) {
    return (
      <>
        {header}
        <MembersOnly
          feature="Planbiblioteket"
          description="Som medlem väljer du en färdig plan mot ditt mål – maraton, triathlon, cykel eller simning – i den längd och nivå som passar dig, och byter nivå själv när det behövs."
        />
      </>
    );
  }

  const [entries, active] = await Promise.all([
    listLibrary(),
    user.adept ? getActiveInstance(user.adept.id) : Promise.resolve(null),
  ]);

  const categories = [
    ...new Map(
      entries
        .filter((e) => e.category)
        .map((e) => [e.category!.key, e.category!]),
    ).values(),
  ];
  const chosen = typeof query.mal === "string" ? query.mal : "alla";
  const shown =
    chosen === "alla"
      ? entries
      : entries.filter((e) => e.category?.key === chosen);

  return (
    <>
      {header}

      {active && (
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-text">
              Du följer {active.title}
            </p>
            <p className="text-[13px] text-text-muted">
              En plan i taget. Avsluta den aktiva för att starta en ny.
            </p>
          </div>
          <ButtonLink href={routes.myPlan} size="sm">
            Till min plan
            <ArrowRight aria-hidden className="size-4" />
          </ButtonLink>
        </Card>
      )}

      {entries.length === 0 ? (
        <EmptyState
          title="Inga planer ännu"
          description="Biblioteket fylls på med planer för Ironman, 70.3, maraton, cykel och simning."
        />
      ) : (
        <>
          {categories.length > 1 && (
            <div className="mb-5">
              <PillLinks
                label="Mål"
                active={chosen}
                items={[
                  { key: "alla", label: "Alla", href: routes.planLibrary },
                  ...categories.map((c) => ({
                    key: c.key,
                    label: c.name,
                    href: `${routes.planLibrary}?mal=${c.key}`,
                  })),
                ]}
              />
            </div>
          )}
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {shown.map(({ template, version, category, levels, phases }) => {
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
                  ? rangeText(Math.min(...lows), Math.max(...highs), "h/vecka")
                  : "";
              return (
                <li key={template.id}>
                  <Link
                    href={`${routes.planLibrary}/${template.slug}`}
                    className="lift flex h-full flex-col rounded-lg border border-line bg-surface p-5 transition-colors hover:border-line-strong"
                  >
                    <span className="text-[12px] text-text-subtle">
                      {[category?.name, weeks].filter(Boolean).join(" · ")}
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
                      <span className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-text-muted">
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
            })}
          </ul>
        </>
      )}
    </>
  );
}
