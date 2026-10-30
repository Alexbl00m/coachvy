import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { BlockEditor } from "@/components/season/block-editor";
import { DistributionCard } from "@/components/season/distribution-card";
import { RaceEditor } from "@/components/season/race-editor";
import { blockLabel } from "@/components/season/phase-style";
import { PriorityBadge } from "@/components/season/priority-badge";
import { SeasonTimeline } from "@/components/season/season-timeline";
import { PageHeader } from "@/components/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { listActivities } from "@/lib/activities/queries";
import { routes } from "@/lib/routes";
import { sessionGoal } from "@/lib/season/distribution";
import { listPlanGoalsBetween } from "@/lib/plan-library/plan-view";
import { listPlansForSeason } from "@/lib/plan-library/season-plans";
import { seasonBlocks } from "@/lib/season/plan-season";
import { listBlocks, listRaces } from "@/lib/season/queries";
import {
  addDays,
  blockOn,
  countdownText,
  daysBetween,
  longDate,
  mainRace,
  monthName,
  nextBlock,
  planNotes,
  shiftMonth,
  todayIso,
  upcomingRaces,
} from "@/lib/season/season";
import type { Sport } from "@/lib/calculators/lactate";
import { sessionHeadline } from "@/lib/tests/headline";
import { protocolByKey } from "@/lib/tests/protocols";
import { listSessions } from "@/lib/tests/session-queries";
import type { TrainingPhase } from "@/lib/tests/phases";
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
  header,
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
  /** Sidans huvud, när planen är hela sidan. Utan står rubriken i vyn. */
  header?: { eyebrow: string };
}) {
  const today = todayIso();
  const [manual, plans, races, sessions, activities, workouts] = await Promise.all([
    listBlocks(adept.id),
    listPlansForSeason(adept.id),
    listRaces(adept.id),
    listSessions(adept.id),
    listActivities(adept.id),
    listWorkouts(adept.id),
  ]);
  // Säsongen: planernas faser, och perioderna för hand där ingen plan gäller.
  const blocks = seasonBlocks(manual, plans);
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
  const next = nextBlock(blocks, today);
  const main = mainRace(races, today);
  const first = upcomingRaces(races, today)[0] ?? null;
  const sooner = first && main && first.id !== main.id ? first : null;
  const lastRace =
    [...races]
      .filter((r) => r.race_date < today)
      .sort((a, b) => b.race_date.localeCompare(a.race_date))[0] ?? null;
  const title = seasonHeadline({ phaseNow, next, main, today });
  const lead = "Perioder, tävlingar och tester på en tidslinje.";
  const newPeriodHref = canPlan
    ? (() => {
        const params = new URLSearchParams(basePath.split("?")[1]);
        params.set("ny", "period");
        return `${basePath.split("?")[0]}?${params.toString()}#perioder`;
      })()
    : undefined;

  // Inplanerade pass med sitt huvudsyfte, för intensitetsfördelningen:
  // de egna och planens.
  const planned = [
    ...workouts.flatMap((w) =>
      w.scheduled_for
        ? [{ date: w.scheduled_for, goal: sessionGoal(w, w.reference) }]
        : [],
    ),
    ...(plans.length > 0
      ? await listPlanGoalsBetween(from, to, adept.id, today)
      : []),
  ];
  // Genomförda pass i de perioder som visas, klassade på samma sätt.
  const doneFrom = blocks
    .filter((b) => b.ends_on >= from)
    .reduce((min, b) => (b.starts_on < min ? b.starts_on : min), from);
  const done = await listDoneGoals(adept.id, doneFrom, to < today ? to : today);

  return (
    <div className="space-y-6">
      {header ? (
        <PageHeader
          size="lg"
          eyebrow={header.eyebrow}
          title={title}
          description={lead}
        />
      ) : (
        <div className="pb-2">
          <h2 className="headline text-[clamp(2rem,1.5rem+1.8vw,3.25rem)] text-text">
            {title}
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-text-muted">
            {lead}
          </p>
        </div>
      )}

      <section
        aria-label="Läget i säsongen"
        className={`lift grid gap-px overflow-hidden rounded-lg border border-line bg-line ${sooner || lastRace ? "md:grid-cols-3" : "md:grid-cols-2"}`}
      >
        <SummaryCell label="Fasen nu">
          <p className="headline text-[2rem] leading-tight text-text">
            {phaseNow
              ? blockLabel(phaseNow)
              : next
                ? "Övergång"
                : "Ingen period"}
          </p>
          <p className="mt-2 text-sm text-text-muted">
            {phaseNow
              ? `${daysBetween(today, phaseNow.ends_on)} dagar kvar · till ${longDate(phaseNow.ends_on, today)}`
              : next
                ? `${blockLabel(next)} börjar ${longDate(next.starts_on, today)}`
                : "Börja med grundperioden."}
          </p>
        </SummaryCell>
        <SummaryCell
          label={main?.priority === "A" ? "Säsongens mål" : "Nästa tävling"}
        >
          {main ? (
            <>
              <p className="headline flex items-center gap-3 text-[2rem] leading-tight text-text">
                <span className="min-w-0 truncate">{main.name}</span>
                <PriorityBadge
                  priority={main.priority}
                  className="size-5 shrink-0 text-[0.6875rem]"
                />
              </p>
              <p className="mt-2 text-sm text-text-muted">
                {capitalise(countdownText(daysBetween(today, main.race_date)))}{" "}
                · {longDate(main.race_date, today)}
              </p>
            </>
          ) : (
            <>
              <p className="headline text-[2rem] leading-tight text-text-muted">
                Inget A-lopp
              </p>
              <a
                href="#tavlingar"
                className="mt-2 inline-block text-sm font-medium text-accent-text hover:text-accent"
              >
                Lägg in säsongens mål →
              </a>
            </>
          )}
        </SummaryCell>
        {sooner ? (
          <SummaryCell label="Före det">
            <p className="headline text-[2rem] leading-tight text-text">
              {sooner.name}
            </p>
            <p className="mt-2 text-sm text-text-muted">
              {capitalise(countdownText(daysBetween(today, sooner.race_date)))}{" "}
              · {sooner.priority}-lopp
            </p>
          </SummaryCell>
        ) : (
          lastRace && (
            <SummaryCell label="Senast">
              <p className="headline text-[2rem] leading-tight text-text">
                {lastRace.name}
              </p>
              <p className="mt-2 text-sm text-text-muted">
                Genomfört ·{" "}
                {monthName(Number(lastRace.race_date.slice(5, 7)) - 1)}
              </p>
            </SummaryCell>
          )
        )}
      </section>

      <Card className="min-w-0">
        <CardTitle
          action={
            <nav
              aria-label="Flytta tidslinjen"
              className="flex items-center gap-2"
            >
              <Link
                href={link(shiftMonth(fran, -6))}
                aria-label="Ett halvår bakåt"
                className="grid size-9 place-items-center rounded-full border border-line-strong text-text-muted transition-colors hover:border-text-subtle hover:text-text"
              >
                <ChevronLeft aria-hidden className="size-4" />
              </Link>
              <span className="hidden min-w-[9.5rem] text-center text-[0.8125rem] text-text-muted tabular-nums sm:inline">
                {monthLabel(fran)} – {monthLabel(shiftMonth(fran, 11))}
              </span>
              <Link
                href={link(shiftMonth(fran, 6))}
                aria-label="Ett halvår framåt"
                className="grid size-9 place-items-center rounded-full border border-line-strong text-text-muted transition-colors hover:border-text-subtle hover:text-text"
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
          newPeriodHref={newPeriodHref}
        />
        {notes.length > 0 && (
          <div className="mt-5 border-t border-line pt-4">
            <h3 className="text-[0.8125rem] font-medium text-text">Att se över</h3>
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
        <div id="perioder" className="min-w-0 scroll-mt-24">
          <BlockEditor
            adeptId={adept.id}
            blocks={manual}
            fromPlans={blocks.filter((b) => b.plan)}
            races={races}
            today={today}
            canEdit={canPlan}
            openNew={openNew}
          />
        </div>
        <div id="tavlingar" className="min-w-0 scroll-mt-24">
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
    </div>
  );
}

const capitalise = (text: string) => text.replace(/^./, (c) => c.toUpperCase());

/** En cell i sammanfattningen: etiketten i versaler, läget i serif. */
function SummaryCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 bg-surface p-5 sm:p-6">
      <p className="eyebrow text-text-subtle">{label}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

/**
 * Rubriken över säsongen: det som ligger närmast. Ett A-lopp inom ett halvår
 * räknas ned; annars perioden som pågår eller nästa som börjar.
 */
function seasonHeadline({
  phaseNow,
  next,
  main,
  today,
}: {
  phaseNow: {
    phase: TrainingPhase;
    name?: string | null;
    ends_on: string;
  } | null;
  next: {
    phase: TrainingPhase;
    name?: string | null;
    starts_on: string;
  } | null;
  main: { name: string; priority: string; race_date: string } | null;
  today: string;
}): string {
  const amount = (days: number) =>
    days < 21
      ? `${days} ${days === 1 ? "dag" : "dagar"}`
      : `${Math.floor(days / 7)} veckor`;
  if (main?.priority === "A") {
    const days = daysBetween(today, main.race_date);
    if (days === 0) return `${main.name} i dag.`;
    if (days <= 182) return `${amount(days)} till ${main.name}.`;
  }
  if (phaseNow) {
    const left = daysBetween(today, phaseNow.ends_on);
    return `${amount(left)} kvar av ${blockLabel(phaseNow)}.`;
  }
  if (next)
    return `${amount(daysBetween(today, next.starts_on))} till ${blockLabel(next)}.`;
  return "Säsongen är inte planerad än.";
}
