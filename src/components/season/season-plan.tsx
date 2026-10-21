import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { BlockEditor } from "@/components/season/block-editor";
import { DistributionCard } from "@/components/season/distribution-card";
import { RaceEditor } from "@/components/season/race-editor";
import { blockLabel, phaseFill } from "@/components/season/phase-style";
import { PriorityBadge } from "@/components/season/priority-badge";
import { SeasonTimeline } from "@/components/season/season-timeline";
import { Card, CardTitle } from "@/components/ui/card";
import { listActivities } from "@/lib/activities/queries";
import { routes } from "@/lib/routes";
import { sessionGoal } from "@/lib/season/distribution";
import { listBlocks, listRaces } from "@/lib/season/queries";
import {
  addDays,
  blockOn,
  countdownText,
  daysBetween,
  mainRace,
  monthName,
  planNotes,
  shiftMonth,
  todayIso,
  upcomingRaces,
} from "@/lib/season/season";
import type { Sport } from "@/lib/calculators/lactate";
import { sessionHeadline } from "@/lib/tests/headline";
import { protocolByKey } from "@/lib/tests/protocols";
import { listSessions } from "@/lib/tests/session-queries";
import type { Adept, RaceSport } from "@/lib/types/database";
import { listWorkouts } from "@/lib/workouts/queries";
import { listDoneGoals } from "@/lib/activities/intensity-queries";

const monthLabel = (month: string) =>
  `${monthName(Number(month.slice(5, 7)) - 1)} ${month.slice(0, 4)}`;

/** Adeptens gren som tävlingsgren, för att förifylla formuläret. */
function raceSportOf(raw: string | null): RaceSport | "" {
  const value = (raw ?? "").toLowerCase();
  if (value.includes("tri")) return "triathlon";
  if (value.includes("löp") || value.includes("run")) return "löpning";
  if (value.includes("sim") || value.includes("swim")) return "simning";
  if (value.includes("cyk") || value.includes("bike")) return "cykling";
  return "";
}

/**
 * Säsongsplanen: perioderna, tävlingarna och testerna på en tidslinje.
 *
 * Planen är grunden de andra vyerna läser: översikten räknar ned mot
 * A-loppet, kalendern färgar dagarna efter fasen, ett nytt test får fasen
 * förvald, och AI-coachen och passbyggaren får veta var i säsongen atleten
 * är. Fönstret är tolv månader och flyttas ett halvår i taget.
 */
export async function SeasonPlan({
  adept,
  canPlan,
  basePath,
  fran: requestedFrom,
  openNew,
}: {
  adept: Adept;
  /** Coachen planerar; en adept utan coach planerar sin egen säsong. */
  canPlan: boolean;
  /** Adressen sidan ligger på, för att flytta tidslinjen. */
  basePath: string;
  /** Första månaden i fönstret, "2026-09". */
  fran: string | undefined;
  /** Öppna formuläret för en ny period direkt. */
  openNew: boolean;
}) {
  const today = todayIso();
  const [blocks, races, sessions, activities, workouts] = await Promise.all([
    listBlocks(adept.id),
    listRaces(adept.id),
    listSessions(adept.id),
    listActivities(adept.id),
    listWorkouts(adept.id),
  ]);
  // Senast uppladdade loppet per tävling – listan är nyast först.
  const analyses: Record<string, string> = {};
  for (const a of activities) {
    if (a.race_id && !analyses[a.race_id]) analyses[a.race_id] = a.id;
  }

  const current = today.slice(0, 7);
  const fran =
    requestedFrom && /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedFrom)
      ? requestedFrom
      : shiftMonth(current, -2);
  const from = `${fran}-01`;
  const to = addDays(`${shiftMonth(fran, 12)}-01`, -1);

  const link = (month: string) => {
    const params = new URLSearchParams(basePath.split("?")[1]);
    params.set("fran", month);
    return `${basePath.split("?")[0]}?${params.toString()}`;
  };

  const tests = sessions.map((s) => ({
    id: s.id,
    date: s.performed_on,
    label: protocolByKey(s.protocol)?.label ?? s.protocol,
    detail: sessionHeadline(s.test_metrics, s.sport as Sport),
    href: `${routes.adepts}/${adept.id}/test/${s.id}`,
  }));

  const notes = planNotes(blocks, races, today);

  // Läget i en rad överst i tidslinjens kort – fasen, målet och en start före
  // det – i stället för egna rutor som säger samma sak som tidslinjen.
  const phaseNow = blockOn(blocks, today);
  const main = mainRace(races, today);
  const first = upcomingRaces(races, today)[0] ?? null;
  const sooner = first && main && first.id !== main.id ? first : null;

  // Inplanerade pass med sitt huvudsyfte, för intensitetsfördelningen.
  const planned = workouts.flatMap((w) =>
    w.scheduled_for
      ? [{ date: w.scheduled_for, goal: sessionGoal(w, w.reference) }]
      : [],
  );
  // Genomförda pass i de perioder som visas, klassade på samma sätt.
  const doneFrom = blocks
    .filter((b) => b.ends_on >= from)
    .reduce((min, b) => (b.starts_on < min ? b.starts_on : min), from);
  const done = await listDoneGoals(adept.id, doneFrom, to < today ? to : today);

  return (
    <div className="space-y-6">
      <Card level="lead" className="min-w-0">
        <CardTitle
          action={
            <nav
              aria-label="Flytta tidslinjen"
              className="flex items-center gap-1"
            >
              <Link
                href={link(shiftMonth(fran, -6))}
                aria-label="Ett halvår bakåt"
                className="grid size-8 place-items-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text"
              >
                <ChevronLeft aria-hidden className="size-4" />
              </Link>
              <span className="min-w-[10rem] text-center text-[12px] text-text-muted tabular-nums">
                {monthLabel(fran)} – {monthLabel(shiftMonth(fran, 11))}
              </span>
              <Link
                href={link(shiftMonth(fran, 6))}
                aria-label="Ett halvår framåt"
                className="grid size-8 place-items-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text"
              >
                <ChevronRight aria-hidden className="size-4" />
              </Link>
            </nav>
          }
        >
          Säsongen
        </CardTitle>
        <dl className="-mt-1 mb-5 flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <div className="min-w-0">
            <dt className="text-[13px] text-text-muted">Fasen nu</dt>
            <dd className="flex items-center gap-2 font-medium text-text">
              {phaseNow ? (
                <>
                  <span
                    aria-hidden
                    className="h-2.5 w-4 rounded-[3px]"
                    style={{ background: phaseFill(phaseNow.phase) }}
                  />
                  {blockLabel(phaseNow)}
                  <span className="font-normal text-text-muted tabular-nums">
                    · {daysBetween(today, phaseNow.ends_on)} dagar kvar
                  </span>
                </>
              ) : (
                <span className="font-normal text-text-muted">
                  Ingen period
                </span>
              )}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[13px] text-text-muted">
              {main?.priority === "A" ? "Säsongens mål" : "Nästa tävling"}
            </dt>
            <dd className="flex items-center gap-2 font-medium text-text">
              {main ? (
                <>
                  <PriorityBadge
                    priority={main.priority}
                    className="size-5 text-[11px]"
                  />
                  {main.name}
                  <span className="font-normal text-text-muted">
                    · {countdownText(daysBetween(today, main.race_date))}
                  </span>
                </>
              ) : (
                <span className="font-normal text-text-muted">
                  Inget inlagt – lägg in målet som A-lopp
                </span>
              )}
            </dd>
          </div>
          {sooner && (
            <div className="min-w-0">
              <dt className="text-[13px] text-text-muted">Före det</dt>
              <dd className="flex items-center gap-2 font-medium text-text">
                <PriorityBadge
                  priority={sooner.priority}
                  className="size-5 text-[11px]"
                />
                {sooner.name}
                <span className="font-normal text-text-muted">
                  · {countdownText(daysBetween(today, sooner.race_date))}
                </span>
              </dd>
            </div>
          )}
        </dl>
        <SeasonTimeline
          from={from}
          to={to}
          today={today}
          blocks={blocks}
          races={races}
          tests={tests}
        />
        {notes.length > 0 && (
          <div className="mt-5 border-t border-line pt-4">
            <h3 className="text-[13px] font-medium text-text">Att se över</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-text-muted">
              {notes.map((note) => (
                <li key={note} className="flex gap-2.5">
                  <span
                    aria-hidden
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-warn"
                  />
                  {note}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <DistributionCard
        blocks={blocks}
        races={races}
        planned={planned}
        done={done}
        from={from}
        to={to}
        today={today}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <BlockEditor
          adeptId={adept.id}
          blocks={blocks}
          races={races}
          today={today}
          canEdit={canPlan}
          openNew={openNew}
        />
        <RaceEditor
          adeptId={adept.id}
          races={races}
          blocks={blocks}
          today={today}
          defaultSport={raceSportOf(adept.sport)}
          analyses={analyses}
        />
      </div>
    </div>
  );
}
