"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatValue } from "@/lib/format";

/**
 * One test type at a time, plotted over time.
 *
 * Deliberately a single series: FTP in watt and VO2max in ml/kg/min share no
 * scale, and putting them on one plot would mean a dual-axis chart — the
 * chart mistake that most reliably misleads. The type selector switches which
 * series is shown instead.
 */

// A step of the brand accent lowered into the lightness band that reads
// correctly on the dark chart surface (validated for dark mode + #1f1f24).
const SERIES = "#e07049";
const GRID = "#2f2f37";
const AXIS_TEXT = "#7a7a86";
const SURFACE = "#1f1f24";

export type ChartPoint = {
  t: number;
  value: number;
  label: string;
};

const DAY = 86_400_000;

/**
 * Round tick values covering [lo, hi]. An explicit padded domain otherwise
 * leaves recharts labelling the axis 293,76 / 286,24 / 277,24 — technically
 * correct and unreadable.
 */
function niceTicks(lo: number, hi: number, count = 5): number[] {
  const raw = (hi - lo) / Math.max(count - 1, 1);
  const magnitude = 10 ** Math.floor(Math.log10(raw || 1));
  const normalised = raw / magnitude;
  const step =
    (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10) *
    magnitude;

  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;

  const ticks: number[] = [];
  for (let tick = start; tick <= end + step / 2; tick += step) {
    ticks.push(Number(tick.toFixed(6)));
  }
  return ticks;
}

function TooltipBody({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
  unit: string;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="rounded-md border border-ink-600 bg-ink-800 px-3 py-2 shadow-lg">
      <p className="text-[11px] text-ink-400">{point.label}</p>
      <p className="text-sm font-semibold text-ink-50">
        {formatValue(point.value)}{" "}
        <span className="font-normal text-ink-300">{unit}</span>
      </p>
    </div>
  );
}

export function TestChart({
  points,
  unit,
}: {
  points: ChartPoint[];
  unit: string;
}) {
  // A lone point would collapse the time domain to zero width.
  const [min, max] =
    points.length > 1
      ? [points[0].t, points[points.length - 1].t]
      : [points[0].t - DAY, points[0].t + DAY];

  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  // Breathing room so the line never rides the frame. A line chart does not
  // need a zero baseline, and forcing one here would flatten real progress.
  const pad = Math.max((hi - lo) * 0.15, Math.abs(hi) * 0.02, 1);

  const ticks = niceTicks(lo - pad, hi + pad);

  // With few tests, label the actual test dates. Letting recharts pick ticks
  // across a two-day domain repeats the same date five times.
  const xTicks =
    points.length <= 6 ? points.map((point) => point.t) : undefined;
  const lastIndex = points.length - 1;

  return (
    // Height covers plot + x-axis band so the card never grows a nested scroll.
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={points}
          margin={{ top: 16, right: 48, bottom: 4, left: 4 }}
        >
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            // A linear scale over epoch milliseconds already spaces the points
            // by real elapsed time; recharts 3's scale="time" drops the series.
            domain={[min, max]}
            tickFormatter={(t: number) =>
              new Date(t).toISOString().slice(0, 10)
            }
            tick={{ fill: AXIS_TEXT, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            ticks={xTicks}
            minTickGap={28}
            tickMargin={8}
            height={28}
          />
          <YAxis
            domain={[ticks[0], ticks[ticks.length - 1]]}
            ticks={ticks}
            tick={{ fill: AXIS_TEXT, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v: number) => formatValue(v)}
          />
          <Tooltip
            cursor={{ stroke: AXIS_TEXT, strokeWidth: 1 }}
            content={<TooltipBody unit={unit} />}
          />
          <Line
            type="linear"
            dataKey="value"
            stroke={SERIES}
            strokeWidth={2}
            // A 2px surface-coloured ring keeps markers legible where the line
            // passes behind them.
            dot={{ r: 4, fill: SERIES, stroke: SURFACE, strokeWidth: 2 }}
            activeDot={{ r: 6, fill: SERIES, stroke: SURFACE, strokeWidth: 2 }}
            isAnimationActive={false}
            // Label the endpoint only — a number on every point is noise.
            // recharts types this render prop loosely, hence the narrowing.
            label={(props: unknown) => {
              const { index, x, y, value } = props as {
                index?: number;
                x?: number;
                y?: number;
                value?: number;
              };
              if (index !== lastIndex) return <g key="skip" />;
              return (
                <text
                  key="endpoint"
                  x={Number(x) + 10}
                  y={Number(y) + 4}
                  fill="#e7e7ec"
                  fontSize={12}
                  fontWeight={600}
                >
                  {formatValue(Number(value))}
                </text>
              );
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
