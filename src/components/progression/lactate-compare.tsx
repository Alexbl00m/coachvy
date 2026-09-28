"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { DataTable } from "@/components/calculators/result-grid";
import {
  CHART_AXIS_TEXT,
  CHART_GRID,
  CHART_SURFACE,
  SERIES,
} from "@/lib/calculators/chart-colors";
import type { IntensityUnit } from "@/lib/calculators/lactate";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import {
  formatPace,
  paceUnit,
  showsPace,
  toMetresPerSecond,
} from "@/lib/tests/pace";
import { compareCurves, type LactateCurve } from "@/lib/tests/progression";

const sv = (value: number, digits: number) =>
  value.toFixed(digits).replace(".", ",");
const DIGITS: Record<IntensityUnit, number> = { W: 0, "km/h": 1, "m/s": 2 };

/**
 * Hur ett test ritas. Följer testet, inte dess plats i urvalet: väljer man bort
 * ett test ska de andra behålla sina färger.
 *
 * Det senaste testet är accenten. De äldre är samma blå i avtagande styrka –
 * en ordnad följd, inte olika kategorier – och allt äldre än det näst senaste
 * streckas, så att två kurvor aldrig skiljs åt bara av färg.
 */
function styleFor(index: number, total: number) {
  const age = total - 1 - index; // 0 = senaste
  if (age === 0)
    return { stroke: SERIES.primary, opacity: 1, dash: undefined, width: 2.5 };
  const opacity = Math.max(1 - (age - 1) * 0.2, 0.4);
  return {
    stroke: SERIES.secondary,
    opacity,
    dash: age === 1 ? undefined : "5 4",
    width: 2,
  };
}

type Row = { intensity: number } & Record<string, number | undefined>;

function ChartTooltip({
  active,
  payload,
  label,
  unit,
  names,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: number;
  unit: IntensityUnit;
  names: Map<string, string>;
}) {
  if (!active || !payload?.length || label === undefined) return null;
  return (
    <div className="rounded-md border border-line bg-canvas px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-text tabular-nums">
        {sv(Number(label), DIGITS[unit])} {unit}
      </p>
      <ul className="mt-1 space-y-0.5">
        {payload
          .filter((p) => p.value !== undefined && p.value !== null)
          .map((p) => (
            <li
              key={p.dataKey}
              className="flex items-center gap-2 text-text-muted tabular-nums"
            >
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              {names.get(p.dataKey)} ·{" "}
              <span className="text-text">{sv(p.value, 2)}</span> mmol/l
            </li>
          ))}
      </ul>
    </div>
  );
}

function Delta({
  value,
  suffix = "%",
}: {
  value: number | null;
  suffix?: string;
}) {
  if (value === null) return <span className="text-text-subtle">–</span>;
  // Jämförs efter avrundning: "−0,0" är ingen förändring och ska inte se ut som en.
  const flat = Number(value.toFixed(1)) === 0;
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-medium tabular-nums",
        flat ? "text-text-muted" : value > 0 ? "text-good" : "text-bad",
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {flat ? "±" : value > 0 ? "+" : ""}
      {sv(flat ? 0 : value, 1)}
      {suffix}
    </span>
  );
}

function Stat({
  label,
  value,
  unit,
  hint,
  children,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-text-muted">
        {label}
      </p>
      <p className="mt-1.5 text-xl font-semibold tracking-tight text-text tabular-nums">
        {value}
        {unit && (
          <span className="ml-1 text-sm font-normal text-text-muted">
            {unit}
          </span>
        )}
      </p>
      {hint && <p className="mt-0.5 text-[12px] text-text-subtle">{hint}</p>}
      {children && <div className="mt-1 text-[12px]">{children}</div>}
    </div>
  );
}

/**
 * Laktatkurvor mot varandra.
 *
 * Coachen väljer vilka tester som ska med – alla, eller några – och ser dem i
 * samma diagram. Det senaste valda testet är utgångspunkten; det näst senaste
 * valda är vad det jämförs med. Kurvan som flyttat åt höger har fått högre
 * tröskel, kurvan som sjunkit ger lägre laktat på samma belastning.
 */
export function LactateCompare({ curves }: { curves: LactateCurve[] }) {
  // Tester i olika grenar eller enheter delar ingen axel.
  const groups = useMemo(() => {
    const map = new Map<string, LactateCurve[]>();
    for (const c of curves) {
      const key = `${c.sport} · ${c.unit}`;
      map.set(key, [...(map.get(key) ?? []), c]);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [curves]);

  const [groupKey, setGroupKey] = useState(groups[0]?.[0] ?? "");
  const group =
    groups.find(([key]) => key === groupKey)?.[1] ?? groups[0]?.[1] ?? [];

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(group.slice(-2).map((c) => c.sessionId)),
  );

  if (group.length === 0) return null;

  const unit = group[0].unit;
  const digits = DIGITS[unit];
  const chosen = group.filter((c) => selected.has(c.sessionId));
  const current = chosen[chosen.length - 1] ?? null;
  const previous = chosen.length >= 2 ? chosen[chosen.length - 2] : null;
  const comparison =
    current && previous ? compareCurves(current, previous) : null;

  const allSelected = chosen.length === group.length;
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  // En rad per belastning, en kolumn per test. Tester som gick igenom samma
  // belastning hamnar på samma rad, och då visar tooltipen dem bredvid varandra.
  const rows: Row[] = [];
  for (const curve of chosen) {
    for (const p of curve.points) {
      let row = rows.find((r) => r.intensity === p.intensity);
      if (!row) {
        row = { intensity: p.intensity } as Row;
        rows.push(row);
      }
      row[curve.sessionId] = p.lactate;
    }
  }
  rows.sort((a, b) => a.intensity - b.intensity);

  const maxLactate = Math.max(
    4.5,
    ...chosen.flatMap((c) => c.points.map((p) => p.lactate)),
  );
  const names = new Map(
    group.map((c) => [c.sessionId, formatDate(c.performedOn)]),
  );
  // Löpning och simning i tempo: trösklarna som tid per km eller per 100 m.
  const sport = group[0].sport;
  const paced = showsPace(sport, unit);
  const fmt = (v: number | null) =>
    v === null
      ? "–"
      : paced
        ? formatPace(toMetresPerSecond(v, unit) as number, sport)
        : sv(v, digits);
  const shownUnit = paced ? paceUnit(sport) : unit;
  const columnUnit = paced ? `min${paceUnit(sport)}` : unit;

  return (
    <div className="space-y-5">
      {groups.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Gren">
          {groups.map(([key, list]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setGroupKey(key);
                setSelected(new Set(list.slice(-2).map((c) => c.sessionId)));
              }}
              className={cn(
                "rounded-md border px-3 py-1.5 text-[13px] transition-colors",
                key === groupKey
                  ? "border-accent bg-accent-soft text-text"
                  : "border-line text-text-muted hover:text-text",
              )}
            >
              {key} ({list.length})
            </button>
          ))}
        </div>
      )}

      {/* Urvalet är också diagrammets förklaring: varje knapp bär testets färg. */}
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Tester att jämföra"
      >
        <button
          type="button"
          onClick={() =>
            setSelected(
              allSelected
                ? new Set(group.slice(-1).map((c) => c.sessionId))
                : new Set(group.map((c) => c.sessionId)),
            )
          }
          className="rounded-md border border-line px-3 py-1.5 text-[13px] font-medium text-text-muted transition-colors hover:text-text"
        >
          {allSelected ? "Bara senaste" : "Alla"}
        </button>
        {group.map((c, index) => {
          const style = styleFor(index, group.length);
          const on = selected.has(c.sessionId);
          return (
            <button
              key={c.sessionId}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(c.sessionId)}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-[13px] tabular-nums transition-colors",
                on
                  ? "border-line-strong bg-surface-2 text-text"
                  : "border-line text-text-subtle hover:text-text",
              )}
            >
              <svg
                aria-hidden
                width="18"
                height="6"
                className={on ? "" : "opacity-40"}
              >
                <line
                  x1="1"
                  x2="17"
                  y1="3"
                  y2="3"
                  stroke={style.stroke}
                  strokeOpacity={style.opacity}
                  strokeWidth={2.5}
                  strokeDasharray={style.dash}
                  strokeLinecap="round"
                />
              </svg>
              {formatDate(c.performedOn)}
            </button>
          );
        })}
      </div>

      {current && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="LT1 · aerob tröskel"
            value={fmt(current.lt1)}
            unit={current.lt1 !== null ? shownUnit : undefined}
            hint={
              current.lt1 === null
                ? "för få steg"
                : [
                    current.hrAtLt1 !== null
                      ? `${Math.round(current.hrAtLt1)} slag/min`
                      : null,
                    current.lt1PctVo2max !== null
                      ? `${Math.round(current.lt1PctVo2max)} % av VO2max`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || undefined
            }
          />
          <Stat
            label="LT2 · anaerob tröskel"
            value={fmt(current.lt2)}
            unit={current.lt2 !== null ? shownUnit : undefined}
            hint={
              current.lt2 === null
                ? "för få steg"
                : [
                    current.hrAtLt2 !== null
                      ? `${Math.round(current.hrAtLt2)} slag/min`
                      : null,
                    current.lt2PctVo2max !== null
                      ? `${Math.round(current.lt2PctVo2max)} % av VO2max`
                      : null,
                    current.lt2Method,
                  ]
                    .filter(Boolean)
                    .join(" · ")
            }
          />
          <Stat
            label="Vid 2 mmol"
            value={fmt(current.at2)}
            unit={current.at2 !== null ? shownUnit : undefined}
          />
          <Stat
            label="Vid 4 mmol (OBLA)"
            value={fmt(current.at4)}
            unit={current.at4 !== null ? shownUnit : undefined}
          />
        </div>
      )}

      <div
        className="h-[340px] w-full"
        role="img"
        aria-label="Laktatkurvor för de valda testerna"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={rows}
            margin={{ top: 28, right: 20, bottom: 8, left: 0 }}
          >
            <CartesianGrid
              stroke={CHART_GRID}
              strokeDasharray="2 4"
              vertical={false}
            />
            <XAxis
              dataKey="intensity"
              type="number"
              domain={["dataMin - 10", "dataMax + 10"]}
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
              allowDecimals={false}
              stroke={CHART_GRID}
              tick={{ fill: CHART_AXIS_TEXT, fontSize: 12 }}
              tickLine={false}
              width={40}
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
              content={<ChartTooltip unit={unit} names={names} />}
              cursor={{ stroke: CHART_AXIS_TEXT, strokeDasharray: "3 3" }}
            />

            <ReferenceLine
              y={2}
              stroke={CHART_AXIS_TEXT}
              strokeOpacity={0.5}
              strokeDasharray="4 4"
              label={{
                value: "2 mmol",
                position: "insideBottomRight",
                fill: CHART_AXIS_TEXT,
                fontSize: 10,
              }}
            />
            <ReferenceLine
              y={4}
              stroke={CHART_AXIS_TEXT}
              strokeOpacity={0.5}
              strokeDasharray="4 4"
              label={{
                value: "4 mmol",
                position: "insideBottomRight",
                fill: CHART_AXIS_TEXT,
                fontSize: 10,
              }}
            />

            {current?.lt1 != null && (
              <ReferenceLine
                x={current.lt1}
                stroke={CHART_AXIS_TEXT}
                label={{
                  value: "LT1",
                  position: "top",
                  fill: CHART_AXIS_TEXT,
                  fontSize: 11,
                }}
              />
            )}
            {current?.lt2 != null && (
              <ReferenceLine
                x={current.lt2}
                stroke={CHART_AXIS_TEXT}
                label={{
                  value: "LT2",
                  position: "top",
                  fill: CHART_AXIS_TEXT,
                  fontSize: 11,
                }}
              />
            )}

            {/* Äldst först, så att den senaste kurvan ritas överst. */}
            {chosen.map((c) => {
              const style = styleFor(group.indexOf(c), group.length);
              return (
                <Line
                  key={c.sessionId}
                  dataKey={c.sessionId}
                  name={formatDate(c.performedOn)}
                  type="linear"
                  connectNulls
                  stroke={style.stroke}
                  strokeOpacity={style.opacity}
                  strokeWidth={style.width}
                  strokeDasharray={style.dash}
                  dot={{
                    r: 4,
                    fill: style.stroke,
                    fillOpacity: style.opacity,
                    stroke: CHART_SURFACE,
                    strokeWidth: 2,
                  }}
                  activeDot={{
                    r: 6,
                    fill: style.stroke,
                    stroke: CHART_SURFACE,
                    strokeWidth: 2,
                  }}
                  isAnimationActive={false}
                />
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {current && previous && comparison && (
        <div>
          <p className="mb-2 text-[13px] text-text-muted">
            Utveckling sedan{" "}
            <span className="font-medium text-text">
              {formatDate(previous.performedOn)}
            </span>
          </p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="LT2"
              value={fmt(current.lt2)}
              unit={current.lt2 !== null ? shownUnit : undefined}
            >
              <Delta value={comparison.lt2Pct} />{" "}
              <span className="text-text-subtle">från {fmt(previous.lt2)}</span>
            </Stat>
            <Stat
              label="LT1"
              value={fmt(current.lt1)}
              unit={current.lt1 !== null ? shownUnit : undefined}
            >
              <Delta value={comparison.lt1Pct} />{" "}
              <span className="text-text-subtle">från {fmt(previous.lt1)}</span>
            </Stat>
            <Stat
              label="Vid 4 mmol"
              value={fmt(current.at4)}
              unit={current.at4 !== null ? shownUnit : undefined}
            >
              <Delta value={comparison.at4Pct} />{" "}
              <span className="text-text-subtle">från {fmt(previous.at4)}</span>
            </Stat>
            {comparison.probe ? (
              <Stat
                label={`Laktat vid ${sv(comparison.probe.intensity, digits)} ${unit}`}
                value={sv(comparison.probe.now, 1)}
                unit="mmol/l"
              >
                {/* Lägre laktat på samma belastning är framsteg – därför vänds tecknet. */}
                <Delta
                  value={-(comparison.probe.now - comparison.probe.then)}
                  suffix=" mmol"
                />{" "}
                <span className="text-text-subtle">
                  från {sv(comparison.probe.then, 1)}
                </span>
              </Stat>
            ) : (
              <Stat
                label="Laktat vid samma belastning"
                value="–"
                hint="testerna delar ingen belastning"
              />
            )}
          </div>
          <p className="mt-2 text-[12px] text-text-subtle">
            Kurvan flyttar sig åt höger (tröskel vid högre belastning) eller
            nedåt (lägre laktat på samma belastning) när formen går framåt.
            Pilen för laktatet pekar uppåt när laktatet sjunkit.
          </p>
        </div>
      )}

      {chosen.length >= 2 && (
        <DataTable
          headers={[
            "Datum",
            `LT1 (${columnUnit})`,
            `LT2 (${columnUnit})`,
            "Puls LT2",
            `2 mmol (${columnUnit})`,
            `4 mmol (${columnUnit})`,
            "Steg",
          ]}
          minWidth={620}
          rows={[...chosen]
            .reverse()
            .map((c) => [
              formatDate(c.performedOn),
              fmt(c.lt1),
              fmt(c.lt2),
              c.hrAtLt2 === null ? "–" : String(Math.round(c.hrAtLt2)),
              fmt(c.at2),
              fmt(c.at4),
              String(c.points.length),
            ])}
        />
      )}
    </div>
  );
}
