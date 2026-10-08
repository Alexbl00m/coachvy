import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { LevelsEditor } from "@/components/plan-library/admin/levels-editor";
import { MetaForm } from "@/components/plan-library/admin/meta-form";
import { PhasesEditor } from "@/components/plan-library/admin/phases-editor";
import { TemplateActions } from "@/components/plan-library/admin/template-actions";
import { WeeksEditor } from "@/components/plan-library/admin/weeks-editor";
import { PillLinks } from "@/components/plan-library/pill-links";
import { StatusChip } from "@/components/plan-library/status-chip";
import { TemplateWeeks } from "@/components/plan-library/template-weeks";
import { Card, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/session";
import { intensityParts } from "@/lib/plan-library/labels";
import {
  listAdminTemplates,
  listCategories,
  listDisciplines,
  loadVersion,
} from "@/lib/plan-library/queries";
import { validateVersion } from "@/lib/plan-library/validate";
import { routes } from "@/lib/routes";

export const metadata = { title: "Planmall" };

const TABS = [
  { key: "oversikt", label: "Översikt" },
  { key: "nivaer", label: "Nivåer" },
  { key: "faser", label: "Faser" },
  { key: "veckor", label: "Veckor och pass" },
  { key: "forhandsvisning", label: "Förhandsvisning" },
] as const;

export default async function PlanTemplatePage({
  params,
  searchParams,
}: PageProps<"/app/planbibliotek/mallar/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const query = await searchParams;
  const one = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;

  const templates = await listAdminTemplates();
  const template = templates.find((t) => t.id === id);
  if (!template) notFound();

  const chosen =
    template.versions.find((v) => v.id === one(query.v)) ??
    template.versions.find((v) => v.status === "utkast") ??
    template.versions.find((v) => v.status === "publicerad") ??
    template.versions[0];
  if (!chosen) notFound();

  const [content, categories, disciplines] = await Promise.all([
    loadVersion(chosen.id),
    listCategories(),
    listDisciplines(),
  ]);
  if (!content) notFound();

  const { version, domain } = content;
  const editable = version.status === "utkast";
  const tab = TABS.find((t) => t.key === one(query.flik))?.key ?? "oversikt";
  const base = `${routes.planTemplates}/${id}?v=${version.id}`;
  const issues = validateVersion({ ...domain, minWeeks: version.min_weeks });
  const blocking = issues.filter((i) => i.level === "fel").length;
  const disciplineName = (key: string) =>
    disciplines.find((d) => d.key === key)?.name ?? key;
  const previewLevel =
    content.levels.find((l) => l.id === one(query.niva)) ?? content.levels[0];

  return (
    <>
      <Link
        href={routes.planTemplates}
        className="mb-3 inline-flex items-center gap-1 text-[13px] text-text-muted hover:text-text"
      >
        <ChevronLeft aria-hidden className="size-4" />
        Planmallar
      </Link>
      <PageHeader
        title={version.title}
        description={
          editable
            ? "Ett utkast. Ingen medlem ser det förrän det publiceras."
            : version.status === "publicerad"
              ? "Publicerad och låst. Gör ett nytt utkast för att ändra – planer som redan startats behåller den här versionen."
              : "En äldre version, låst. Planer som startades på den följer den fortfarande."
        }
        action={
          <TemplateActions
            templateId={id}
            versionId={version.id}
            status={version.status}
            hasDraft={template.versions.some((v) => v.status === "utkast")}
            archived={Boolean(template.archived_at)}
            blocking={blocking}
            instances={template.instances}
          />
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {template.versions.map((v) => (
          <Link
            key={v.id}
            href={`${routes.planTemplates}/${id}?v=${v.id}&flik=${tab}`}
            aria-current={v.id === version.id ? "page" : undefined}
            className={
              v.id === version.id
                ? "rounded-full ring-1 ring-text-subtle"
                : "rounded-full opacity-70 hover:opacity-100"
            }
          >
            <StatusChip status={v.status} version={v.version} />
          </Link>
        ))}
      </div>

      <div className="mb-6">
        <PillLinks
          label="Delar av mallen"
          active={tab}
          items={TABS.map((t) => ({
            key: t.key,
            label: t.label,
            href: `${base}&flik=${t.key}`,
          }))}
        />
      </div>

      {tab === "oversikt" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <Card>
            <CardTitle>Planen</CardTitle>
            <MetaForm
              key={version.id}
              templateId={id}
              versionId={version.id}
              editable={editable}
              maxWeeks={version.max_weeks}
              slug={content.template.slug}
              categoryId={content.template.category_id}
              categories={categories.map((c) => ({ id: c.id, name: c.name }))}
              initial={{
                title: version.title,
                summary: version.summary ?? "",
                goal: version.goal ?? "",
                description: version.description ?? "",
                prerequisites: version.prerequisites ?? "",
                minWeeks: version.min_weeks,
                volumeUnit: version.volume_unit,
              }}
            />
          </Card>
          <Card className="h-fit">
            <CardTitle>
              {editable ? "Redo att publicera?" : "Innehåll"}
            </CardTitle>
            <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
              <dt className="text-text-muted">Längd</dt>
              <dd className="text-right tabular-nums">
                {version.min_weeks === version.max_weeks
                  ? `${version.max_weeks} v`
                  : `${version.min_weeks}–${version.max_weeks} v`}
              </dd>
              <dt className="text-text-muted">Nivåer</dt>
              <dd className="text-right tabular-nums">
                {content.levels.length}
              </dd>
              <dt className="text-text-muted">Faser</dt>
              <dd className="text-right tabular-nums">
                {content.phases.length}
              </dd>
              <dt className="text-text-muted">Pass</dt>
              <dd className="text-right tabular-nums">
                {content.sessions.length}
              </dd>
            </dl>
            {editable && (
              <ul className="mt-4 space-y-1.5 border-t border-line pt-4 text-[13px] leading-snug">
                {issues.length === 0 ? (
                  <li className="text-good">Allt ser bra ut.</li>
                ) : (
                  issues.map((issue) => (
                    <li
                      key={issue.text}
                      className={
                        issue.level === "fel" ? "text-warn" : "text-text-muted"
                      }
                    >
                      {issue.level === "fel" ? "Måste rättas: " : ""}
                      {issue.text}
                    </li>
                  ))
                )}
              </ul>
            )}
          </Card>
        </div>
      )}

      {tab === "nivaer" && (
        <Card>
          <LevelsEditor
            key={version.id}
            versionId={version.id}
            editable={editable}
            initial={content.levels.map((l) => ({
              id: l.id,
              key: l.key,
              name: l.name,
              description: l.description ?? "",
              hoursMin: l.hours_min,
              hoursMax: l.hours_max,
              sessionsMin: l.sessions_min,
              sessionsMax: l.sessions_max,
              intensity: intensityParts(l.intensity),
            }))}
          />
        </Card>
      )}

      {tab === "faser" && (
        <Card>
          <PhasesEditor
            key={version.id}
            versionId={version.id}
            editable={editable}
            weeksPerPhase={Object.fromEntries(
              content.phases.map((p) => [
                p.id,
                content.weeks.filter((w) => w.phase_id === p.id).length,
              ]),
            )}
            initial={content.phases.map((p) => ({
              id: p.id,
              name: p.name,
              seasonPhase: p.season_phase,
              purpose: p.purpose ?? "",
              focus: p.focus ?? "",
              specificity: p.specificity,
              intensity: intensityParts(p.intensity),
              minWeeks: p.min_weeks,
              trimOrder: p.trim_order,
            }))}
          />
        </Card>
      )}

      {tab === "veckor" && (
        <WeeksEditor
          versionId={version.id}
          editable={editable}
          phases={content.phases.map((p) => ({ id: p.id, name: p.name }))}
          weeks={content.weeks.map((w) => ({
            id: w.id,
            phaseId: w.phase_id,
            position: w.position,
            kind: w.kind,
            title: w.title,
            note: w.note,
            checkpoint: w.checkpoint,
          }))}
          sessions={domain.sessions}
          volumes={domain.volumes}
          volumeUnit={domain.volumeUnit}
          levels={content.levels.map((l) => ({
            id: l.id,
            key: l.key,
            name: l.name,
          }))}
          disciplines={disciplines.map((d) => ({
            key: d.key,
            name: d.name,
            structureSport: d.structure_sport,
          }))}
        />
      )}

      {tab === "forhandsvisning" && previewLevel && (
        <div className="space-y-4">
          <PillLinks
            label="Nivå"
            active={previewLevel.id}
            items={content.levels.map((l) => ({
              key: l.id,
              label: `${l.key} · ${l.name}`,
              href: `${base}&flik=forhandsvisning&niva=${l.id}`,
            }))}
          />
          <TemplateWeeks
            phases={content.phases.map((p) => ({ id: p.id, name: p.name }))}
            weeks={content.weeks.map((w) => ({
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
            levelId={previewLevel.id}
            disciplineName={disciplineName}
          />
        </div>
      )}
    </>
  );
}
