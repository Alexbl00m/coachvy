"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import {
  formatClock,
  paceOf,
  type BestEffort,
  type Streams,
} from "@/lib/activities/analysis";
import {
  ActivityCharts,
  panelsFor,
  type Row,
  type XMode,
} from "./activity-charts";
import {
  createHoverStore,
  useHoverIndex,
  type HoverStore,
} from "./hover-store";

// Leaflet rör `window` redan vid import och kan inte renderas på servern.
const ActivityMap = dynamic(
  () => import("./activity-map").then((m) => m.ActivityMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[340px] w-full animate-pulse rounded-lg border border-line bg-surface-2 sm:h-[420px]" />
    ),
  },
);

const sv = (v: number, digits = 0) => v.toFixed(digits).replace(".", ",");

/** Utjämningen i sekunder: effekt som i normaliserad effekt, resten kortare. */
const SMOOTH_S = {
  power: 30,
  speed: 10,
  hr: 10,
  cadence: 10,
  alt: 0,
  balance: 0,
} as const;

/**
 * Glidande medelvärde över serien, centrerat, i sekunder. Ett stopp (null)
 * förblir ett stopp – utjämningen ska inte rita en linje där ingen fanns.
 */
function smooth(values: (number | null)[], points: number): (number | null)[] {
  if (points <= 1) return values;
  const half = Math.floor(points / 2);
  return values.map((v, i) => {
    if (v === null) return null;
    let sum = 0;
    let n = 0;
    for (
      let j = Math.max(0, i - half);
      j <= Math.min(values.length - 1, i + half);
      j++
    ) {
      const x = values[j];
      if (x !== null) {
        sum += x;
        n += 1;
      }
    }
    return n > 0 ? sum / n : null;
  });
}

/** Värdena under pekaren, ovanför graferna. */
function Readout({
  rows,
  hover,
  sport,
}: {
  rows: Row[];
  hover: HoverStore;
  sport: string;
}) {
  const i = useHoverIndex(hover);
  const row = i !== null ? rows[i] : null;
  const items: [string, string][] = row
    ? [
        ["Distans", `${sv(row.km, 2)} km`],
        ["Tid", formatClock(row.t)],
        ...(row.speed !== null
          ? [
              sport === "löpning"
                ? (["Tempo", `${paceOf(row.speed / 3.6)}/km`] as [
                    string,
                    string,
                  ])
                : (["Fart", `${sv(row.speed, 1)} km/h`] as [string, string]),
            ]
          : []),
        ...(row.power !== null
          ? [["Effekt", `${sv(row.power)} W`] as [string, string]]
          : []),
        ...(row.hr !== null ? [["Puls", sv(row.hr)] as [string, string]] : []),
        ...(row.alt !== null
          ? [["Höjd", `${sv(row.alt)} m`] as [string, string]]
          : []),
      ]
    : [];
  return (
    <div
      aria-live="off"
      className="flex min-h-[38px] flex-wrap items-baseline gap-x-5 gap-y-1 text-sm"
    >
      {row ? (
        items.map(([label, value]) => (
          <span key={label} className="whitespace-nowrap">
            <span className="text-[11px] uppercase tracking-[0.08em] text-text-subtle">
              {label}
            </span>{" "}
            <span className="font-medium text-text tabular-nums">{value}</span>
          </span>
        ))
      ) : (
        <span className="text-[13px] text-text-subtle">
          För pekaren över graferna för att följa loppet på kartan.
        </span>
      )}
    </div>
  );
}

/**
 * Karta, grafer och bästa insatser, kopplade till varandra: pekaren i en graf
 * flyttar markören på kartan, och en vald insats markeras i båda.
 */
export function ActivityExplorer({
  streams,
  sport,
  ftp,
  lthr,
  best,
}: {
  streams: Streams;
  sport: string;
  ftp: number | null;
  lthr: number | null;
  best: BestEffort[];
}) {
  const [hover] = useState(createHoverStore);
  const [x, setX] = useState<XMode>(() =>
    streams.km[streams.km.length - 1] > 0.5 ? "km" : "t",
  );
  const [chosen, setChosen] = useState<number | null>(null);
  const [smoothed, setSmoothed] = useState(true);

  const rows = useMemo<Row[]>(() => {
    const n = streams.t.length;
    // Sekunder per punkt i den nedsamplade serien.
    const step = n > 1 ? (streams.t[n - 1] - streams.t[0]) / (n - 1) : 1;
    const by = (key: keyof typeof SMOOTH_S, values: (number | null)[]) =>
      smoothed ? smooth(values, Math.round(SMOOTH_S[key] / step)) : values;
    // Frihjul är kadens noll, inte en kadens. Punkterna är medelvärden, så en
    // punkt med mest rullning hamnar långt under någon verklig trampfrekvens –
    // under 30 varv/min räknas den som rullning.
    const cadence = streams.cadence.map((c) =>
      sport === "cykling" && c !== null && c < 30 ? null : c,
    );
    const speed = by("speed", streams.speed);
    const power = by("power", streams.power);
    const hr = by("hr", streams.hr);
    const cad = by("cadence", cadence);
    return streams.t.map((t, i) => ({
      i,
      t,
      km: streams.km[i],
      alt: streams.alt[i],
      speed: speed[i],
      power: power[i],
      hr: hr[i],
      cadence: cad[i],
      balance:
        streams.balance?.[i] != null
          ? (streams.balance[i] as number) * 100
          : null,
    }));
  }, [streams, smoothed, sport]);
  const panels = useMemo(
    () => panelsFor(rows, sport, ftp, lthr),
    [rows, sport, ftp, lthr],
  );
  const hasRoute = streams.lat.filter((v) => v !== null).length > 1;

  // Insatsen som index i den nedsamplade serien. För löpningens distanser är
  // värdet tiden, för effekt är längden det.
  const highlight = useMemo<[number, number] | null>(() => {
    const effort = chosen !== null ? best[chosen] : null;
    if (!effort) return null;
    const seconds = sport === "löpning" ? effort.value : effort.span;
    const from = streams.t.findIndex((t) => t >= effort.at);
    let to = streams.t.findIndex((t) => t >= effort.at + seconds);
    if (to === -1) to = streams.t.length - 1;
    return from === -1 ? null : [from, Math.max(from + 1, to)];
  }, [chosen, best, sport, streams.t]);

  const onHover = useCallback((i: number | null) => hover.set(i), [hover]);

  return (
    <div className="space-y-5">
      {hasRoute && (
        <ActivityMap streams={streams} hover={hover} highlight={highlight} />
      )}

      {best.length > 0 && (
        <div>
          <p className="mb-2 text-[12px] text-text-subtle">
            Välj en insats för att se var i loppet den gjordes.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {best.map((b, n) => (
              <button
                key={b.label}
                type="button"
                aria-pressed={chosen === n}
                onClick={() => setChosen(chosen === n ? null : n)}
                className={cn(
                  "rounded-md border px-2.5 py-1.5 text-left text-[12px] transition-colors",
                  chosen === n
                    ? "border-text-subtle bg-surface-3 text-text"
                    : "border-line-strong text-text-muted hover:border-accent/60 hover:text-text",
                )}
              >
                <span className="block text-text-subtle">{b.label}</span>
                <span className="font-medium text-text tabular-nums">
                  {sport === "löpning"
                    ? formatClock(b.value)
                    : `${sv(b.value)} W`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-line bg-surface p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <Readout rows={rows} hover={hover} sport={sport} />
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-1.5 rounded-md border border-line-strong px-2.5 py-1 text-[12px] text-text-muted">
              <input
                type="checkbox"
                checked={smoothed}
                onChange={(e) => setSmoothed(e.target.checked)}
                className="accent-[var(--color-accent)]"
              />
              Utjämnat
            </label>
            <div
              role="group"
              aria-label="X-axel"
              className="flex rounded-md border border-line-strong p-0.5 text-[12px]"
            >
              {(
                [
                  ["km", "Distans"],
                  ["t", "Tid"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={x === key}
                  onClick={() => setX(key)}
                  className={cn(
                    "rounded px-2.5 py-1 transition-colors",
                    x === key
                      ? "bg-surface-2 font-medium text-text"
                      : "text-text-muted hover:text-text",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <ActivityCharts
          rows={rows}
          panels={panels}
          x={x}
          highlight={highlight}
          onHover={onHover}
        />
      </div>
    </div>
  );
}
