import { ArrowDownRight, ArrowUpRight, Check } from "lucide-react";

import { TargetLevelSelect } from "@/components/benchmarks/target-level-select";
import { PriorityBadge } from "@/components/season/priority-badge";
import { Card, CardTitle } from "@/components/ui/card";
import { SERIES } from "@/lib/calculators/chart-colors";
import type { MetricGap } from "@/lib/benchmarks/gap";
import type { RaceLine } from "@/lib/benchmarks/goals";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/workouts/schema";

const sv = (v: number, digits = 0) =>
  v.toFixed(digits).replace(".", ",").replace("-", "−");

const longDate = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));

/** Hur långt kvar, som stapel mot målet. Över 100 % är över målnivån. */
function GapRow({ gap }: { gap: MetricGap }) {
  const ceiling = 1.3;
  const fill = Math.max(0, Math.min(gap.achieved, ceiling)) / ceiling;
  const ahead = gap.gapPct > -2;
  const Icon = ahead
    ? gap.gapPct >= 0.5
      ? ArrowUpRight
      : Check
    : ArrowDownRight;
  return (
    <li className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-center gap-x-4 gap-y-1 py-2.5 sm:grid-cols-[11rem_minmax(0,1fr)_14rem]">
      <span className="text-sm text-text">{gap.label}</span>
      <span className="relative h-2 rounded-full bg-surface-3" aria-hidden>
        <span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${fill * 100}%`, backgroundColor: SERIES.primary }}
        />
        {/* Målet: 100 %. */}
        <span
          className="absolute -inset-y-1 w-0.5 rounded-full bg-text"
          style={{ left: `calc(${(1 / ceiling) * 100}% - 1px)` }}
        />
      </span>
      <span className="col-span-2 flex items-baseline justify-between gap-3 text-[13px] tabular-nums sm:col-span-1 sm:justify-end">
        <span className="text-text-muted">
          {sv(gap.value, gap.digits)}{" "}
          <span className="text-text-subtle">
            / {sv(gap.target, gap.digits)}{" "}
            {gap.unit === "% av VO2max" ? "%" : gap.unit}
          </span>
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-0.5 font-medium whitespace-nowrap",
            ahead ? "text-good" : "text-bad",
          )}
        >
          <Icon aria-hidden className="size-3.5" />
          {gap.gapPct >= 0 ? "+" : ""}
          {sv(gap.gapPct)} %
        </span>
      </span>
    </li>
  );
}

function RaceGoalRow({ line }: { line: RaceLine }) {
  const { race, goal, weeks } = line;
  const pace =
    goal && race.sport === "löpning"
      ? `${formatDuration(1000 / (goal.metres / goal.targetSeconds))}/km`
      : goal && race.sport === "cykling"
        ? `${sv((goal.metres / goal.targetSeconds) * 3.6, 1)} km/h`
        : null;

  const reading = line.reading;

  return (
    <li className="flex gap-3 py-3">
      <PriorityBadge priority={race.priority} className="mt-0.5" />
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium text-text">
          {race.name}
          <span className="ml-2 font-normal text-text-subtle">
            {longDate(race.race_date)}
            {weeks > 0
              ? ` · ${weeks} ${weeks === 1 ? "vecka" : "veckor"} kvar`
              : ""}
          </span>
        </p>
        <p className="text-[13px] text-text-muted tabular-nums">
          {[race.distance, race.target].filter(Boolean).join(" · ") ||
            "Ingen distans eller målsättning"}
          {goal && (
            <span className="text-text-subtle">
              {" "}
              → {formatDuration(goal.targetSeconds)}
              {pace ? ` · ${pace}` : ""}
            </span>
          )}
        </p>
        {reading && (
          <p className="max-w-3xl text-[13px] leading-relaxed text-text-subtle">
            {reading}
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * Gap-analysen: avståndet till målnivån mått för mått, vad det säger om vad
 * som begränsar, och avståndet till de kommande tävlingsmålen.
 */
export function GapCard({
  adeptId,
  groups,
  targetId,
  gaps,
  reading,
  races,
  canEdit,
}: {
  adeptId: string;
  groups: { id: string; name: string }[];
  targetId: string | null;
  gaps: MetricGap[];
  reading: string[];
  races: RaceLine[];
  canEdit: boolean;
}) {
  const target = groups.find((g) => g.id === targetId) ?? null;
  return (
    <Card className="min-w-0">
      <CardTitle
        action={
          canEdit ? (
            <TargetLevelSelect
              adeptId={adeptId}
              groups={groups}
              value={target?.id ?? null}
            />
          ) : target ? (
            <span className="text-[13px] text-text-muted">
              Målnivå: <span className="text-text">{target.name}</span>
            </span>
          ) : undefined
        }
      >
        Gap mot målet
      </CardTitle>

      {!target ? (
        <p className="text-sm text-text-muted">
          {canEdit
            ? "Välj en målnivå uppe till höger så räknas avståndet mått för mått – VO2max, VLamax, tröskeln, FatMax och de andra."
            : "Din coach har inte satt någon målnivå ännu."}
        </p>
      ) : gaps.length === 0 ? (
        <p className="text-sm text-text-muted">
          Inga testvärden att jämföra mot {target.name} ännu. Ett metabolt
          profiltest med vikt ger de flesta måtten.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-line">
            {gaps.map((gap) => (
              <GapRow key={gap.key} gap={gap} />
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-text-subtle">
            Stapeln är adeptens värde som andel av {target.name}s; strecket är
            målet. För VLamax räknas lägre som närmare målet.
          </p>
          {reading.length > 0 && (
            <ul className="mt-4 max-w-3xl space-y-1.5 border-t border-line pt-4 text-sm leading-relaxed text-text-muted">
              {reading.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </>
      )}

      {races.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <h3 className="text-[13px] font-medium text-text">Tävlingsmål</h3>
          <ul className="divide-y divide-line">
            {races.map((line) => (
              <RaceGoalRow key={line.race.id} line={line} />
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
