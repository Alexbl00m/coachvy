"use client";

import { useState } from "react";
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
  weekStartOn,
  type Goal,
} from "@/lib/plan-library/periodization";
import {
  MAX_ROUNDS,
  proposeRounds,
  roundOptions,
} from "@/lib/plan-library/rounds";
import type { Phase, TemplateWeek, VolumeUnit } from "@/lib/plan-library/types";
import { volumeText } from "@/lib/plan-library/volume";
import { routes } from "@/lib/routes";
import { daysBetween } from "@/lib/season/season";

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
  /** Den största veckovolymen på nivån. */
  volumePeak: number | null;
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

const weeksText = (n: number) => `${n} ${n === 1 ? "vecka" : "veckor"}`;

/**
 * Startguiden: mål, upplägg, faser och nivå. Förslaget räknas om vid varje
 * val med samma funktion som servern använder när planen sparas.
 *
 * Är det längre till loppet än planen kan vara föreslås varv – 2 × 12
 * veckor i stället för 18 veckor som börjar om ett halvår – och nivån kan
 * väljas för varje varv.
 */
export function StartWizard({
  versionId,
  title,
  minWeeks,
  maxWeeks,
  phases,
  weeks,
  levels,
  volumeUnit,
  usesPaces,
  race,
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
  volumeUnit: VolumeUnit;
  /** Planen räknar tempon: då väljs vad de räknas ur. */
  usesPaces: boolean;
  /** Loppet planen leder fram till, för måltiden. */
  race: { name: string; example: string };
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
  /** Antal varv medlemmen valt. Null: förslaget. */
  const [roundsWanted, setRoundsWanted] = useState<number | null>(null);
  /** Medlemmens egna veckor per fas, per varv. */
  const [counts, setCounts] = useState<Record<
    number,
    Record<string, number>
  > | null>(null);
  const [levelIds, setLevelIds] = useState<string[]>(() => {
    const middle = levels[Math.floor(levels.length / 2)]?.id ?? "";
    return Array.from({ length: MAX_ROUNDS }, () => middle);
  });
  const levelId = levelIds[0];
  const [paceMode, setPaceMode] = useState<"form" | "mål">("form");
  const [goalTime, setGoalTime] = useState("");

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

  // Veckorna som ryms före loppet, och uppläggen de ger.
  const available =
    mode === "lopp" && raceDate && raceDate >= today
      ? Math.floor(
          daysBetween(
            nextWeekStart(today, weekStart),
            weekStartOn(raceDate, weekStart),
          ) / 7,
        ) + 1
      : null;
  const options =
    available !== null ? roundOptions(available, minWeeks, maxWeeks) : [];
  const option =
    available === null
      ? null
      : (options.find((o) => o.rounds.length === roundsWanted) ??
        proposeRounds(available, minWeeks, maxWeeks));
  const roundCount =
    mode === "lopp" ? (option?.rounds.length ?? 1) : (roundsWanted ?? 1);
  const rounds =
    mode === "lopp"
      ? (option?.rounds ?? [])
      : Array.from({ length: roundCount }, () => length);
  const multi = roundCount > 1;

  const proposal = goal
    ? proposePeriodization({
        phases,
        weeks,
        minWeeks,
        maxWeeks,
        goal,
        length,
        counts: !multi ? counts?.[0] : undefined,
        rounds: multi ? rounds : undefined,
        roundCounts: multi
          ? rounds.map((_, i) => counts?.[i] ?? null)
          : undefined,
      })
    : null;
  const bounds = phaseBounds(phases, weeks);
  const resetCounts = () => setCounts(null);

  const adjust = (round: number, phaseId: string, delta: number) => {
    if (!proposal?.ok) return;
    const current = { ...proposal.rounds[round].counts };
    current[phaseId] += delta;
    setCounts((c) => ({ ...c, [round]: current }));
  };

  const setLevel = (round: number, id: string) =>
    setLevelIds((ids) =>
      ids.map((old, i) =>
        // Ett byte i ett tidigare varv följer med till de senare som hade samma nivå.
        i === round || (i > round && old === ids[round]) ? id : old,
      ),
    );

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
              counts: !multi ? (counts?.[0] ?? null) : null,
              levelId,
              rounds: multi ? proposal.rounds.map((r) => r.weeks) : null,
              roundCounts: multi ? proposal.rounds.map((r) => r.counts) : null,
              roundLevels: multi ? levelIds.slice(0, roundCount) : null,
              paceMode: usesPaces ? paceMode : "form",
              goalTime: usesPaces && paceMode === "mål" ? goalTime : undefined,
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

      <Step n={2} title={mode === "lopp" ? "Upplägg" : "Hur lång?"}>
        {mode === "lopp" && options.length > 1 && (
          <div className="mb-4 grid gap-2 sm:grid-cols-2">
            {options.map((o) => {
              const selected = o.rounds.length === roundCount;
              return (
                <button
                  key={o.rounds.length}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setRoundsWanted(o.rounds.length);
                    resetCounts();
                  }}
                  className={choiceClass(selected)}
                >
                  <span className="block font-medium">
                    {o.rounds.length === 1
                      ? `Ett varv, ${weeksText(o.rounds[0])}`
                      : `${o.rounds.length} varv, ${o.rounds.join(" + ")} veckor`}
                  </span>
                  <span className="block text-[13px] text-text-subtle">
                    {o.leadIn === 0
                      ? "Börjar nästa vecka."
                      : `Börjar om ${weeksText(o.leadIn)} – lugn grundträning fram till dess.`}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {mode === "lopp" && options.length > 1 && (
          <p className="mb-4 text-[13px] text-text-muted">
            Ju längre tid du ger dig, desto bättre. I varv går du igenom planen
            flera gånger, med ett testlopp i slutet av varje varv före det sista
            – och kan ta nästa varv på en högre nivå.
          </p>
        )}
        {mode === "fritt" && (
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="Varv"
              htmlFor="start-varv"
              hint="Planen gås igenom så många gånger, varv efter varv."
            >
              <Select
                id="start-varv"
                value={roundCount}
                onChange={(e) => {
                  setRoundsWanted(Number(e.target.value));
                  resetCounts();
                }}
              >
                {Array.from({ length: MAX_ROUNDS }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {i === 0 ? "Ett varv" : `${i + 1} varv`}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
        {mode === "lopp" && multi ? null : minWeeks === maxWeeks ? (
          <p className="text-sm text-text-muted">
            Planen är {maxWeeks} veckor och går inte att korta.
          </p>
        ) : (
          <Field
            label={`${multi ? "Varje varv" : "Längd"}: ${
              proposal?.ok && !multi ? proposal.length : length
            } veckor`}
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
            {proposal.rounds.map((round, ri) => (
              <div key={round.round} className="mt-4">
                {multi && (
                  <p className="mb-2 text-[13px] font-medium text-text">
                    Varv {round.round}{" "}
                    <span className="font-normal text-text-subtle tabular-nums">
                      · {weeksText(round.weeks)} · {shortDate(round.startsOn)} –{" "}
                      {shortDate(round.endsOn)}
                      {ri < proposal.rounds.length - 1
                        ? " · slutar med testlopp"
                        : ""}
                    </span>
                  </p>
                )}
                <ol className="divide-y divide-line rounded-lg border border-line">
                  {round.phases.map((span) => {
                    const b = bounds[span.phaseId];
                    const full =
                      available !== null && proposal.length >= available;
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
                              : ""}{" "}
                            · {shortDate(span.startsOn)} –{" "}
                            {shortDate(span.endsOn)}
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Kortare ${span.name}${multi ? `, varv ${round.round}` : ""}`}
                            disabled={
                              span.weeks <= b.min || round.weeks <= minWeeks
                            }
                            onClick={() => adjust(ri, span.phaseId, -1)}
                          >
                            <Minus aria-hidden className="size-4" />
                          </Button>
                          <span className="w-16 text-center text-sm tabular-nums">
                            {span.weeks} v
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Längre ${span.name}${multi ? `, varv ${round.round}` : ""}`}
                            disabled={
                              span.weeks >= b.max ||
                              round.weeks >= maxWeeks ||
                              full
                            }
                            onClick={() => adjust(ri, span.phaseId, 1)}
                          >
                            <Plus aria-hidden className="size-4" />
                          </Button>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
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

      <Step n={4} title={multi ? "Nivå i första varvet" : "Nivå"}>
        <div className="grid gap-2 md:grid-cols-3">
          {levels.map((l) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={l.id === levelId}
              onClick={() => setLevel(0, l.id)}
              className={choiceClass(l.id === levelId)}
            >
              <span className="block font-medium">
                {l.key} · {l.name}
              </span>
              <span className="block text-[12px] text-text-subtle tabular-nums">
                {[
                  l.volumePeak !== null
                    ? `upp till ${volumeText({ min: l.volumePeak, max: null }, volumeUnit)}/vecka`
                    : null,
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
        {multi && proposal?.ok && (
          <div className="mt-4 space-y-3 border-t border-line pt-4">
            {proposal.rounds.slice(1).map((round) => (
              <div key={round.round}>
                <p className="mb-1.5 text-[13px] font-medium text-text">
                  Varv {round.round}{" "}
                  <span className="font-normal text-text-subtle">
                    · från vecka {round.fromWeek}
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {levels.map((l) => {
                    const selected = levelIds[round.round - 1] === l.id;
                    return (
                      <button
                        key={l.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setLevel(round.round - 1, l.id)}
                        className={choiceClass(selected)}
                      >
                        {l.key} · {l.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <p className="text-[13px] text-text-muted">
              Till exempel en lägre volym första varvet och en högre mot målet.
            </p>
          </div>
        )}
        <p className="mt-3 text-[13px] text-text-muted">
          Du kan byta nivå när som helst under planen.
        </p>
      </Step>

      {usesPaces && (
        <Step n={5} title="Tempo">
          <p className="mb-3 text-sm text-text-muted">
            Passen anges i procent och zoner. Vad ska tempona räknas ur?
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              aria-pressed={paceMode === "form"}
              onClick={() => setPaceMode("form")}
              className={choiceClass(paceMode === "form")}
            >
              <span className="block font-medium">Min form</span>
              <span className="block text-[13px] text-text-subtle">
                Dina tester och tider. Tempona följer med när formen ändras.
              </span>
            </button>
            <button
              type="button"
              aria-pressed={paceMode === "mål"}
              onClick={() => setPaceMode("mål")}
              className={choiceClass(paceMode === "mål")}
            >
              <span className="block font-medium">Min måltid</span>
              <span className="block text-[13px] text-text-subtle">
                Tiden du vill springa {race.name} på. Tempona räknas ur den.
              </span>
            </button>
          </div>
          {paceMode === "mål" && (
            <div className="mt-4 max-w-xs">
              <Field
                label={`Måltid för ${race.name}`}
                htmlFor="start-maltid"
                hint={`Till exempel ${race.example}. Känns de första passen för snabba är målet för högt satt.`}
              >
                <Input
                  id="start-maltid"
                  inputMode="numeric"
                  placeholder={race.example}
                  value={goalTime}
                  onChange={(e) => setGoalTime(e.target.value)}
                />
              </Field>
            </div>
          )}
          <p className="mt-3 text-[13px] text-text-muted">
            Du kan byta senare under planen.
          </p>
        </Step>
      )}

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
