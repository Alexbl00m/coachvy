"use client";

import { useState, type ReactNode } from "react";

import { WorkoutStrip } from "@/components/workouts/workout-strip";
import { cn } from "@/lib/cn";
import { templateProfile } from "@/lib/plan-library/profile";
import {
  amountText,
  basisName,
  levelOf,
  phasesText,
  type LibraryLevelKey,
  type LibrarySession,
} from "@/lib/session-library/library";

const chip =
  "rounded-sm bg-surface-3 px-1.5 py-px text-[11px] font-medium text-text-muted";

const DETAILS: [
  "description" | "adaptations" | "fueling" | "timing" | "progression",
  string,
][] = [
  ["description", "Utförande"],
  ["adaptations", "Anpassningar"],
  ["fueling", "Energi"],
  ["timing", "När passet passar"],
  ["progression", "Så byggs det på"],
];

/**
 * Ett pass i biblioteket: namn, profil, raden och syftet. Har passet nivåer
 * går de att bläddra mellan, nivå B först. Utförandet, anpassningarna,
 * energin och progressionen ligger under "Mer", så att listan går att
 * skumma.
 */
export function LibraryCard({
  session,
  actions,
  compact = false,
  level: controlled,
  onLevel,
}: {
  session: LibrarySession;
  /** Knapparna; får nivån som visas. */
  actions?: ReactNode | ((level: LibraryLevelKey | null) => ReactNode);
  compact?: boolean;
  level?: LibraryLevelKey;
  onLevel?: (level: LibraryLevelKey) => void;
}) {
  const [own, setOwn] = useState<LibraryLevelKey>("B");
  const hasLevels = session.levels.length > 0;
  const level = hasLevels ? (controlled ?? own) : null;
  const shown = levelOf(session, level);
  const profile = templateProfile(shown.blocks, session.basis);
  const amount = amountText(shown.blocks);
  const phases = phasesText(session.phases);
  const details = DETAILS.filter(([field]) => session[field]);
  const more = details.length > 0 || phases;

  return (
    <article className="flex h-full flex-col gap-2.5 rounded-lg border border-line bg-surface p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-text">
            {session.title}
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className={chip}>
              {session.sport[0].toUpperCase() + session.sport.slice(1)}
            </span>
            {session.kind && <span className={chip}>{session.kind}</span>}
            {session.intensity && (
              <span className={chip}>{session.intensity}</span>
            )}
            {!session.own && (
              <span className={cn(chip, "text-text")}>Delat</span>
            )}
            {session.own && session.shared && (
              <span className={cn(chip, "text-text")}>Delas med coacher</span>
            )}
          </p>
        </div>
        {amount && (
          <span className="shrink-0 text-[13px] tabular-nums text-text-muted">
            {amount}
          </span>
        )}
      </header>

      {hasLevels && (
        <div
          role="group"
          aria-label="Nivå"
          className="flex w-fit rounded-md border border-line p-0.5"
        >
          {session.levels.map((l) => (
            <button
              key={l.key}
              type="button"
              aria-pressed={l.key === level}
              onClick={() => (onLevel ?? setOwn)(l.key)}
              className={cn(
                "rounded-sm px-2 py-0.5 text-[12px] font-medium tabular-nums transition-colors",
                l.key === level
                  ? "bg-surface-3 text-text"
                  : "text-text-subtle hover:text-text",
              )}
            >
              Nivå {l.key}
            </button>
          ))}
        </div>
      )}

      <WorkoutStrip blocks={profile} className="h-7" />

      <p
        className="font-mono text-[12px] leading-snug break-words text-text-muted"
        title={`Procent av ${basisName(session.basis).toLowerCase()}`}
      >
        {shown.structure}
      </p>

      {session.purpose && (
        <p
          className={cn(
            "text-[13px] leading-snug text-text",
            compact && "line-clamp-2",
          )}
        >
          {session.purpose}
        </p>
      )}

      {!compact && more && (
        <details className="group text-[13px] text-text-muted">
          <summary className="cursor-pointer select-none text-[12px] text-text-subtle hover:text-text">
            Mer
          </summary>
          <dl className="mt-2 space-y-2">
            {details.map(([field, heading]) => (
              <div key={field}>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-text-subtle">
                  {heading}
                </dt>
                <dd className="whitespace-pre-line">{session[field]}</dd>
              </div>
            ))}
            {phases && (
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-text-subtle">
                  Faser
                </dt>
                <dd>{phases}</dd>
              </div>
            )}
          </dl>
        </details>
      )}

      {actions && (
        <footer className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          {typeof actions === "function" ? actions(level) : actions}
        </footer>
      )}
    </article>
  );
}
