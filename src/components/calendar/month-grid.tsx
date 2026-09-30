import Link from "next/link";

import { phaseFill } from "@/components/season/phase-style";
import { SERIES } from "@/lib/calculators/chart-colors";
import { cn } from "@/lib/cn";
import {
  addDays,
  daysBetween,
  isoWeek,
  longDate,
  mondayOf,
  weekdayName,
} from "@/lib/season/season";
import type { TrainingBlockRow } from "@/lib/types/database";
import {
  SportIcon,
  TestIcon,
  emptyDay,
  firstName,
  type DayItems,
} from "./calendar-items";

const WEEKDAYS = ["mån", "tis", "ons", "tor", "fre", "lör", "sön"];
const MAX_ROWS = 3;

/** Datumen som visas för en månad: hela veckor, måndag till söndag. */
export function monthDates(month: string): string[] {
  const first = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const nextFirst =
    m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const last = addDays(nextFirst, -1);
  const start = mondayOf(first);
  const end = addDays(mondayOf(last), 6);
  const count = daysBetween(start, end) + 1;
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

function describe(date: string, items: DayItems): string {
  const parts = [
    items.races.length > 0 &&
      `${items.races.length} ${items.races.length === 1 ? "tävling" : "tävlingar"}`,
    items.workouts.length > 0 && `${items.workouts.length} pass`,
    items.tests.length > 0 &&
      `${items.tests.length} ${items.tests.length === 1 ? "test" : "tester"}`,
    items.checkin && "incheckning",
  ].filter(Boolean);
  return `${weekdayName(date)} ${longDate(date)}${parts.length ? `: ${parts.join(", ")}` : ""}`;
}

/**
 * Månaden som rutnät. Varje dag är en länk som väljer dagen; det som hänt
 * eller ska hända den dagen visas i panelen bredvid, med länkar vidare.
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
}: {
  month: string;
  today: string;
  selected: string | null;
  days: Map<string, DayItems>;
  /** Fasen per dag, för en enskild adept. null i vyn över alla. */
  phases: Map<string, TrainingBlockRow["phase"]> | null;
  showNames: boolean;
  hrefFor: (date: string) => string;
}) {
  const dates = monthDates(month);
  const weeks = Array.from({ length: dates.length / 7 }, (_, i) =>
    dates.slice(i * 7, i * 7 + 7),
  );

  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <div className="grid grid-cols-7 border-b border-line bg-surface-2/60 text-[11px] font-medium uppercase tracking-[0.08em] text-text-subtle sm:grid-cols-[2.25rem_repeat(7,minmax(0,1fr))]">
        <span className="hidden px-2 py-2 sm:block" aria-hidden>
          v.
        </span>
        {WEEKDAYS.map((d) => (
          <span key={d} className="px-1.5 py-2 text-center sm:text-left">
            {d}
          </span>
        ))}
      </div>

      {weeks.map((week) => (
        <div
          key={week[0]}
          className="grid grid-cols-7 border-b border-line last:border-b-0 sm:grid-cols-[2.25rem_repeat(7,minmax(0,1fr))]"
        >
          <span className="hidden border-r border-line px-2 py-1.5 text-[11px] text-text-subtle tabular-nums sm:block">
            {isoWeek(week[0])}
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
            ];
            const more = rows.length - MAX_ROWS;
            return (
              <Link
                key={date}
                href={hrefFor(date)}
                aria-label={describe(date, items)}
                aria-current={isSelected ? "date" : undefined}
                className={cn(
                  "relative flex min-h-[3.4rem] min-w-0 flex-col gap-1 border-r border-line p-1 transition-colors last:border-r-0 hover:bg-surface-2/70 sm:min-h-[6rem] sm:p-1.5",
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
                      "grid size-6 place-items-center rounded-full text-[12px] tabular-nums",
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
                          className="flex min-w-0 items-center gap-1 text-[11px] font-medium leading-tight text-text"
                        >
                          <span
                            aria-hidden
                            className={cn(
                              "grid size-3.5 shrink-0 place-items-center rounded-[3px] text-[8px] font-bold",
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
                    if (row.kind === "workout") {
                      return (
                        <span
                          key={row.key}
                          className="flex min-w-0 items-center gap-1 text-[11px] leading-tight text-text-muted"
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
                        className="flex min-w-0 items-center gap-1 text-[11px] leading-tight text-text-muted"
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
                    <span className="text-[11px] text-text-subtle">
                      +{more} till
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}
