"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
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

type CurvePoint = { kmh: number; watts: number };

/** Decimaltal med komma, som resten av appen. */
const sv = (value: number, digits: number) =>
  value.toFixed(digits).replace(".", ",");

function CurveTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: CurvePoint }>;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="rounded-md border border-line bg-canvas px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-text tabular-nums">
        {sv(point.kmh, 1)} km/h
      </p>
      <p className="mt-1 text-text-muted tabular-nums">
        {Math.round(point.watts)} W
      </p>
    </div>
  );
}

/**
 * Fart mot effekt. En serie, så ingen förklaringsruta behövs – rubriken säger
 * vad linjen är. FTP-linjen och den aktuella punkten är hänvisningar ovanpå
 * kurvan, inte egna serier.
 */
export function SpeedPowerChart({
  curve,
  currentKmh,
  currentWatts,
  ftp,
}: {
  curve: CurvePoint[];
  currentKmh: number | null;
  currentWatts: number | null;
  ftp: number | null;
}) {
  if (curve.length < 2) return null;

  const maxWatts = Math.max(
    ...curve.map((p) => p.watts),
    currentWatts ?? 0,
    ftp ?? 0,
  );

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={curve}
          margin={{ top: 16, right: 16, bottom: 8, left: 0 }}
        >
          <CartesianGrid stroke={CHART_GRID} strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="kmh"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(v: number) => String(Math.round(v))}
            stroke={CHART_GRID}
            tick={{ fill: CHART_AXIS_TEXT, fontSize: 12 }}
            tickLine={false}
            label={{
              value: "km/h",
              position: "insideBottomRight",
              offset: -4,
              fill: CHART_AXIS_TEXT,
              fontSize: 11,
            }}
          />
          <YAxis
            domain={[0, Math.ceil((maxWatts * 1.05) / 50) * 50]}
            stroke={CHART_GRID}
            tick={{ fill: CHART_AXIS_TEXT, fontSize: 12 }}
            tickLine={false}
            width={52}
            label={{
              value: "W",
              position: "insideTopLeft",
              offset: 8,
              fill: CHART_AXIS_TEXT,
              fontSize: 11,
            }}
          />
          <Tooltip
            content={<CurveTooltip />}
            cursor={{ stroke: CHART_AXIS_TEXT, strokeDasharray: "3 3" }}
          />

          {ftp !== null && ftp > 0 && (
            <ReferenceLine
              y={ftp}
              stroke={CHART_AXIS_TEXT}
              strokeDasharray="4 4"
              label={{
                value: `FTP ${Math.round(ftp)} W`,
                position: "insideTopLeft",
                fill: CHART_AXIS_TEXT,
                fontSize: 11,
              }}
            />
          )}

          <Line
            type="monotone"
            dataKey="watts"
            stroke={SERIES.primary}
            strokeWidth={2}
            dot={false}
            activeDot={{
              r: 5,
              fill: SERIES.primary,
              stroke: CHART_SURFACE,
              strokeWidth: 2,
            }}
            isAnimationActive={false}
          />

          {currentKmh !== null && currentWatts !== null && (
            <ReferenceDot
              x={currentKmh}
              y={currentWatts}
              r={6}
              fill={SERIES.primary}
              stroke={CHART_SURFACE}
              strokeWidth={2}
              label={{
                value: `${sv(currentKmh, 1)} km/h · ${Math.round(currentWatts)} W`,
                position: "top",
                fill: "#e7e7ec",
                fontSize: 11,
              }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

type Share = { label: string; watts: number; color: string };

/**
 * Effektbudgeten som en liggande stapel. Tre delar av en helhet läses snabbast
 * som en enda staplad rad; 2 px mellan segmenten så gränserna syns utan att
 * färgerna behöver bära hela skillnaden.
 */
export function PowerSplitBar({
  rollingWatts,
  gravityWatts,
  airWatts,
}: {
  rollingWatts: number;
  gravityWatts: number;
  airWatts: number;
}) {
  const shares: Share[] = [
    { label: "Luftmotstånd", watts: airWatts, color: SERIES.primary },
    { label: "Rullmotstånd", watts: rollingWatts, color: SERIES.secondary },
    { label: "Stigning", watts: gravityWatts, color: SERIES.tertiary },
  ];

  // Utför eller i medvind kan en term vara negativ. Den bidrar inte till något
  // man behöver trampa för, så stapeln visar bara de positiva delarna och
  // negativa termer redovisas som en egen rad under.
  const positive = shares.filter((s) => s.watts > 0);
  const negative = shares.filter((s) => s.watts < 0);
  const total = positive.reduce((sum, s) => sum + s.watts, 0);

  // Största resten: avrundas varje andel för sig blir summan 101 %, vilket
  // ser ut som ett räknefel. Här fördelas de sista procenten till de delar
  // som förlorade mest på avrundningen.
  const percentages = (() => {
    if (total <= 0) return positive.map(() => 0);
    const exact = positive.map((s) => (s.watts / total) * 100);
    const floors = exact.map(Math.floor);
    let remainder = 100 - floors.reduce((a, b) => a + b, 0);
    const order = exact
      .map((value, index) => ({ index, frac: value - Math.floor(value) }))
      .sort((a, b) => b.frac - a.frac);
    const result = [...floors];
    for (const { index } of order) {
      if (remainder <= 0) break;
      result[index] += 1;
      remainder -= 1;
    }
    return result;
  })();

  if (total <= 0) {
    return (
      <p className="text-sm text-text-muted">
        Vid den här farten behöver du inte trampa – tyngdkraften och vinden gör
        jobbet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full">
        {positive.map((share) => (
          <div
            key={share.label}
            className="first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${(share.watts / total) * 100}%`,
              backgroundColor: share.color,
            }}
          />
        ))}
      </div>

      {/* En rad per del. Kortet är smalt, så kolumner skulle kollidera. */}
      <dl className="space-y-2">
        {positive.map((share, index) => (
          <div key={share.label} className="flex items-baseline gap-2">
            <span
              aria-hidden
              className="size-2.5 shrink-0 translate-y-px rounded-full"
              style={{ backgroundColor: share.color }}
            />
            <dt className="text-[13px] text-text-muted">{share.label}</dt>
            <dd className="ml-auto shrink-0 text-[13px] font-medium text-text tabular-nums">
              {percentages[index]} %
              <span className="ml-2 font-normal text-text-subtle">
                {Math.round(share.watts)} W
              </span>
            </dd>
          </div>
        ))}
      </dl>

      {negative.map((share) => (
        <p key={share.label} className="text-[12px] text-text-subtle">
          {share.label} hjälper i stället till med {Math.round(-share.watts)} W.
        </p>
      ))}
    </div>
  );
}
