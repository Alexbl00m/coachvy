"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  MinusCircle,
  RotateCcw,
  SkipForward,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import {
  logSession,
  moveSession,
  setSessionState,
  swapSessions,
} from "@/lib/plan-library/actions";
import type { LogStatus } from "@/lib/plan-library/types";

import { useAction } from "../use-action";

const STATUS: { key: LogStatus; label: string; icon: typeof Check }[] = [
  { key: "genomförd", label: "Genomfört", icon: Check },
  { key: "delvis", label: "Delvis", icon: MinusCircle },
  { key: "hoppad", label: "Hoppade över", icon: SkipForward },
];

/**
 * Det medlemmen gör med ett pass: loggar det, flyttar det, byter dag med
 * ett annat, stryker det eller ersätter det med ett eget. Originalet ligger
 * alltid kvar och går att återställa.
 */
export function SessionActions({
  instanceId,
  sessionId,
  week,
  title,
  state,
  plannedDate,
  date,
  log,
  minDate,
  maxDate,
  others,
  workouts,
}: {
  instanceId: string;
  sessionId: string;
  week: number;
  title: string;
  state: "original" | "flyttad" | "ersatt" | "struken";
  plannedDate: string | null;
  date: string | null;
  log: { status: LogStatus; rpe: number | null; note: string | null } | null;
  minDate: string;
  maxDate: string;
  others: { sessionId: string; week: number; title: string; date: string }[];
  workouts: { id: string; title: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [moveTo, setMoveTo] = useState(date ?? plannedDate ?? minDate);
  const [swapWith, setSwapWith] = useState("");
  const [workoutId, setWorkoutId] = useState(workouts[0]?.id ?? "");
  const [rpe, setRpe] = useState(log?.rpe ? String(log.rpe) : "");
  const [note, setNote] = useState(log?.note ?? "");
  const { pending, error, run } = useAction();
  const ref = { instanceId, sessionId, week };

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-1">
        {STATUS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            disabled={pending || state === "struken"}
            aria-pressed={log?.status === key}
            onClick={() =>
              run(() =>
                logSession({
                  ...ref,
                  status: log?.status === key ? null : key,
                  rpe: rpe ? Number(rpe) : null,
                  note,
                }),
              )
            }
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[12px] transition-colors disabled:opacity-50",
              log?.status === key
                ? "border-text-subtle bg-surface-3 text-text"
                : "border-line text-text-muted hover:border-text-subtle hover:text-text",
            )}
          >
            <Icon aria-hidden className="size-3.5" />
            {label}
          </button>
        ))}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="ml-auto inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[12px] text-text-muted hover:text-text"
        >
          Mer
          <ChevronDown
            aria-hidden
            className={cn(
              "size-3.5 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </div>

      {open && (
        <div className="mt-2 space-y-3 rounded-md border border-line bg-surface p-3">
          <div className="grid grid-cols-[5rem_1fr] gap-2">
            <Field label="RPE" htmlFor={`rpe-${week}-${sessionId}`} optional>
              <Select
                id={`rpe-${week}-${sessionId}`}
                value={rpe}
                onChange={(e) => setRpe(e.target.value)}
              >
                <option value="">–</option>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Anteckning"
              htmlFor={`not-${week}-${sessionId}`}
              optional
            >
              <Input
                id={`not-${week}-${sessionId}`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
          </div>
          {log && (
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                run(() =>
                  logSession({
                    ...ref,
                    status: log.status,
                    rpe: rpe ? Number(rpe) : null,
                    note,
                  }),
                )
              }
            >
              Spara RPE och anteckning
            </Button>
          )}

          <div className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
            <div className="min-w-0 flex-1">
              <Field
                label="Flytta till"
                htmlFor={`flytta-${week}-${sessionId}`}
              >
                <Input
                  id={`flytta-${week}-${sessionId}`}
                  type="date"
                  min={minDate}
                  max={maxDate}
                  value={moveTo}
                  onChange={(e) => setMoveTo(e.target.value)}
                />
              </Field>
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={pending || !moveTo}
              onClick={() => run(() => moveSession({ ...ref, date: moveTo }))}
            >
              Flytta
            </Button>
          </div>

          {others.length > 0 && date && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1">
                <Field label="Byt dag med" htmlFor={`byt-${week}-${sessionId}`}>
                  <Select
                    id={`byt-${week}-${sessionId}`}
                    value={swapWith}
                    onChange={(e) => setSwapWith(e.target.value)}
                  >
                    <option value="">Välj ett pass</option>
                    {others.map((o) => (
                      <option
                        key={`${o.week}:${o.sessionId}`}
                        value={`${o.week}:${o.sessionId}`}
                      >
                        {o.title}, {o.date}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={pending || !swapWith}
                onClick={() => {
                  const [w, id] = swapWith.split(":");
                  run(() =>
                    swapSessions({
                      instanceId,
                      a: { sessionId, week },
                      b: { sessionId: id, week: Number(w) },
                    }),
                  );
                }}
              >
                Byt
              </Button>
            </div>
          )}

          {workouts.length > 0 && state !== "ersatt" && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1">
                <Field
                  label="Ersätt med eget pass"
                  htmlFor={`ersatt-${week}-${sessionId}`}
                >
                  <Select
                    id={`ersatt-${week}-${sessionId}`}
                    value={workoutId}
                    onChange={(e) => setWorkoutId(e.target.value)}
                  >
                    {workouts.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.title}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={pending || !workoutId}
                onClick={() =>
                  run(() =>
                    setSessionState({ ...ref, state: "ersatt", workoutId }),
                  )
                }
              >
                Ersätt
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            {state !== "struken" && (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  if (confirm(`Stryk ${title}? Det går att ta tillbaka.`)) {
                    run(() => setSessionState({ ...ref, state: "struken" }));
                  }
                }}
              >
                Stryk passet
              </Button>
            )}
            {state !== "original" && (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  run(() => setSessionState({ ...ref, state: "original" }))
                }
              >
                <RotateCcw aria-hidden className="size-3.5" />
                Tillbaka till planen
              </Button>
            )}
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-1 text-[12px] text-warn">
          {error}
        </p>
      )}
    </div>
  );
}
