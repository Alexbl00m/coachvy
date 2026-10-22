import Link from "next/link";
import { Check } from "lucide-react";

import { WorkoutStrip } from "@/components/workouts/workout-strip";
import type { CalendarWorkout } from "@/lib/calendar/queries";
import { cn } from "@/lib/cn";
import { hoursMinutes } from "@/lib/plan-library/labels";
import { weekdayName } from "@/lib/season/season";
import { profileSeconds } from "@/lib/workouts/summary";

const SHORT_DAY = (iso: string) => weekdayName(iso).slice(0, 3);

/**
 * Veckan dag för dag: passets profil i miniatyr, namnet och tiden, och vila
 * där det är vila. I dag lyfts fram; ett loggat pass får en bock.
 */
export function WeekStrip({
  days,
  workouts,
  done,
  today,
  hrefFor,
}: {
  /** Måndag till söndag. */
  days: string[];
  workouts: CalendarWorkout[];
  /** Dagar med ett loggat pass. */
  done: Set<string>;
  today: string;
  hrefFor: (w: CalendarWorkout) => string;
}) {
  return (
    <ol className="-mx-1 grid auto-cols-[minmax(8.75rem,1fr)] grid-flow-col gap-2 overflow-x-auto px-1 pb-1 lg:grid-flow-row lg:grid-cols-7 lg:overflow-visible">
      {days.map((day) => {
        const own = workouts.filter((w) => w.date === day);
        const first = own[0] ?? null;
        const isToday = day === today;
        const past = day < today;
        const body = (
          <>
            <span className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  "eyebrow",
                  isToday ? "text-accent-text" : "text-text-subtle",
                )}
              >
                {SHORT_DAY(day)} {Number(day.slice(8))}
              </span>
              {done.has(day) && (
                <Check aria-label="Loggat" className="size-3.5 text-good" />
              )}
            </span>
            {first ? (
              <span className="mt-auto block min-w-0 pt-5">
                <WorkoutStrip blocks={first.profile} className="h-6" />
                <span className="mt-3 block truncate text-sm font-medium text-text">
                  {first.title}
                </span>
                <span className="mt-0.5 block font-mono text-[0.75rem] text-text-subtle tabular-nums">
                  {first.profile.length > 0
                    ? hoursMinutes(profileSeconds(first.profile))
                    : (first.duration ?? "")}
                  {own.length > 1 ? ` · +${own.length - 1}` : ""}
                </span>
              </span>
            ) : (
              <span className="headline mt-4 block text-[1.75rem] italic text-text-subtle">
                Vila
              </span>
            )}
          </>
        );
        const cell = cn(
          "flex h-full min-h-36 flex-col rounded-md border p-3.5 transition-colors",
          isToday
            ? "border-line-strong bg-surface-2"
            : "border-line bg-canvas/30",
          past && !isToday && "opacity-70",
          first && "hover:border-line-strong",
        );
        return (
          <li key={day} aria-current={isToday ? "date" : undefined}>
            {first ? (
              <Link href={hrefFor(first)} className={cell}>
                {body}
              </Link>
            ) : (
              <div className={cell}>{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
