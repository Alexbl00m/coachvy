"use client";

import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/cn";
import {
  addDays,
  isoWeek,
  longDate,
  mondayOf,
  monthDates,
  monthName,
  shiftMonth,
  todayIso,
  weekdayIndex,
  weekdayName,
} from "@/lib/season/season";

/** Rutans bredd, 20rem, och minsta avstånd till fönstrets kant. */
const POPOVER_WIDTH = 320;
const EDGE = 8;

const DAY_HEADS = ["Må", "Ti", "On", "To", "Fr", "Lö", "Sö"];
const WEEKDAY_SHORT = ["mån", "tis", "ons", "tor", "fre", "lör", "sön"];

/** En period att visa i kalendern, som en tunn färgad linje under dagarna. */
export type DateMark = {
  from: string;
  to: string;
  color: string;
  label: string;
};

/** "mån 12 jan 2027" – kort nog för ett fält, med veckodagen först. */
export function pickerDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${WEEKDAY_SHORT[weekdayIndex(iso)]} ${d} ${monthName(m - 1).slice(0, 3)} ${y}`;
}

/** Samma dag `months` månader bort, eller månadens sista dag. */
function shiftDate(iso: string, months: number): string {
  const month = shiftMonth(iso.slice(0, 7), months);
  const last = Number(addDays(`${shiftMonth(month, 1)}-01`, -1).slice(8, 10));
  const day = Math.min(Number(iso.slice(8, 10)), last);
  return `${month}-${String(day).padStart(2, "0")}`;
}

const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

const clamp = (iso: string, min?: string, max?: string) =>
  min && iso < min ? min : max && iso > max ? max : iso;

/**
 * Ett datumfält med en kalender som öppnas under fältet: svensk kalender,
 * måndag först och veckonummer i vänsterkanten. Ett klick på veckonumret
 * väljer veckans måndag, så att det går att planera i hela veckor.
 *
 * Tangentbord: pilarna flyttar en dag eller en vecka, Page Up och Page Down
 * en månad (med Shift ett år), Home och End till veckans måndag och söndag,
 * Enter väljer och Escape stänger.
 */
export function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  range = null,
  marks = [],
  placeholder = "Välj datum",
  disabled = false,
  className,
}: {
  id: string;
  /** YYYY-MM-DD, eller tomt. */
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  /** Ett intervall att visa, som perioden som planeras. */
  range?: { from: string; to: string } | null;
  marks?: DateMark[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"days" | "months">("days");
  const [view, setView] = useState(() => (value || todayIso()).slice(0, 7));
  const [focus, setFocus] = useState(() => value || todayIso());
  // Rutans förskjutning i sidled från fältets vänsterkant, i pixlar.
  const [shift, setShift] = useState(0);
  // Fokus flyttas in i rutnätet bara när tangentbordet eller öppningen bad
  // om det, inte när musen bläddrar med pilarna.
  const moveFocus = useRef(false);
  const today = todayIso();

  const outside = (date: string) =>
    Boolean((min && date < min) || (max && date > max));

  const show = () => {
    const start = clamp(value || today, min, max);
    setView(start.slice(0, 7));
    setFocus(start);
    setMode("days");
    // Rutan börjar vid fältets vänsterkant men hålls minst 8 px innanför
    // fönstret, så att den inte hamnar utanför på en smal skärm.
    const rect = trigger.current?.getBoundingClientRect();
    if (rect) {
      const width = Math.min(POPOVER_WIDTH, window.innerWidth - 32);
      const right = window.innerWidth - EDGE;
      let left = 0;
      if (rect.left + width > right) left = right - width - rect.left;
      if (rect.left + left < EDGE) left = EDGE - rect.left;
      setShift(Math.round(left));
    }
    moveFocus.current = true;
    setOpen(true);
  };

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };

  const pick = (date: string) => {
    if (outside(date)) return;
    onChange(date);
    close(true);
  };

  const goTo = (date: string) => {
    const next = clamp(date, min, max);
    setFocus(next);
    setView(next.slice(0, 7));
    moveFocus.current = true;
  };

  useEffect(() => {
    if (!open || mode !== "days" || !moveFocus.current) return;
    moveFocus.current = false;
    grid.current
      ?.querySelector<HTMLButtonElement>(`[data-date="${focus}"]`)
      ?.focus();
  }, [open, mode, focus, view]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const onGridKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (event.key in step) {
      goTo(addDays(focus, step[event.key]));
    } else if (event.key === "Home") {
      goTo(mondayOf(focus));
    } else if (event.key === "End") {
      goTo(addDays(mondayOf(focus), 6));
    } else if (event.key === "PageUp" || event.key === "PageDown") {
      const months =
        (event.key === "PageUp" ? -1 : 1) * (event.shiftKey ? 12 : 1);
      goTo(shiftDate(focus, months));
    } else {
      return;
    }
    event.preventDefault();
  };

  // Tabbar man ur kalendern stängs den. Rutan själv kan ta fokus, så att ett
  // klick på dess kant inte räknas som att lämna den.
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (open && !wrapper.current?.contains(event.relatedTarget as Node)) {
      setOpen(false);
    }
  };

  const dates = monthDates(view);
  const weeks = Array.from({ length: dates.length / 7 }, (_, i) =>
    dates.slice(i * 7, i * 7 + 7),
  );
  const markOn = (date: string) =>
    marks.find((m) => m.from <= date && date <= m.to) ?? null;
  const year = Number(view.slice(0, 4));
  const title = capitalize(
    `${monthName(Number(view.slice(5, 7)) - 1)} ${year}`,
  );

  return (
    <div ref={wrapper} className={cn("relative", className)} onBlur={onBlur}>
      <button
        ref={trigger}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close(false) : show())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            show();
          }
        }}
        className="flex w-full items-center gap-2 rounded-md border border-line-control bg-surface px-3 py-2 text-left text-sm text-text transition-colors hover:border-text-subtle focus:border-accent focus:outline-none disabled:opacity-50"
      >
        <CalendarDays
          aria-hidden
          className="size-4 shrink-0 text-text-subtle"
        />
        {value ? (
          <>
            <span className="truncate tabular-nums">{pickerDate(value)}</span>
            <span className="ml-auto shrink-0 text-[12px] text-text-subtle tabular-nums">
              v. {isoWeek(value)}
            </span>
          </>
        ) : (
          <span className="text-text-subtle">{placeholder}</span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Välj datum"
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              close(true);
            }
          }}
          style={{ left: shift }}
          className="enter absolute top-[calc(100%+4px)] z-40 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-line-strong bg-surface p-3 shadow-2xl focus:outline-none"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label={
                mode === "days" ? "Föregående månad" : "Föregående år"
              }
              onClick={() =>
                setView(shiftMonth(view, mode === "days" ? -1 : -12))
              }
              className="grid size-8 place-items-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
            >
              <ChevronLeft aria-hidden className="size-4" />
            </button>
            <button
              type="button"
              aria-label={
                mode === "days"
                  ? `${title}, välj en annan månad`
                  : `${year}, tillbaka till dagarna`
              }
              onClick={() => setMode(mode === "days" ? "months" : "days")}
              className="rounded-md px-2 py-1 text-sm font-semibold text-text hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
            >
              {mode === "days" ? title : year}
            </button>
            <button
              type="button"
              aria-label={mode === "days" ? "Nästa månad" : "Nästa år"}
              onClick={() =>
                setView(shiftMonth(view, mode === "days" ? 1 : 12))
              }
              className="grid size-8 place-items-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
            >
              <ChevronRight aria-hidden className="size-4" />
            </button>
          </div>

          {mode === "months" ? (
            <div className="grid grid-cols-3 gap-1">
              {Array.from({ length: 12 }, (_, i) => {
                const month = `${year}-${String(i + 1).padStart(2, "0")}`;
                const current = month === view;
                return (
                  <button
                    key={month}
                    type="button"
                    onClick={() => {
                      setMode("days");
                      // Samma dag i den valda månaden, eller dess sista.
                      goTo(shiftDate(`${month}-${focus.slice(8, 10)}`, 0));
                    }}
                    className={cn(
                      "h-10 rounded-md text-[13px] hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent",
                      current
                        ? "bg-accent-soft font-semibold text-accent-text"
                        : "text-text",
                    )}
                  >
                    {capitalize(monthName(i).slice(0, 3))}
                  </button>
                );
              })}
            </div>
          ) : (
            <div
              ref={grid}
              role="grid"
              aria-label={title}
              onKeyDown={onGridKey}
              className="text-center"
            >
              <div role="row" className="grid grid-cols-8">
                <span
                  role="columnheader"
                  className="py-1 text-[11px] text-text-subtle"
                >
                  <abbr title="Vecka" className="no-underline">
                    v.
                  </abbr>
                </span>
                {DAY_HEADS.map((head, i) => (
                  <span
                    key={head}
                    role="columnheader"
                    className="py-1 text-[11px] font-medium text-text-muted"
                  >
                    <abbr
                      title={weekdayName(addDays("2026-01-05", i))}
                      className="no-underline"
                    >
                      {head}
                    </abbr>
                  </span>
                ))}
              </div>
              {weeks.map((week) => {
                const monday = week[0];
                const weekNumber = isoWeek(monday);
                return (
                  <div key={monday} role="row" className="grid grid-cols-8">
                    <span role="rowheader" className="p-0.5">
                      <button
                        type="button"
                        tabIndex={-1}
                        disabled={outside(monday)}
                        aria-label={`Välj måndag i vecka ${weekNumber}`}
                        title={`Välj måndag ${longDate(monday)}`}
                        onClick={() => pick(monday)}
                        className="h-8 w-full rounded-md text-[11px] text-text-subtle tabular-nums hover:bg-surface-2 hover:text-text disabled:pointer-events-none disabled:opacity-30"
                      >
                        {weekNumber}
                      </button>
                    </span>
                    {week.map((date) => {
                      const inMonth = date.slice(0, 7) === view;
                      const selected = date === value;
                      const isToday = date === today;
                      const inRange =
                        range !== null &&
                        range.from <= date &&
                        date <= range.to;
                      const rangeEnd =
                        range !== null &&
                        (date === range.from || date === range.to);
                      const mark = markOn(date);
                      return (
                        <span
                          key={date}
                          role="gridcell"
                          aria-selected={selected}
                          className="p-0.5"
                        >
                          <button
                            type="button"
                            data-date={date}
                            tabIndex={date === focus ? 0 : -1}
                            disabled={outside(date)}
                            aria-current={isToday ? "date" : undefined}
                            aria-label={`${weekdayName(date)} ${longDate(date)}${mark ? `, ${mark.label}` : ""}`}
                            title={mark?.label}
                            onClick={() => pick(date)}
                            onFocus={() => setFocus(date)}
                            className={cn(
                              "relative h-8 w-full rounded-md text-[13px] tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-30",
                              selected || rangeEnd
                                ? "bg-accent font-semibold text-accent-on hover:bg-accent-strong"
                                : inRange
                                  ? "bg-accent-soft text-text hover:bg-surface-3"
                                  : inMonth
                                    ? "text-text hover:bg-surface-2"
                                    : "text-text-subtle/70 hover:bg-surface-2",
                              isToday &&
                                !selected &&
                                !rangeEnd &&
                                "font-semibold text-accent-text ring-1 ring-inset ring-line-control",
                            )}
                          >
                            {Number(date.slice(8, 10))}
                            {mark && (
                              <span
                                aria-hidden
                                className="absolute inset-x-1.5 bottom-0.5 h-[3px] rounded-full"
                                style={{ background: mark.color }}
                              />
                            )}
                          </button>
                        </span>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
            <button
              type="button"
              disabled={outside(today)}
              onClick={() => pick(today)}
              className="rounded-md px-2 py-1 text-[12px] font-medium text-accent-text hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40"
            >
              I dag
            </button>
            <span className="text-[11px] text-text-subtle">
              Klicka på veckan för måndagen
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
