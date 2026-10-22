import Link from "next/link";

import { Card, CardHeadline, CardLabel } from "@/components/ui/card";
import { Unit } from "@/components/ui/metric";
import type { Sport } from "@/lib/calculators/lactate";
import { cn } from "@/lib/cn";
import { longDate } from "@/lib/season/season";
import { protocolLabel, type Trend } from "@/lib/tests/progression";
import { latestOf, THRESHOLD_KEYS } from "@/lib/tests/threshold-summary";

const SPORT_TEXT: Record<Sport, string> = {
  cykling: "Cykel",
  löpning: "Löpning",
  simning: "Simning",
};

/**
 * Trösklarna i grenen: senaste värdet stort, förändringen mot testet före och
 * vilket test det kom ur. Samma tal som under Utveckling.
 */
export function ThresholdsCard({
  trends,
  sport,
  today,
  href,
}: {
  trends: Trend[];
  sport: Sport | null;
  today: string;
  href: string;
}) {
  const rows = sport
    ? THRESHOLD_KEYS[sport]
        .map((key) => trends.find((t) => t.key === key && t.points.length))
        .filter((t): t is Trend => Boolean(t))
        .slice(0, 3)
    : [];

  return (
    <Card className="flex min-w-0 flex-col">
      <CardLabel
        aside={
          <Link href={href} className="hover:text-text">
            Alla tester →
          </Link>
        }
      >
        {sport ? `Trösklar · ${SPORT_TEXT[sport]}` : "Trösklar"}
      </CardLabel>
      {rows.length === 0 ? (
        <>
          <CardHeadline>Inga trösklar än.</CardHeadline>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-text-muted">
            Ett laktattest eller ett tidstest ger trösklarna, och zonerna passen
            räknas mot.
          </p>
        </>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {rows.map((trend) => {
            const latest = latestOf(trend, sport as Sport);
            return (
              <li
                key={trend.id}
                className="flex items-center gap-3 py-4 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">
                    {trend.label.replace(" – ", " · ")}
                  </p>
                  <p className="mt-0.5 truncate text-[0.75rem] text-text-subtle">
                    {protocolLabel(latest.last.protocol)}{" "}
                    {longDate(latest.last.performedOn, today)}
                    {latest.previousShown
                      ? ` · från ${latest.previousShown}`
                      : ""}
                  </p>
                </div>
                {latest.change && (
                  <span
                    className={cn(
                      "shrink-0 font-mono text-[0.75rem] tabular-nums",
                      latest.change.tone === "good"
                        ? "text-good"
                        : latest.change.tone === "bad"
                          ? "text-bad"
                          : "text-text-muted",
                    )}
                  >
                    {latest.change.text.replace(/ W$/, "")}
                  </span>
                )}
                <p className="shrink-0 text-[1.75rem] font-light leading-none tracking-[-0.03em] text-text tabular-nums">
                  {latest.shown.value}
                  {latest.shown.unit && <Unit>{latest.shown.unit}</Unit>}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
