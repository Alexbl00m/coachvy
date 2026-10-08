import { DAY_SHORT, weekKindLabel } from "@/lib/plan-library/labels";
import type { TemplateSession, WeekKind } from "@/lib/plan-library/types";

import { SessionCard } from "./session-card";

/**
 * Mallens veckor på en nivå, som medlemmen skulle få dem i full längd. För
 * förhandsvisningen och för mallsidan i biblioteket.
 */
export function TemplateWeeks({
  phases,
  weeks,
  sessions,
  levelId,
  disciplineName,
}: {
  phases: { id: string; name: string }[];
  weeks: {
    id: string;
    phaseId: string;
    position: number;
    kind: WeekKind;
    title: string | null;
  }[];
  sessions: TemplateSession[];
  levelId: string;
  disciplineName: (key: string) => string;
}) {
  return (
    <div className="space-y-6">
      {phases.map((phase) => (
        <section key={phase.id}>
          <h3 className="mb-2 text-sm font-semibold text-text">{phase.name}</h3>
          <div className="space-y-2">
            {weeks
              .filter((w) => w.phaseId === phase.id)
              .map((week) => {
                const own = sessions
                  .filter((s) => s.weekId === week.id)
                  .flatMap((s) => {
                    const v = s.variants.find((x) => x.levelId === levelId);
                    return v ? [{ s, v }] : [];
                  });
                return (
                  <div
                    key={week.id}
                    className="rounded-lg border border-line bg-surface"
                  >
                    <p className="border-b border-line px-3 py-2 text-[13px] text-text-muted">
                      <span className="font-semibold text-text tabular-nums">
                        Vecka {week.position}
                      </span>
                      {week.kind !== "normal" &&
                        ` · ${weekKindLabel(week.kind)}`}
                      {week.title && ` · ${week.title}`}
                    </p>
                    {own.length === 0 ? (
                      <p className="px-3 py-3 text-[13px] text-text-subtle">
                        Inga pass på den här nivån.
                      </p>
                    ) : (
                      <ul className="grid gap-2 p-2 sm:grid-cols-2 lg:grid-cols-4">
                        {own
                          .sort(
                            (a, b) =>
                              (a.s.day ?? 7) - (b.s.day ?? 7) ||
                              a.s.position - b.s.position,
                          )
                          .map(({ s, v }) => (
                            <li
                              key={s.id}
                              className="rounded-md border border-line bg-surface-2 p-2"
                            >
                              <p className="mb-1 text-[11px] font-medium text-text-subtle">
                                {s.day === null
                                  ? "Valfri dag"
                                  : DAY_SHORT[s.day]}
                              </p>
                              <SessionCard
                                session={s}
                                variant={v}
                                disciplineName={disciplineName(s.discipline)}
                              />
                              {(v.description || s.description) && (
                                <p className="mt-1.5 text-[12px] leading-snug text-text-muted">
                                  {v.description || s.description}
                                </p>
                              )}
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
