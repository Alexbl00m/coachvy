"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { changeLevel } from "@/lib/plan-library/actions";
import { REASON_LABEL } from "@/lib/plan-library/labels";
import {
  effectiveWeek,
  historyKept,
  levelTimeline,
  planStepwise,
  planSwitch,
  planTemporary,
  levelForWeek,
  scenarioTarget,
  SCENARIOS,
  supersededBy,
  type ReturnMode,
} from "@/lib/plan-library/levels";
import type {
  ChangeReason,
  Level,
  LevelChange,
} from "@/lib/plan-library/types";

import { useAction } from "../use-action";
import { LevelTimeline } from "./level-timeline";

type Mode = "byte" | "stegvis" | "tillfällig";

const RETURN_MODES: { key: ReturnMode; label: string }[] = [
  { key: "tidigare", label: "Tillbaka till tidigare nivå" },
  { key: "en-under", label: "Tillbaka till en nivå under" },
  { key: "stegvis", label: "Stegvis tillbaka" },
  { key: "stanna", label: "Stanna kvar – jag byter själv" },
];

const tab = (selected: boolean) =>
  cn(
    "rounded-md border px-2.5 py-1 text-[13px] transition-colors",
    selected
      ? "border-text-subtle bg-surface-3 font-medium text-text"
      : "border-line-strong text-text-muted hover:border-text-subtle hover:text-text",
  );

/**
 * Byt nivå: ett byte, stegvis eller tillfälligt. Förhandsvisningen visar
 * nivån vecka för vecka med bytet, innan något sparas.
 */
export function LevelPanel({
  instanceId,
  levels,
  startLevelId,
  history,
  currentWeek,
  totalWeeks,
}: {
  instanceId: string;
  levels: Level[];
  startLevelId: string;
  history: LevelChange[];
  currentWeek: number;
  totalWeeks: number;
}) {
  const ordered = [...levels].sort((a, b) => b.rank - a.rank);
  const { pending, error, run } = useAction();
  const [mode, setMode] = useState<Mode>("byte");
  const [week, setWeek] = useState(effectiveWeek(currentWeek, totalWeeks));
  const fromNow = levelForWeek(
    startLevelId,
    historyKept(history, week, currentWeek),
    week,
  );
  const [toLevelId, setToLevelId] = useState(
    ordered.find((l) => l.id !== fromNow)?.id ?? ordered[0].id,
  );
  const [stepWeeks, setStepWeeks] = useState(4);
  const [durationWeeks, setDurationWeeks] = useState(2);
  const [returnMode, setReturnMode] = useState<ReturnMode>("tidigare");
  const [reason, setReason] = useState<ChangeReason>("eget val");
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);

  const applyScenario = (key: ChangeReason) => {
    const s = SCENARIOS.find((x) => x.reason === key);
    setReason(key);
    if (!s) return;
    setMode("tillfällig");
    setToLevelId(scenarioTarget(levels, fromNow, s).id);
    setDurationWeeks(s.durationWeeks);
    setReturnMode(s.returnMode);
    setStepWeeks(s.stepWeeks);
  };

  // Billigt att räkna om: några veckor och några nivåer.
  const planned = (() => {
    if (mode === "byte") return planSwitch(fromNow, toLevelId, week);
    if (mode === "stegvis") {
      return planStepwise({
        levels,
        fromLevelId: fromNow,
        toLevelId,
        startWeek: week,
        stepWeeks,
        totalWeeks,
      });
    }
    return planTemporary({
      levels,
      fromLevelId: fromNow,
      toLevelId,
      startWeek: week,
      durationWeeks,
      returnMode,
      stepWeeks,
      totalWeeks,
    });
  })();

  const before = levelTimeline(startLevelId, history, totalWeeks);
  const superseded = supersededBy(history, week, currentWeek);
  const after = levelTimeline(
    startLevelId,
    [
      ...history.filter((c) => !superseded.includes(c)),
      ...planned.map((c, i) => ({
        ...c,
        reason,
        source: "medlem" as const,
        createdAt: `9999-${i}`,
      })),
    ],
    totalWeeks,
  );
  const changed = new Set(
    after.flatMap((id, i) => (id !== before[i] ? [i + 1] : [])),
  );
  const name = (id: string) => {
    const l = levels.find((x) => x.id === id);
    return l ? `${l.key} · ${l.name}` : "";
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setDone(false);
        run(
          () =>
            changeLevel({
              instanceId,
              mode,
              toLevelId,
              week,
              stepWeeks,
              durationWeeks,
              returnMode,
              reason,
              note,
            }),
          () => setDone(true),
        );
      }}
    >
      <div>
        <p className="mb-2 text-[13px] text-text-muted">Något som händer?</p>
        <div className="flex flex-wrap gap-1.5">
          {SCENARIOS.map((s) => (
            <button
              key={s.reason}
              type="button"
              aria-pressed={reason === s.reason}
              onClick={() => applyScenario(s.reason)}
              className={tab(reason === s.reason)}
              title={s.description}
            >
              {s.label}
            </button>
          ))}
        </div>
        {SCENARIOS.find((s) => s.reason === reason) && (
          <p className="mt-2 text-[12px] leading-relaxed text-text-subtle">
            {SCENARIOS.find((s) => s.reason === reason)!.description} Förvalen
            nedan går att ändra.
          </p>
        )}
      </div>

      <div
        role="radiogroup"
        aria-label="Typ av byte"
        className="flex flex-wrap gap-1.5"
      >
        {(
          [
            ["byte", "Byt nivå"],
            ["stegvis", "Stegvis"],
            ["tillfällig", "Tillfälligt"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={mode === key}
            onClick={() => setMode(key)}
            className={tab(mode === key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Till nivå" htmlFor="niva-till">
          <Select
            id="niva-till"
            value={toLevelId}
            onChange={(e) => setToLevelId(e.target.value)}
          >
            {ordered.map((l) => (
              <option key={l.id} value={l.id}>
                {l.key} · {l.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Från vecka"
          htmlFor="niva-vecka"
          hint={`Nu är det vecka ${currentWeek}. Standard är nästa vecka.`}
        >
          <Select
            id="niva-vecka"
            value={week}
            onChange={(e) => setWeek(Number(e.target.value))}
          >
            {Array.from(
              { length: totalWeeks - currentWeek + 1 },
              (_, i) => currentWeek + i,
            ).map((w) => (
              <option key={w} value={w}>
                Vecka {w}
                {w === currentWeek
                  ? " (den här)"
                  : w === currentWeek + 1
                    ? " (nästa)"
                    : ""}
              </option>
            ))}
          </Select>
        </Field>
        {mode === "tillfällig" && (
          <>
            <Field label="Hur länge, veckor" htmlFor="niva-langd">
              <Input
                id="niva-langd"
                type="number"
                min={1}
                max={totalWeeks}
                value={durationWeeks}
                onChange={(e) => setDurationWeeks(Number(e.target.value))}
              />
            </Field>
            <Field label="Sedan" htmlFor="niva-sedan">
              <Select
                id="niva-sedan"
                value={returnMode}
                onChange={(e) => setReturnMode(e.target.value as ReturnMode)}
              >
                {RETURN_MODES.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        )}
        {(mode === "stegvis" ||
          (mode === "tillfällig" && returnMode === "stegvis")) && (
          <Field label="Veckor per steg" htmlFor="niva-steg">
            <Input
              id="niva-steg"
              type="number"
              min={1}
              max={8}
              value={stepWeeks}
              onChange={(e) => setStepWeeks(Number(e.target.value))}
            />
          </Field>
        )}
        <Field label="Orsak" htmlFor="niva-orsak">
          <Select
            id="niva-orsak"
            value={reason}
            onChange={(e) => setReason(e.target.value as ChangeReason)}
          >
            {(Object.keys(REASON_LABEL) as ChangeReason[]).map((r) => (
              <option key={r} value={r}>
                {REASON_LABEL[r]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Anteckning" htmlFor="niva-not" optional>
            <Input
              id="niva-not"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
        </div>
      </div>

      <div className="rounded-lg border border-line bg-surface-2/40 p-3">
        <p className="mb-2 text-[13px] text-text-muted">
          {planned.length === 0
            ? `Du är redan på ${name(toLevelId)} vecka ${week}.`
            : planned
                .map(
                  (c) =>
                    `Vecka ${c.effectiveWeek}: ${name(c.fromLevelId).split(" · ")[0]} → ${name(c.toLevelId)}`,
                )
                .join(" · ")}
        </p>
        <LevelTimeline
          timeline={after}
          levels={levels}
          currentWeek={currentWeek}
          changed={changed}
          label="Nivån vecka för vecka efter bytet"
        />
        {superseded.length > 0 && (
          <p className="mt-2 text-[12px] text-text-subtle">
            Ersätter {superseded.length} planerade byten från vecka {week}.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || planned.length === 0}>
          Spara bytet
        </Button>
        {done && (
          <span className="text-sm text-text-muted">
            Sparat. Passen följer nivån från vecka {week}.
          </span>
        )}
        {error && (
          <span role="alert" className="text-sm text-warn">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
