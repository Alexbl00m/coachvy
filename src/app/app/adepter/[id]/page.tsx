import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AdeptInfoCard } from "@/components/adepts/adept-info-card";
import { AdeptProfileForm } from "@/components/adepts/adept-profile-form";
import { PageHeader } from "@/components/page-header";
import { SessionPanel } from "@/components/tests/session-panel";
import { TestResultsPanel } from "@/components/tests/test-results-panel";
import { MessageThread } from "@/components/messages/message-thread";
import { LoadPanel } from "@/components/training/load-panel";
import { WorkoutPanel } from "@/components/workouts/workout-panel";
import { Card, CardTitle } from "@/components/ui/card";
import { getAdeptProfile } from "@/lib/adepts/profile";
import { getAdept } from "@/lib/adepts/queries";
import { requireSessionUser } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { formatDate, formatLastActive, formatValue } from "@/lib/format";
import { routes } from "@/lib/routes";
import { listTestResults, listTestTypes } from "@/lib/tests/queries";
import { sportOf } from "@/lib/tests/protocols";
import {
  rollingCriticalPower,
  rollingCriticalSpeed,
} from "@/lib/tests/rolling";
import { listMaximalEfforts, listSessions } from "@/lib/tests/session-queries";
import { countUnread, listMessages } from "@/lib/messages/queries";
import { listCheckins } from "@/lib/training/queries";
import { listWorkouts } from "@/lib/workouts/queries";

const TABS = [
  { key: "oversikt", label: "Översikt" },
  { key: "testtillfallen", label: "Testtillfällen" },
  { key: "pass", label: "Pass" },
  { key: "maende", label: "Mående" },
  { key: "meddelanden", label: "Meddelanden" },
  { key: "testresultat", label: "Enstaka värden" },
] as const;

export async function generateMetadata({
  params,
}: PageProps<"/app/adepter/[id]">) {
  const { id } = await params;
  const adept = await getAdept(id);
  return { title: adept?.full_name ?? "Adept" };
}

export default async function AdeptPage({
  params,
  searchParams,
}: PageProps<"/app/adepter/[id]">) {
  const user = await requireSessionUser();
  const { id } = await params;
  const query = await searchParams;

  // RLS decides visibility: a coach sees their own adepts, an adept sees only
  // their own row. Anything else comes back empty and reads as "finns inte".
  const adept = await getAdept(id);
  if (!adept) notFound();

  const isCoach = user.profile?.role === "coach";
  const canEdit = isCoach && adept.coach_id === user.id;

  const tab =
    typeof query.vy === "string" && TABS.some((t) => t.key === query.vy)
      ? query.vy
      : "oversikt";

  const sport = sportOf(adept.sport);

  const [
    results,
    testTypes,
    sessions,
    efforts,
    workouts,
    checkins,
    profile,
    messages,
    unread,
  ] = await Promise.all([
    listTestResults(adept.id),
    canEdit ? listTestTypes() : Promise.resolve([]),
    listSessions(adept.id),
    listMaximalEfforts(adept.id, sport),
    listWorkouts(adept.id),
    listCheckins(adept.id),
    getAdeptProfile(adept.id),
    listMessages(adept.id),
    countUnread(adept.id, user.id),
  ]);

  // Senaste hela testet, för att kunna säga om ett nyare bästavärde har
  // flyttat kurvan sedan dess.
  const lastFullTestOn = sessions[0]?.performed_on ?? null;
  const rolling =
    sport === "cykling"
      ? rollingCriticalPower({ efforts, lastFullTestOn })
      : rollingCriticalSpeed({ efforts, lastFullTestOn });

  const speedUnit = sport === "simning" ? "m/s" : "km/h";

  const latest = [...results].sort((a, b) =>
    b.tested_on.localeCompare(a.tested_on),
  )[0];

  return (
    <>
      {isCoach && (
        <Link
          href={routes.adepts}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-100"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Adepter
        </Link>
      )}

      <PageHeader
        title={adept.full_name}
        description={[adept.sport, adept.current_level]
          .filter(Boolean)
          .join(" · ")}
      />

      <div
        role="tablist"
        aria-label="Adeptvyer"
        // Sex flikar får inte plats på en telefon. Raden scrollar i sidled i
        // stället för att skjuta ut hela sidan – en sida som går att dra
        // vågrätt känns trasig, en flikrad som gör det är en känd gest.
        className="mb-6 flex gap-1 overflow-x-auto border-b border-ink-800 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map((item) => {
          const active = item.key === tab;
          return (
            <Link
              key={item.key}
              role="tab"
              aria-selected={active}
              href={`${routes.adepts}/${adept.id}?vy=${item.key}`}
              className={cn(
                "-mb-px shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition-colors",
                active
                  ? "border-accent font-medium text-ink-50"
                  : "border-transparent text-ink-400 hover:text-ink-100",
              )}
            >
              {item.label}
              {item.key === "meddelanden" && unread > 0 && (
                <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-medium text-accent-on tabular-nums">
                  {unread}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {tab === "oversikt" ? (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <AdeptInfoCard adept={adept} canEdit={canEdit} />

            <div className="space-y-6">
              <Card>
                <CardTitle>Senaste test</CardTitle>
                {latest ? (
                  <>
                    <p className="text-3xl font-semibold tracking-tight text-ink-50 tabular-nums">
                      {formatValue(Number(latest.value))}{" "}
                      <span className="text-base font-normal text-ink-300">
                        {latest.unit}
                      </span>
                    </p>
                    <p className="mt-1 text-[13px] text-ink-400">
                      {latest.test_type?.label ?? "Test"} ·{" "}
                      {formatDate(latest.tested_on)}
                    </p>
                    <Link
                      href={`${routes.adepts}/${adept.id}?vy=testresultat`}
                      className="mt-4 inline-block text-sm font-medium text-accent hover:text-accent-strong"
                    >
                      Alla testresultat ({results.length})
                    </Link>
                  </>
                ) : (
                  <p className="text-sm text-ink-400">
                    Inga testresultat registrerade ännu.
                  </p>
                )}
              </Card>

              <Card>
                <CardTitle>Aktivitet</CardTitle>
                <p className="text-sm text-ink-200">
                  {formatLastActive(adept.last_active_at)}
                </p>
                <p className="mt-1 text-[12px] text-ink-500">
                  Uppdateras när adepten loggar in.
                </p>
              </Card>
            </div>
          </div>

          <AdeptProfileForm adeptId={adept.id} profile={profile} />
        </div>
      ) : tab === "testtillfallen" ? (
        <SessionPanel
          adeptId={adept.id}
          sessions={sessions}
          rolling={rolling}
          rollingLabel={sport === "cykling" ? "CP" : "CS"}
          rollingUnit={sport === "cykling" ? "W" : speedUnit}
          reserveLabel={sport === "cykling" ? "W′" : "D′"}
          reserveUnit={sport === "cykling" ? "kJ" : "m"}
          canEdit={canEdit}
        />
      ) : tab === "pass" ? (
        <WorkoutPanel
          adeptId={adept.id}
          workouts={workouts}
          canEdit={canEdit}
        />
      ) : tab === "maende" ? (
        <LoadPanel adeptId={adept.id} checkins={checkins} />
      ) : tab === "meddelanden" ? (
        <MessageThread
          adeptId={adept.id}
          messages={messages}
          viewerId={user.id}
          adeptProfileId={adept.profile_id}
          adeptName={adept.full_name}
        />
      ) : (
        <TestResultsPanel
          adeptId={adept.id}
          adeptName={adept.full_name}
          results={results}
          testTypes={testTypes}
          canEdit={canEdit}
        />
      )}
    </>
  );
}
