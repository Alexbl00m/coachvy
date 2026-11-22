"use client";

import { useId, useState } from "react";
import { CalendarRange } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { weekChoices } from "@/lib/calendar/week";
import { isoWeek } from "@/lib/season/season";

import { useWeekMove } from "./calendar-dnd";

/**
 * Flytta eller kopiera hela veckan till en annan vecka, utan att dra: samma
 * flytt som när veckonumret dras i rutnätet. Listan når ett halvår framåt,
 * så att veckan går att lägga efter ett läger i nästa månad. Passen hamnar
 * på samma veckodag.
 */
export function MoveWeekButton({
  adeptId,
  monday,
  count,
}: {
  adeptId: string;
  /** Måndagen i veckan som flyttas. */
  monday: string;
  /** Passen i veckan som går att flytta. */
  count: number;
}) {
  const id = useId();
  const { moveWeek, pending } = useWeekMove();
  const choices = weekChoices(monday);
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(
    () => choices.find((c) => c.monday > monday)?.monday ?? "",
  );
  const week = isoWeek(monday);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-accent-text hover:underline"
      >
        <CalendarRange aria-hidden className="size-4" />
        Flytta eller kopiera vecka {week} ({count} pass)
      </button>
    );
  }

  const run = async (copy: boolean) => {
    if (!to) return;
    const ok = await moveWeek({ adeptId, from: monday, to, copy });
    if (ok) setOpen(false);
  };

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        void run(false);
      }}
    >
      <label
        htmlFor={id}
        className="block text-[0.8125rem] font-medium text-text"
      >
        Vecka {week}, {count} pass, till
      </label>
      <Select
        id={id}
        value={to}
        onChange={(e) => setTo(e.target.value)}
        className="h-9"
      >
        {choices.map((c) => (
          <option key={c.monday} value={c.monday}>
            {c.label}
          </option>
        ))}
      </Select>
      <p className="text-[0.75rem] text-text-muted">
        Passen hamnar på samma veckodag. Genomförda aktiviteter, loggade
        styrkepass, tester och tävlingar ligger kvar.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending || !to}>
          {pending ? "Sparar …" : "Flytta"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending || !to}
          onClick={() => void run(true)}
        >
          Kopiera
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
        >
          Avbryt
        </Button>
      </div>
    </form>
  );
}
