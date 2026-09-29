"use client";

import { useState } from "react";

import { DataTable } from "@/components/calculators/result-grid";
import { MetabolicSection } from "@/components/tests/metabolic-section";
import { Card, CardTitle } from "@/components/ui/card";
import type {
  MetabolicPoint,
  MetabolicThresholds,
} from "@/lib/calculators/metabolic";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";

export type MetabolicEntry = {
  sessionId: string;
  performedOn: string;
  protocolLabel: string;
  vo2max: number;
  vlamax: number;
  points: MetabolicPoint[];
  thresholds: MetabolicThresholds;
};

const sv = (v: number, digits = 0) => v.toFixed(digits).replace(".", ",");
const watts = (p: MetabolicPoint | null) =>
  p ? `${Math.round(p.power)} W` : "–";

/** Punkten närmast en effekt. */
const at = (points: MetabolicPoint[], power: number) =>
  points.reduce((best, p) =>
    Math.abs(p.power - power) < Math.abs(best.power - power) ? p : best,
  );

/**
 * Den metabola profilen över tid. Välj ett test för att se dess diagram;
 * kartan visar alla, och tabellen hur tröskel, FatMax och bränsle flyttat
 * sig. Jämförelsen längst ned läser båda kurvorna vid samma effekt – det är
 * där en förbättrad fettförbränning syns, också när FatMax inte flyttat sig.
 */
export function MetabolicProgression({
  entries,
}: {
  entries: MetabolicEntry[];
}) {
  const [selectedId, setSelectedId] = useState(
    entries[entries.length - 1].sessionId,
  );
  const selected =
    entries.find((e) => e.sessionId === selectedId) ??
    entries[entries.length - 1];
  const index = entries.indexOf(selected);
  const previous = index > 0 ? entries[index - 1] : null;

  const map = entries.map((e) => ({
    vo2max: e.vo2max,
    vlamax: e.vlamax,
    date: e.performedOn,
    current: e.sessionId === selected.sessionId,
  }));

  // Samma effekt i båda testerna: det tidigare testets FatMax.
  const probe = previous?.thresholds.fatMax?.power ?? null;
  const now = probe !== null ? at(selected.points, probe) : null;
  const then = probe !== null && previous ? at(previous.points, probe) : null;

  return (
    <div className="space-y-6">
      {entries.length > 1 && (
        <div role="group" aria-label="Test" className="flex flex-wrap gap-2">
          {entries.map((e) => (
            <button
              key={e.sessionId}
              type="button"
              aria-pressed={e.sessionId === selected.sessionId}
              onClick={() => setSelectedId(e.sessionId)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-[13px] tabular-nums transition-colors",
                e.sessionId === selected.sessionId
                  ? "border-accent bg-surface-2 font-medium text-text"
                  : "border-line text-text-muted hover:text-text",
              )}
            >
              {formatDate(e.performedOn)}
            </button>
          ))}
        </div>
      )}

      <MetabolicSection
        points={selected.points}
        thresholds={selected.thresholds}
        map={map}
      />

      {now && then && previous && probe !== null && (
        <Card>
          <CardTitle>Samma effekt, två tester</CardTitle>
          <p className="max-w-3xl text-sm leading-relaxed text-text-muted">
            Vid {Math.round(probe)} W – FatMax{" "}
            {formatDate(previous.performedOn)} – förbränner profilen från{" "}
            {formatDate(selected.performedOn)}{" "}
            <span className="font-medium text-text tabular-nums">
              {sv(now.fatPerHour)} g fett
            </span>{" "}
            och{" "}
            <span className="font-medium text-text tabular-nums">
              {sv(now.carbsPerHour)} g kolhydrat
            </span>{" "}
            per timme, mot {sv(then.fatPerHour)} och {sv(then.carbsPerHour)} g
            förra gången.{" "}
            {now.carbsPerHour < then.carbsPerHour - 2
              ? "Samma arbete kostar mindre kolhydrat – mer räcker till slutet av ett långt lopp."
              : now.carbsPerHour > then.carbsPerHour + 2
                ? "Samma arbete kostar mer kolhydrat än förra gången."
                : "Bränslet vid den effekten är i stort sett oförändrat."}
          </p>
        </Card>
      )}

      <Card className="min-w-0">
        <CardTitle>Profilen över tid</CardTitle>
        <DataTable
          headers={[
            "Datum",
            "Test",
            "VO2max",
            "VLamax",
            "Tröskel",
            "FatMax",
            "Fett vid FatMax",
            "CarbMax",
          ]}
          minWidth={760}
          rows={[...entries].reverse().map((e) => [
            <span
              key="d"
              className={cn(
                e.sessionId === selected.sessionId && "font-medium text-text",
              )}
            >
              {formatDate(e.performedOn)}
            </span>,
            e.protocolLabel,
            `${sv(e.vo2max, 1)} ml/kg/min`,
            `${sv(e.vlamax, 2)} mmol/l/s`,
            watts(e.thresholds.anaerobicThreshold),
            watts(e.thresholds.fatMax),
            e.thresholds.fatMax
              ? `${sv(e.thresholds.fatMax.fatPerHour)} g/h`
              : "–",
            watts(e.thresholds.carbMax),
          ])}
        />
        <p className="mt-3 text-[12px] leading-relaxed text-text-subtle">
          Varje test räknas om ur rådatan med dagens modell, så att profiler
          från olika år går att jämföra.
        </p>
      </Card>
    </div>
  );
}
