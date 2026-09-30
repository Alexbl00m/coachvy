import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { PriorityBadge } from "@/components/season/priority-badge";
import { PHASE_SHORT, phaseFill } from "@/components/season/phase-style";
import { Card, CardTitle } from "@/components/ui/card";
import { routes } from "@/lib/routes";
import {
  countdownText,
  daysBetween,
  longDate,
  weekdayName,
} from "@/lib/season/season";
import {
  READINESS_MAX,
  readReadiness,
  readinessScore,
  sessionLoad,
} from "@/lib/training/load";
import { toCheckin } from "@/lib/training/queries";
import type { TrainingBlockRow } from "@/lib/types/database";
import { SportIcon, TestIcon, type DayItems } from "./calendar-items";

const sv = (v: number) => String(v).replace(".", ",");

function ItemLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group -mx-2 flex items-start gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-surface-2"
    >
      {children}
      <ChevronRight
        aria-hidden
        className="ml-auto mt-0.5 size-4 shrink-0 text-text-subtle group-hover:text-accent"
      />
    </Link>
  );
}

/** Det som finns en dag, med länkar vidare. */
export function DayContent({
  items,
  today,
  showNames,
}: {
  items: DayItems;
  today: string;
  showNames: boolean;
}) {
  const who = (name: string) => (showNames ? `${name} · ` : "");
  const checkin = items.checkin ? toCheckin(items.checkin) : null;
  const load = checkin
    ? sessionLoad(checkin.sessionRpe, checkin.durationMinutes)
    : 0;
  const readiness = checkin ? readinessScore(checkin) : null;

  if (
    items.races.length === 0 &&
    items.workouts.length === 0 &&
    items.tests.length === 0 &&
    !checkin
  ) {
    return <p className="text-sm text-text-subtle">Inget inlagt.</p>;
  }

  return (
    <ul className="space-y-0.5">
      {items.races.map((race) => (
        <li key={race.id}>
          <ItemLink href={`${routes.plans}?adept=${race.adept_id}`}>
            <PriorityBadge
              priority={race.priority}
              className="size-5 text-[11px]"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-text">
                {race.name}
              </span>
              <span className="block text-[12px] text-text-subtle">
                {who(race.adept_name)}
                {[race.distance, race.target && `mål: ${race.target}`]
                  .filter(Boolean)
                  .join(" · ") || `${race.priority}-lopp`}
                {race.race_date >= today &&
                  ` · ${countdownText(daysBetween(today, race.race_date))}`}
              </span>
            </span>
          </ItemLink>
        </li>
      ))}
      {items.workouts.map((w) => (
        <li key={w.id}>
          <ItemLink href={`${routes.adepts}/${w.adeptId}/pass/${w.id}`}>
            <SportIcon
              sport={w.sport}
              className="mt-0.5 size-4 shrink-0 text-text-subtle"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-text">
                {w.title}
              </span>
              <span className="block text-[12px] text-text-subtle">
                {who(w.adeptName)}
                {[w.duration, w.summary].filter(Boolean).join(" · ") || "Pass"}
              </span>
            </span>
          </ItemLink>
        </li>
      ))}
      {items.tests.map((t) => (
        <li key={t.id}>
          <ItemLink href={`${routes.adepts}/${t.adeptId}/test/${t.id}`}>
            <TestIcon className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-text">
                {t.label}
              </span>
              <span className="block text-[12px] text-text-subtle">
                {who(t.adeptName)}
                {t.headline ?? "Inga värden än"}
              </span>
            </span>
          </ItemLink>
        </li>
      ))}
      {checkin && items.checkin && (
        <li className="mt-1 rounded-md border border-line px-3 py-2 text-[13px] text-text-muted">
          <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-text-subtle">
            Incheckning
          </p>
          {checkin.sessionRpe !== null && checkin.durationMinutes !== null ? (
            <p>
              Pass: RPE {sv(checkin.sessionRpe)} · {sv(checkin.durationMinutes)}{" "}
              min ={" "}
              <span className="font-medium text-text tabular-nums">
                {Math.round(load)}
              </span>{" "}
              enheter
            </p>
          ) : (
            <p>Vilodag</p>
          )}
          {readiness !== null && (
            <p>
              Återhämtning{" "}
              <span className="font-medium text-text tabular-nums">
                {readiness} av {READINESS_MAX}
              </span>{" "}
              · {readReadiness(readiness).toLowerCase()}
            </p>
          )}
          {items.checkin.note && (
            <p className="mt-1 text-text-subtle">”{items.checkin.note}”</p>
          )}
        </li>
      )}
    </ul>
  );
}

/** Den valda dagen. */
export function DayPanel({
  date,
  items,
  today,
  phase,
  showNames,
}: {
  date: string;
  items: DayItems;
  today: string;
  phase: TrainingBlockRow["phase"] | null;
  showNames: boolean;
}) {
  return (
    // Ankaret dagarna i rutnätet länkar till, så att telefonen scrollar hit.
    <div id="dag" className="min-w-0 scroll-mt-20">
      <Card className="min-w-0">
        <div className="mb-3">
          <p className="text-[12px] font-medium uppercase tracking-[0.1em] text-text-muted">
            {date === today ? "I dag" : weekdayName(date)}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-lg font-semibold text-text">
            {longDate(date, today)}
            {phase && (
              <span className="inline-flex items-center gap-1.5 rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-text-muted">
                <span
                  aria-hidden
                  className="h-2 w-3 rounded-[2px]"
                  style={{ background: phaseFill(phase) }}
                />
                {PHASE_SHORT[phase]}
              </span>
            )}
          </p>
        </div>
        <DayContent items={items} today={today} showNames={showNames} />
      </Card>
    </div>
  );
}

/** De närmaste dagarna med något inlagt, i ordning. */
export function Upcoming({
  dates,
  days,
  today,
  showNames,
}: {
  dates: string[];
  days: Map<string, DayItems>;
  today: string;
  showNames: boolean;
}) {
  const withItems = dates.filter((d) => {
    const items = days.get(d);
    return (
      items &&
      (items.races.length > 0 ||
        items.workouts.length > 0 ||
        items.tests.length > 0)
    );
  });
  return (
    <Card className="min-w-0">
      <CardTitle>Närmaste två veckorna</CardTitle>
      {withItems.length === 0 ? (
        <p className="text-sm text-text-subtle">
          Inga pass, tester eller tävlingar inlagda. Pass får ett datum i
          passbyggaren; tävlingar läggs in i säsongsplanen.
        </p>
      ) : (
        <div className="space-y-4">
          {withItems.map((date) => {
            const items = days.get(date)!;
            return (
              <div key={date}>
                <p className="text-[12px] font-medium text-text-subtle">
                  {date === today
                    ? "I dag"
                    : `${weekdayName(date)} ${longDate(date, today)}`}
                </p>
                <DayContent
                  items={{ ...items, checkin: null }}
                  today={today}
                  showNames={showNames}
                />
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
