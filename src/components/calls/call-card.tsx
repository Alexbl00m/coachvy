"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Video } from "lucide-react";

import { Button, buttonClass } from "@/components/ui/button";
import { cancelCall } from "@/lib/calls/actions";
import { callState, callWhen, type CallState } from "@/lib/calls/time";
import type { CoachCallRow } from "@/lib/types/database";

const STATE_TEXT: Record<CallState, string> = {
  kommande: "Bokat",
  snart: "Börjar snart",
  pågår: "Pågår",
  avslutat: "Avslutat",
  avbokat: "Avbokat",
};

/**
 * Ett videosamtal i tråden, i kalendern eller i Idag: när, längd, ämne och
 * "Gå med" så länge samtalet inte är avslutat eller avbokat. Coachen kan
 * avboka ett kommande samtal.
 *
 * Tiden räknas mot `now` från servern, så att servern och webbläsaren visar
 * samma läge.
 */
export function CallCard({
  call,
  now,
  canCancel = false,
  compact = false,
}: {
  call: CoachCallRow;
  now: number;
  canCancel?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const state = callState(call, now);
  const open = state !== "avslutat" && state !== "avbokat";
  const live = state === "pågår" || state === "snart";

  return (
    <div
      className={
        compact
          ? "min-w-0"
          : "mt-2 min-w-0 rounded-md border border-line-strong bg-surface p-3"
      }
    >
      <div className="flex items-start gap-2.5">
        <Video
          aria-hidden
          className={
            live
              ? "mt-0.5 size-4 shrink-0 text-good"
              : "mt-0.5 size-4 shrink-0 text-text-muted"
          }
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text">
            Videosamtal
            <span
              className={
                live
                  ? "ml-2 text-[0.75rem] font-medium text-good"
                  : "ml-2 text-[0.75rem] font-normal text-text-muted"
              }
            >
              {STATE_TEXT[state]}
            </span>
          </p>
          <p
            className={
              state === "avbokat"
                ? "text-[0.8125rem] text-text-subtle line-through"
                : "text-[0.8125rem] text-text-muted"
            }
          >
            {callWhen(call.starts_at)} · {call.duration_minutes} min
          </p>
          {call.topic && (
            <p className="mt-0.5 text-[0.8125rem] text-text">{call.topic}</p>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a
            href={call.url}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass({ variant: "secondary", size: "sm" })}
          >
            <Video aria-hidden className="size-4" />
            Gå med
          </a>
          {canCancel && state === "kommande" && (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const result = await cancelCall(call.id);
                  if (!result.ok) setError(result.error);
                  else router.refresh();
                })
              }
            >
              {pending ? "Avbokar …" : "Avboka"}
            </Button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[0.8125rem] text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
