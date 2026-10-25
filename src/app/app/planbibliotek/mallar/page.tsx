import Link from "next/link";
import { redirect } from "next/navigation";

import { MembersOnly } from "@/components/members-only";
import { PageHeader } from "@/components/page-header";
import { NewTemplateForm } from "@/components/plan-library/admin/new-template-form";
import { StatusChip } from "@/components/plan-library/status-chip";
import { Card, CardTitle, EmptyState } from "@/components/ui/card";
import { canBuildPlans } from "@/lib/auth/membership";
import { requireSessionUser } from "@/lib/auth/session";
import { listAdminTemplates, listCategories } from "@/lib/plan-library/queries";
import { routes } from "@/lib/routes";
import { listSharesFor } from "@/lib/sharing/queries";
import { shareSummary } from "@/lib/sharing/shares";

export const metadata = { title: "Planmallar" };

const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));

/**
 * Coachens egna planer. Coacher med medlemskap och admin skriver dem: en
 * publicerad version ändras aldrig, så en ändring blir ett nytt utkast som
 * publiceras när det är klart. Vem som ser en plan väljer ägaren.
 */
export default async function PlanTemplatesPage() {
  const user = await requireSessionUser();
  if (user.profile?.role !== "coach" && !user.isAdmin) {
    redirect(routes.planLibrary);
  }
  const header = (
    <PageHeader
      title="Planmallar"
      description="Dina egna planer. En publicerad version ändras aldrig: ändringar görs i ett nytt utkast, och planer som redan startats behåller sin version. Du väljer vem som ser varje plan."
    />
  );
  if (!canBuildPlans(user)) {
    return (
      <>
        {header}
        <MembersOnly
          feature="Egna planer"
          description="Med medlemskap bygger du egna planer mot ett mål, i nivåer och faser, och delar dem med dina adepter, med alla medlemmar eller med andra coacher. Dina adepter behöver inget eget medlemskap för det du delar med dem."
        />
      </>
    );
  }

  const [templates, categories] = await Promise.all([
    listAdminTemplates(),
    listCategories(),
  ]);
  const shares = await listSharesFor(
    "plan",
    templates.map((t) => t.id),
  );

  return (
    <>
      {header}

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
            description="Skapa en mall ovan, eller kopiera en plan ur planbiblioteket. En ny mall börjar som ett utkast med tre nivåer och fyra faser att bygga vidare på."
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
                        <span className="block text-[0.8125rem] text-text-subtle">
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
                        <span className="block text-[0.8125rem] text-text-subtle">
                          Ser planen: {shareSummary(shares.get(t.id) ?? [])}
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
