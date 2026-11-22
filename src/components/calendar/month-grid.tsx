import Link from "next/link";
import { GripVertical, Video } from "lucide-react";

import { phaseFill } from "@/components/season/phase-style";
import { SERIES } from "@/lib/calculators/chart-colors";
import type { Sport } from "@/lib/calculators/lactate";
import { dragOf, type DragWeek } from "@/lib/calendar/drag";
import type { WeekLoad } from "@/lib/calendar/week-load";
import { callTime } from "@/lib/calls/time";
import { cn } from "@/lib/cn";
import {
  isoWeek,
  longDate,
  monthDates,
  weekdayName,
} from "@/lib/season/season";
import type { TrainingBlockRow } from "@/lib/types/database";
import { hoursText, tssText, type LoadTotals } from "@/lib/workouts/load";
import {
  SportIcon,
  TestIcon,
  emptyDay,
  firstName,
  type DayItems,
} from "./calendar-items";

const WEEKDAYS = ["mån", "tis", "ons", "tor", "fre", "lör", "sön"];

/** Veckans summa i kolumnen till höger: tid och TSS. */
function WeekSum({ label, totals }: { label: string; totals: LoadTotals }) {
  return (
    <span className="flex flex-col">
      <span className="text-[0.625rem] uppercase tracking-[0.08em] text-text-subtle">
        {label}
      </span>
      <span className="font-medium text-text">{hoursText(totals.seconds)}</span>
      {totals.tss > 0 && (
        <span className="text-text-muted">TSS {tssText(totals.tss)}</span>
      )}
    </span>
  );
}
const MAX_ROWS = 3;

function describe(date: string, items: DayItems): string {
  const parts = [
    items.races.length > 0 &&
      `${items.races.length} ${items.races.length === 1 ? "tävling" : "tävlingar"}`,
    items.activities.length > 0 &&
      `${items.activities.length} ${items.activities.length === 1 ? "genomförd aktivitet" : "genomförda aktiviteter"}`,
    items.workouts.length > 0 && `${items.workouts.length} pass`,
    items.tests.length > 0 &&
      `${items.tests.length} ${items.tests.length === 1 ? "test" : "tester"}`,
    items.calls.length > 0 && `${items.calls.length} videosamtal`,
    items.checkin && "incheckning",
  ].filter(Boolean);
  return `${weekdayName(date)} ${longDate(date)}${parts.length ? `: ${parts.join(", ")}` : ""}`;
}

/**
 * Månaden som rutnät. Varje dag är en länk som väljer dagen; det som hänt
 * eller ska hända den dagen visas i panelen bredvid, med länkar vidare.
 *
 * Med `movable` går passen att dra till en annan dag (CalendarDnd runt
 * rutnätet tar emot dem). Med en adept i `weekAdeptId` går också hela
 * veckan att dra, med veckonumret, till en annan rad.
 *
 * På en telefon ryms ingen text i rutorna, så där blir innehållet prickar –
 * dagspanelen under rutnätet bär resten.
 */
export function MonthGrid({
  month,
  today,
  selected,
  days,
  phases,
  showNames,
  hrefFor,
  movable = false,
  weekAdeptId = null,
  weekLoads = null,
}: {
  month: string;
  today: string;
  selected: string | null;
  days: Map<string, DayItems>;
  /** Fasen per dag, för en enskild adept. null i vyn över alla. */
  phases: Map<string, TrainingBlockRow["phase"]> | null;
  showNames: boolean;
  hrefFor: (date: string) => string;
  /** Passen går att dra till en annan dag. */
  movable?: boolean;
  /** Adepten vars vecka går att dra till en annan vecka. */
  weekAdeptId?: string | null;
  /** Veckornas summa, nyckel måndagen: en kolumn till höger med tid och TSS. */
  weekLoads?: Map<string, WeekLoad> | null;
}) {
  // Rutnätet får en kolumn till för veckans summa när den finns.
  const columns = weekLoads
    ? "sm:grid-cols-[2.25rem_repeat(7,minmax(0,1fr))_5.5rem]"
    : "sm:grid-cols-[2.25rem_repeat(7,minmax(0,1fr))]";
  const weekMovable = movable && weekAdeptId !== null;
  const dates = monthDates(month);
  const weeks = Array.from({ length: dates.length / 7 }, (_, i) =>
    dates.slice(i * 7, i * 7 + 7),
  );

  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <div
        className={cn(
          "grid grid-cols-7 border-b border-line bg-surface-2/60 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-text-subtle",
          columns,
        )}
      >
        <span className="hidden px-2 py-2 sm:block" aria-hidden>
          v.
        </span>
        {WEEKDAYS.map((d) => (
          <span key={d} className="px-1.5 py-2 text-center sm:text-left">
            {d}
          </span>
        ))}
        {weekLoads && (
          <span className="hidden border-l border-line px-1.5 py-2 sm:block">
            Vecka
          </span>
        )}
      </div>

      {weeks.map((week) => {
        const number = isoWeek(week[0]);
        // Passen i veckan som går att flytta; utan dem dras inte veckan.
        const count = weekMovable
          ? week
              .flatMap((d) => days.get(d)?.workouts ?? [])
              .filter((w) => w.adeptId === weekAdeptId && dragOf(w) !== null)
              .length
          : 0;
        const drag: DragWeek | null =
          weekAdeptId && count > 0
            ? {
                kind: "vecka",
                adeptId: weekAdeptId,
                monday: week[0],
                title: `Vecka ${number}`,
              }
            : null;
        return (
          <div
            key={week[0]}
            data-drop-week={weekMovable ? week[0] : undefined}
            className={cn(
              "grid grid-cols-7 border-b border-line last:border-b-0",
              columns,
              "data-[drop-over]:bg-accent/10 data-[drop-over]:ring-2 data-[drop-over]:ring-inset data-[drop-over]:ring-accent",
            )}
          >
            <span
              draggable={drag ? true : undefined}
              data-drag={drag ? JSON.stringify(drag) : undefined}
              title={
                drag
                  ? `Vecka ${number}, ${count} pass: dra till en annan vecka för att flytta passen, håll Ctrl (Alt på Mac) för att kopiera`
                  : undefined
              }
              className={cn(
                "hidden flex-col items-start gap-1 border-r border-line px-2 py-1.5 text-[0.6875rem] text-text-subtle tabular-nums sm:flex",
                drag &&
                  "group/week cursor-grab hover:bg-surface-2 hover:text-text active:cursor-grabbing",
              )}
            >
              {number}
              {drag && (
                <GripVertical
                  aria-hidden
                  className="-ml-0.5 size-3.5 opacity-60 group-hover/week:opacity-100"
                />
              )}
            </span>
            {week.map((date) => {
              const items = days.get(date) ?? emptyDay();
              const inMonth = date.slice(0, 7) === month;
              const isToday = date === today;
              const isSelected = date === selected;
              const phase = phases?.get(date) ?? null;
              const rows = [
                ...items.races.map((r) => ({
                  kind: "race" as const,
                  key: r.id,
                  race: r,
                })),
                ...items.activities.map((a) => ({
                  kind: "activity" as const,
                  key: a.id,
                  activity: a,
                })),
                ...items.workouts.map((w) => ({
                  kind: "workout" as const,
                  key: w.id,
                  workout: w,
                })),
                ...items.tests.map((t) => ({
                  kind: "test" as const,
                  key: t.id,
                  test: t,
                })),
                ...items.calls.map((c) => ({
                  kind: "call" as const,
                  key: c.id,
                  call: c,
                })),
              ];
              const more = rows.length - MAX_ROWS;
              return (
                <Link
                  key={date}
                  href={hrefFor(date)}
                  aria-label={describe(date, items)}
                  aria-current={isSelected ? "date" : undefined}
                  data-drop-date={movable ? date : undefined}
                  className={cn(
                    "relative flex min-h-[3.4rem] min-w-0 flex-col gap-1 border-r border-line p-1 transition-colors last:border-r-0 hover:bg-surface-2/70 sm:min-h-[6rem] sm:p-1.5",
                    "data-[drop-over]:bg-accent/10 data-[drop-over]:ring-2 data-[drop-over]:ring-inset data-[drop-over]:ring-accent",
                    !inMonth && "bg-surface-2/30",
                    isSelected && "bg-surface-2 ring-2 ring-inset ring-accent",
                  )}
                  // Fasen som en tunn rand överst i rutan.
                  style={
                    phase
                      ? { boxShadow: `inset 0 3px 0 ${phaseFill(phase)}` }
                      : undefined
                  }
                >
                  <span className="flex items-center justify-between">
                    <span
                      className={cn(
                        "grid size-6 place-items-center rounded-full text-[0.75rem] tabular-nums",
                        isToday
                          ? "bg-accent font-semibold text-accent-on"
                          : inMonth
                            ? "text-text"
                            : "text-text-subtle",
                      )}
                    >
                      {Number(date.slice(8, 10))}
                    </span>
                    {items.checkin && (
                      <span
                        aria-hidden
                        title="Incheckning"
                        className="mr-0.5 size-1.5 rounded-full bg-text-subtle"
                      />
                    )}
                  </span>

                  {/* Telefon: prickar */}
                  {rows.length > 0 && (
                    <span
                      aria-hidden
                      className="flex flex-wrap gap-1 px-0.5 sm:hidden"
                    >
                      {rows.slice(0, 4).map((row) => (
                        <span
                          key={row.key}
                          className={cn(
                            "block size-1.5",
                            row.kind === "race"
                              ? "rotate-45 rounded-[1px] bg-text"
                              : "rounded-full",
                            row.kind === "workout" && "bg-text-muted",
                            row.kind === "activity" && "bg-good",
                            row.kind === "call" && "bg-text",
                          )}
                          style={
                            row.kind === "test"
                              ? { background: SERIES.secondary }
                              : undefined
                          }
                        />
                      ))}
                    </span>
                  )}

                  {/* Större skärm: rader */}
                  <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                    {rows.slice(0, MAX_ROWS).map((row) => {
                      const who = (name: string) =>
                        showNames ? `${firstName(name)}: ` : "";
                      if (row.kind === "race") {
                        return (
                          <span
                            key={row.key}
                            className="flex min-w-0 items-center gap-1 text-[0.6875rem] font-medium leading-tight text-text"
                          >
                            <span
                              aria-hidden
                              className={cn(
                                "grid size-3.5 shrink-0 place-items-center rounded-[3px] text-[0.5rem] font-bold",
                                row.race.priority === "A"
                                  ? "bg-text text-canvas"
                                  : "border border-line-strong text-text-muted",
                              )}
                            >
                              {row.race.priority}
                            </span>
                            <span className="truncate">
                              {who(row.race.adept_name)}
                              {row.race.name}
                            </span>
                          </span>
                        );
                      }
                      if (row.kind === "call") {
                        return (
                          <span
                            key={row.key}
                            className="flex min-w-0 items-center gap-1 text-[0.6875rem] leading-tight text-text"
                          >
                            <Video
                              aria-hidden
                              className="size-3 shrink-0 text-text"
                            />
                            <span className="truncate">
                              {who(row.call.adeptName)}
                              {callTime(row.call.starts_at)} samtal
                            </span>
                          </span>
                        );
                      }
                      if (row.kind === "activity") {
                        return (
                          <span
                            key={row.key}
                            className="flex min-w-0 items-center gap-1 text-[0.6875rem] leading-tight text-text"
                          >
                            <SportIcon
                              sport={row.activity.sport as Sport}
                              className="size-3 shrink-0 text-text"
                            />
                            <span className="truncate">
                              {who(row.activity.adept_name)}
                              {row.activity.name}
                            </span>
                          </span>
                        );
                      }
                      if (row.kind === "workout") {
                        const drag = movable ? dragOf(row.workout) : null;
                        return (
                          <span
                            key={row.key}
                            draggable={drag ? true : undefined}
                            data-drag={drag ? JSON.stringify(drag) : undefined}
                            title={
                              drag
                                ? `${row.workout.title}: dra för att flytta, håll Ctrl (Alt på Mac) för att kopiera`
                                : undefined
                            }
                            className={cn(
                              "flex min-w-0 items-center gap-1 rounded-sm text-[0.6875rem] leading-tight text-text-muted",
                              drag &&
                                "cursor-grab hover:bg-surface-3 active:cursor-grabbing",
                            )}
                          >
                            <SportIcon
                              sport={row.workout.sport}
                              className="size-3 shrink-0 text-text-subtle"
                            />
                            <span className="truncate">
                              {who(row.workout.adeptName)}
                              {row.workout.title}
                            </span>
                          </span>
                        );
                      }
                      return (
                        <span
                          key={row.key}
                          className="flex min-w-0 items-center gap-1 text-[0.6875rem] leading-tight text-text-muted"
                        >
                          <TestIcon className="size-3 shrink-0" />
                          <span className="truncate">
                            {who(row.test.adeptName)}
                            {row.test.label}
                          </span>
                        </span>
                      );
                    })}
                    {more > 0 && (
                      <span className="text-[0.6875rem] text-text-subtle">
                        +{more} till
                      </span>
                    )}
                  </span>
                </Link>
              );
            })}
            {weekLoads && <WeekCell load={weekLoads.get(week[0]) ?? null} />}
          </div>
        );
      })}
    </div>
  );
}

/** Veckans summa: planen och, när något är gjort, det genomförda. */
function WeekCell({ load }: { load: WeekLoad | null }) {
  const planned = load && load.planned.sessions > 0 ? load.planned : null;
  const done = load && load.done.sessions > 0 ? load.done : null;
  return (
    <span className="hidden min-w-0 flex-col gap-1.5 border-l border-line bg-surface-2/30 px-1.5 py-1.5 text-[0.6875rem] leading-tight tabular-nums sm:flex">
      {planned && <WeekSum label="Plan" totals={planned} />}
      {done && <WeekSum label="Gjort" totals={done} />}
    </span>
  );
}
