"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent,
} from "react";

import { SERIES } from "@/lib/calculators/chart-colors";
import { cn } from "@/lib/cn";
import {
  addDays,
  countdownText,
  dateRange,
  dayNumber,
  daysBetween,
  longDate,
  monthName,
} from "@/lib/season/season";
import { TRAINING_PHASES, type TrainingPhase } from "@/lib/tests/phases";
import { PHASE_SHORT, phaseFill, phaseText } from "./phase-style";

export type TimelineBlock = {
  id: string;
  phase: TrainingPhase;
  starts_on: string;
  ends_on: string;
  focus: string | null;
};

export type TimelineRace = {
  id: string;
  name: string;
  race_date: string;
  priority: "A" | "B" | "C";
  distance: string | null;
  target: string | null;
};

export type TimelineTest = {
  id: string;
  date: string;
  label: string;
  detail: string | null;
  href: string;
};

type Tip = {
  left: number;
  top: number;
  /** Under markeringen när det inte finns plats ovanför. */
  below: boolean;
  title: string;
  lines: string[];
};

/** Ungefärlig höjd för en tooltip med rubrik och tre rader. */
const TIP_ROOM = 90;

// Lodrät layout, px. Tävlingarnas etiketter på två rader för att undvika
// krockar, markörerna under dem, sedan faserna och testerna.
const Y = {
  month: 0,
  raceRow: [22, 38] as const,
  raceMarker: 62,
  band: 74,
  bandHeight: 24,
  test: 112,
  today: 126,
  height: 142,
};

/** Ungefärlig bredd för en etikett i 11 px Montserrat. */
const textWidth = (text: string) => text.length * 6.4 + 6;

const MARKER_SIZE = { A: 12, B: 10, C: 8 } as const;

/**
 * Säsongen på en tidslinje: perioderna som band, tävlingarna som markörer och
 * testerna som punkter, med dagens datum utritat.
 *
 * Varje markering har en egen hovring och samma sak vid tangentbordsfokus.
 * Allt som visas där står också i listorna under diagrammet – hovringen
 * förtydligar, den gömmer ingenting.
 */
export function SeasonTimeline({
  from,
  to,
  today,
  blocks,
  races,
  tests,
}: {
  from: string;
  to: string;
  today: string;
  blocks: TimelineBlock[];
  races: TimelineRace[];
  tests: TimelineTest[];
}) {
  const box = useRef<HTMLDivElement>(null);
  /** Ramen runt scrollytan. Tooltipen ligger här så att den inte klipps. */
  const frame = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const total = daysBetween(from, to) + 1;
  /** Andel av bredden vid dagens början. */
  const frac = (iso: string) => (dayNumber(iso) - dayNumber(from)) / total;
  /** Mitt på dagen – där en tävling eller ett test ritas. */
  const mid = (iso: string) => frac(iso) + 0.5 / total;
  const pct = (f: number) => `${(f * 100).toFixed(3)}%`;
  const inside = (iso: string) => iso >= from && iso <= to;

  const show = (
    event: PointerEvent<HTMLElement> | FocusEvent<HTMLElement>,
    title: string,
    lines: string[],
  ) => {
    const outer = frame.current?.getBoundingClientRect();
    const mark = event.currentTarget.getBoundingClientRect();
    if (!outer) return;
    const center = mark.left + mark.width / 2 - outer.left;
    const above = mark.top - outer.top;
    const below = above < TIP_ROOM;
    setTip({
      left: Math.min(Math.max(center, 110), Math.max(outer.width - 110, 110)),
      top: below ? mark.bottom - outer.top + 8 : above - 8,
      below,
      title,
      lines,
    });
  };
  const hide = () => setTip(null);
  const hover = (title: string, lines: string[]) => ({
    onPointerEnter: (e: PointerEvent<HTMLElement>) => show(e, title, lines),
    onPointerLeave: hide,
    onFocus: (e: FocusEvent<HTMLElement>) => show(e, title, lines),
    onBlur: hide,
  });

  // Månaderna: en tunn linje vid varje månadsskifte, namnet strax efter.
  const months: { iso: string; label: string }[] = [];
  {
    let y = Number(from.slice(0, 4));
    let m = Number(from.slice(5, 7)) - 1;
    for (;;) {
      const iso = `${y}-${String(m + 1).padStart(2, "0")}-01`;
      if (iso > to) break;
      if (iso >= from) {
        const label = monthName(m).slice(0, 3);
        months.push({
          iso,
          label: m === 0 || months.length === 0 ? `${label} ${y}` : label,
        });
      }
      m += 1;
      if (m === 12) {
        m = 0;
        y += 1;
      }
    }
  }

  // Etikettrader för tävlingarna: A-loppen först, sedan i datumordning. Ryms
  // en etikett inte på någon rad får hovringen och listan bära den.
  const visibleRaces = races.filter((r) => inside(r.race_date));
  const labelled = new Map<string, { row: 0 | 1; left: number }>();
  if (width > 0) {
    const taken: [number, number][][] = [[], []];
    const order = [...visibleRaces].sort(
      (a, b) =>
        a.priority.localeCompare(b.priority) ||
        a.race_date.localeCompare(b.race_date),
    );
    for (const race of order) {
      const w = textWidth(race.name);
      const center = mid(race.race_date) * width;
      const left = Math.min(
        Math.max(center - w / 2, 0),
        Math.max(width - w, 0),
      );
      const span: [number, number] = [left - 8, left + w + 8];
      for (const row of [0, 1] as const) {
        if (taken[row].every(([a, b]) => span[1] < a || span[0] > b)) {
          taken[row].push(span);
          labelled.set(race.id, { row, left });
          break;
        }
      }
    }
  }

  const todayInside = inside(today);

  return (
    <div>
      <div ref={frame} className="relative">
        <div className="overflow-x-auto pb-1 [scrollbar-width:thin]">
          <div
            ref={box}
            className="relative min-w-[720px] select-none"
            style={{ height: Y.height }}
            onPointerLeave={hide}
          >
            {/* Månadslinjer och namn */}
            {months.map((month) => (
              <div key={month.iso}>
                <span
                  aria-hidden
                  className="absolute w-px"
                  style={{
                    left: pct(frac(month.iso)),
                    top: 16,
                    bottom: 18,
                    background: "var(--chart-grid)",
                  }}
                />
                <span
                  className="absolute whitespace-nowrap text-[11px] tabular-nums"
                  style={{
                    left: `calc(${pct(frac(month.iso))} + 4px)`,
                    top: Y.month,
                    color: "var(--chart-axis-text)",
                  }}
                >
                  {month.label}
                </span>
              </div>
            ))}

            {/* Perioderna */}
            {blocks.map((block) => {
              const start = block.starts_on < from ? from : block.starts_on;
              const end = block.ends_on > to ? to : block.ends_on;
              if (start > end) return null;
              const left = frac(start);
              const right = frac(addDays(end, 1));
              const px = (right - left) * width;
              const label = PHASE_SHORT[block.phase];
              const fits = px >= textWidth(label) + 10;
              const cutStart = block.starts_on < from;
              const cutEnd = block.ends_on > to;
              const days = daysBetween(block.starts_on, block.ends_on) + 1;
              const title =
                TRAINING_PHASES.find((p) => p.key === block.phase)?.label ??
                label;
              const lines = [
                `${dateRange(block.starts_on, block.ends_on)} · ${days} dagar`,
                ...(block.focus ? [`Fokus: ${block.focus}`] : []),
              ];
              return (
                <button
                  key={block.id}
                  type="button"
                  aria-label={`${title}, ${lines.join(", ")}`}
                  className="absolute flex items-center overflow-hidden px-1.5 text-left text-[11px] font-medium transition-[filter] hover:brightness-110 focus-visible:brightness-110"
                  style={{
                    left: pct(left),
                    // Två pixlars glapp i ytans färg skiljer perioder som
                    // ligger kant i kant, utan en ram runt banden.
                    width: `calc(${pct(right - left)} - 2px)`,
                    top: Y.band,
                    height: Y.bandHeight,
                    background: phaseFill(block.phase),
                    color: phaseText(block.phase),
                    // Ett band som fortsätter utanför fönstret får rak kant.
                    borderRadius: `${cutStart ? 0 : 4}px ${cutEnd ? 0 : 4}px ${cutEnd ? 0 : 4}px ${cutStart ? 0 : 4}px`,
                  }}
                  {...hover(title, lines)}
                >
                  {fits && <span className="truncate">{label}</span>}
                </button>
              );
            })}

            {/* Tävlingarna: en hårlinje ned genom perioden, markören ovanför */}
            {visibleRaces.map((race) => {
              const x = pct(mid(race.race_date));
              const size = MARKER_SIZE[race.priority];
              const label = labelled.get(race.id);
              const lines = [
                `${race.priority}-lopp · ${longDate(race.race_date)}`,
                `${countdownText(daysBetween(today, race.race_date)).replace(/^./, (c) => c.toUpperCase())}`,
                ...(race.distance ? [race.distance] : []),
                ...(race.target ? [`Mål: ${race.target}`] : []),
              ];
              return (
                <div key={race.id}>
                  <span
                    aria-hidden
                    className="absolute w-px -translate-x-1/2"
                    style={{
                      left: x,
                      top: Y.raceMarker + size / 2,
                      height:
                        Y.band + Y.bandHeight + 4 - Y.raceMarker - size / 2,
                      background: "var(--text-muted)",
                    }}
                  />
                  {label && (
                    <span
                      className="absolute whitespace-nowrap text-[11px] text-text-muted"
                      style={{ left: label.left, top: Y.raceRow[label.row] }}
                    >
                      {race.name}
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={`${race.name}, ${lines.join(", ")}`}
                    className="absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center"
                    style={{ left: x, top: Y.raceMarker }}
                    {...hover(race.name, lines)}
                  >
                    <span
                      aria-hidden
                      className="block rotate-45 rounded-[2px]"
                      style={{
                        width: size,
                        height: size,
                        background:
                          race.priority === "A"
                            ? "var(--text)"
                            : race.priority === "B"
                              ? "var(--text-muted)"
                              : "transparent",
                        border:
                          race.priority === "C"
                            ? "2px solid var(--text-subtle)"
                            : undefined,
                        boxShadow: "0 0 0 2px var(--chart-surface)",
                      }}
                    />
                  </button>
                </div>
              );
            })}

            {/* Testerna */}
            {tests
              .filter((t) => inside(t.date))
              .map((test) => (
                <Link
                  key={test.id}
                  href={test.href}
                  aria-label={`${test.label}, ${test.date}${test.detail ? `, ${test.detail}` : ""}`}
                  className="absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
                  style={{ left: pct(mid(test.date)), top: Y.test }}
                  {...hover(test.label, [
                    longDate(test.date),
                    ...(test.detail ? [test.detail] : []),
                  ])}
                >
                  <span
                    aria-hidden
                    className="block size-2 rounded-full"
                    style={{
                      background: SERIES.secondary,
                      boxShadow: "0 0 0 2px var(--chart-surface)",
                    }}
                  />
                </Link>
              ))}

            {/* I dag */}
            {todayInside && (
              <>
                <span
                  aria-hidden
                  className="absolute w-px -translate-x-1/2 bg-accent"
                  style={{
                    left: pct(mid(today)),
                    top: 16,
                    height: Y.today - 16,
                  }}
                />
                <span
                  className="absolute -translate-x-1/2 whitespace-nowrap text-[11px] font-medium text-text"
                  style={{ left: pct(mid(today)), top: Y.today }}
                >
                  i dag
                </span>
              </>
            )}
          </div>
        </div>
        {tip && (
          <div
            role="tooltip"
            className={cn(
              "pointer-events-none absolute z-10 w-max max-w-[220px] -translate-x-1/2 rounded-md border border-line-strong bg-surface-2 px-3 py-2 shadow-lg",
              !tip.below && "-translate-y-full",
            )}
            style={{ left: tip.left, top: tip.top }}
          >
            <p className="text-[13px] font-semibold text-text">{tip.title}</p>
            {tip.lines.map((line) => (
              <p key={line} className="text-[12px] text-text-muted">
                {line}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Förklaringen */}
      <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-text-muted">
        {TRAINING_PHASES.map((phase) => (
          <li key={phase.key} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2.5 w-4 rounded-[2px]"
              style={{ background: phaseFill(phase.key) }}
            />
            {PHASE_SHORT[phase.key]}
          </li>
        ))}
        {(["A", "B", "C"] as const).map((priority) => (
          <li key={priority} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn("inline-block rotate-45 rounded-[2px]")}
              style={{
                width: MARKER_SIZE[priority] - 2,
                height: MARKER_SIZE[priority] - 2,
                background:
                  priority === "A"
                    ? "var(--text)"
                    : priority === "B"
                      ? "var(--text-muted)"
                      : "transparent",
                border:
                  priority === "C" ? "2px solid var(--text-subtle)" : undefined,
              }}
            />
            {priority}-lopp
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block size-2 rounded-full"
            style={{ background: SERIES.secondary }}
          />
          Test
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-3 w-px bg-accent" />I dag
        </li>
      </ul>
    </div>
  );
}
