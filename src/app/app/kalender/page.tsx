import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  groupByDay,
  phaseByDay,
  emptyDay,
} from "@/components/calendar/calendar-items";
import { DayPanel, Upcoming } from "@/components/calendar/day-panel";
import { MonthGrid, monthDates } from "@/components/calendar/month-grid";
import { PageHeader } from "@/components/page-header";
import { AdeptPicker } from "@/components/progression/adept-picker";
import { PHASE_SHORT, phaseFill } from "@/components/season/phase-style";
import { EmptyState } from "@/components/ui/card";
import { getMyAdeptRow, listAdepts } from "@/lib/adepts/queries";
import { requireSessionUser } from "@/lib/auth/session";
import {
  listCheckinsBetween,
  listScheduledWorkouts,
  listSessionsBetween,
} from "@/lib/calendar/queries";
import { routes } from "@/lib/routes";
import { listBlocks, listRacesBetween } from "@/lib/season/queries";
import { addDays, monthName, todayIso } from "@/lib/season/season";
import { TRAINING_PHASES } from "@/lib/tests/phases";
import type { Adept } from "@/lib/types/database";

export const metadata = { title: "Kalender" };

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function shiftMonth(month: string, months: number): string {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + months;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

const monthTitle = (month: string) => {
  const name = monthName(Number(month.slice(5, 7)) - 1);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${month.slice(0, 4)}`;
};

/**
 * Kalendern: planerade pass, tester, tävlingar och säsongens faser, dag för
 * dag. Coachen ser alla sina adepter på en gång eller en i taget; med en
 * adept vald färgas dagarna efter fasen och incheckningarna syns.
 */
export default async function KalenderPage({
  searchParams,
}: PageProps<"/app/kalender">) {
  const user = await requireSessionUser();
  const query = await searchParams;
  const today = todayIso();
  const isCoach = user.profile?.role === "coach";

  let adept: Adept | null = null;
  let picker: React.ReactNode = null;

  if (isCoach) {
    const own = (await listAdepts()).filter((a) => a.coach_id === user.id);
    const wanted = typeof query.adept === "string" ? query.adept : null;
    adept = own.find((a) => a.id === wanted) ?? null;
    picker =
      own.length > 0 ? (
        <AdeptPicker
          adepts={[
            { id: "alla", name: "Alla adepter" },
            ...own.map((a) => ({ id: a.id, name: a.full_name })),
          ]}
          current={adept?.id ?? "alla"}
          basePath={routes.calendar}
        />
      ) : null;
  } else {
    adept = await getMyAdeptRow(user.id);
    if (!adept) {
      return (
        <>
          <PageHeader title="Kalender" />
          <EmptyState
            title="Ingen adeptprofil hittades"
            description="Kalendern visar en adepts pass, tester och tävlingar. Ditt konto är inte kopplat till någon adeptprofil."
          />
        </>
      );
    }
  }

  const adeptId = adept?.id ?? null;
  const month =
    typeof query.manad === "string" && MONTH.test(query.manad)
      ? query.manad
      : today.slice(0, 7);
  const dates = monthDates(month);
  const selected =
    typeof query.dag === "string" &&
    DAY.test(query.dag) &&
    dates.includes(query.dag)
      ? query.dag
      : today.slice(0, 7) === month
        ? today
        : `${month}-01`;

  // Månaden och de närmaste två veckorna, i en hämtning.
  const soon = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const from = dates[0] < today ? dates[0] : today;
  const lastSoon = soon[soon.length - 1];
  const to =
    dates[dates.length - 1] > lastSoon ? dates[dates.length - 1] : lastSoon;

  const [workouts, tests, races, blocks, checkins] = await Promise.all([
    listScheduledWorkouts(from, to, adeptId),
    listSessionsBetween(from, to, adeptId),
    listRacesBetween(from, to),
    adeptId ? listBlocks(adeptId) : Promise.resolve([]),
    adeptId ? listCheckinsBetween(adeptId, from, to) : Promise.resolve([]),
  ]);

  const days = groupByDay({
    workouts,
    tests,
    races: adeptId ? races.filter((r) => r.adept_id === adeptId) : races,
    checkins,
  });
  const phases = adeptId ? phaseByDay(blocks, [...dates, ...soon]) : null;
  const showNames = isCoach && !adeptId;

  const href = (params: { manad?: string; dag?: string }) => {
    const search = new URLSearchParams();
    if (isCoach && adeptId) search.set("adept", adeptId);
    search.set("manad", params.manad ?? month);
    if (params.dag) search.set("dag", params.dag);
    return `${routes.calendar}?${search.toString()}`;
  };

  const phasesShown = phases
    ? TRAINING_PHASES.filter((p) => dates.some((d) => phases.get(d) === p.key))
    : [];

  return (
    <>
      <PageHeader
        title="Kalender"
        description={
          showNames
            ? "Alla dina adepters pass, tester och tävlingar. Välj en adept för att se fas och incheckningar."
            : "Pass, tester, tävlingar och säsongens faser, dag för dag."
        }
        action={picker}
      />

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <Link
                href={href({ manad: shiftMonth(month, -1) })}
                aria-label="Föregående månad"
                className="grid size-9 place-items-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text"
              >
                <ChevronLeft aria-hidden className="size-5" />
              </Link>
              <h2 className="min-w-[10.5rem] text-center text-lg font-semibold text-text">
                {monthTitle(month)}
              </h2>
              <Link
                href={href({ manad: shiftMonth(month, 1) })}
                aria-label="Nästa månad"
                className="grid size-9 place-items-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text"
              >
                <ChevronRight aria-hidden className="size-5" />
              </Link>
            </div>
            {month !== today.slice(0, 7) && (
              <Link
                href={href({ manad: today.slice(0, 7), dag: today })}
                className="rounded-md border border-line-strong px-3 py-1.5 text-[13px] text-text hover:border-accent"
              >
                I dag
              </Link>
            )}
          </div>

          <MonthGrid
            month={month}
            today={today}
            selected={selected}
            days={days}
            phases={phases}
            showNames={showNames}
            // Ankaret tar telefonen ned till dagspanelen under rutnätet.
            hrefFor={(dag) => `${href({ manad: dag.slice(0, 7), dag })}#dag`}
          />

          {phasesShown.length > 0 && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-text-muted">
              {phasesShown.map((p) => (
                <li key={p.key} className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="h-[3px] w-4 rounded-full"
                    style={{ background: phaseFill(p.key) }}
                  />
                  {PHASE_SHORT[p.key]}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid min-w-0 content-start gap-6 md:grid-cols-2 2xl:grid-cols-1">
          <DayPanel
            date={selected}
            items={days.get(selected) ?? emptyDay()}
            today={today}
            phase={phases?.get(selected) ?? null}
            showNames={showNames}
          />
          <Upcoming
            dates={soon}
            days={days}
            today={today}
            showNames={showNames}
          />
        </div>
      </div>
    </>
  );
}
