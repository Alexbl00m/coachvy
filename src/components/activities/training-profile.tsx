"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardTitle } from "@/components/ui/card";
import { formatClock, paceOf } from "@/lib/activities/analysis";
import {
  bestCurve,
  bestDistances,
  fitCritical,
  inPeriod,
  KEY_SPANS,
  PERIODS,
  periodRange,
  spanLabel,
  type CurveKind,
  type CurvePoint,
  type ProfileSource,
} from "@/lib/activities/profile";
import {
  pickReference,
  type ReferenceCandidate,
} from "@/lib/activities/reference";
import {
  CHART_AXIS_TEXT,
  CHART_GRID,
  SERIES,
} from "@/lib/calculators/chart-colors";
import { cn } from "@/lib/cn";
import { routes } from "@/lib/routes";

const sv = (v: number, digits = 0) =>
  v.toFixed(digits).replace(".", ",").replace("-", "−");

const longDate = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));

/** Ett värde i kurvans enhet: watt, eller tempo och fart för löpning. */
function show(kind: CurveKind, value: number) {
  return kind === "power" ? `${sv(value)} W` : `${paceOf(value)}/km`;
}

const TICKS = [5, 30, 60, 300, 1200, 3600, 10800];

/** En vald knapp lyfts, som filterbrickor i resten av appen. */
function Choice({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "rounded-md border px-2.5 py-1 text-[13px] transition-colors",
        selected
          ? "border-text-subtle bg-surface-3 text-text"
          : "border-line-strong text-text-muted hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

function Change({ now, before }: { now: number; before: number | null }) {
  if (before === null || before <= 0) {
    return <span className="text-text-subtle">–</span>;
  }
  const pct = ((now - before) / before) * 100;
  if (Math.abs(pct) < 0.5) {
    return <span className="text-text-muted">±0 %</span>;
  }
  const up = pct > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5",
        up ? "text-good" : "text-bad",
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {up ? "+" : ""}
      {sv(pct, 1)} %
    </span>
  );
}

/**
 * Profilen ur träningen: bästa-kurvan för en period, jämförd med perioden
 * före och med testerna, och CP/W′ eller CS/D′ räknade ur den.
 */
export function TrainingProfile({
  adeptId,
  sources,
  candidates,
  today,
}: {
  adeptId: string;
  sources: ProfileSource[];
  candidates: ReferenceCandidate[];
  /** Dagens datum i svensk tid, från servern. */
  today: string;
}) {
  const kinds = (["power", "speed"] as const).filter(
    (k) => inPeriod(sources, k, null, null).length > 0,
  );
  const [kind, setKind] = useState<CurveKind>(() => {
    const counts = kinds.map((k) => inPeriod(sources, k, null, null).length);
    return kinds[counts.indexOf(Math.max(...counts))] ?? "power";
  });
  const [periodKey, setPeriodKey] = useState(() => {
    // Den kortaste perioden med minst tre pass, så att en gammal historik
    // inte öppnar på en tom kurva.
    const first = kinds[0] ?? "power";
    for (const p of PERIODS) {
      const r = periodRange(p.days, today);
      if (inPeriod(sources, first, r.from, r.to).length >= 3 && p.days !== 42)
        return p.key;
    }
    return "allt";
  });

  const period = PERIODS.find((p) => p.key === periodKey) ?? PERIODS[3];
  const range = periodRange(period.days, today);

  const view = useMemo(() => {
    const now = inPeriod(sources, kind, range.from, range.to);
    const before =
      range.prevFrom !== null
        ? inPeriod(sources, kind, range.prevFrom, range.prevTo)
        : [];
    const curve = bestCurve(now, kind);
    const prev = bestCurve(before, kind);
    const fit = fitCritical(curve, kind);
    return {
      now,
      curve,
      prev,
      fit,
      distances: kind === "speed" ? bestDistances(now) : [],
    };
  }, [sources, kind, range.from, range.to, range.prevFrom, range.prevTo]);

  if (kinds.length === 0) return null;

  const sport = kind === "power" ? "cykling" : "löpning";
  const test = pickReference(candidates, today, sport);
  const testCritical = kind === "power" ? test.cp : test.cs;
  const testReserve = kind === "power" ? test.wPrime : test.dPrime;
  const prevBy = new Map(view.prev.map((p) => [p.span, p]));
  const factor = kind === "speed" ? 3.6 : 1;

  const data = view.curve.map((p) => ({
    span: p.span,
    now: p.value * factor,
    prev: (prevBy.get(p.span)?.value ?? NaN) * factor || null,
    model:
      view.fit && p.span >= 120 && p.span <= 3600
        ? (view.fit.critical + view.fit.reserve / p.span) * factor
        : null,
  }));

  const keyPoints = KEY_SPANS[kind]
    .map((span) => view.curve.find((p) => p.span === span))
    .filter((p): p is CurvePoint => p !== undefined);
  const thin = view.curve.filter((p) => p.support < 3 && p.span <= 3600);
  const link = (id: string) => `${routes.adepts}/${adeptId}/aktivitet/${id}`;
  const linkLabel =
    "underline decoration-line-strong underline-offset-2 hover:decoration-text-subtle";

  return (
    <Card>
      <CardTitle
        action={
          <div className="flex flex-wrap justify-end gap-1.5">
            {kinds.length > 1 &&
              kinds.map((k) => (
                <Choice
                  key={k}
                  selected={kind === k}
                  onClick={() => setKind(k)}
                >
                  {k === "power" ? "Cykel" : "Löpning"}
                </Choice>
              ))}
            {kinds.length > 1 && <span className="w-2" aria-hidden />}
            {PERIODS.map((p) => (
              <Choice
                key={p.key}
                selected={periodKey === p.key}
                onClick={() => setPeriodKey(p.key)}
              >
                {p.label}
              </Choice>
            ))}
          </div>
        }
      >
        Profil ur träningen
      </CardTitle>

      {view.now.length === 0 ? (
        <p className="text-sm text-text-muted">
          Inga {kind === "power" ? "cykelpass med effekt" : "löppass"} i
          perioden. Välj en längre period.
        </p>
      ) : (
        <>
          <p className="text-[13px] text-text-subtle">
            Det bästa ur {view.now.length}{" "}
            {view.now.length === 1 ? "pass" : "pass"}
            {range.from
              ? ` mellan ${longDate(range.from)} och ${longDate(range.to)}`
              : " i hela historiken"}
            . En kurva ur träning visar vad adepten minst klarar – den blir
            skarp med lopp, tester och hårda pass i perioden.
          </p>

          <dl className="mt-5 flex flex-wrap gap-px overflow-hidden rounded-lg border border-line bg-line">
            <div className="min-w-[9.5rem] flex-1 bg-surface px-3 py-3">
              <dt className="text-[12px] text-text-muted">
                {kind === "power" ? "CP ur träningen" : "CS ur träningen"}
              </dt>
              <dd className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-text tabular-nums">
                {view.fit
                  ? kind === "power"
                    ? `${sv(view.fit.critical)} W`
                    : `${paceOf(view.fit.critical)}/km`
                  : "–"}
              </dd>
              <dd className="text-[12px] text-text-subtle tabular-nums">
                {view.fit
                  ? kind === "power"
                    ? `W′ ${sv(view.fit.reserve / 1000, 1)} kJ`
                    : `D′ ${sv(view.fit.reserve)} m`
                  : "för få punkter på 3–20 min"}
              </dd>
            </div>
            <div className="min-w-[9.5rem] flex-1 bg-surface px-3 py-3">
              <dt className="text-[12px] text-text-muted">
                {kind === "power" ? "CP i senaste test" : "CS i senaste test"}
              </dt>
              <dd className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-text tabular-nums">
                {testCritical
                  ? kind === "power"
                    ? `${sv(testCritical)} W`
                    : `${paceOf(testCritical)}/km`
                  : "–"}
              </dd>
              <dd className="text-[12px] text-text-subtle tabular-nums">
                {testCritical && view.fit ? (
                  <Change now={view.fit.critical} before={testCritical} />
                ) : test.testedOn ? (
                  longDate(test.testedOn)
                ) : (
                  "inget test"
                )}
                {testCritical && testReserve
                  ? kind === "power"
                    ? ` · W′ ${sv(testReserve / 1000, 1)} kJ`
                    : ` · D′ ${sv(testReserve)} m`
                  : ""}
              </dd>
            </div>
            {keyPoints.map((p) => (
              <div
                key={p.span}
                className="min-w-[9.5rem] flex-1 bg-surface px-3 py-3"
              >
                <dt className="text-[12px] text-text-muted">
                  Bästa {spanLabel(p.span)}
                </dt>
                <dd className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-text tabular-nums">
                  {show(kind, p.value)}
                </dd>
                <dd className="text-[12px] tabular-nums">
                  <Change
                    now={p.value}
                    before={prevBy.get(p.span)?.value ?? null}
                  />
                </dd>
              </div>
            ))}
          </dl>

          {view.fit?.doubtful && (
            <p className="mt-3 rounded-md border border-line-strong bg-surface-2 px-3 py-2 text-[13px] text-text-muted">
              {kind === "power" ? "W′" : "D′"} hamnar utanför det rimliga, så
              3–20 minuter i perioden är troligen inte maximala. Läs{" "}
              {kind === "power" ? "CP" : "CS"} som en undre gräns, eller välj en
              period med lopp eller test.
            </p>
          )}

          <div className="mt-5 h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
              >
                <CartesianGrid stroke={CHART_GRID} vertical={false} />
                <XAxis
                  dataKey="span"
                  type="number"
                  scale="log"
                  domain={[1, 10800]}
                  ticks={TICKS}
                  tickFormatter={spanLabel}
                  allowDataOverflow
                  tick={{ fill: CHART_AXIS_TEXT, fontSize: 11 }}
                  stroke={CHART_GRID}
                />
                <YAxis
                  width={44}
                  domain={["auto", "auto"]}
                  tick={{ fill: CHART_AXIS_TEXT, fontSize: 11 }}
                  stroke={CHART_GRID}
                  tickFormatter={(v: number) => sv(v, kind === "speed" ? 1 : 0)}
                />
                <Tooltip
                  cursor={{ stroke: CHART_AXIS_TEXT, strokeDasharray: "3 3" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0].payload as (typeof data)[number];
                    const point = view.curve.find((p) => p.span === row.span);
                    const before = prevBy.get(row.span);
                    return (
                      <div className="rounded-md border border-line-strong bg-surface-3 px-3 py-2 text-[12px] shadow-none">
                        <p className="font-medium text-text">
                          {spanLabel(row.span)}
                        </p>
                        {point && (
                          <p className="text-text tabular-nums">
                            {show(kind, point.value)}
                            <span className="text-text-subtle">
                              {" "}
                              · {point.date}
                            </span>
                          </p>
                        )}
                        {before && (
                          <p className="text-text-muted tabular-nums">
                            Före: {show(kind, before.value)}
                          </p>
                        )}
                      </div>
                    );
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="model"
                  stroke={SERIES.secondary}
                  strokeWidth={1.25}
                  strokeDasharray="4 4"
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                  name="Modellen"
                />
                <Line
                  type="monotone"
                  dataKey="prev"
                  stroke={CHART_AXIS_TEXT}
                  strokeWidth={1.5}
                  strokeDasharray="2 3"
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                  name="Perioden före"
                />
                <Line
                  type="monotone"
                  dataKey="now"
                  stroke={SERIES.primary}
                  strokeWidth={2.25}
                  dot={{ r: 2.5, fill: SERIES.primary, strokeWidth: 0 }}
                  isAnimationActive={false}
                  name="Perioden"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-text-muted">
            <li className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-0.5 w-4 rounded"
                style={{ background: SERIES.primary }}
              />
              {period.label === "Allt" ? "Hela historiken" : period.label},{" "}
              {kind === "power" ? "W" : "km/h"}
            </li>
            {range.prevFrom && view.prev.length > 0 && (
              <li className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-0 w-4 border-t-2 border-dotted"
                  style={{ borderColor: CHART_AXIS_TEXT }}
                />
                Perioden före
              </li>
            )}
            {view.fit && (
              <li className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-0 w-4 border-t-2 border-dashed"
                  style={{ borderColor: SERIES.secondary }}
                />
                {kind === "power" ? "CP + W′/t" : "CS + D′/t"}
              </li>
            )}
          </ul>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-sm whitespace-nowrap tabular-nums">
              <thead>
                <tr className="border-b border-line text-left text-[12px] text-text-muted">
                  <th className="py-2 pr-3 font-medium">Längd</th>
                  <th className="py-2 pr-3 text-right font-medium">Bästa</th>
                  <th className="py-2 pr-3 font-medium">Pass</th>
                  <th className="py-2 pr-3 text-right font-medium">
                    Perioden före
                  </th>
                  <th className="py-2 pr-3 text-right font-medium">
                    Förändring
                  </th>
                  <th
                    className="py-2 text-right font-medium"
                    title="Pass i perioden som är minst så här långa"
                  >
                    Underlag
                  </th>
                </tr>
              </thead>
              <tbody>
                {view.curve
                  .filter(
                    (p) =>
                      [
                        5, 15, 30, 60, 120, 180, 300, 600, 1200, 1800, 3600,
                        7200,
                      ].includes(p.span) &&
                      (kind === "power" || p.span >= 30),
                  )
                  .map((p) => {
                    const before = prevBy.get(p.span);
                    return (
                      <tr
                        key={p.span}
                        className="border-b border-line last:border-0"
                      >
                        <td className="py-2 pr-3 text-text-muted">
                          {spanLabel(p.span)}
                        </td>
                        <td className="py-2 pr-3 text-right font-medium text-text">
                          {show(kind, p.value)}
                          {kind === "speed" && (
                            <span className="ml-1.5 font-normal text-text-subtle">
                              {sv(p.value * 3.6, 1)} km/h
                            </span>
                          )}
                        </td>
                        <td className="max-w-[16rem] truncate py-2 pr-3 text-text-muted">
                          <Link href={link(p.activityId)} className={linkLabel}>
                            {p.date}
                          </Link>
                        </td>
                        <td className="py-2 pr-3 text-right text-text-muted">
                          {before ? show(kind, before.value) : "–"}
                        </td>
                        <td className="py-2 pr-3 text-right">
                          <Change
                            now={p.value}
                            before={before?.value ?? null}
                          />
                        </td>
                        <td
                          className={cn(
                            "py-2 text-right",
                            p.support < 3 ? "text-warn" : "text-text-subtle",
                          )}
                        >
                          {p.support} pass
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          {thin.length > 0 && (
            <p className="mt-2 text-[12px] text-text-subtle">
              Färre än tre pass bär{" "}
              {thin.length === 1 ? "en längd" : `${thin.length} längder`} – den
              delen av kurvan säger mindre.
            </p>
          )}

          {view.distances.length > 0 && (
            <div className="mt-6">
              <h3 className="text-[13px] font-medium text-text-muted">
                Snabbaste på distans
              </h3>
              <ul className="mt-2 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
                {view.distances.map((d) => (
                  <li key={d.span} className="bg-surface px-3 py-2.5">
                    <p className="text-[12px] text-text-muted">{d.label}</p>
                    <p className="text-[16px] font-semibold text-text tabular-nums">
                      {formatClock(d.seconds)}
                      <span className="ml-1.5 text-[12px] font-normal text-text-subtle">
                        {paceOf(d.span / d.seconds)}/km
                      </span>
                    </p>
                    <Link
                      href={link(d.activityId)}
                      className={cn("text-[12px] text-text-subtle", linkLabel)}
                    >
                      {d.date}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
