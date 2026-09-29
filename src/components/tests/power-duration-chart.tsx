"use client";

import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardTitle } from "@/components/ui/card";
import {
  CHART_AXIS_TEXT,
  CHART_GRID,
  CHART_SURFACE,
  SERIES,
} from "@/lib/calculators/chart-colors";
import { CS_RANGE_SECONDS } from "@/lib/calculators/critical-speed";
import { formatDuration } from "@/lib/calculators/time";

type Point = { t: number; watts: number; effort?: boolean };

const TICKS = [60, 120, 180, 300, 480, 720, 1200];

function PdTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: Point }>;
}) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="rounded-md border border-line-strong bg-surface-2 px-3 py-2 text-xs shadow-lg">
      <p className="text-text-muted">
        {formatDuration(p.t)} {p.effort ? "· testinsats" : "· modellen"}
      </p>
      <p className="mt-0.5 font-medium text-text tabular-nums">
        {Math.round(p.watts)} W
      </p>
    </div>
  );
}

/**
 * Effekt–tid-kurvan ur CP och W′: P = CP + W′/t, med testets insatser som
 * punkter. Kurvan ritas bara där modellen gäller, ungefär 2–20 minuter – den
 * säger inget om en sprint eller om en timme.
 */
export function PowerDurationChart({
  cp,
  wPrime,
  efforts,
}: {
  cp: number;
  /** W′ i joule. */
  wPrime: number;
  efforts: { seconds: number; watts: number }[];
}) {
  const [from, to] = CS_RANGE_SECONDS;
  const curve: Point[] = [];
  for (let i = 0; i <= 40; i += 1) {
    const t = from * (to / from) ** (i / 40);
    curve.push({ t, watts: cp + wPrime / t });
  }
  const dots: Point[] = efforts
    .filter((e) => e.seconds >= 60 && e.seconds <= 1500 && e.watts > 0)
    .map((e) => ({ t: e.seconds, watts: e.watts, effort: true }));
  const all = [...curve, ...dots].map((p) => p.watts);
  const yMin = Math.floor((Math.min(cp, ...all) * 0.9) / 25) * 25;
  const yMax = Math.ceil((Math.max(...all) * 1.05) / 25) * 25;

  return (
    <Card className="min-w-0">
      <CardTitle>Effekt och tid</CardTitle>
      <p className="mb-3 text-sm text-text-muted">
        Vad modellen säger att atleten orkar på varje längd:{" "}
        {Math.round(cp + wPrime / 180)} W i 3 minuter,{" "}
        {Math.round(cp + wPrime / 300)} W i 5, {Math.round(cp + wPrime / 720)} W
        i 12. Kurvan planar ut mot CP, {Math.round(cp)} W.
      </p>
      <div
        className="h-72 w-full"
        role="img"
        aria-label="Effekt mot tid: CP-modellen och testets insatser"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke={CHART_GRID} strokeDasharray="2 4" />
            <XAxis
              dataKey="t"
              type="number"
              scale="log"
              domain={[55, 1500]}
              ticks={TICKS}
              tickFormatter={(t: number) => `${t / 60} min`}
              tick={{ fill: CHART_AXIS_TEXT, fontSize: 11 }}
              tickLine={false}
              stroke={CHART_GRID}
              allowDuplicatedCategory={false}
            />
            <YAxis
              dataKey="watts"
              type="number"
              domain={[yMin, yMax]}
              tick={{ fill: CHART_AXIS_TEXT, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <ReferenceLine
              y={cp}
              stroke={CHART_AXIS_TEXT}
              strokeDasharray="4 4"
              label={{
                value: `CP ${Math.round(cp)} W`,
                position: "insideBottomRight",
                fill: CHART_AXIS_TEXT,
                fontSize: 11,
              }}
            />
            <Tooltip content={<PdTooltip />} cursor={false} />
            <Line
              data={curve}
              dataKey="watts"
              type="monotone"
              stroke={SERIES.primary}
              strokeWidth={2}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            <Scatter
              data={dots}
              dataKey="watts"
              fill={SERIES.primary}
              stroke={CHART_SURFACE}
              strokeWidth={2}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[12px] text-text-subtle">
        Linjen är modellen, punkterna testets insatser. Ligger en punkt klart
        under linjen kördes den insatsen troligen inte maximalt.
      </p>
    </Card>
  );
}
