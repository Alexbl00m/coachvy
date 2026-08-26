"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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
import type { MetabolicPoint } from "@/lib/calculators/metabolic";

type SeriesKey = "lactate" | "fuel";

const CONFIG: Record<
  SeriesKey,
  {
    unit: string;
    lines: { key: keyof MetabolicPoint; name: string; color: string }[];
  }
> = {
  lactate: {
    unit: "mmol/l/min",
    lines: [
      { key: "lactateProduction", name: "Produktion", color: SERIES.primary },
      { key: "lactateCombustion", name: "Förbränning", color: SERIES.secondary },
    ],
  },
  fuel: {
    unit: "g/h",
    lines: [
      { key: "carbsPerHour", name: "Kolhydrat", color: SERIES.primary },
      { key: "fatPerHour", name: "Fett", color: SERIES.secondary },
    ],
  },
};

function ChartTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; payload: MetabolicPoint }>;
  unit: string;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="rounded-md border border-line-strong bg-surface-2 px-3 py-2 shadow-lg">
      <p className="text-[11px] text-text-muted">
        {Math.round(point.power)} W · {point.percentOfMax}%
      </p>
      {payload?.map((entry) => (
        <p key={entry.name} className="mt-1 flex items-center gap-2 text-sm">
          <span
            aria-hidden
            className="size-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-text-muted">{entry.name}</span>
          <span className="ml-auto font-semibold text-text tabular-nums">
            {entry.value.toFixed(1)}
          </span>
        </p>
      ))}
      <p className="mt-1 text-right text-[11px] text-text-subtle">{unit}</p>
    </div>
  );
}

/**
 * Två serier med samma enhet, alltså en y-axel. Där laktatkurvorna korsar
 * varandra ligger tröskeln — hela poängen med diagrammet — så korsningen
 * markeras med en referenslinje.
 */
export function MetabolicChart({
  points,
  series,
  thresholdPower,
}: {
  points: MetabolicPoint[];
  series: SeriesKey;
  thresholdPower: number | null;
}) {
  const config = CONFIG[series];

  // Nära VO2max skenar laktatproduktionen mot tvåsiffriga värden och trycker
  // ihop korsningen — det enda man faktiskt vill läsa av — till en tunn rand
  // längst ned. Y-axeln kapas därför utifrån värdet vid tröskeln, och
  // kurvorna klipps där uppe i stället.
  const atPoint =
    thresholdPower === null
      ? null
      : (points.find((p) => p.power >= thresholdPower) ?? null);

  const headroom = series === "lactate" ? 2.5 : 1.4;
  const anchor = atPoint
    ? series === "lactate"
      ? atPoint.lactateProduction
      : atPoint.carbsPerHour
    : null;

  const yMax = anchor && anchor > 0 ? Number((anchor * headroom).toFixed(2)) : undefined;

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
          <CartesianGrid stroke={CHART_GRID} vertical={false} />
          <XAxis
            dataKey="power"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(v: number) => String(Math.round(v))}
            tick={{ fill: CHART_AXIS_TEXT, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: CHART_GRID }}
            height={28}
            tickMargin={8}
            label={{
              value: "Effekt (W)",
              position: "insideBottomRight",
              offset: -4,
              fill: CHART_AXIS_TEXT,
              fontSize: 11,
            }}
          />
          <YAxis
            domain={yMax ? [0, yMax] : undefined}
            allowDataOverflow
            tick={{ fill: CHART_AXIS_TEXT, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={52}
            label={{
              value: config.unit,
              angle: -90,
              position: "insideLeft",
              fill: CHART_AXIS_TEXT,
              fontSize: 11,
            }}
          />
          <Tooltip
            cursor={{ stroke: CHART_AXIS_TEXT, strokeWidth: 1 }}
            content={<ChartTooltip unit={config.unit} />}
          />
          <Legend
            verticalAlign="top"
            align="right"
            height={28}
            iconType="plainline"
            wrapperStyle={{ fontSize: 12, color: CHART_AXIS_TEXT }}
          />

          {thresholdPower !== null && (
            <ReferenceLine
              x={thresholdPower}
              stroke={CHART_AXIS_TEXT}
              strokeDasharray="4 4"
              label={{
                value: "Tröskel",
                position: "top",
                fill: CHART_AXIS_TEXT,
                fontSize: 11,
              }}
            />
          )}

          {config.lines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.name}
              stroke={line.color}
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 5,
                fill: line.color,
                stroke: CHART_SURFACE,
                strokeWidth: 2,
              }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
