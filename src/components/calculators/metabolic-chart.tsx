"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
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
import {
  KCAL_PER_G_CARB,
  KCAL_PER_G_FAT,
  paceFromSpeed,
  type MetabolicPoint,
} from "@/lib/calculators/metabolic";
import type { FuelBand } from "@/lib/calculators/metabolic-zones";

type Mode = "cykling" | "löpning";

export type SeriesKey = "lactate" | "fuel";

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
  mode,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; payload: MetabolicPoint }>;
  unit: string;
  mode: Mode;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="rounded-md border border-line-strong bg-surface-2 px-3 py-2 shadow-lg">
      <p className="text-[11px] text-text-muted">
        {mode === "cykling"
          ? `${Math.round(point.power)} W`
          : `${paceFromSpeed(point.power)}/km · ${(point.power * 3.6).toFixed(1).replace(".", ",")} km/h`}{" "}
        · {String(point.percentOfMax).replace(".", ",")} %
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
            {entry.name === "Syreupptag"
              ? `${Math.round(entry.value)} ml/min`
              : entry.value.toFixed(entry.value < 10 ? 2 : 1).replace(".", ",")}
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
  markers = [],
  band,
  weightKg = null,
  mode = "cykling",
}: {
  points: MetabolicPoint[];
  series: SeriesKey;
  thresholdPower: number | null;
  /** Fler lodräta markeringar, t.ex. FatMax och CarbMax. */
  markers?: { power: number; label: string }[];
  /** Osäkerhetsbandet runt bränslet, samma index som `points`. */
  band?: FuelBand[];
  /** Ger syreupptaget i ml/min på vänster axel i laktatdiagrammet. */
  weightKg?: number | null;
  /** I löpning är punkternas `power` fart i m/s; axeln visar km/h. */
  mode?: Mode;
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

  // Taket avrundas uppåt till ett jämnt steg, så att översta markeringen blir
  // ett läsbart tal och inte 412,02.
  const step = series === "lactate" ? 0.5 : 50;
  const yMax =
    anchor && anchor > 0
      ? Math.ceil((anchor * headroom) / step) * step
      : undefined;

  // I löpning ligger punkterna i m/s men axeln visas i km/h. Utan egna
  // markeringar hamnar de på jämna m/s – 0, 7, 14, 17 km/h. Här blir de
  // jämna km/h i stället.
  const top = points.length > 0 ? points[points.length - 1].power * 3.6 : 0;
  const runningTicks =
    mode === "löpning" && top > 0
      ? Array.from({ length: Math.floor(top / 4) + 1 }, (_, i) => (i * 4) / 3.6)
      : undefined;
  // På cykeln jämna 100 W (50 W för låga effekter) i stället för 4, 154, 304.
  const topWatts = points.length > 0 ? points[points.length - 1].power : 0;
  const wattStep = topWatts > 300 ? 100 : 50;
  const cyclingTicks =
    mode === "cykling" && topWatts > 0
      ? Array.from(
          { length: Math.floor(topWatts / wattStep) + 1 },
          (_, i) => i * wattStep,
        )
      : undefined;

  // Syreupptaget i ml/min på en egen axel, när vikten är känd.
  const withVo2 = series === "lactate" && weightKg !== null && weightKg > 0;
  const data = withVo2
    ? points.map((p) => ({ ...p, vo2Absolute: p.vo2 * (weightKg as number) }))
    : points;

  if (series === "fuel") {
    return (
      <FuelChart
        points={points}
        band={band}
        thresholdPower={thresholdPower}
        markers={markers}
        mode={mode}
        ticks={runningTicks ?? cyclingTicks}
        carbMax={yMax}
      />
    );
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
          <CartesianGrid stroke={CHART_GRID} vertical={false} />
          <XAxis
            dataKey="power"
            type="number"
            domain={mode === "cykling" ? [0, "dataMax"] : ["dataMin", "dataMax"]}
            ticks={runningTicks ?? cyclingTicks}
            tickFormatter={(v: number) =>
              mode === "cykling" ? String(Math.round(v)) : (v * 3.6).toFixed(0)
            }
            tick={{ fill: CHART_AXIS_TEXT, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: CHART_GRID }}
            height={28}
            tickMargin={8}
            label={{
              value: mode === "cykling" ? "Effekt (W)" : "Fart (km/h)",
              position: "insideBottomRight",
              offset: -4,
              fill: CHART_AXIS_TEXT,
              fontSize: 11,
            }}
          />
          {withVo2 && (
            <YAxis
              yAxisId="vo2"
              domain={[0, "auto"]}
              tickFormatter={(v: number) => String(Math.round(v))}
              tick={{ fill: CHART_AXIS_TEXT, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={56}
              label={{
                value: "VO2 ml/min",
                angle: -90,
                position: "insideLeft",
                fill: CHART_AXIS_TEXT,
                fontSize: 11,
              }}
            />
          )}
          <YAxis
            yAxisId="la"
            orientation={withVo2 ? "right" : "left"}
            domain={yMax ? [0, yMax] : undefined}
            allowDataOverflow
            tickFormatter={(v: number) =>
              series === "lactate"
                ? v.toFixed(1).replace(".", ",")
                : String(Math.round(v))
            }
            tick={{ fill: CHART_AXIS_TEXT, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={52}
            label={{
              value: config.unit,
              angle: withVo2 ? 90 : -90,
              position: withVo2 ? "insideRight" : "insideLeft",
              fill: CHART_AXIS_TEXT,
              fontSize: 11,
            }}
          />
          <Tooltip
            cursor={{ stroke: CHART_AXIS_TEXT, strokeWidth: 1 }}
            content={<ChartTooltip unit={config.unit} mode={mode} />}
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
              yAxisId="la"
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

          {markers.map((m) => (
            <ReferenceLine
              key={m.label}
              yAxisId="la"
              x={m.power}
              stroke={CHART_AXIS_TEXT}
              strokeDasharray="2 4"
              strokeOpacity={0.7}
              label={{
                value: m.label,
                position: "insideTopLeft",
                fill: CHART_AXIS_TEXT,
                fontSize: 11,
              }}
            />
          ))}

          {withVo2 && (
            <Line
              yAxisId="vo2"
              type="monotone"
              dataKey="vo2Absolute"
              name="Syreupptag"
              stroke={SERIES.tertiary}
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 5,
                fill: SERIES.tertiary,
                stroke: CHART_SURFACE,
                strokeWidth: 2,
              }}
              isAnimationActive={false}
            />
          )}

          {config.lines.map((line) => (
            <Line
              yAxisId="la"
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

type FuelRow = MetabolicPoint & {
  fatRange?: [number, number];
  carbRange?: [number, number];
};

function FuelTooltip({
  active,
  payload,
  mode,
}: {
  active?: boolean;
  payload?: Array<{ payload: FuelRow }>;
  mode: Mode;
}) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  const row = (
    label: string,
    color: string,
    grams: number,
    kcalPerGram: number,
    range?: [number, number],
  ) => (
    <p className="mt-1 flex items-center gap-2 text-sm">
      <span
        aria-hidden
        className="size-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-text-muted">{label}</span>
      <span className="ml-auto pl-3 font-semibold text-text tabular-nums">
        {grams.toFixed(1).replace(".", ",")} g/h
      </span>
      <span className="text-text-subtle tabular-nums">
        ⇔ {Math.round(grams * kcalPerGram)} kcal/h
      </span>
      {range && (
        <span className="text-[11px] text-text-subtle tabular-nums">
          ({Math.round(range[0])}–{Math.round(range[1])})
        </span>
      )}
    </p>
  );
  return (
    <div className="rounded-md border border-line-strong bg-surface-2 px-3 py-2 shadow-lg">
      <p className="text-[11px] text-text-muted">
        {mode === "cykling"
          ? `${Math.round(p.power)} W`
          : `${paceFromSpeed(p.power)}/km · ${(p.power * 3.6).toFixed(1).replace(".", ",")} km/h`}{" "}
        · {String(p.percentOfMax).replace(".", ",")} %
      </p>
      {row("Fett", SERIES.secondary, p.fatPerHour, KCAL_PER_G_FAT, p.fatRange)}
      {row(
        "Kolhydrat",
        SERIES.primary,
        p.carbsPerHour,
        KCAL_PER_G_CARB,
        p.carbRange,
      )}
    </div>
  );
}

/**
 * Fett och kolhydrat i samma diagram, med var sin y-axel: kolhydraten till
 * vänster, fettet till höger. Fettet ligger på tiotals gram i timmen och
 * kolhydraten på hundratals – med en gemensam axel blir fettet en platt rand.
 *
 * Med två skalor säger linjernas korsning ingenting; den flyttar sig med
 * skalorna. Den verkliga crossover-punkten – där fett och kolhydrat ger lika
 * mycket energi – räknas därför fram och markeras för sig.
 *
 * Banden runt kurvorna är samma modell med VLamax ±0,04, referensmodellens
 * typiska fel.
 */
function FuelChart({
  points,
  band,
  thresholdPower,
  markers,
  mode,
  ticks,
  carbMax,
}: {
  points: MetabolicPoint[];
  band?: FuelBand[];
  thresholdPower: number | null;
  markers: { power: number; label: string }[];
  mode: Mode;
  ticks: number[] | undefined;
  carbMax: number | undefined;
}) {
  const data: FuelRow[] = points.map((p, i) => ({
    ...p,
    ...(band?.[i]
      ? { fatRange: band[i].fat, carbRange: band[i].carbs }
      : {}),
  }));
  const fatTop = Math.max(
    ...data.map((p) => p.fatRange?.[1] ?? p.fatPerHour),
    1,
  );
  const fatMax = Math.ceil((fatTop * 1.15) / 20) * 20;
  const fatTicks = Array.from({ length: fatMax / 20 + 1 }, (_, i) => i * 20);
  const carbTop = carbMax ?? Math.max(...points.map((p) => p.carbsPerHour));
  const carbStep = carbTop > 400 ? 100 : 50;
  const carbCeil = Math.ceil(carbTop / carbStep) * carbStep;
  const carbTicks = Array.from(
    { length: carbCeil / carbStep + 1 },
    (_, i) => i * carbStep,
  );

  // Crossover: första punkten där kolhydraten ger mer energi än fettet.
  const crossover =
    points.find(
      (p) =>
        p.carbsPerHour * KCAL_PER_G_CARB > p.fatPerHour * KCAL_PER_G_FAT &&
        p.fatPerHour > 0,
    ) ?? null;

  const format = (v: number) =>
    mode === "cykling" ? String(Math.round(v)) : (v * 3.6).toFixed(0);
  const lines = [
    ...markers,
    ...(crossover ? [{ power: crossover.power, label: "Crossover" }] : []),
  ];

  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap justify-end gap-x-5 gap-y-1 text-[12px] text-text-muted">
        <li className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-0.5 w-5 rounded"
            style={{ backgroundColor: SERIES.primary }}
          />
          Kolhydrat, g/h (vänster axel)
        </li>
        <li className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-0.5 w-5 rounded"
            style={{ backgroundColor: SERIES.secondary }}
          />
          Fett, g/h (höger axel)
        </li>
        {band && (
          <li className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-2.5 w-5 rounded-sm bg-text-subtle/25"
            />
            VLamax ±0,04
          </li>
        )}
      </ul>
      <div className="h-96 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 4, left: 4 }}
          >
            <CartesianGrid stroke={CHART_GRID} vertical={false} />
            <XAxis
              dataKey="power"
              type="number"
              domain={mode === "cykling" ? [0, "dataMax"] : ["dataMin", "dataMax"]}
              ticks={ticks}
              tickFormatter={format}
              tick={{ fill: CHART_AXIS_TEXT, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: CHART_GRID }}
              height={28}
              tickMargin={8}
              label={{
                value: mode === "cykling" ? "Effekt (W)" : "Fart (km/h)",
                position: "insideBottomRight",
                offset: -4,
                fill: CHART_AXIS_TEXT,
                fontSize: 11,
              }}
            />
            <YAxis
              yAxisId="carbs"
              domain={[0, carbCeil]}
              ticks={carbTicks}
              allowDataOverflow
              tick={{ fill: CHART_AXIS_TEXT, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={48}
              label={{
                value: "Kolhydrat g/h",
                angle: -90,
                position: "insideLeft",
                fill: CHART_AXIS_TEXT,
                fontSize: 11,
              }}
            />
            <YAxis
              yAxisId="fat"
              orientation="right"
              domain={[0, fatMax]}
              ticks={fatTicks}
              allowDataOverflow
              tick={{ fill: CHART_AXIS_TEXT, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={48}
              label={{
                value: "Fett g/h",
                angle: 90,
                position: "insideRight",
                fill: CHART_AXIS_TEXT,
                fontSize: 11,
              }}
            />
            <Tooltip
              cursor={{ stroke: CHART_AXIS_TEXT, strokeWidth: 1 }}
              content={<FuelTooltip mode={mode} />}
            />
            {thresholdPower !== null && (
              <ReferenceLine
                yAxisId="carbs"
                x={thresholdPower}
                stroke={CHART_AXIS_TEXT}
                strokeDasharray="4 4"
                label={{
                  value: "Tröskel",
                  position: "insideTopRight",
                  fill: CHART_AXIS_TEXT,
                  fontSize: 11,
                }}
              />
            )}
            {lines.map((m) => (
              <ReferenceLine
                key={m.label}
                yAxisId="carbs"
                x={m.power}
                stroke={CHART_AXIS_TEXT}
                strokeDasharray="2 4"
                strokeOpacity={0.7}
                label={{
                  value: m.label,
                  position: m.label === "CarbMax" ? "insideBottomLeft" : "insideTopLeft",
                  fill: CHART_AXIS_TEXT,
                  fontSize: 11,
                }}
              />
            ))}
            <ReferenceLine
              yAxisId="carbs"
              y={90}
              stroke={CHART_AXIS_TEXT}
              strokeDasharray="2 4"
              strokeOpacity={0.5}
              label={{
                value: "90 g/h",
                position: "insideTopLeft",
                fill: CHART_AXIS_TEXT,
                fontSize: 10,
              }}
            />
            {band && (
              <>
                <Area
                  yAxisId="carbs"
                  dataKey="carbRange"
                  stroke="none"
                  fill={SERIES.primary}
                  fillOpacity={0.14}
                  isAnimationActive={false}
                  activeDot={false}
                />
                <Area
                  yAxisId="fat"
                  dataKey="fatRange"
                  stroke="none"
                  fill={SERIES.secondary}
                  fillOpacity={0.16}
                  isAnimationActive={false}
                  activeDot={false}
                />
              </>
            )}
            <Line
              yAxisId="carbs"
              type="monotone"
              dataKey="carbsPerHour"
              name="Kolhydrat"
              stroke={SERIES.primary}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: SERIES.primary, stroke: CHART_SURFACE, strokeWidth: 2 }}
              isAnimationActive={false}
            />
            <Line
              yAxisId="fat"
              type="monotone"
              dataKey="fatPerHour"
              name="Fett"
              stroke={SERIES.secondary}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: SERIES.secondary, stroke: CHART_SURFACE, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
