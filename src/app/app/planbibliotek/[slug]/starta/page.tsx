import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StartWizard } from "@/components/plan-library/start-wizard";
import { isMember } from "@/lib/auth/membership";
import { requireSessionUser } from "@/lib/auth/session";
import {
  getActiveInstance,
  loadPublishedBySlug,
} from "@/lib/plan-library/queries";
import { peakVolume } from "@/lib/plan-library/volume";
import { routes } from "@/lib/routes";
import { listRaces } from "@/lib/season/queries";
import { todayIso } from "@/lib/season/season";

export const metadata = { title: "Starta plan" };

export default async function StartPlanPage({
  params,
}: PageProps<"/app/planbibliotek/[slug]/starta">) {
  const user = await requireSessionUser();
  const { slug } = await params;
  const back = `${routes.planLibrary}/${slug}`;
  // Medlemmen startar sin plan själv.
  if (user.profile?.role !== "adept" || !user.adept || !isMember(user))
    redirect(back);

  const [content, active, races] = await Promise.all([
    loadPublishedBySlug(slug),
    getActiveInstance(user.adept.id),
    listRaces(user.adept.id),
  ]);
  if (!content) notFound();
  if (active) redirect(routes.myPlan);

  const today = todayIso();
  const { version, levels, domain } = content;

  return (
    <>
      <Link
        href={back}
        className="mb-3 inline-flex items-center gap-1 text-[13px] text-text-muted hover:text-text"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {version.title}
      </Link>
      <PageHeader
        title={`Starta ${version.title}`}
        description="Förslaget räknas fram ur målet och längden. Justera faserna om du vill – planen ändras inte efter start, men nivån byter du när du vill."
      />
      <div className="max-w-3xl">
        <StartWizard
          versionId={version.id}
          title={version.title}
          minWeeks={version.min_weeks}
          maxWeeks={version.max_weeks}
          phases={domain.phases}
          weeks={domain.weeks}
          volumeUnit={domain.volumeUnit}
          today={today}
          races={races
            .filter((r) => r.race_date >= today)
            .sort(
              (a, b) =>
                a.priority.localeCompare(b.priority) ||
                a.race_date.localeCompare(b.race_date),
            )
            .map((r) => ({
              id: r.id,
              name: r.name,
              date: r.race_date,
              priority: r.priority,
            }))}
          levels={levels.map((l) => ({
            id: l.id,
            key: l.key,
            name: l.name,
            description: l.description,
            hoursMin: l.hours_min,
            hoursMax: l.hours_max,
            sessionsMin: l.sessions_min,
            sessionsMax: l.sessions_max,
            intensity: l.intensity,
            volumePeak: peakVolume(domain.volumes, l.id),
          }))}
        />
      </div>
    </>
  );
}
