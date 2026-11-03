"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarArrowUp, CalendarPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import type { DragPass } from "@/lib/calendar/drag";
import { movePass } from "@/lib/calendar/move-actions";

/**
 * Flytta ett pass till en annan dag utan att dra det: samma flytt som dra
 * och släpp i rutnätet, för tangentbord och telefon. Ett pass ur en plan i
 * biblioteket läggs in på dagen i stället.
 */
export function MovePassButton({
  pass,
  date,
}: {
  pass: DragPass;
  /** Passets dag, eller den förvalda dagen för ett pass som läggs in. */
  date: string;
}) {
  const adding = pass.kind === "mall";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(date);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        aria-label={`${adding ? "Lägg in" : "Flytta"} ${pass.title}`}
        onClick={() => setOpen(true)}
        className="mt-1 shrink-0 rounded-md p-2 text-text-subtle hover:bg-surface-2 hover:text-text"
      >
        {adding ? (
          <CalendarPlus aria-hidden className="size-4" />
        ) : (
          <CalendarArrowUp aria-hidden className="size-4" />
        )}
      </button>
    );
  }

  return (
    <form
      className="flex w-full flex-wrap items-center gap-2 pb-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await movePass(pass, to);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setOpen(false);
          router.refresh();
        });
      }}
    >
      <label className="sr-only" htmlFor={`flytta-${pass.title}-${date}`}>
        {adding ? "Dag för" : "Ny dag för"} {pass.title}
      </label>
      <Input
        id={`flytta-${pass.title}-${date}`}
        type="date"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        className="h-9 w-auto"
      />
      <Button
        type="submit"
        size="sm"
        disabled={pending || !to || (!adding && to === date)}
      >
        {pending
          ? adding
            ? "Lägger in …"
            : "Flyttar …"
          : adding
            ? "Lägg in"
            : "Flytta"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setOpen(false)}
      >
        Avbryt
      </Button>
      {error && (
        <p role="alert" className="w-full text-[0.8125rem] text-warn">
          {error}
        </p>
      )}
    </form>
  );
}
