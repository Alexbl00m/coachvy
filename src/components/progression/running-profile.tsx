"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DataTable } from "@/components/calculators/result-grid";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import {
  CHART_AXIS_TEXT,
  CHART_GRID,
  CHART_SURFACE,
  SERIES,
} from "@/lib/calculators/chart-colors";
import { CS_RANGE_SECONDS } from "@/lib/calculators/critical-speed";
import { formatDuration, formatPacePerKm } from "@/lib/calculators/time";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { protocolLabel } from "@/lib/tests/progression";
import { racePlan, type Strategy } from "@/lib/tests/race-plan";
import type { SpeedProfile } from "@/lib/tests/speed-profile";
import { parseDuration } from "@/lib/tests/use-protocol-calculator";

const sv = (value: number, digits = 1) =>
  value.toFixed(digits).replace(".", ",");

const clock = formatDuration;
const pace = (metresPerSecond: number) =>
  `${formatPacePerKm(metresPerSecond)}/km`;

/** Tidsaxelns etiketter: minuter upp till en timme, sedan timmar. */
const TICKS = [120, 300, 600, 1200, 2400, 3600, 7200, 14400];
const tickLabel = (t: number) => (t < 3600 ? `${t / 60} min` : `${t / 3600} h`);

type ChartPoint = { t: number; kmh: number; label?: string };

function ProfileTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint; name?: string }>;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-md border border-line bg-canvas px-3 py-2 text-xs shadow-lg">
      {point.label && <p className="text-text-subtle">{point.label}</p>}
      <p className="font-medium text-text tabular-nums">
        {clock(point.t)} · {sv(point.kmh)} km/h · {pace(point.kmh / 3.6)}
      </p>
    </div>
  );
}

const STRATEGIES: { key: Strategy; label: string }[] = [
  { key: "jämn", label: "Jämn" },
  { key: "negativ", label: "Negativ split" },
  { key: "positiv", label: "Positiv split" },
];

/**
 * Löparens fartprofil och en tävlingsplan på den.
 *
 * Överst hur mycket fart atleten tappar med distansen, sedan kurvan med
 * insatserna den bygger på, prognoserna ur tre modeller, och sist en plan
 * för ett valt lopp: splits, och hur mycket av D′ den kostar.
 */
export function RunningProfile({ profile }: { profile: SpeedProfile }) {
  const { exponent, scale, cs } = profile;

  // Egen kurva som fart över tid: T = a·D^b ⇒ D = (T/a)^(1/b).
  const curve = useMemo(() => {
    const points: ChartPoint[] = [];
    for (let i = 0; i <= 60; i += 1) {
      const t = 120 * (14400 / 120) ** (i / 60);
      const d = (t / scale) ** (1 / exponent);
      points.push({ t, kmh: (d / t) * 3.6 });
    }
    return points;
  }, [scale, exponent]);

  const csCurve = useMemo(() => {
    if (!cs) return [];
    const points: ChartPoint[] = [];
    const [from, to] = CS_RANGE_SECONDS;
    for (let i = 0; i <= 30; i += 1) {
      const t = from * (to / from) ** (i / 30);
      points.push({ t, kmh: (cs.speed + cs.dPrime / t) * 3.6 });
    }
    return points;
  }, [cs]);

  const usedIds = new Set(
    profile.used.map((p) => `${p.sessionId}|${p.seconds}`),
  );
  const toPoint = (p: SpeedProfile["all"][number]): ChartPoint => ({
    t: p.seconds,
    kmh: (p.metres / p.seconds) * 3.6,
    label: `${formatDate(p.performedOn)} · ${protocolLabel(p.protocol)} · ${Math.round(p.metres)} m`,
  });
  const usedPoints = profile.all
    .filter((p) => usedIds.has(`${p.sessionId}|${p.seconds}`))
    .map(toPoint);
  const olderPoints = profile.all
    .filter((p) => !usedIds.has(`${p.sessionId}|${p.seconds}`))
    .map(toPoint);

  const speeds = [...curve, ...usedPoints, ...olderPoints, ...csCurve].map(
    (p) => p.kmh,
  );
  const yMin = Math.floor(Math.min(...speeds) - 0.5);
  const yMax = Math.ceil(Math.max(...speeds) + 0.5);

  // --- Tävlingsplanen ------------------------------------------------------
  const distances = profile.predictions;
  const [distanceKey, setDistanceKey] = useState(
    String(
      distances.find((d) => d.metres === 10000)?.metres ??
        distances[0]?.metres ??
        5000,
    ),
  );
  const [customKm, setCustomKm] = useState("");
  const metres =
    distanceKey === "egen"
      ? Number(customKm.replace(",", ".")) * 1000
      : Number(distanceKey);
  const predicted = (m: number) => scale * m ** exponent;
  const [target, setTarget] = useState("");
  const targetSeconds =
    parseDuration(target) ?? (metres > 0 ? predicted(metres) : 0);
  const [strategy, setStrategy] = useState<Strategy>("jämn");
  const [splitPct, setSplitPct] = useState(2);
  const [lapMetres, setLapMetres] = useState(1000);

  const plan =
    metres > 0 && targetSeconds > 0
      ? racePlan({
          metres,
          targetSeconds,
          strategy,
          splitPct,
          lapMetres,
          cs: cs?.speed ?? null,
          dPrime: cs?.dPrime ?? null,
        })
      : null;

  return (
    <div className="space-y-6">
      <Card className="min-w-0">
        <CardTitle>Fartprofil</CardTitle>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-lg border border-line bg-surface p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-text-muted">
              Profil
            </p>
            <p className="mt-1.5 text-xl font-semibold tracking-tight text-text">
              {profile.label ?? "–"}
            </p>
            <p className="mt-0.5 text-[12px] text-text-subtle tabular-nums">
              {profile.individual
                ? `egen exponent ${sv(exponent, 3)}`
                : "Riegel 1,06 (en distans)"}
            </p>
          </div>
          <div className="rounded-lg border border-line bg-surface p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-text-muted">
              Fart-tapp per dubblad distans
            </p>
            <p className="mt-1.5 text-xl font-semibold tracking-tight text-text tabular-nums">
              {sv(profile.lossPerDoubling)} %
            </p>
            <p className="mt-0.5 text-[12px] text-text-subtle">
              de flesta: ca 4 %
            </p>
          </div>
          <div className="rounded-lg border border-line bg-surface p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-text-muted">
              Critical speed
            </p>
            <p className="mt-1.5 text-xl font-semibold tracking-tight text-text tabular-nums">
              {cs ? pace(cs.speed) : "–"}
            </p>
            <p className="mt-0.5 text-[12px] text-text-subtle tabular-nums">
              {cs
                ? `D′ ${Math.round(cs.dPrime)} m · ${sv(cs.speed * 3.6)} km/h`
                : "kräver insatser av klart olika längd på 2–20 min"}
            </p>
          </div>
          <div className="rounded-lg border border-line bg-surface p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-text-muted">
              VDOT
            </p>
            <p className="mt-1.5 text-xl font-semibold tracking-tight text-text tabular-nums">
              {profile.vdot ? sv(profile.vdot.value) : "–"}
            </p>
            <p className="mt-0.5 text-[12px] text-text-subtle">
              {profile.vdot
                ? `${protocolLabel(profile.vdot.point.protocol)}, ${formatDate(profile.vdot.point.performedOn)}`
                : "–"}
            </p>
          </div>
        </div>

        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-text-muted">
          {profile.reading}
        </p>
        {profile.warnings.map((w) => (
          <p key={w} className="mt-2 max-w-3xl text-[13px] text-text-subtle">
            {w}
          </p>
        ))}

        <p className="mt-5 text-[12px] text-text-subtle">
          Fart i km/h mot tid, tidsaxeln logaritmisk – 2 minuter till 4 timmar.
        </p>
        <div
          className="mt-2 h-[320px] w-full"
          role="img"
          aria-label="Fart mot tid: insatserna och den egna kurvan"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={CHART_GRID} strokeDasharray="2 4" />
              <XAxis
                dataKey="t"
                type="number"
                scale="log"
                domain={[110, 15000]}
                ticks={TICKS}
                tickFormatter={tickLabel}
                allowDuplicatedCategory={false}
                stroke={CHART_GRID}
                tick={{ fill: CHART_AXIS_TEXT, fontSize: 11 }}
                tickLine={false}
              />
              <YAxis
                dataKey="kmh"
                type="number"
                domain={[yMin, yMax]}
                allowDecimals={false}
                stroke={CHART_GRID}
                tick={{ fill: CHART_AXIS_TEXT, fontSize: 11 }}
                tickLine={false}
                width={40}
              />
              <Tooltip
                content={<ProfileTooltip />}
                cursor={{ stroke: CHART_AXIS_TEXT, strokeDasharray: "3 3" }}
              />
              <Line
                data={curve}
                dataKey="kmh"
                name="Egen kurva"
                type="monotone"
                stroke={SERIES.primary}
                strokeWidth={2}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
              {csCurve.length > 0 && (
                <Line
                  data={csCurve}
                  dataKey="kmh"
                  name="CS-modellen"
                  type="monotone"
                  stroke={SERIES.secondary}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
              )}
              <Scatter
                data={olderPoints}
                dataKey="kmh"
                name="Äldre och slagna"
                fill={CHART_SURFACE}
                stroke={CHART_AXIS_TEXT}
                strokeWidth={1.5}
                isAnimationActive={false}
              />
              <Scatter
                data={usedPoints}
                dataKey="kmh"
                name="Insatserna kurvan bygger på"
                fill={SERIES.primary}
                stroke={CHART_SURFACE}
                strokeWidth={2}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-text-muted">
          <li className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-0.5 w-5 rounded"
              style={{ backgroundColor: SERIES.primary }}
            />
            Egen kurva
          </li>
          {cs && (
            <li className="flex items-center gap-2">
              <svg aria-hidden width="20" height="4">
                <line
                  x1="0"
                  x2="20"
                  y1="2"
                  y2="2"
                  stroke={SERIES.secondary}
                  strokeWidth="2"
                  strokeDasharray="5 4"
                />
              </svg>
              CS och D′ (2–20 min)
            </li>
          )}
          <li className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2.5 rounded-full"
              style={{ backgroundColor: SERIES.primary }}
            />
            Insatserna kurvan bygger på – bästa per durationsband senaste året
          </li>
          {olderPoints.length > 0 && (
            <li className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-2.5 rounded-full border-[1.5px]"
                style={{ borderColor: "var(--chart-axis-text)" }}
              />
              Äldre eller slagna
            </li>
          )}
        </ul>
      </Card>

      <Card className="min-w-0">
        <CardTitle>Loppprognos</CardTitle>
        <DataTable
          headers={[
            "Distans",
            "Egen kurva",
            "VDOT (Daniels)",
            ...(cs ? ["CS och D′"] : []),
          ]}
          minWidth={560}
          rows={profile.predictions.map((p) => [
            p.label,
            `${clock(p.personal)} · ${pace(p.metres / p.personal)}`,
            p.vdot ? `${clock(p.vdot)} · ${pace(p.metres / p.vdot)}` : "–",
            ...(cs
              ? [p.cs ? `${clock(p.cs)} · ${pace(p.metres / p.cs)}` : "–"]
              : []),
          ])}
        />
        <p className="mt-3 text-[12px] leading-relaxed text-text-subtle">
          Den egna kurvan bygger på hur just den här atleten tappar fart. VDOT
          antar en genomsnittlig löpares kurva, och CS-modellen gäller bara lopp
          på ungefär 2–20 minuter. Där de skiljer sig mycket saknas oftast ett
          test på en distans nära loppet.
        </p>
      </Card>

      <Card className="min-w-0">
        <CardTitle>Tävlingsplan</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1.5 text-[13px] font-medium text-text">
            <span>Lopp</span>
            <Select
              value={distanceKey}
              onChange={(e) => {
                setDistanceKey(e.target.value);
                setTarget("");
              }}
            >
              {distances.map((d) => (
                <option key={d.metres} value={String(d.metres)}>
                  {d.label}
                </option>
              ))}
              <option value="egen">Egen distans</option>
            </Select>
          </label>
          {distanceKey === "egen" && (
            <label className="space-y-1.5 text-[13px] font-medium text-text">
              <span>Distans (km)</span>
              <Input
                inputMode="decimal"
                value={customKm}
                onChange={(e) => {
                  setCustomKm(e.target.value);
                  setTarget("");
                }}
                placeholder="15"
              />
            </label>
          )}
          <label className="space-y-1.5 text-[13px] font-medium text-text">
            <span>Måltid</span>
            <Input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={metres > 0 ? clock(predicted(metres)) : "0:00"}
            />
            <span className="block text-[11px] font-normal text-text-subtle">
              tomt = den egna kurvans prognos
            </span>
          </label>
          <label className="space-y-1.5 text-[13px] font-medium text-text">
            <span>Varv</span>
            <Select
              value={String(lapMetres)}
              onChange={(e) => setLapMetres(Number(e.target.value))}
            >
              <option value="1000">1 km</option>
              <option value="400">400 m (bana)</option>
              <option value="5000">5 km</option>
            </Select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div
            className="inline-flex overflow-hidden rounded-md border border-line-strong"
            role="group"
            aria-label="Strategi"
          >
            {STRATEGIES.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={strategy === s.key}
                onClick={() => setStrategy(s.key)}
                className={cn(
                  "px-3 py-1.5 text-[13px] transition-colors",
                  strategy === s.key
                    ? "bg-surface-2 font-medium text-text"
                    : "text-text-muted hover:text-text",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          {strategy !== "jämn" && (
            <label className="flex items-center gap-2 text-[13px] text-text-muted">
              Skillnad mellan halvorna
              <input
                type="range"
                min={1}
                max={6}
                step={0.5}
                value={splitPct}
                onChange={(e) => setSplitPct(Number(e.target.value))}
                className="accent-[var(--color-accent)]"
              />
              <span className="w-12 tabular-nums text-text">
                {sv(splitPct)} %
              </span>
            </label>
          )}
        </div>

        {plan && (
          <div className="mt-5 space-y-3">
            <p className="text-sm text-text-muted">
              <span className="font-medium text-text tabular-nums">
                {clock(targetSeconds)}
              </span>{" "}
              · {pace(metres / targetSeconds)} i snitt · halvorna{" "}
              <span className="tabular-nums">{clock(plan.halves[0])}</span> +{" "}
              <span className="tabular-nums">{clock(plan.halves[1])}</span>
              {plan.percentOfCs !== null &&
                ` · ${Math.round(plan.percentOfCs)} % av CS`}
            </p>
            <DataTable
              headers={[
                "Sträcka",
                "Varvtid",
                "Tempo",
                "Total",
                ...(cs ? ["D′ kvar"] : []),
              ]}
              minWidth={cs ? 520 : 440}
              rows={plan.laps.map((l) => [
                l.toMetres >= 1000
                  ? `${sv(l.toMetres / 1000, l.toMetres % 1000 === 0 ? 0 : 2)} km`
                  : `${Math.round(l.toMetres)} m`,
                clock(l.seconds),
                pace(l.speed),
                clock(l.cumulative),
                ...(cs
                  ? [
                      l.dPrimeLeft === null
                        ? "–"
                        : `${Math.round(l.dPrimeLeft)} m`,
                    ]
                  : []),
              ])}
            />
            {plan.notes.map((n) => (
              <p
                key={n}
                className="text-[13px] leading-relaxed text-text-muted"
              >
                {n}
              </p>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
