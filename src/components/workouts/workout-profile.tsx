"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import type { Sport } from "@/lib/calculators/lactate";
import { profileBlocks } from "@/lib/workouts/blocks";
import {
  ZONE_NAMES,
  ZONES,
  zoneColor,
  type IntensityZone,
} from "@/lib/workouts/intensity";
import {
  formatDuration,
  type ResolvedStep,
  type StepKind,
  type TargetBasis,
} from "@/lib/workouts/schema";
import { percentText, targetText } from "@/lib/workouts/target-text";

/**
 * Passets profil som block: bredden är tiden, höjden målet och färgen zonen.
 *
 * Ritad för hand i SVG i stället för med diagrambiblioteket. Ett pass är en
 * rad rektanglar, och det som gör dem läsbara – ett mellanrum mellan varje
 * block, rundade toppar, ett verktygstips per block i stället för en pekare
 * som hoppar till närmaste punkt – är just det biblioteket gör svårt.
 *
 * Marginalerna är desamma som i W′bal-panelen under, så att tidsaxlarna
 * hamnar exakt över varandra.
 */

/** Plotytans vänsterkant: y-axelns bredd i W′bal-panelen. */
export const PLOT_LEFT = 52;
export const PLOT_RIGHT = 16;
const PLOT_TOP = 12;

/**
 * Jämna tidsmarkeringar i stället för automatikens.
 *
 * Att dela tidsaxeln i lika delar ger "14:10" och "28:20" – tal som inte
 * betyder något för den som läser ett pass. Här väljs ett jämnt steg som ger
 * ungefär ett halvdussin markeringar.
 */
export function timeTicks(totalSeconds: number): number[] {
  const step =
    [30, 60, 120, 300, 600, 900, 1800, 3600].find(
      (candidate) => totalSeconds / candidate <= 7,
    ) ?? 3600;

  const ticks: number[] = [];
  for (let t = 0; t <= totalSeconds; t += step) ticks.push(t);

  // Slutet läggs till bara när det inte trängs med föregående markering.
  const last = ticks[ticks.length - 1];
  if (totalSeconds - last > step / 2) ticks.push(totalSeconds);
  return ticks;
}

/**
 * Procentmarkeringar med steget 20, så att 100 % alltid hamnar på en linje.
 * Referensen är den enda nivå i grafen som betyder något i sig.
 */
export function percentTicks(max: number): { top: number; ticks: number[] } {
  const top = Math.ceil((max + 5) / 20) * 20;
  const ticks: number[] = [];
  for (let value = 0; value <= top; value += 20) ticks.push(value);
  return { top, ticks };
}

/** Bredden på elementet, mätt när det ritats och när det ändrar storlek. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Ett block med rundad topp och rak fot. */
function barPath(x0: number, x1: number, top: number, base: number): string {
  const width = x1 - x0;
  const height = base - top;
  const r = Math.max(0, Math.min(4, width / 2, height));
  return [
    `M${x0},${base}`,
    `L${x0},${top + r}`,
    `Q${x0},${top} ${x0 + r},${top}`,
    `L${x1 - r},${top}`,
    `Q${x1},${top} ${x1},${top + r}`,
    `L${x1},${base}`,
    "Z",
  ].join(" ");
}

const KIND_LABEL: Record<StepKind, string> = {
  uppvärmning: "Uppvärmning",
  intervall: "Intervall",
  vila: "Vila",
  distans: "Distans",
  nedvarvning: "Nedvarvning",
};

export function WorkoutProfile({
  steps,
  reference,
  basis,
  sport,
  showTimeAxis = true,
  legend = true,
  height = 240,
}: {
  steps: ResolvedStep[];
  reference: number;
  basis: TargetBasis;
  sport: Sport;
  /** Av när en panel under visar samma tidsaxel. */
  showTimeAxis?: boolean;
  /** Av när förklaringen står längre ned, under en panel till. */
  legend?: boolean;
  height?: number;
}) {
  const [ref, width] = useWidth();
  const [active, setActive] = useState<number | null>(null);

  const blocks = useMemo(
    () => profileBlocks(steps, reference, basis),
    [steps, reference, basis],
  );
  const starts = useMemo(() => {
    const out: number[] = [];
    let t = 0;
    for (const block of blocks) {
      out.push(t);
      t += block.seconds;
    }
    return out;
  }, [blocks]);

  if (blocks.length === 0) return null;

  const total = blocks.reduce((sum, b) => sum + b.seconds, 0);
  const scale = percentTicks(Math.max(100, ...blocks.map((b) => b.percent)));
  const ticks = timeTicks(total);
  const bottom = showTimeAxis ? 30 : 8;
  const plotWidth = Math.max(0, width - PLOT_LEFT - PLOT_RIGHT);
  const plotHeight = height - PLOT_TOP - bottom;
  const x = (t: number) => PLOT_LEFT + (t / total) * plotWidth;
  const y = (percent: number) =>
    PLOT_TOP + (1 - percent / scale.top) * plotHeight;
  const base = y(0);

  /** Blocket under en punkt på tidsaxeln. */
  const blockAt = (t: number): number => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= t) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const left = event.currentTarget.getBoundingClientRect().left;
    const px = event.clientX - left;
    if (px < PLOT_LEFT || px > PLOT_LEFT + plotWidth) {
      setActive(null);
      return;
    }
    setActive(blockAt(((px - PLOT_LEFT) / plotWidth) * total));
  };

  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    const last = blocks.length - 1;
    const current = active ?? -1;
    const next =
      event.key === "ArrowRight"
        ? Math.min(last, current + 1)
        : event.key === "ArrowLeft"
          ? Math.max(0, current - 1)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (event.key === "Escape") {
      setActive(null);
      return;
    }
    if (next === null) return;
    event.preventDefault();
    setActive(next);
  };

  const used = ZONES.filter((zone) => blocks.some((b) => b.zone === zone));
  const step = active !== null ? steps[active] : null;
  const block = active !== null ? blocks[active] : null;
  const center =
    active !== null ? x(starts[active] + blocks[active].seconds / 2) : 0;
  // Verktygstipset står på den sida om blocket där det finns plats.
  const tipOnLeft = center > width * 0.6;

  return (
    <div className="space-y-2">
      <div ref={ref} className="relative w-full" style={{ height }}>
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`Passets profil: ${blocks.length} steg på ${formatDuration(total)}, högst ${Math.round(
              Math.max(...blocks.map((b) => b.percent)),
            )} % av ${basis}. Piltangenterna stegar genom blocken.`}
            tabIndex={0}
            onPointerMove={onPointerMove}
            onPointerLeave={() => setActive(null)}
            onKeyDown={onKeyDown}
            onFocus={() => setActive((a) => a ?? 0)}
            onBlur={() => setActive(null)}
            className="block touch-pan-y rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            {scale.ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PLOT_LEFT}
                  x2={PLOT_LEFT + plotWidth}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke="var(--chart-grid)"
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <text
                  x={PLOT_LEFT - 8}
                  y={y(tick)}
                  dy="0.32em"
                  textAnchor="end"
                  fontSize={12}
                  fill="var(--chart-axis-text)"
                  className="tabular-nums"
                >
                  {tick} %
                </text>
              </g>
            ))}

            {blocks.map((b, i) => {
              const x0 = x(starts[i]);
              const x1 = x(starts[i] + b.seconds);
              // Ett mellanrum i ytans färg skiljer blocken åt – men bara när
              // blocket är brett nog att synas ändå.
              const gap = x1 - x0 > 4 ? 1 : 0;
              const top = Math.min(y(Math.max(b.percent, 0)), base - 2);
              return (
                <path
                  key={i}
                  d={barPath(x0 + gap, x1 - gap, top, base)}
                  fill={zoneColor(b.zone)}
                  stroke={active === i ? "var(--text)" : "none"}
                  strokeWidth={active === i ? 1.5 : 0}
                />
              );
            })}

            {/* Referensen. Allt ovanför den tär på reserven. */}
            <line
              x1={PLOT_LEFT}
              x2={PLOT_LEFT + plotWidth}
              y1={y(100)}
              y2={y(100)}
              stroke="var(--chart-axis-text)"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            <text
              x={PLOT_LEFT + 6}
              y={y(100) - 6}
              fontSize={11}
              fill="var(--chart-axis-text)"
            >
              {basis}
            </text>

            {showTimeAxis &&
              ticks.map((tick) => (
                <text
                  key={tick}
                  x={x(tick)}
                  y={height - 8}
                  textAnchor={
                    tick === 0 ? "start" : tick === total ? "end" : "middle"
                  }
                  fontSize={12}
                  fill="var(--chart-axis-text)"
                  className="tabular-nums"
                >
                  {formatDuration(tick)}
                </text>
              ))}
          </svg>
        )}

        {step && block && active !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-2 z-10 w-max max-w-[220px] rounded-md border border-line bg-canvas px-3 py-2 text-xs shadow-lg"
            style={
              tipOnLeft ? { right: width - center + 10 } : { left: center + 10 }
            }
          >
            <p className="text-sm font-semibold text-text tabular-nums">
              {targetText(step, sport)}
            </p>
            <p className="mt-0.5 text-text-muted tabular-nums">
              {formatDuration(step.seconds)} ·{" "}
              {step.label || KIND_LABEL[step.kind]}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-text-subtle tabular-nums">
              <span
                aria-hidden
                className="inline-block h-0.5 w-3 rounded-full"
                style={{ backgroundColor: zoneColor(block.zone) }}
              />
              {percentText(step, basis)} · Z{block.zone}{" "}
              {ZONE_NAMES[block.zone]}
            </p>
            <p className="mt-0.5 text-text-subtle tabular-nums">
              Start {formatDuration(starts[active])}
            </p>
          </div>
        )}
      </div>

      {legend && <ZoneLegend zones={used} />}
    </div>
  );
}

/** Zonerna som finns i passet, i ordning. */
export function ZoneLegend({ zones }: { zones: IntensityZone[] }) {
  if (zones.length === 0) return null;
  return (
    <ul
      aria-label="Zoner"
      className="flex flex-wrap gap-x-4 gap-y-1 pl-[52px] text-[12px] text-text-muted"
    >
      {zones.map((zone) => (
        <li key={zone} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block size-2.5 rounded-[2px]"
            style={{ backgroundColor: zoneColor(zone) }}
          />
          Z{zone} {ZONE_NAMES[zone]}
        </li>
      ))}
    </ul>
  );
}
