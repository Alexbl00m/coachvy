import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { NewTemplateForm } from "@/components/plan-library/admin/new-template-form";
import { StatusChip } from "@/components/plan-library/status-chip";
import { Card, CardTitle, EmptyState } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/session";
import { listAdminTemplates, listCategories } from "@/lib/plan-library/queries";
import { routes } from "@/lib/routes";

export const metadata = { title: "Planmallar" };

const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));

/**
 * Mallarna bakom planbiblioteket. Bara admin skriver dem: en publicerad
 * version ändras aldrig, så en ändring blir ett nytt utkast som publiceras
 * när det är klart.
 */
export default async function PlanTemplatesPage() {
  await requireAdmin();
  const [templates, categories] = await Promise.all([
    listAdminTemplates(),
    listCategories(),
  ]);

  return (
    <>
      <PageHeader
        title="Planmallar"
        description="Mallarna medlemmarna väljer bland i planbiblioteket. En publicerad version ändras aldrig – ändringar görs i ett nytt utkast, och planer som redan startats behåller sin version."
      />

      <div className="space-y-6">
        <Card>
          <CardTitle>Ny mall</CardTitle>
          <NewTemplateForm
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          />
        </Card>

        {templates.length === 0 ? (
          <EmptyState
            title="Inga mallar ännu"
            description="Skapa en mall ovan. Den börjar som ett utkast med tre nivåer och fyra faser att bygga vidare på."
          />
        ) : (
          <Card className="p-0 sm:p-0">
            <ul className="divide-y divide-line">
              {templates.map((t) => {
                const latest = t.versions[0];
                const published = t.versions.find(
                  (v) => v.status === "publicerad",
                );
                const draft = t.versions.find((v) => v.status === "utkast");
                return (
                  <li key={t.id}>
                    <Link
                      href={`${routes.planTemplates}/${t.id}`}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-4 transition-colors hover:bg-surface-2 sm:px-6"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-text">
                          {latest?.title ?? t.slug}
                        </span>
                        <span className="block text-[13px] text-text-subtle">
                          {[
                            t.category?.name,
                            t.instances > 0
                              ? `${t.instances} ${t.instances === 1 ? "plan" : "planer"} startade`
                              : null,
                            latest
                              ? `ändrad ${shortDate(latest.updated_at)}`
                              : null,
                            t.archived_at ? "arkiverad" : null,
                            t.is_example ? "exempel" : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <span className="flex gap-1.5">
                        {published && (
                          <StatusChip
                            status="publicerad"
                            version={published.version}
                          />
                        )}
                        {draft && (
                          <StatusChip status="utkast" version={draft.version} />
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
