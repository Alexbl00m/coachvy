"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { startPlan } from "@/lib/plan-library/actions";
import { DAY_LONG, rangeText, intensityText } from "@/lib/plan-library/labels";
import {
  nextWeekStart,
  phaseBounds,
  proposePeriodization,
  type Goal,
} from "@/lib/plan-library/periodization";
import type { Phase, TemplateWeek } from "@/lib/plan-library/types";
import { routes } from "@/lib/routes";

import { useAction } from "./use-action";

type LevelOption = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  hoursMin: number | null;
  hoursMax: number | null;
  sessionsMin: number | null;
  sessionsMax: number | null;
  intensity: unknown;
};

type RaceOption = { id: string; name: string; date: string; priority: string };

const longDate = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));

const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <h2 className="mb-4 flex items-baseline gap-2 text-sm font-semibold text-text">
        <span className="text-text-subtle tabular-nums">{n}</span>
        {title}
      </h2>
      {children}
    </Card>
  );
}

const choiceClass = (selected: boolean) =>
  cn(
    "rounded-md border px-3 py-2 text-left text-sm transition-colors",
    selected
      ? "border-text-subtle bg-surface-3 text-text"
      : "border-line-strong text-text-muted hover:border-text-subtle hover:text-text",
  );

/**
 * Startguiden: mål, längd, faser och nivå. Förslaget räknas om vid varje
 * val med samma funktion som servern använder när planen sparas.
 */
export function StartWizard({
  versionId,
  title,
  minWeeks,
  maxWeeks,
  phases,
  weeks,
  levels,
  races,
  today,
}: {
  versionId: string;
  title: string;
  minWeeks: number;
  maxWeeks: number;
  phases: Phase[];
  weeks: TemplateWeek[];
  levels: LevelOption[];
  races: RaceOption[];
  today: string;
}) {
  const router = useRouter();
  const { pending, error, run } = useAction();
  const [mode, setMode] = useState<"lopp" | "fritt">(
    races.length > 0 ? "lopp" : "fritt",
  );
  const [raceId, setRaceId] = useState<string>(
    races.find((r) => r.priority === "A")?.id ?? races[0]?.id ?? "ny",
  );
  const [newRace, setNewRace] = useState({ name: "", date: "" });
  const [weekStart, setWeekStart] = useState(0);
  const [startDate, setStartDate] = useState(nextWeekStart(today, 0));
  const [length, setLength] = useState(maxWeeks);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [levelId, setLevelId] = useState(
    levels[Math.floor(levels.length / 2)]?.id ?? "",
  );

  const raceDate =
    raceId === "ny"
      ? newRace.date
      : (races.find((r) => r.id === raceId)?.date ?? "");

  const goal: Goal | null =
    mode === "lopp"
      ? raceDate
        ? { mode: "lopp", raceDate, earliest: today, weekStart }
        : null
      : { mode: "fritt", startDate };

  const proposal = useMemo(
    () =>
      goal
        ? proposePeriodization({
            phases,
            weeks,
            minWeeks,
            maxWeeks,
            goal,
            length,
            counts: counts ?? undefined,
          })
        : null,
    // goal är ett nytt objekt varje gång; dess delar räcker som beroenden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      phases,
      weeks,
      minWeeks,
      maxWeeks,
      mode,
      raceDate,
      weekStart,
      startDate,
      length,
      counts,
    ],
  );
  const bounds = phaseBounds(phases, weeks);
  const resetCounts = () => setCounts(null);

  const adjust = (phaseId: string, delta: number) => {
    if (!proposal?.ok) return;
    const current = Object.fromEntries(
      phases.map((p) => [
        p.id,
        proposal.phases.find((s) => s.phaseId === p.id)?.weeks ?? 0,
      ]),
    );
    current[phaseId] += delta;
    setCounts(current);
  };

  const level = levels.find((l) => l.id === levelId);

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!proposal?.ok) return;
        run(
          () =>
            startPlan({
              versionId,
              goal:
                mode === "lopp"
                  ? {
                      mode,
                      raceId: raceId === "ny" ? null : raceId,
                      newRace:
                        raceId === "ny"
                          ? { name: newRace.name || title, date: newRace.date }
                          : null,
                      weekStart,
                    }
                  : { mode, startDate },
              length: proposal.length,
              counts,
              levelId,
            }),
          () => router.push(routes.myPlan),
        );
      }}
    >
      <Step n={1} title="Mot vad?">
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            aria-pressed={mode === "lopp"}
            onClick={() => {
              setMode("lopp");
              resetCounts();
            }}
            className={choiceClass(mode === "lopp")}
          >
            <span className="block font-medium">Mot ett lopp</span>
            <span className="block text-[13px] text-text-subtle">
              Planen räknas bakåt så att loppet hamnar i sista veckan.
            </span>
          </button>
          <button
            type="button"
            aria-pressed={mode === "fritt"}
            onClick={() => {
              setMode("fritt");
              resetCounts();
            }}
            className={choiceClass(mode === "fritt")}
          >
            <span className="block font-medium">Utan lopp</span>
            <span className="block text-[13px] text-text-subtle">
              Välj startdag och längd själv.
            </span>
          </button>
        </div>

        {mode === "lopp" ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Lopp" htmlFor="start-lopp">
              <Select
                id="start-lopp"
                value={raceId}
                onChange={(e) => {
                  setRaceId(e.target.value);
                  resetCounts();
                }}
              >
                {races.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}, {longDate(r.date)} ({r.priority}-lopp)
                  </option>
                ))}
                <option value="ny">Ett nytt lopp …</option>
              </Select>
            </Field>
            <Field
              label="Veckorna börjar på"
              htmlFor="start-veckostart"
              hint="Dag 1 i planen."
            >
              <Select
                id="start-veckostart"
                value={weekStart}
                onChange={(e) => {
                  setWeekStart(Number(e.target.value));
                  resetCounts();
                }}
              >
                {DAY_LONG.map((d, i) => (
                  <option key={d} value={i}>
                    {d[0].toUpperCase() + d.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>
            {raceId === "ny" && (
              <>
                <Field label="Loppets namn" htmlFor="start-nytt-namn">
                  <Input
                    id="start-nytt-namn"
                    value={newRace.name}
                    onChange={(e) =>
                      setNewRace((r) => ({ ...r, name: e.target.value }))
                    }
                    placeholder="Stockholm Marathon"
                  />
                </Field>
                <Field
                  label="Datum"
                  htmlFor="start-nytt-datum"
                  hint="Läggs in som A-lopp i säsongsplanen."
                >
                  <Input
                    id="start-nytt-datum"
                    type="date"
                    min={today}
                    value={newRace.date}
                    onChange={(e) => {
                      setNewRace((r) => ({ ...r, date: e.target.value }));
                      resetCounts();
                    }}
                  />
                </Field>
              </>
            )}
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Första dagen" htmlFor="start-datum">
              <Input
                id="start-datum"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  resetCounts();
                }}
              />
            </Field>
          </div>
        )}
      </Step>

      <Step n={2} title="Hur lång?">
        {minWeeks === maxWeeks ? (
          <p className="text-sm text-text-muted">
            Planen är {maxWeeks} veckor och går inte att korta.
          </p>
        ) : (
          <Field
            label={`Längd: ${proposal?.ok ? proposal.length : length} veckor`}
            htmlFor="start-langd"
            hint={`Planen går att göra ${minWeeks}–${maxWeeks} veckor. Kortare plan: grundfasen blir kortare, den specifika delen och tapern ligger kvar.`}
          >
            <input
              id="start-langd"
              type="range"
              min={minWeeks}
              max={maxWeeks}
              value={length}
              onChange={(e) => {
                setLength(Number(e.target.value));
                resetCounts();
              }}
              className="w-full accent-[var(--accent)]"
            />
          </Field>
        )}
      </Step>

      <Step n={3} title="Faserna">
        {!goal ? (
          <p className="text-sm text-text-muted">Välj lopp och datum först.</p>
        ) : !proposal?.ok ? (
          <p role="alert" className="text-sm text-warn">
            {proposal?.error}
          </p>
        ) : (
          <>
            <p className="text-sm text-text-muted">
              {longDate(proposal.startDate)} – {longDate(proposal.endDate)},{" "}
              {proposal.length} veckor.
            </p>
            <ol className="mt-4 divide-y divide-line rounded-lg border border-line">
              {proposal.phases.map((span) => {
                const b = bounds[span.phaseId];
                const total = proposal.length;
                return (
                  <li
                    key={span.phaseId}
                    className="flex flex-wrap items-center gap-3 px-4 py-3"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-text">
                        {span.name}
                      </span>
                      <span className="block text-[12px] text-text-subtle tabular-nums">
                        Vecka {span.fromWeek}
                        {span.toWeek > span.fromWeek
                          ? `–${span.toWeek}`
                          : ""} · {shortDate(span.startsOn)} –{" "}
                        {shortDate(span.endsOn)}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Kortare ${span.name}`}
                        disabled={span.weeks <= b.min || total <= minWeeks}
                        onClick={() => adjust(span.phaseId, -1)}
                      >
                        <Minus aria-hidden className="size-4" />
                      </Button>
                      <span className="w-16 text-center text-sm tabular-nums">
                        {span.weeks} v
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Längre ${span.name}`}
                        disabled={span.weeks >= b.max || total >= maxWeeks}
                        onClick={() => adjust(span.phaseId, 1)}
                      >
                        <Plus aria-hidden className="size-4" />
                      </Button>
                    </span>
                  </li>
                );
              })}
            </ol>
            {proposal.notes.length > 0 && (
              <ul className="mt-3 space-y-1 text-[13px] text-text-muted">
                {proposal.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
            {counts && (
              <Button
                size="sm"
                variant="ghost"
                className="mt-2"
                onClick={resetCounts}
              >
                Tillbaka till förslaget
              </Button>
            )}
          </>
        )}
      </Step>

      <Step n={4} title="Nivå">
        <div className="grid gap-2 md:grid-cols-3">
          {levels.map((l) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={l.id === levelId}
              onClick={() => setLevelId(l.id)}
              className={choiceClass(l.id === levelId)}
            >
              <span className="block font-medium">
                {l.key} · {l.name}
              </span>
              <span className="block text-[12px] text-text-subtle tabular-nums">
                {[
                  rangeText(l.hoursMin, l.hoursMax, "h/vecka"),
                  rangeText(l.sessionsMin, l.sessionsMax, "pass"),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {l.description && (
                <span className="mt-1 block text-[13px] leading-snug">
                  {l.description}
                </span>
              )}
            </button>
          ))}
        </div>
        {level && intensityText(level.intensity) && (
          <p className="mt-3 text-[12px] text-text-subtle">
            Intensitet på {level.key}: {intensityText(level.intensity)}.
          </p>
        )}
        <p className="mt-3 text-[13px] text-text-muted">
          Du kan byta nivå när som helst under planen.
        </p>
      </Step>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {error && (
          <p role="alert" className="text-sm text-warn">
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={pending || !proposal?.ok || !levelId}
          className="font-semibold"
        >
          Starta {title}
        </Button>
      </div>
    </form>
  );
}
