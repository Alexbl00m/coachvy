import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { BlockEditor } from "@/components/season/block-editor";
import { DistributionCard } from "@/components/season/distribution-card";
import { RaceEditor } from "@/components/season/race-editor";
import { SeasonSummary } from "@/components/season/season-summary";
import { SeasonTimeline } from "@/components/season/season-timeline";
import { Card, CardTitle } from "@/components/ui/card";
import { listActivities } from "@/lib/activities/queries";
import { routes } from "@/lib/routes";
import { sessionGoal } from "@/lib/season/distribution";
import { listBlocks, listRaces } from "@/lib/season/queries";
import {
  addDays,
  monthName,
  planNotes,
  shiftMonth,
  todayIso,
} from "@/lib/season/season";
import type { Sport } from "@/lib/calculators/lactate";
import { sessionHeadline } from "@/lib/tests/headline";
import { protocolByKey } from "@/lib/tests/protocols";
import { listSessions } from "@/lib/tests/session-queries";
import type { Adept, RaceSport } from "@/lib/types/database";
import { listWorkouts } from "@/lib/workouts/queries";

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

  // Inplanerade pass med sitt huvudsyfte, för intensitetsfördelningen.
  const planned = workouts.flatMap((w) =>
    w.scheduled_for
      ? [{ date: w.scheduled_for, goal: sessionGoal(w, w.reference) }]
      : [],
  );

  return (
    <div className="space-y-6">
      <SeasonSummary blocks={blocks} races={races} today={today} />

      <Card className="min-w-0">
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
        <SeasonTimeline
          from={from}
          to={to}
          today={today}
          blocks={blocks}
          races={races}
          tests={tests}
        />
      </Card>

      {notes.length > 0 && (
        <Card>
          <CardTitle>Att se över</CardTitle>
          <ul className="space-y-2 text-sm text-text-muted">
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
        </Card>
      )}

      <DistributionCard
        blocks={blocks}
        races={races}
        planned={planned}
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
