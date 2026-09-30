"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { longDate, weekdayName } from "@/lib/season/season";
import { scheduleWorkout } from "@/lib/workouts/actions";

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

  const save = (value: string | null) =>
    start(async () => {
      setError(null);
      const result = await scheduleWorkout(workoutId, adeptId, value);
      if (!result.ok) return setError(result.error ?? "Kunde inte spara.");
      if (value === null) setDate("");
      router.refresh();
    });

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm print:hidden">
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
            className="h-8 w-auto py-1"
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
      {error && (
        <p role="alert" className="w-full text-sm text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
