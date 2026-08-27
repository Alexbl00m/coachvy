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

import {
  CHART_AXIS_TEXT,
  CHART_GRID,
  CHART_SURFACE,
  SERIES,
} from "@/lib/calculators/chart-colors";
import type { IntensityUnit, LactateStep } from "@/lib/calculators/lactate";

/** Antal decimaler på axeln, efter enhet – watt behöver inga. */
const AXIS_DIGITS: Record<IntensityUnit, number> = {
  W: 0,
  "km/h": 1,
  "m/s": 2,
};

const sv = (value: number, digits: number) =>
  value.toFixed(digits).replace(".", ",");

type Point = { intensity: number; lactate: number };

function CurveTooltip({
  active,
  payload,
  unit,
  digits,
}: {
  active?: boolean;
  payload?: Array<{ payload: Point & { measured?: number } }>;
  unit: string;
  digits: number;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="rounded-md border border-line bg-canvas px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-text tabular-nums">
        {sv(point.intensity, digits)} {unit}
      </p>
      <p className="mt-1 text-text-muted tabular-nums">
        {sv(point.lactate, 2)} mmol/l
      </p>
    </div>
  );
}

/**
 * Laktatkurvan med de uppmätta stegen.
 *
 * Kurvan och punkterna är samma storhet – modellen och mätningen den bygger på
 * – så de delar färg och behöver ingen förklaringsruta. Trösklarna ritas som
 * hänvisningslinjer ovanpå, med namnet utskrivet.
 *
 * Pulsen visas medvetet inte här. Den skulle kräva en andra y-axel med en helt
 * annan skala, och två axlar i samma diagram gör lutningarna jämförbara på ett
 * sätt som inte betyder något. Pulsen står i tabellen i stället.
 */
export function LactateChart({
  curve,
  steps,
  unit,
  lt1,
  lt2,
}: {
  curve: Point[];
  steps: LactateStep[];
  unit: IntensityUnit;
  lt1: number | null;
  lt2: number | null;
}) {
  if (curve.length < 2) return null;

  const digits = AXIS_DIGITS[unit];

  const maxLactate = Math.max(
    ...curve.map((p) => p.lactate),
    ...steps.map((s) => s.lactate),
  );

  return (
    <div className="h-[360px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart margin={{ top: 34, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke={CHART_GRID} strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="intensity"
            type="number"
            domain={["dataMin", "dataMax"]}
            allowDuplicatedCategory={false}
            tickFormatter={(v: number) => sv(v, digits)}
            stroke={CHART_GRID}
            tick={{ fill: CHART_AXIS_TEXT, fontSize: 12 }}
            tickLine={false}
            label={{
              value: unit,
              position: "insideBottomRight",
              offset: -4,
              fill: CHART_AXIS_TEXT,
              fontSize: 11,
            }}
          />
          <YAxis
            type="number"
            domain={[0, Math.ceil(maxLactate + 0.5)]}
            stroke={CHART_GRID}
            tick={{ fill: CHART_AXIS_TEXT, fontSize: 12 }}
            tickLine={false}
            width={52}
            label={{
              value: "mmol/l",
              position: "insideTopLeft",
              offset: 6,
              dy: -22,
              fill: CHART_AXIS_TEXT,
              fontSize: 11,
            }}
          />
          <Tooltip
            content={<CurveTooltip unit={unit} digits={digits} />}
            cursor={{ stroke: CHART_AXIS_TEXT, strokeDasharray: "3 3" }}
          />

          {lt1 !== null && (
            <ReferenceLine
              x={lt1}
              stroke={CHART_AXIS_TEXT}
              strokeDasharray="4 4"
              label={{
                value: `LT1 ${sv(lt1, digits)}`,
                position: "top",
                fill: CHART_AXIS_TEXT,
                fontSize: 11,
              }}
            />
          )}
          {lt2 !== null && (
            <ReferenceLine
              x={lt2}
              stroke={CHART_AXIS_TEXT}
              strokeDasharray="4 4"
              label={{
                value: `LT2 ${sv(lt2, digits)}`,
                position: "top",
                fill: CHART_AXIS_TEXT,
                fontSize: 11,
              }}
            />
          )}

          <Line
            data={curve}
            type="monotone"
            dataKey="lactate"
            stroke={SERIES.primary}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Scatter
            data={steps}
            dataKey="lactate"
            fill={SERIES.primary}
            stroke={CHART_SURFACE}
            strokeWidth={2}
            shape="circle"
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Var metoderna landar på belastningsaxeln.
 *
 * Spridningen är själva poängen: ett stegtest ger inte ett tröskelvärde utan
 * ett spann, och en coach som ser 70 W mellan LTratio och LTP2 vet att valet
 * av metod betyder mer än testets sista decimal.
 */
export function MethodSpread({
  rows,
  unit,
  lt1,
  lt2,
}: {
  rows: { method: string; intensity: number | null }[];
  unit: IntensityUnit;
  lt1: number | null;
  lt2: number | null;
}) {
  const usable = rows.filter(
    (r): r is { method: string; intensity: number } => r.intensity !== null,
  );
  if (usable.length < 2) return null;

  const digits = AXIS_DIGITS[unit];
  const values = usable.map((r) => r.intensity);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  // Lite luft i kanterna så prickarna för lägsta och högsta metod inte hamnar
  // halvt utanför spåret.
  const position = (value: number) => 4 + ((value - min) / span) * 92;

  const band =
    lt1 !== null && lt2 !== null
      ? { from: position(Math.min(lt1, lt2)), to: position(Math.max(lt1, lt2)) }
      : null;

  return (
    <div className="space-y-3">
      <p className="text-[12px] leading-relaxed text-text-subtle">
        Ett stegtest ger inte ett tröskelvärde utan ett spann. Här ligger de{" "}
        {usable.length} metoderna på {sv(span, digits)} {unit}.
      </p>

      <ol className="space-y-[3px]">
        {usable.map((row) => (
          <li key={row.method} className="group relative flex items-center gap-2">
            <span className="w-[104px] shrink-0 truncate text-[11px] text-text-muted">
              {row.method}
            </span>

            <span className="relative h-[14px] flex-1">
              {band && (
                <span
                  aria-hidden
                  className="absolute inset-y-[3px] rounded-[2px] bg-accent-soft"
                  style={{
                    left: `${band.from}%`,
                    width: `${Math.max(band.to - band.from, 0.5)}%`,
                  }}
                />
              )}
              <span
                aria-hidden
                className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line"
              />
              <span
                aria-hidden
                className="absolute top-1/2 size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface"
                style={{
                  left: `${position(row.intensity)}%`,
                  backgroundColor: SERIES.primary,
                }}
              />
            </span>

            <span className="w-[46px] shrink-0 text-right text-[11px] text-text tabular-nums">
              {sv(row.intensity, digits)}
            </span>
          </li>
        ))}
      </ol>

      <p className="border-t border-line pt-3 text-[12px] leading-relaxed text-text-subtle">
        Det skuggade fältet är spannet mellan LT1 och LT2 – där det mesta av
        träningen styrs.
      </p>
    </div>
  );
}
