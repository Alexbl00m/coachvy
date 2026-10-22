import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { PHASE_SHORT } from "@/components/season/phase-style";
import { digitsForMetric } from "@/lib/format";
import { monthName } from "@/lib/season/season";
import { shortMetricLabel } from "@/lib/tests/headline";
import { displayValue } from "@/lib/tests/pace";
import type { TrainingPhase } from "@/lib/tests/phases";
import { protocolLabel } from "@/lib/tests/progression";
import type { FullSession } from "@/lib/tests/session-queries";

const dateText = (iso: string) =>
  `${Number(iso.slice(8))} ${monthName(Number(iso.slice(5, 7)) - 1).slice(0, 3)} ${iso.slice(0, 4)}`;

/**
 * Testtillfällena i grenen, nyast först: datumet, testet, fasen det togs i
 * och primärvärdena till höger. Hela raden leder till testet.
 */
export function SessionList({
  sessions,
  hrefFor,
}: {
  sessions: FullSession[];
  hrefFor: (s: FullSession) => string;
}) {
  const sorted = [...sessions].sort((a, b) =>
    b.performed_on.localeCompare(a.performed_on),
  );
  return (
    <ul className="divide-y divide-line">
      {sorted.map((s) => {
        const primary = s.test_metrics.filter((m) => m.is_primary).slice(0, 4);
        const phase = s.training_phase as TrainingPhase | null;
        return (
          <li key={s.id}>
            <Link
              href={hrefFor(s)}
              className="group -mx-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-md px-3 py-3.5 transition-colors hover:bg-surface-2"
            >
              <span className="eyebrow w-28 shrink-0 text-text-subtle">
                {dateText(s.performed_on)}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-2.5">
                <span className="truncate text-sm font-medium text-text">
                  {protocolLabel(s.protocol)}
                </span>
                {phase && PHASE_SHORT[phase] && (
                  <span className="shrink-0 rounded-full border border-line-strong px-2 py-0.5 text-[11px] text-text-muted">
                    {PHASE_SHORT[phase]}
                  </span>
                )}
              </span>
              <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1 tabular-nums">
                {primary.map((m) => {
                  const d = displayValue(
                    Number(m.value),
                    m.unit,
                    s.sport,
                    digitsForMetric(m.key, m.unit),
                  );
                  return (
                    <span key={m.id} className="whitespace-nowrap">
                      <span className="font-mono text-[11px] text-text-subtle">
                        {shortMetricLabel(m.key)}
                      </span>{" "}
                      <span className="text-[15px] font-semibold text-text">
                        {d.value}
                      </span>{" "}
                      <span className="font-mono text-[11px] text-text-subtle">
                        {d.unit}
                      </span>
                    </span>
                  );
                })}
              </span>
              <ChevronRight
                aria-hidden
                className="size-4 shrink-0 text-text-subtle group-hover:text-text"
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
