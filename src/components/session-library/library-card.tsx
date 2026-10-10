import type { ReactNode } from "react";

import { WorkoutStrip } from "@/components/workouts/workout-strip";
import { cn } from "@/lib/cn";
import { templateProfile } from "@/lib/plan-library/profile";
import {
  amountText,
  basisName,
  phasesText,
  type LibrarySession,
} from "@/lib/session-library/library";

const chip =
  "rounded-sm bg-surface-3 px-1.5 py-px text-[11px] font-medium text-text-muted";

/**
 * Ett pass i biblioteket: namn, profil, raden och syftet. Instruktionen och
 * progressionen ligger under "Mer", så att listan går att skumma.
 */
export function LibraryCard({
  session,
  actions,
  compact = false,
}: {
  session: LibrarySession;
  actions?: ReactNode;
  compact?: boolean;
}) {
  const profile = templateProfile(session.blocks, session.basis);
  const amount = amountText(session.blocks);
  const phases = phasesText(session.phases);
  const more = session.description || session.progression || phases;

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
            {!session.own && <span className={cn(chip, "text-accent")}>Delat</span>}
            {session.own && session.shared && (
              <span className={cn(chip, "text-accent")}>Delas med coacher</span>
            )}
          </p>
        </div>
        {amount && (
          <span className="shrink-0 text-[13px] tabular-nums text-text-muted">
            {amount}
          </span>
        )}
      </header>

      <WorkoutStrip blocks={profile} className="h-7" />

      <p
        className="font-mono text-[12px] leading-snug break-words text-text-muted"
        title={`Procent av ${basisName(session.basis).toLowerCase()}`}
      >
        {session.structure}
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
            {session.description && (
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-text-subtle">
                  Instruktion
                </dt>
                <dd className="whitespace-pre-line">{session.description}</dd>
              </div>
            )}
            {session.progression && (
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-text-subtle">
                  Så byggs det på
                </dt>
                <dd className="whitespace-pre-line">{session.progression}</dd>
              </div>
            )}
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
          {actions}
        </footer>
      )}
    </article>
  );
}
