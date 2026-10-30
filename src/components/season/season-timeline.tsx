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
import { useRootScale } from "@/lib/ui/use-root-scale";
import {
  addDays,
  countdownText,
  dateRange,
  dayNumber,
  daysBetween,
  lengthText,
  longDate,
  monthName,
  weekSpan,
} from "@/lib/season/season";
import { TRAINING_PHASES, type TrainingPhase } from "@/lib/tests/phases";
import { blockLabel, PHASE_SHORT, phaseFill, phaseText } from "./phase-style";

export type TimelineBlock = {
  id: string;
  phase: TrainingPhase;
  name?: string | null;
  starts_on: string;
  ends_on: string;
  focus: string | null;
  /** Perioden är en fas i en plan ur biblioteket. */
  plan?: { title: string };
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

// Lodrät layout i px vid grundstorleken: månaderna överst, sedan en rad per
// slag – perioderna som höga band med namn och veckor, tävlingarna och
// testerna. Allt skalas med gränssnittet på stora skärmar.
const Y_BASE = {
  month: 6,
  band: 34,
  bandHeight: 54,
  race: 126,
  test: 178,
  height: 204,
};

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
  newPeriodHref,
}: {
  from: string;
  to: string;
  today: string;
  blocks: TimelineBlock[];
  races: TimelineRace[];
  tests: TimelineTest[];
  /** Länken för en ny period, när den som tittar får planera. */
  newPeriodHref?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  /** Ramen runt scrollytan. Tooltipen ligger här så att den inte klipps. */
  const frame = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [tip, setTip] = useState<Tip | null>(null);
  const scale = useRootScale();
  const Y = Object.fromEntries(
    Object.entries(Y_BASE).map(([k, v]) => [k, v * scale]),
  ) as typeof Y_BASE;
  /** Raderna, med etikett i vänsterkanten. */
  const ROWS = [
    { label: "Perioder", center: Y.band + Y.bandHeight / 2 },
    { label: "Tävlingar", center: Y.race },
    { label: "Tester", center: Y.test },
  ];
  /** Ungefärlig bredd för en etikett i 12 px Geist. */
  const textWidth = (text: string) => (text.length * 6.6 + 6) * scale;
  /** Ungefärlig bredd för en etikett i 10,5 px Geist Mono i versaler. */
  const monoWidth = (text: string) => (text.length * 7.4 + 6) * scale;

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
    const below = above < TIP_ROOM * scale;
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

  // Tävlingarnas namn står till vänster om markören, eller till höger när
  // det inte ryms. A-loppen får plats först; ryms en etikett inte alls får
  // hovringen och listan bära den.
  const visibleRaces = races.filter((r) => inside(r.race_date));
  const labelled = new Map<string, { left: number }>();
  if (width > 0) {
    const taken: [number, number][] = [];
    const order = [...visibleRaces].sort(
      (a, b) =>
        a.priority.localeCompare(b.priority) ||
        a.race_date.localeCompare(b.race_date),
    );
    for (const race of order) {
      const w = textWidth(race.name);
      const center = mid(race.race_date) * width;
      for (const left of [center - 14 - w, center + 14]) {
        const span: [number, number] = [left - 6, left + w + 6];
        const free =
          left >= 0 &&
          left + w <= width &&
          taken.every(([a, b]) => span[1] < a || span[0] > b) &&
          visibleRaces.every(
            (r) =>
              r.id === race.id ||
              Math.abs(mid(r.race_date) * width - (left + w / 2)) > w / 2 + 8,
          );
        if (free) {
          taken.push(span);
          labelled.set(race.id, { left });
          break;
        }
      }
    }
  }

  // Det som inte är planerat: från sista periodens slut till fönstrets slut.
  const lastEnd = blocks.reduce<string | null>(
    (max, b) => (max === null || b.ends_on > max ? b.ends_on : max),
    null,
  );
  const openFrom =
    lastEnd && lastEnd >= today
      ? addDays(lastEnd, 1)
      : today > from
        ? today
        : from;
  const showOpen = openFrom <= to && daysBetween(openFrom, to) >= 28;

  const todayInside = inside(today);

  return (
    <div>
      <div ref={frame} className="relative flex">
        <div
          aria-hidden
          className="relative hidden w-24 shrink-0 sm:block"
          style={{ height: Y.height }}
        >
          {ROWS.map((row) => (
            <span
              key={row.label}
              className="eyebrow absolute left-0 -translate-y-1/2 text-[0.6875rem] text-text-subtle"
              style={{ top: row.center }}
            >
              {row.label}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto pb-1 [scrollbar-width:thin]">
          <div
            ref={box}
            className="relative min-w-[45rem] select-none"
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
                    top: 26 * scale,
                    bottom: 6 * scale,
                    background: "var(--chart-grid)",
                  }}
                />
                <span
                  className="absolute whitespace-nowrap font-mono text-[0.6875rem] tabular-nums"
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
              const label = blockLabel(block);
              const weeks = Math.round(
                (daysBetween(block.starts_on, block.ends_on) + 1) / 7,
              );
              const sub = `${block.name?.trim() ? `${PHASE_SHORT[block.phase]} · ` : ""}${weekSpan(block.starts_on, block.ends_on).replace("v. ", "v")} · ${weeks} v`;
              const fits = px >= textWidth(label) + 18;
              const subFits = px >= monoWidth(sub) + 18;
              const cutStart = block.starts_on < from;
              const cutEnd = block.ends_on > to;
              const days = daysBetween(block.starts_on, block.ends_on) + 1;
              const phase =
                TRAINING_PHASES.find((p) => p.key === block.phase)?.label ??
                label;
              const title = block.name?.trim()
                ? `${block.name.trim()} · ${phase}`
                : phase;
              const lines = [
                `${dateRange(block.starts_on, block.ends_on)} · ${weekSpan(block.starts_on, block.ends_on)} · ${lengthText(days)}`,
                ...(block.focus ? [`Fokus: ${block.focus}`] : []),
                ...(block.plan ? [`Ur planen ${block.plan.title}`] : []),
              ];
              return (
                <button
                  key={block.id}
                  type="button"
                  aria-label={`${title}, ${lines.join(", ")}`}
                  className="absolute flex flex-col items-start justify-center gap-0.5 overflow-hidden px-3 text-left transition-[filter] hover:brightness-110 focus-visible:brightness-110"
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
                    borderRadius: `${cutStart ? 0 : 8}px ${cutEnd ? 0 : 8}px ${cutEnd ? 0 : 8}px ${cutStart ? 0 : 8}px`,
                  }}
                  {...hover(title, lines)}
                >
                  {fits && (
                    <span className="max-w-full truncate text-[0.8125rem] font-semibold">
                      {label}
                    </span>
                  )}
                  {subFits && (
                    <span className="max-w-full truncate font-mono text-[0.65625rem] uppercase tracking-[0.06em] opacity-80">
                      {sub}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Det som inte är planerat än */}
            {showOpen &&
              (() => {
                const style = {
                  left: `calc(${pct(frac(openFrom))} + 4px)`,
                  width: `calc(${pct(frac(addDays(to, 1)) - frac(openFrom))} - 4px)`,
                  top: Y.band,
                  height: Y.bandHeight,
                };
                const text = `Inget planerat efter ${longDate(addDays(openFrom, -1), today)}`;
                const className =
                  "absolute flex items-center justify-center gap-2 overflow-hidden rounded-lg border border-dashed border-line-strong px-3 text-[0.8125rem] text-text-muted";
                return newPeriodHref ? (
                  <Link
                    href={newPeriodHref}
                    className={cn(
                      className,
                      "transition-colors hover:border-text-subtle hover:text-text",
                    )}
                    style={style}
                  >
                    <span aria-hidden>+</span>
                    <span className="truncate">{text}</span>
                  </Link>
                ) : (
                  <span className={className} style={style}>
                    <span className="truncate">{text}</span>
                  </span>
                );
              })()}

            {/* Tävlingarna: en markör på sin rad, namnet bredvid */}
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
                  {label && (
                    <span
                      className="absolute -translate-y-1/2 whitespace-nowrap text-[0.75rem] text-text-muted"
                      style={{ left: label.left, top: Y.race }}
                    >
                      {race.name}
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={`${race.name}, ${lines.join(", ")}`}
                    className="absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center"
                    style={{ left: x, top: Y.race }}
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
                  className="absolute w-0.5 -translate-x-1/2 rounded-full bg-accent"
                  style={{
                    left: pct(mid(today)),
                    top: 4,
                    height: Y.height - 8,
                  }}
                />
                <span
                  className="eyebrow absolute whitespace-nowrap bg-surface pr-1 pl-1.5 text-[0.6875rem] text-accent-text"
                  style={{ left: pct(mid(today)), top: Y.month - 2 }}
                >
                  I dag
                </span>
              </>
            )}
          </div>
        </div>
        {tip && (
          <div
            role="tooltip"
            className={cn(
              "pointer-events-none absolute z-10 w-max max-w-[13.75rem] -translate-x-1/2 rounded-md border border-line-strong bg-surface-2 px-3 py-2 shadow-lg",
              !tip.below && "-translate-y-full",
            )}
            style={{ left: tip.left, top: tip.top }}
          >
            <p className="text-[0.8125rem] font-semibold text-text">
              {tip.title}
            </p>
            {tip.lines.map((line) => (
              <p key={line} className="text-[0.75rem] text-text-muted">
                {line}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Förklaringen */}
      <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.75rem] text-text-muted">
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
