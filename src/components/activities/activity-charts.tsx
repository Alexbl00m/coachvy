"use client";

import { memo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  CHART_AXIS_TEXT,
  CHART_GRID,
  CHART_SURFACE,
  SERIES,
} from "@/lib/calculators/chart-colors";
import { formatClock } from "@/lib/activities/analysis";

export type Row = {
  i: number;
  t: number;
  km: number;
  alt: number | null;
  speed: number | null;
  power: number | null;
  hr: number | null;
  cadence: number | null;
  balance: number | null;
};

export type XMode = "km" | "t";

type Panel = {
  key: "alt" | "speed" | "power" | "hr" | "cadence" | "balance";
  title: string;
  unit: string;
  color: string;
  height: number;
  /** En referenslinje: FTP, tröskelpuls eller W′ = 0. */
  reference?: { value: number; label: string } | null;
};

const sv = (v: number, digits = 0) => v.toFixed(digits).replace(".", ",");

export function panelsFor(
  rows: Row[],
  sport: string,
  ftp: number | null,
  lthr: number | null,
): Panel[] {
  const has = (key: Panel["key"]) =>
    rows.some((r) => r[key] !== null && r[key] !== 0);
  const running = sport === "löpning";
  const all: (Panel | false)[] = [
    has("alt") && {
      key: "alt",
      title: "Höjd",
      unit: "m ö.h.",
      color: CHART_AXIS_TEXT,
      height: 88,
    },
    has("speed") && {
      key: "speed",
      title: running ? "Fart och tempo" : "Fart",
      unit: "km/h",
      color: SERIES.secondary,
      height: 112,
    },
    has("power") && {
      key: "power",
      title: "Effekt",
      unit: "W",
      color: SERIES.primary,
      height: 128,
      reference: ftp ? { value: ftp, label: `FTP ${sv(ftp)}` } : null,
    },
    has("hr") && {
      key: "hr",
      title: "Puls",
      unit: "slag/min",
      color: SERIES.tertiary,
      height: 112,
      reference: lthr ? { value: lthr, label: `Tröskel ${sv(lthr)}` } : null,
    },
    has("cadence") && {
      key: "cadence",
      title: "Kadens",
      unit: running ? "steg/min" : "varv/min",
      color: SERIES.secondary,
      height: 88,
    },
    has("balance") && {
      key: "balance",
      title: running ? "D′bal" : "W′bal",
      unit: "% kvar",
      color: SERIES.primary,
      height: 100,
      reference: { value: 0, label: "Tom" },
    },
  ];
  return all.filter((p): p is Panel => p !== false);
}

/**
 * En graf i raden. Minnad: den ritas bara om när serien, x-axeln eller den
 * valda insatsen byts – inte när pekaren rör sig, det sköter Recharts egen
 * synkning via `syncId`.
 */
const ChartPanel = memo(function ChartPanel({
  rows,
  panel,
  x,
  last,
  highlight,
  onHover,
}: {
  rows: Row[];
  panel: Panel;
  x: XMode;
  last: boolean;
  highlight: [number, number] | null;
  onHover: (index: number | null) => void;
}) {
  const gradientId = `fill-${panel.key}`;
  return (
    <figure className="min-w-0">
      <figcaption className="mb-1 flex items-baseline justify-between gap-3 text-[12px]">
        <span className="font-medium text-text">{panel.title}</span>
        <span className="text-text-subtle">{panel.unit}</span>
      </figcaption>
      <div style={{ height: panel.height + (last ? 22 : 0) }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={rows}
            syncId="aktivitet"
            margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
            onMouseMove={(state) => {
              const i = state?.activeTooltipIndex;
              onHover(typeof i === "number" ? i : i != null ? Number(i) : null);
            }}
            onMouseLeave={() => onHover(null)}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={panel.color} stopOpacity={0.22} />
                <stop
                  offset="100%"
                  stopColor={panel.color}
                  stopOpacity={0.02}
                />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={CHART_GRID} vertical={false} />
            <XAxis
              dataKey={x}
              type="number"
              domain={["dataMin", "dataMax"]}
              hide={!last}
              tickFormatter={(v: number) =>
                x === "km" ? sv(v) : formatClock(v)
              }
              tick={{ fill: CHART_AXIS_TEXT, fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: CHART_GRID }}
              minTickGap={28}
              unit={x === "km" ? " km" : undefined}
            />
            <YAxis
              width={40}
              tick={{ fill: CHART_AXIS_TEXT, fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickCount={3}
              ticks={panel.key === "balance" ? balanceTicks(rows) : undefined}
              domain={
                panel.key === "alt"
                  ? ["dataMin - 10", "dataMax + 10"]
                  : panel.key === "balance"
                    ? [
                        (min: number) => Math.min(0, Math.floor(min / 10) * 10),
                        100,
                      ]
                    : panel.key === "hr" || panel.key === "speed"
                      ? ["auto", "auto"]
                      : [0, "auto"]
              }
              allowDecimals={false}
            />
            {highlight && (
              <ReferenceArea
                x1={rows[highlight[0]]?.[x]}
                x2={rows[highlight[1]]?.[x]}
                fill={CHART_AXIS_TEXT}
                fillOpacity={0.14}
                ifOverflow="hidden"
              />
            )}
            {panel.reference && (
              <ReferenceLine
                y={panel.reference.value}
                stroke={CHART_AXIS_TEXT}
                strokeOpacity={0.7}
                strokeDasharray="4 4"
                label={{
                  value: panel.reference.label,
                  position: "insideTopRight",
                  fill: CHART_AXIS_TEXT,
                  fontSize: 10,
                }}
              />
            )}
            <Tooltip
              // Värdena står i avläsningen ovanför; en ruta i varje graf döljer kurvorna.
              content={() => null}
              cursor={{ stroke: CHART_AXIS_TEXT, strokeWidth: 1 }}
              isAnimationActive={false}
            />
            <Area
              dataKey={panel.key}
              type="linear"
              stroke={panel.color}
              strokeWidth={panel.key === "alt" ? 1.5 : 1.25}
              fill={`url(#${gradientId})`}
              baseValue={panel.key === "balance" ? 0 : "dataMin"}
              connectNulls={false}
              dot={false}
              activeDot={{
                r: 4,
                fill: panel.color,
                stroke: CHART_SURFACE,
                strokeWidth: 2,
              }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
});

/** W′bal i jämna steg, och ned under noll bara när reserven gick dit. */
function balanceTicks(rows: Row[]): number[] {
  const min = Math.min(...rows.map((r) => r.balance ?? 100));
  return min < 0 ? [Math.floor(min / 10) * 10, 0, 50, 100] : [0, 50, 100];
}

/** Graferna under varandra, med samma x-axel och synkad pekare. */
export function ActivityCharts({
  rows,
  panels,
  x,
  highlight,
  onHover,
}: {
  rows: Row[];
  panels: Panel[];
  x: XMode;
  highlight: [number, number] | null;
  onHover: (index: number | null) => void;
}) {
  return (
    <div className="space-y-4">
      {panels.map((panel, n) => (
        <ChartPanel
          key={panel.key}
          rows={rows}
          panel={panel}
          x={x}
          last={n === panels.length - 1}
          highlight={highlight}
          onHover={onHover}
        />
      ))}
    </div>
  );
}
