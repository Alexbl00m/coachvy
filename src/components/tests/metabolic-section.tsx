"use client";

import { useState } from "react";
import {
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  MetabolicChart,
  type SeriesKey,
} from "@/components/calculators/metabolic-chart";
import { Card, CardTitle } from "@/components/ui/card";
import {
  CHART_AXIS_TEXT,
  CHART_GRID,
  CHART_LABEL_TEXT,
  CHART_SURFACE,
  SERIES,
} from "@/lib/calculators/chart-colors";
import {
  paceFromSpeed,
  type MetabolicPoint,
  type MetabolicThresholds,
} from "@/lib/calculators/metabolic";
import type { FuelBand } from "@/lib/calculators/metabolic-zones";
import { cn } from "@/lib/cn";

const sv = (v: number, digits = 0) => v.toFixed(digits).replace(".", ",");

/**
 * Cykeltyperna på VO2max och VLamax, ur metabolic-navigator. Spannen är
 * erfarenhetsmässiga och överlappar – kartan är en orientering, inte en
 * klassning.
 */
const TYPES: {
  label: string;
  vo2: [number, number];
  vla: [number, number];
}[] = [
  { label: "Sprinter", vo2: [40, 55], vla: [0.6, 1.0] },
  { label: "Pursuiter", vo2: [55, 70], vla: [0.5, 0.8] },
  { label: "Allrounder", vo2: [55, 75], vla: [0.35, 0.55] },
  { label: "Klättrare", vo2: [65, 85], vla: [0.25, 0.45] },
  { label: "Tempocyklist", vo2: [70, 90], vla: [0.3, 0.5] },
  { label: "Uthållighet", vo2: [50, 70], vla: [0.15, 0.35] },
];

export type MapPoint = {
  vo2max: number;
  vlamax: number;
  date: string;
  current: boolean;
};

function MapTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: MapPoint }>;
}) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="rounded-md border border-line-strong bg-surface-2 px-3 py-2 text-xs shadow-lg">
      <p className="text-text-muted">{p.date}</p>
      <p className="mt-0.5 font-medium text-text tabular-nums">
        VO2max {sv(p.vo2max, 1)} · VLamax {sv(p.vlamax, 2)}
      </p>
    </div>
  );
}

function MetabolicMap({ points }: { points: MapPoint[] }) {
  if (points.length === 0) return null;
  const current = points.find((p) => p.current) ?? points[points.length - 1];
  const history = points.filter((p) => p !== current);
  const matches = TYPES.filter(
    (t) =>
      current.vo2max >= t.vo2[0] &&
      current.vo2max <= t.vo2[1] &&
      current.vlamax >= t.vla[0] &&
      current.vlamax <= t.vla[1],
  ).map((t) => t.label);

  return (
    <div className="space-y-2">
      <p className="text-sm text-text-muted">
        {matches.length > 0
          ? `Profilen ligger där ${matches.join(" och ").toLowerCase()} brukar ligga.`
          : "Profilen ligger utanför de typiska cykeltyperna."}{" "}
        {history.length > 0 &&
          `Ljusa punkter är tidigare tester – vägen dit visar vart träningen flyttat profilen.`}
      </p>
      <div
        className="h-80 w-full"
        role="img"
        aria-label="VO2max mot VLamax, med cykeltyperna som områden"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke={CHART_GRID} strokeDasharray="2 4" />
            <XAxis
              type="number"
              dataKey="vo2max"
              domain={[40, 90]}
              ticks={[40, 50, 60, 70, 80, 90]}
              tick={{ fill: CHART_AXIS_TEXT, fontSize: 11 }}
              tickLine={false}
              stroke={CHART_GRID}
              label={{
                value: "VO2max (ml/kg/min)",
                position: "insideBottomRight",
                offset: -4,
                fill: CHART_AXIS_TEXT,
                fontSize: 11,
              }}
            />
            <YAxis
              type="number"
              dataKey="vlamax"
              domain={[0.1, 1.0]}
              ticks={[0.2, 0.4, 0.6, 0.8, 1.0]}
              tickFormatter={(v: number) => sv(v, 1)}
              tick={{ fill: CHART_AXIS_TEXT, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            {TYPES.map((t) => (
              <ReferenceArea
                key={t.label}
                x1={t.vo2[0]}
                x2={t.vo2[1]}
                y1={t.vla[0]}
                y2={t.vla[1]}
                fill={CHART_AXIS_TEXT}
                fillOpacity={0.05}
                stroke={CHART_AXIS_TEXT}
                strokeOpacity={0.35}
                strokeDasharray="3 3"
                label={{
                  value: t.label,
                  position: "insideTopLeft",
                  fill: CHART_AXIS_TEXT,
                  fontSize: 10,
                }}
              />
            ))}
            <Tooltip content={<MapTooltip />} cursor={false} />
            {history.length > 0 && (
              <Scatter
                data={[...history, current]}
                line={{ stroke: CHART_AXIS_TEXT, strokeDasharray: "3 3" }}
                fill={CHART_SURFACE}
                stroke={CHART_AXIS_TEXT}
                strokeWidth={1.5}
                isAnimationActive={false}
              />
            )}
            <Scatter
              data={[current]}
              fill={SERIES.primary}
              stroke={CHART_SURFACE}
              strokeWidth={2}
              isAnimationActive={false}
              label={{
                dataKey: "date",
                position: "right",
                fill: CHART_LABEL_TEXT,
                fontSize: 11,
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[12px] text-text-subtle">
        Typerna är erfarenhetsmässiga spann för cyklister och överlappar – en
        orientering, inte en klassning.
      </p>
    </div>
  );
}

const VIEWS: { key: SeriesKey | "karta"; label: string }[] = [
  { key: "lactate", label: "Laktatbalans" },
  { key: "fuel", label: "Bränsle" },
  { key: "karta", label: "Metabol karta" },
];

/**
 * Den metabola profilen i diagram: laktatbalansen (där produktion och
 * förbränning möts ligger tröskeln), bränslet över effektspannet, och var
 * profilen ligger bland cykeltyperna.
 */
export function MetabolicSection({
  points,
  thresholds,
  map,
  mode = "cykling",
  showFacts = true,
  band,
  weightKg = null,
}: {
  points: MetabolicPoint[];
  thresholds: MetabolicThresholds;
  /** Punkter på kartan. Tom, eller löpning, så visas ingen karta. */
  map: MapPoint[];
  /** I löpning är punkternas `power` fart i m/s. */
  mode?: "cykling" | "löpning";
  /** Nyckeltalen överst – kalkylen visar dem redan själv. */
  showFacts?: boolean;
  /** Bandet runt bränslet, VLamax ±0,04. */
  band?: FuelBand[];
  /** Ger syreupptaget i ml/min i laktatdiagrammet. */
  weightKg?: number | null;
}) {
  const [chosen, setView] = useState<SeriesKey | "karta">("lactate");
  const views = VIEWS.filter(
    (v) => v.key !== "karta" || (mode === "cykling" && map.length > 0),
  );
  // Byts grenen medan kartan är vald finns den inte längre – då laktatet.
  const view = views.some((v) => v.key === chosen) ? chosen : "lactate";
  const level = (p: MetabolicPoint) =>
    mode === "cykling"
      ? `${Math.round(p.power)} W`
      : `${paceFromSpeed(p.power)}/km`;
  const { anaerobicThreshold: at, fatMax, carbMax } = thresholds;
  const markers = [
    ...(fatMax ? [{ power: fatMax.power, label: "FatMax" }] : []),
    ...(carbMax ? [{ power: carbMax.power, label: "CarbMax" }] : []),
  ];

  const facts = [
    at && {
      label: "Anaerob tröskel",
      value: level(at),
      hint: `${sv(at.carbsPerHour)} g kolhydrat/h`,
    },
    fatMax && {
      label: "FatMax",
      value: level(fatMax),
      hint: `${sv(fatMax.fatPerHour)} g fett/h`,
    },
    carbMax && {
      label: "CarbMax",
      value: level(carbMax),
      hint: "90 g kolhydrat/h – vad magen tar upp",
    },
  ].filter(Boolean) as { label: string; value: string; hint: string }[];

  return (
    <Card className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <CardTitle>Metabol profil</CardTitle>
        <div
          role="group"
          aria-label="Diagram"
          className="inline-flex rounded-md border border-line-strong p-0.5"
        >
          {views.map((v) => (
            <button
              key={v.key}
              type="button"
              aria-pressed={view === v.key}
              onClick={() => setView(v.key)}
              className={cn(
                "rounded px-3 py-1.5 text-[13px] transition-colors",
                view === v.key
                  ? "bg-surface-2 font-medium text-text"
                  : "text-text-muted hover:text-text",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {showFacts && facts.length > 0 && view !== "karta" && (
        <dl className="mb-4 grid gap-3 sm:grid-cols-3">
          {facts.map((f) => (
            <div
              key={f.label}
              className="rounded-md border border-line bg-surface px-3 py-2"
            >
              <dt className="text-[11px] font-medium uppercase tracking-[0.1em] text-text-muted">
                {f.label}
              </dt>
              <dd className="mt-1 text-lg font-semibold text-text tabular-nums">
                {f.value}
              </dd>
              <dd className="text-[12px] text-text-subtle">{f.hint}</dd>
            </div>
          ))}
        </dl>
      )}

      {view === "karta" ? (
        <MetabolicMap points={map} />
      ) : (
        <>
          <MetabolicChart
            points={points}
            series={view}
            thresholdPower={at ? at.power : null}
            markers={markers}
            mode={mode}
            band={band}
            weightKg={weightKg}
          />
          <p className="mt-3 max-w-3xl text-[12px] leading-relaxed text-text-subtle">
            {view === "lactate"
              ? "Laktatet som bildas mot det som förbränns, ur Mader-modellen med VO2max och VLamax, och syreupptaget. Där laktatkurvorna korsar varandra ligger tröskeln – över den hopar sig laktatet."
              : "Fett och kolhydrat i gram per timme. FatMax är där fettförbränningen toppar, CarbMax där kolhydratåtgången når 90 g/h – ungefär vad magen tar upp under ett lopp. Över den töms förråden fortare än de fylls på."}
          </p>
        </>
      )}
    </Card>
  );
}
