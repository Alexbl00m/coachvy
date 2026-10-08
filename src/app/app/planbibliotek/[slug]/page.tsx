import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronLeft } from "lucide-react";

import { MembersOnly } from "@/components/members-only";
import { PageHeader } from "@/components/page-header";
import { PhaseLadder } from "@/components/plan-library/phase-ladder";
import { PillLinks } from "@/components/plan-library/pill-links";
import { TemplateWeeks } from "@/components/plan-library/template-weeks";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { isMember } from "@/lib/auth/membership";
import { requireSessionUser } from "@/lib/auth/session";
import {
  intensityText,
  rangeText,
  SPECIFICITY_LABEL,
} from "@/lib/plan-library/labels";
import {
  getActiveInstance,
  listDisciplines,
  loadPublishedBySlug,
} from "@/lib/plan-library/queries";
import { routes } from "@/lib/routes";

export const metadata = { title: "Plan" };

/**
 * En plan i biblioteket: målet, faserna, nivåerna och en exempelvecka per
 * fas – så att medlemmen ser hur planen går från ospecifikt till specifikt
 * innan den startas.
 */
export default async function LibraryPlanPage({
  params,
  searchParams,
}: PageProps<"/app/planbibliotek/[slug]">) {
  const user = await requireSessionUser();
  const { slug } = await params;
  const query = await searchParams;
  const role = user.profile?.role;

  if (role === "adept" && !isMember(user)) {
    return (
      <>
        <PageHeader title="Planbibliotek" />
        <MembersOnly
          feature="Planbiblioteket"
          description="Som medlem väljer du en färdig plan mot ditt mål, i den längd och nivå som passar dig."
        />
      </>
    );
  }

  const [content, disciplines, active] = await Promise.all([
    loadPublishedBySlug(slug),
    listDisciplines(),
    user.adept ? getActiveInstance(user.adept.id) : Promise.resolve(null),
  ]);
  if (!content) notFound();

  const { version, levels, phases, weeks, domain } = content;
  const level =
    levels.find((l) => l.id === query.niva) ??
    levels[Math.floor(levels.length / 2)] ??
    levels[0];
  const weeksIn = (phaseId: string) =>
    weeks.filter((w) => w.phase_id === phaseId);
  // En vanlig vecka från varje fas visar trappan från ospecifikt till specifikt.
  const sample = phases.flatMap((p) => {
    const own = weeksIn(p.id);
    const pick = own.find((w) => w.kind === "normal") ?? own[0];
    return pick ? [pick] : [];
  });
  const canStart = role === "adept" && isMember(user) && !active;
  const length =
    version.min_weeks === version.max_weeks
      ? `${version.max_weeks} veckor`
      : `${version.min_weeks}–${version.max_weeks} veckor`;

  return (
    <>
      <Link
        href={routes.planLibrary}
        className="mb-3 inline-flex items-center gap-1 text-[13px] text-text-muted hover:text-text"
      >
        <ChevronLeft aria-hidden className="size-4" />
        Planbibliotek
      </Link>
      <PageHeader
        title={version.title}
        description={[content.category?.name, length, version.summary]
          .filter(Boolean)
          .join(" · ")}
        action={
          canStart ? (
            <ButtonLink
              href={`${routes.planLibrary}/${slug}/starta`}
              className="font-semibold"
            >
              Starta planen
              <ArrowRight aria-hidden className="size-4" />
            </ButtonLink>
          ) : active ? (
            <ButtonLink href={routes.myPlan} variant="secondary">
              Du följer {active.title}
            </ButtonLink>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card>
            <CardTitle>Faserna</CardTitle>
            <PhaseLadder
              phases={phases.map((p) => ({
                id: p.id,
                name: p.name,
                weeks: weeksIn(p.id).length,
                specificity: p.specificity,
              }))}
            />
            <ol className="mt-5 grid gap-4 sm:grid-cols-2">
              {phases.map((p) => (
                <li key={p.id} className="border-t border-line pt-3">
                  <p className="text-sm font-medium text-text">
                    {p.name}{" "}
                    <span className="font-normal text-text-subtle">
                      · {weeksIn(p.id).length} v
                      {p.trim_order !== null &&
                      p.min_weeks < weeksIn(p.id).length
                        ? ` (minst ${p.min_weeks})`
                        : ""}
                      {p.specificity
                        ? ` · ${SPECIFICITY_LABEL[p.specificity].toLowerCase()}`
                        : ""}
                    </span>
                  </p>
                  {p.purpose && (
                    <p className="mt-1 text-[13px] leading-relaxed text-text-muted">
                      {p.purpose}
                    </p>
                  )}
                  {p.focus && (
                    <p className="mt-1 text-[13px] leading-relaxed text-text-subtle">
                      Fokus: {p.focus}
                    </p>
                  )}
                  {intensityText(p.intensity) && (
                    <p className="mt-1 text-[12px] text-text-subtle tabular-nums">
                      Intensitet {intensityText(p.intensity)}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </Card>

          {level && (
            <Card>
              <CardTitle>En vecka ur varje fas</CardTitle>
              <div className="mb-4">
                <PillLinks
                  label="Nivå"
                  active={level.id}
                  items={levels.map((l) => ({
                    key: l.id,
                    label: `${l.key} · ${l.name}`,
                    href: `${routes.planLibrary}/${slug}?niva=${l.id}`,
                  }))}
                />
              </div>
              <TemplateWeeks
                phases={phases.map((p) => ({ id: p.id, name: p.name }))}
                weeks={sample.map((w) => ({
                  id: w.id,
                  phaseId: w.phase_id,
                  position: w.position,
                  kind: w.kind,
                  title: w.title,
                }))}
                sessions={domain.sessions}
                levelId={level.id}
                disciplineName={(key) =>
                  disciplines.find((d) => d.key === key)?.name ?? key
                }
              />
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardTitle>Nivåerna</CardTitle>
            <ul className="space-y-4">
              {levels.map((l) => (
                <li
                  key={l.id}
                  className="border-t border-line pt-3 first:border-0 first:pt-0"
                >
                  <p className="text-sm font-medium text-text">
                    {l.key} · {l.name}
                  </p>
                  <p className="text-[12px] text-text-subtle tabular-nums">
                    {[
                      rangeText(l.hours_min, l.hours_max, "h/vecka"),
                      rangeText(l.sessions_min, l.sessions_max, "pass"),
                      intensityText(l.intensity),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {l.description && (
                    <p className="mt-1 text-[13px] leading-relaxed text-text-muted">
                      {l.description}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[12px] leading-relaxed text-text-subtle">
              Du väljer nivå när du startar och byter när du vill – från nästa
              vecka, stegvis eller tillfälligt, till exempel under en resa.
            </p>
          </Card>

          {(version.goal || version.description || version.prerequisites) && (
            <Card>
              <CardTitle>Om planen</CardTitle>
              <div className="space-y-3 text-sm leading-relaxed text-text-muted">
                {version.goal && <p>{version.goal}</p>}
                {version.description &&
                  version.description
                    .split(/\n{2,}/)
                    .map((para) => <p key={para}>{para}</p>)}
                {version.prerequisites && (
                  <p>
                    <span className="font-medium text-text">
                      Förkunskaper:{" "}
                    </span>
                    {version.prerequisites}
                  </p>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
