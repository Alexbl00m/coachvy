"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import { SERIES } from "@/lib/calculators/chart-colors";

/**
 * Adeptens värden mot referensnivåer, i ett gemensamt mått.
 *
 * Varje kolumn har sin egen skala – watt per kilo på 5 sekunder och vid
 * tröskeln, ml/kg/min och mmol/l/s – men nivåerna ligger på samma höjd i alla
 * kolumner. Då blir formen på adeptens linje det man läser: en topp där
 * adepten är stark mot referensen, en dal där det finns mest kvar.
 *
 * Två sätt att rita nivåerna:
 * - `bands`: nivåerna är band, som Coggans kategorier. Position 0–n.
 * - `lines`: nivåerna är linjer, som referensgrupperna. Position 0 är den
 *   första gruppen, 1 nästa.
 */

export type LevelColumn = {
  key: string;
  label: string;
  sublabel?: string;
  /** Var värdet ligger bland nivåerna. null: värde saknas. */
  position: number | null;
  /** Värdet som det står vid punkten, "4,94". */
  value: string;
  /** Enheten, i verktygstipset: "W/kg". */
  unit?: string;
  /** Mer för verktygstipset: kategori, enhet, källa. */
  detail?: string;
};

const LABEL_WIDTH = 108;
const PAD_RIGHT = 16;
const PAD_TOP = 18;
const PAD_BOTTOM = 40;
const COLUMN_MIN = 66;

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

export function LevelChart({
  levels,
  kind,
  columns,
  target = null,
  targetLabel = "Mål",
  height = 300,
  ariaLabel,
}: {
  /** Nivåernas namn nerifrån och upp. */
  levels: string[];
  kind: "bands" | "lines";
  columns: LevelColumn[];
  /** En streckad linje på en position, till exempel målnivån. */
  target?: number | null;
  targetLabel?: string;
  height?: number;
  ariaLabel: string;
}) {
  const [ref, measured] = useWidth();
  const [active, setActive] = useState<number | null>(null);
  const minWidth = LABEL_WIDTH + PAD_RIGHT + columns.length * COLUMN_MIN;
  const width = Math.max(measured, minWidth);

  const n = levels.length;
  const [lo, hi] = kind === "bands" ? [-0.5, n + 0.5] : [-0.6, n - 1 + 0.6];
  const plotLeft = LABEL_WIDTH;
  const plotRight = width - PAD_RIGHT;
  const columnWidth = (plotRight - plotLeft) / Math.max(1, columns.length);
  const plotBottom = height - PAD_BOTTOM;
  const y = (position: number) =>
    PAD_TOP +
    (1 - (Math.max(lo, Math.min(hi, position)) - lo) / (hi - lo)) *
      (plotBottom - PAD_TOP);
  const x = (index: number) => plotLeft + (index + 0.5) * columnWidth;

  const points = columns
    .map((c, i) =>
      c.position === null ? null : { i, c, px: x(i), py: y(c.position) },
    )
    .filter((p): p is NonNullable<typeof p> => p !== null);
  // Linjen bryts där ett värde saknas, i stället för att hoppa över det.
  const segments: (typeof points)[] = [];
  for (const p of points) {
    const last = segments[segments.length - 1];
    if (last && last[last.length - 1].i === p.i - 1) last.push(p);
    else segments.push([p]);
  }

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const left = event.currentTarget.getBoundingClientRect().left;
    const px = event.clientX - left;
    if (px < plotLeft || px > plotRight) return setActive(null);
    const index = Math.min(
      columns.length - 1,
      Math.max(0, Math.floor((px - plotLeft) / columnWidth)),
    );
    setActive(columns[index].position === null ? null : index);
  };

  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    const withValue = columns
      .map((c, i) => (c.position === null ? -1 : i))
      .filter((i) => i >= 0);
    if (withValue.length === 0) return;
    const at = withValue.indexOf(active ?? -1);
    let next: number | null = null;
    if (event.key === "ArrowRight")
      next = withValue[Math.min(withValue.length - 1, at + 1)];
    if (event.key === "ArrowLeft") next = withValue[Math.max(0, at - 1)];
    if (event.key === "Escape") return setActive(null);
    if (next === null || next === undefined) return;
    event.preventDefault();
    setActive(next);
  };

  const activeColumn = active !== null ? columns[active] : null;
  const tipLeft = active !== null ? x(active) : 0;

  return (
    <div className="overflow-x-auto">
      <div ref={ref} className="relative" style={{ minWidth, height }}>
        {measured > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={ariaLabel}
            tabIndex={0}
            onPointerMove={onPointerMove}
            onPointerLeave={() => setActive(null)}
            onKeyDown={onKeyDown}
            onFocus={() =>
              setActive(
                (a) => a ?? columns.findIndex((c) => c.position !== null),
              )
            }
            onBlur={() => setActive(null)}
            className="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            {kind === "bands"
              ? levels.map((name, i) => (
                  <g key={name}>
                    {i % 2 === 0 && (
                      <rect
                        x={plotLeft}
                        width={plotRight - plotLeft}
                        y={y(i + 1)}
                        height={y(i) - y(i + 1)}
                        fill="var(--surface-2)"
                      />
                    )}
                    <text
                      x={0}
                      y={(y(i) + y(i + 1)) / 2}
                      dy="0.32em"
                      fontSize={11}
                      fill="var(--chart-axis-text)"
                    >
                      {name}
                    </text>
                  </g>
                ))
              : levels.map((name, i) => (
                  <g key={name}>
                    <line
                      x1={plotLeft}
                      x2={plotRight}
                      y1={y(i)}
                      y2={y(i)}
                      stroke="var(--chart-grid)"
                      strokeWidth={1}
                      shapeRendering="crispEdges"
                    />
                    <text
                      x={0}
                      y={y(i)}
                      dy="0.32em"
                      fontSize={11}
                      fill="var(--chart-axis-text)"
                    >
                      {name}
                    </text>
                  </g>
                ))}

            {columns.map((c, i) => (
              <g key={c.key}>
                <line
                  x1={x(i)}
                  x2={x(i)}
                  y1={PAD_TOP}
                  y2={plotBottom}
                  stroke="var(--chart-grid)"
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <text
                  x={x(i)}
                  y={plotBottom + 18}
                  textAnchor="middle"
                  fontSize={12}
                  fill="var(--text-muted)"
                >
                  {c.label}
                </text>
                {c.sublabel && (
                  <text
                    x={x(i)}
                    y={plotBottom + 32}
                    textAnchor="middle"
                    fontSize={10.5}
                    fill="var(--chart-axis-text)"
                  >
                    {c.sublabel}
                  </text>
                )}
              </g>
            ))}

            {target !== null && (
              <g>
                <line
                  x1={plotLeft}
                  x2={plotRight}
                  y1={y(target)}
                  y2={y(target)}
                  stroke="var(--text-muted)"
                  strokeDasharray="5 4"
                  strokeWidth={1.25}
                />
                <text
                  x={plotRight}
                  y={y(target) - 6}
                  textAnchor="end"
                  fontSize={11}
                  fill="var(--text-muted)"
                >
                  {targetLabel}
                </text>
              </g>
            )}

            {segments.map((segment, s) =>
              segment.length > 1 ? (
                <polyline
                  key={s}
                  points={segment.map((p) => `${p.px},${p.py}`).join(" ")}
                  fill="none"
                  stroke={SERIES.primary}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : null,
            )}

            {points.map((p) => {
              const above = p.py > PAD_TOP + 22;
              return (
                <g key={p.c.key}>
                  <circle
                    cx={p.px}
                    cy={p.py}
                    r={active === p.i ? 6.5 : 5}
                    fill={SERIES.primary}
                    stroke="var(--surface)"
                    strokeWidth={2}
                  />
                  <text
                    x={p.px}
                    y={above ? p.py - 12 : p.py + 20}
                    textAnchor="middle"
                    fontSize={11.5}
                    fontWeight={600}
                    fill="var(--text)"
                    className="tabular-nums"
                  >
                    {p.c.value}
                  </text>
                </g>
              );
            })}
          </svg>
        )}

        {activeColumn && activeColumn.detail && (
          <div
            role="status"
            className="pointer-events-none absolute top-1 z-10 w-max max-w-[240px] rounded-md border border-line bg-canvas px-3 py-2 text-xs shadow-lg"
            style={
              tipLeft > width * 0.6
                ? { right: width - tipLeft + 12 }
                : { left: tipLeft + 12 }
            }
          >
            <p className="text-sm font-semibold text-text tabular-nums">
              {activeColumn.value}
              {activeColumn.unit && (
                <span className="ml-1 text-[12px] font-normal text-text-muted">
                  {activeColumn.unit}
                </span>
              )}
            </p>
            <p className="mt-0.5 text-text-muted">{activeColumn.label}</p>
            <p className="mt-1 text-text-subtle">{activeColumn.detail}</p>
          </div>
        )}
      </div>
    </div>
  );
}
