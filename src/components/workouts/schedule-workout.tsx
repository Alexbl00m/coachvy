"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Copy } from "lucide-react";

import {
  datesFor,
  RepeatPicker,
  repeatFor,
  type Repeat,
} from "@/components/calendar/repeat-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { addDays, longDate, todayIso, weekdayName } from "@/lib/season/season";
import { copyWorkoutToDates, scheduleWorkout } from "@/lib/workouts/actions";

/**
 * Passets datum i kalendern. Utan datum syns passet bara under adeptens
 * pass; med datum också i kalendern och i veckans översikt.
 */
export function ScheduleWorkout({
  workoutId,
  adeptId,
  scheduledFor,
  canEdit,
}: {
  workoutId: string;
  adeptId: string;
  scheduledFor: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [date, setDate] = useState(scheduledFor ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);

  const save = (value: string | null) =>
    start(async () => {
      setError(null);
      const result = await scheduleWorkout(workoutId, adeptId, value);
      if (!result.ok) return setError(result.error ?? "Kunde inte spara.");
      if (value === null) setDate("");
      router.refresh();
    });

  return (
    <div className="space-y-3 print:hidden">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <CalendarDays aria-hidden className="size-4 text-text-subtle" />
        <span className="text-text-muted">
          {scheduledFor
            ? `I kalendern ${weekdayName(scheduledFor)} ${longDate(scheduledFor)}`
            : "Inget datum i kalendern"}
        </span>
        {canEdit && (
          <>
            <label className="sr-only" htmlFor="workout-date">
              Datum
            </label>
            <Input
              id="workout-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 w-auto! py-1!"
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={pending || !date || date === scheduledFor}
              onClick={() => save(date)}
            >
              {scheduledFor ? "Flytta" : "Lägg i kalendern"}
            </Button>
            {scheduledFor && (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => save(null)}
              >
                Ta bort datum
              </Button>
            )}
          </>
        )}
        {canEdit && (
          <Button
            size="sm"
            variant="ghost"
            aria-expanded={copying}
            onClick={() => setCopying((open) => !open)}
          >
            <Copy aria-hidden className="size-3.5" />
            Kopiera till fler dagar
          </Button>
        )}
        {error && (
          <p role="alert" className="w-full text-sm text-bad">
            {error}
          </p>
        )}
      </div>
      {copying && (
        <CopyPanel
          workoutId={workoutId}
          adeptId={adeptId}
          scheduledFor={scheduledFor}
          onDone={() => setCopying(false)}
        />
      )}
    </div>
  );
}

/**
 * Samma pass på fler dagar: från ett startdatum, valda veckodagar och ett
 * antal veckor. Förvalt är veckan efter passets eget datum, samma veckodag.
 */
function CopyPanel({
  workoutId,
  adeptId,
  scheduledFor,
  onDone,
}: {
  workoutId: string;
  adeptId: string;
  scheduledFor: string | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [start, setStart] = useState(
    scheduledFor ? addDays(scheduledFor, 7) : todayIso(),
  );
  const [repeat, setRepeat] = useState<Repeat>(() =>
    repeatFor(scheduledFor ?? todayIso()),
  );
  const [pending, run] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dates = datesFor(start, { ...repeat, on: true });

  const copy = () =>
    run(async () => {
      setError(null);
      const result = await copyWorkoutToDates(workoutId, adeptId, dates);
      if (!result.ok) return setError(result.error);
      setMessage(
        `${result.count} ${result.count === 1 ? "kopia" : "kopior"} inlagda i kalendern.`,
      );
      router.refresh();
    });

  return (
    <div className="enter max-w-xl space-y-4 rounded-lg border border-line bg-surface p-4">
      <label className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
        Från
        <Input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="h-9 w-auto! py-1!"
        />
      </label>
      <RepeatPicker start={start} value={repeat} onChange={setRepeat} fixed />
      {message ? (
        <div className="flex flex-wrap items-center gap-3">
          <p role="status" className="text-sm text-text">
            {message}
          </p>
          <Button size="sm" variant="ghost" onClick={onDone}>
            Stäng
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled={pending || dates.length === 0}
            onClick={copy}
          >
            {pending
              ? "Kopierar…"
              : `Lägg in ${dates.length} ${dates.length === 1 ? "kopia" : "kopior"}`}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDone}>
            Avbryt
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
