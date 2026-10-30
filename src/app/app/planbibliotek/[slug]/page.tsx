import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronLeft } from "lucide-react";

import { MembersOnly } from "@/components/members-only";
import { PageHeader } from "@/components/page-header";
import { AssignPlanButton } from "@/components/plan-library/assign-plan-button";
import { CopyPlanButton } from "@/components/plan-library/copy-plan-button";
import { PhaseLadder } from "@/components/plan-library/phase-ladder";
import { PillLinks } from "@/components/plan-library/pill-links";
import { TemplateWeeks } from "@/components/plan-library/template-weeks";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { canBuildPlans, isMember } from "@/lib/auth/membership";
import { listAdepts } from "@/lib/adepts/queries";
import { requireSessionUser } from "@/lib/auth/session";
import {
  intensityText,
  levelOptionLabel,
  rangeText,
  SPECIFICITY_LABEL,
} from "@/lib/plan-library/labels";
import {
  getActiveInstance,
  listDisciplines,
  listQueueEnds,
  loadPublishedBySlug,
  planAccessFor,
} from "@/lib/plan-library/queries";
import { nextMonday } from "@/lib/plan-library/queue";
import { peakVolume, volumeText } from "@/lib/plan-library/volume";
import { adeptHref, routes } from "@/lib/routes";
import { todayIso } from "@/lib/season/season";

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

  const [content, disciplines, active, adepts] = await Promise.all([
    loadPublishedBySlug(slug),
    listDisciplines(),
    user.adept ? getActiveInstance(user.adept.id) : Promise.resolve(null),
    // Coachen lägger planen på sina adepter.
    role === "coach" ? listAdepts() : Promise.resolve([]),
  ]);
  // En plan adepten inte når: den ingår i medlemskapet, eller finns inte.
  if (!content) {
    if (role === "adept" && !isMember(user)) {
      return (
        <>
          <PageHeader title="Planbiblioteket" />
          <MembersOnly
            feature="Planbiblioteket"
            description="Som medlem väljer du en färdig plan mot ditt mål, i den längd och nivå som passar dig. Planer din coach delar med dig når du utan medlemskap."
          />
        </>
      );
    }
    notFound();
  }
  const access =
    role === "adept" && user.adept
      ? await planAccessFor(user.adept.id, content.template.id)
      : null;
  const own = content.template.owner_id === user.id;
  // Coachens egna adepter, och var nästa fas börjar för dem som har en kö.
  const ownAdepts = adepts.filter((a) => a.coach_id === user.id);
  const queues = await listQueueEnds(ownAdepts.map((a) => a.id));
  // Coachen kom hit från en adept: adepten följer med i länkarna.
  const forAdept = ownAdepts.find((a) => a.id === query.adept) ?? null;
  const withAdept = (href: string) =>
    forAdept ? `${href}${href.includes("?") ? "&" : "?"}adept=${forAdept.id}` : href;

  const { version, levels, phases, weeks, domain } = content;
  const peak = (levelId: string) => peakVolume(domain.volumes, levelId);
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
  const canStart = role === "adept" && access !== null && !active;
  const length =
    version.min_weeks === version.max_weeks
      ? `${version.max_weeks} veckor`
      : `${version.min_weeks}–${version.max_weeks} veckor`;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem]">
        <Link
          href={withAdept(routes.planLibrary)}
          className="inline-flex items-center gap-1 text-text-muted hover:text-text"
        >
          <ChevronLeft aria-hidden className="size-4" />
          Planbibliotek
        </Link>
        {forAdept && (
          <Link
            href={`${adeptHref(forAdept.id, "plan")}?fas=valj`}
            className="inline-flex items-center gap-1 text-text-muted hover:text-text"
          >
            <ChevronLeft aria-hidden className="size-4" />
            Välj plan för {forAdept.full_name.split(" ")[0]}
          </Link>
        )}
      </div>
      <PageHeader
        title={version.title}
        description={[content.category?.name, length, version.summary]
          .filter(Boolean)
          .join(" · ")}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {role === "coach" && (
              <AssignPlanButton
                // Nivån coachen tittar på följer med in i dialogen.
                key={level?.id}
                versionId={version.id}
                title={version.title}
                minWeeks={version.min_weeks}
                maxWeeks={version.max_weeks}
                levels={[...levels]
                  .sort((a, b) => b.rank - a.rank)
                  .map((l) => ({ id: l.id, label: levelOptionLabel(l) }))}
                initialLevelId={level?.id ?? ""}
                defaultStart={nextMonday(todayIso())}
                adepts={ownAdepts.map((a) => ({ id: a.id, full_name: a.full_name }))}
                queues={Object.fromEntries(queues)}
                initialAdeptId={forAdept?.id}
              />
            )}
            {canStart ? (
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
          ) : own ? (
            <ButtonLink
              href={`${routes.planTemplates}/${content.template.id}`}
              variant="secondary"
            >
              Ändra i planmallar
            </ButtonLink>
          ) : canBuildPlans(user) ? (
            <CopyPlanButton templateId={content.template.id} />
          ) : undefined}
          </div>
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
                    <p className="mt-1 text-[0.8125rem] leading-relaxed text-text-muted">
                      {p.purpose}
                    </p>
                  )}
                  {p.focus && (
                    <p className="mt-1 text-[0.8125rem] leading-relaxed text-text-subtle">
                      Fokus: {p.focus}
                    </p>
                  )}
                  {intensityText(p.intensity) && (
                    <p className="mt-1 text-[0.75rem] text-text-subtle tabular-nums">
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
                    href: withAdept(`${routes.planLibrary}/${slug}?niva=${l.id}`),
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
                  checkpoint: w.checkpoint,
                }))}
                sessions={domain.sessions}
                volumes={domain.volumes}
                volumeUnit={domain.volumeUnit}
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
                  <p className="text-[0.75rem] text-text-subtle tabular-nums">
                    {[
                      peak(l.id) !== null
                        ? `upp till ${volumeText({ min: peak(l.id)!, max: null }, domain.volumeUnit)}/vecka`
                        : null,
                      rangeText(l.hours_min, l.hours_max, "h/vecka"),
                      rangeText(l.sessions_min, l.sessions_max, "pass"),
                      intensityText(l.intensity),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {l.description && (
                    <p className="mt-1 text-[0.8125rem] leading-relaxed text-text-muted">
                      {l.description}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[0.8125rem] leading-relaxed text-text-muted">
              Du väljer nivå när du startar och byter när du vill: från nästa
              vecka, stegvis eller tillfälligt under en resa.
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
