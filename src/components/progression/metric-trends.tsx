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
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import {
  CHART_AXIS_TEXT,
  CHART_GRID,
  CHART_SURFACE,
  SERIES,
} from "@/lib/calculators/chart-colors";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { protocolLabel, type Trend } from "@/lib/tests/progression";

const DAY = 86_400_000;

const digitsFor = (unit: string) =>
  ["W", "m", "%", "ml/kg/min", "slag/min", "J/W"].includes(unit)
    ? 0
    : ["kJ", "km/h", "W/kg", "g/h"].includes(unit)
      ? 1
      : 2;

const sv = (value: number, digits: number) =>
  value.toFixed(digits).replace(".", ",");

type Point = { t: number; value: number; date: string; protocol: string };

function TrendTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ payload: Point }>;
  unit: string;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-md border border-line bg-canvas px-3 py-2 text-xs shadow-lg">
      <p className="text-text-subtle">
        {point.date} · {protocolLabel(point.protocol)}
      </p>
      <p className="mt-0.5 font-medium text-text tabular-nums">
        {sv(point.value, digitsFor(unit))}{" "}
        <span className="font-normal text-text-muted">{unit}</span>
      </p>
    </div>
  );
}

function TrendCard({ trend }: { trend: Trend }) {
  const digits = digitsFor(trend.unit);
  const points: Point[] = trend.points.map((p) => ({
    t: Date.parse(p.performedOn),
    value: p.value,
    date: formatDate(p.performedOn),
    protocol: p.protocol,
  }));
  const first = points[0];
  const last = points[points.length - 1];
  const change =
    points.length > 1 && first.value !== 0
      ? ((last.value - first.value) / first.value) * 100
      : null;

  // Riktningen säger om förändringen är bra. VLamax har ingen – en lägre är
  // rätt för en maratonlöpare och fel för en banåkare – och visas neutralt.
  const tone =
    change === null || Math.abs(change) < 0.05 || trend.higherIsBetter === null
      ? "neutral"
      : change > 0 === trend.higherIsBetter
        ? "good"
        : "bad";
  const Icon =
    change === null || Math.abs(change) < 0.05
      ? Minus
      : change > 0
        ? ArrowUpRight
        : ArrowDownRight;

  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max((hi - lo) * 0.2, Math.abs(hi) * 0.03, 0.01);
  const [x0, x1] =
    points.length > 1
      ? [first.t, last.t]
      : [first.t - DAY * 30, first.t + DAY * 30];

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-text-muted">
            {trend.label}
          </p>
          <p className="mt-1 text-xl font-semibold tracking-tight text-text tabular-nums">
            {sv(last.value, digits)}
            <span className="ml-1 text-sm font-normal text-text-muted">
              {trend.unit}
            </span>
          </p>
        </div>
        {change !== null && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md bg-surface-2 px-2 py-1 text-[12px] font-medium tabular-nums",
              tone === "good"
                ? "text-good"
                : tone === "bad"
                  ? "text-bad"
                  : "text-text-muted",
            )}
            title={`Från ${sv(first.value, digits)} ${trend.unit} ${first.date}`}
          >
            <Icon aria-hidden className="size-3.5" />
            {change > 0 ? "+" : ""}
            {sv(change, 1)} %
          </span>
        )}
      </div>
      <p className="mt-0.5 text-[12px] text-text-subtle">
        {points.length === 1
          ? `ett test · ${last.date}`
          : `${points.length} tester · sedan ${first.date}`}
      </p>

      <div className="mt-3 h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={points}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid stroke={CHART_GRID} vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              domain={[x0, x1]}
              ticks={points.length <= 4 ? points.map((p) => p.t) : undefined}
              tickFormatter={(t: number) =>
                new Date(t).toISOString().slice(2, 7)
              }
              tick={{ fill: CHART_AXIS_TEXT, fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: CHART_GRID }}
              minTickGap={20}
              height={20}
            />
            <YAxis
              domain={[lo - pad, hi + pad]}
              tick={{ fill: CHART_AXIS_TEXT, fontSize: 10 }}
              tickFormatter={(v: number) => sv(v, digits)}
              tickLine={false}
              axisLine={false}
              width={40}
              tickCount={3}
            />
            <Tooltip
              content={<TrendTooltip unit={trend.unit} />}
              cursor={{ stroke: CHART_AXIS_TEXT, strokeWidth: 1 }}
            />
            <Line
              type="linear"
              dataKey="value"
              stroke={SERIES.primary}
              strokeWidth={2}
              dot={{
                r: 3.5,
                fill: SERIES.primary,
                stroke: CHART_SURFACE,
                strokeWidth: 2,
              }}
              activeDot={{
                r: 5,
                fill: SERIES.primary,
                stroke: CHART_SURFACE,
                strokeWidth: 2,
              }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * En liten graf per storhet. Varje storhet får sin egen skala – CP i watt och
 * VO2max i ml/kg/min hör inte hemma på samma axel.
 */
export function MetricTrends({ trends }: { trends: Trend[] }) {
  if (trends.length === 0) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {trends.map((trend) => (
        <TrendCard key={`${trend.key}|${trend.unit}`} trend={trend} />
      ))}
    </div>
  );
}
