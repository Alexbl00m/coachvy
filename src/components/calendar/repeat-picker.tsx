"use client";

import { Switch } from "@/components/ui/switch";
import { Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { recurringDates, WEEKDAYS, weekdayOf } from "@/lib/calendar/recurrence";
import { shortDate, weekdayName } from "@/lib/season/season";

export type Repeat = { on: boolean; weekdays: number[]; weeks: number };

/** Förvalet: av, med startdagens veckodag i fyra veckor när det slås på. */
export const repeatFor = (start: string): Repeat => ({
  on: false,
  weekdays: start ? [weekdayOf(start)] : [],
  weeks: 4,
});

/** Datumen passet läggs på: bara startdagen, eller alla upprepningar. */
export const datesFor = (start: string, repeat: Repeat): string[] =>
  !start
    ? []
    : repeat.on
      ? recurringDates({
          start,
          weekdays: repeat.weekdays,
          weeks: repeat.weeks,
        })
      : [start];

const WEEK_CHOICES = [2, 3, 4, 5, 6, 8, 10, 12, 16];

/**
 * "Upprepa varje vecka": veckodagarna och hur många veckor, med datumen
 * utskrivna innan något sparas – så att det syns vad som läggs in.
 */
export function RepeatPicker({
  start,
  value,
  onChange,
  fixed = false,
}: {
  start: string;
  value: Repeat;
  onChange: (next: Repeat) => void;
  /** Alltid på, utan växel – för "Kopiera till fler dagar". */
  fixed?: boolean;
}) {
  const on = fixed || value.on;
  const dates = datesFor(start, { ...value, on });
  const toggle = (day: number) =>
    onChange({
      ...value,
      weekdays: value.weekdays.includes(day)
        ? value.weekdays.filter((d) => d !== day)
        : [...value.weekdays, day],
    });

  return (
    <div className="space-y-3">
      {!fixed && (
        <Switch
          checked={value.on}
          onChange={(on) =>
            onChange({
              ...value,
              on,
              // Startdagens veckodag förvald när inget annat är valt.
              weekdays:
                on && value.weekdays.length === 0 && start
                  ? [weekdayOf(start)]
                  : value.weekdays,
            })
          }
          label="Upprepa varje vecka"
          hint="Samma pass på valda veckodagar, ett antal veckor framåt."
        />
      )}
      {on && (
        <div className="space-y-3 rounded-md border border-line bg-canvas/40 p-3">
          <div
            role="group"
            aria-label="Veckodagar"
            className="flex flex-wrap gap-1.5"
          >
            {WEEKDAYS.map((label, day) => {
              const pressed = value.weekdays.includes(day);
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => toggle(day)}
                  className={cn(
                    "h-8 min-w-11 rounded-full border px-3 text-[0.8125rem] transition-colors",
                    pressed
                      ? "border-text bg-text font-medium text-canvas"
                      : "border-line-strong text-text-muted hover:border-text-subtle hover:text-text",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <label className="flex items-center gap-2 text-sm text-text-muted">
            i
            <Select
              value={value.weeks}
              onChange={(e) =>
                onChange({ ...value, weeks: Number(e.target.value) })
              }
              className="h-9 w-auto! py-1!"
            >
              {WEEK_CHOICES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
            veckor
          </label>
          <p className="text-[0.8125rem] text-text-muted">
            {dates.length === 0 ? (
              "Välj minst en veckodag."
            ) : (
              <>
                <span className="font-medium text-text">
                  {dates.length} pass:
                </span>{" "}
                {dates
                  .slice(0, 8)
                  .map((d) => `${weekdayName(d).slice(0, 3)} ${shortDate(d)}`)
                  .join(", ")}
                {dates.length > 8 ? ` och ${dates.length - 8} till` : ""}.
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
