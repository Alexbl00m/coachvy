import { Card, CardLabel } from "@/components/ui/card";
import type { Sport } from "@/lib/calculators/lactate";
import { cn } from "@/lib/cn";
import { digitsForMetric } from "@/lib/format";
import { monthName } from "@/lib/season/season";
import { displayValue } from "@/lib/tests/pace";
import type { Trend } from "@/lib/tests/progression";
import { changeBetween } from "@/lib/tests/threshold-summary";

const KEYS: Record<Sport, string[]> = {
  cykling: ["LT2", "LT1", "FatMax", "VLamax", "VO2max"],
  löpning: ["CS", "LT2", "LT1", "VDOT", "VO2max"],
  simning: ["CS", "LT2", "LT1", "D_prime"],
};

const NAMES: Record<string, string> = { FatMax: "FatMax", VLamax: "VLamax" };

const shortMonth = (iso: string) =>
  `${monthName(Number(iso.slice(5, 7)) - 1).slice(0, 3)} ${iso.slice(2, 4)}`;

/**
 * Före och efter: första och senaste värdet för de storheter som säger mest
 * om profilen, som en hantel per rad. Ihålig punkt före, fylld efter; linjen
 * mellan dem i förändringens ton – grönt framåt, guld bakåt eller utan
 * riktning.
 */
export function BeforeAfter({
  trends,
  sport,
}: {
  trends: Trend[];
  sport: Sport;
}) {
  const rows = KEYS[sport]
    .map((key) =>
      trends.find(
        (t) =>
          t.key === key &&
          t.points.length > 1 &&
          t.points[0].performedOn < t.points[t.points.length - 1].performedOn,
      ),
    )
    .filter((t): t is Trend => Boolean(t))
    .slice(0, 4);
  if (rows.length === 0) return null;

  const from = rows.map((t) => t.points[0].performedOn).sort()[0];
  const to = rows
    .map((t) => t.points[t.points.length - 1].performedOn)
    .sort()
    .at(-1) as string;

  return (
    <Card className="min-w-0">
      <CardLabel aside={`${shortMonth(from)} → ${shortMonth(to)}`}>
        Före → efter
      </CardLabel>
      <ul className="mt-4 divide-y divide-line">
        {rows.map((t) => {
          const a = t.points[0];
          const b = t.points[t.points.length - 1];
          const change = changeBetween(t, a, b, sport);
          const digits = digitsForMetric(t.key, t.unit);
          const show = (v: number) => displayValue(v, t.unit, sport, digits);
          const lo = Math.min(a.value, b.value);
          const hi = Math.max(a.value, b.value);
          const pad = Math.max((hi - lo) * 0.7, Math.abs(hi) * 0.06);
          const pos = (v: number) =>
            ((v - (lo - pad)) / (hi - lo + 2 * pad)) * 100;
          const color =
            change?.tone === "good" ? "var(--good)" : "var(--zone-4)";
          return (
            <li
              key={t.id}
              className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-4 py-3.5"
            >
              <span className="text-sm font-semibold text-text">
                {NAMES[t.key] ?? t.label.split(" – ")[0]}
              </span>
              <span className="relative h-4" aria-hidden>
                <span className="absolute inset-x-0 top-1/2 h-px bg-line-strong" />
                <span
                  className="absolute top-1/2 h-0.5 -translate-y-1/2"
                  style={{
                    left: `${Math.min(pos(a.value), pos(b.value))}%`,
                    width: `${Math.abs(pos(b.value) - pos(a.value))}%`,
                    background: color,
                  }}
                />
                <span
                  className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-surface"
                  style={{
                    left: `${pos(a.value)}%`,
                    borderColor: "var(--text-subtle)",
                  }}
                />
                <span
                  className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{ left: `${pos(b.value)}%`, background: color }}
                />
              </span>
              <span className="text-right tabular-nums">
                <span className="block text-[13px] text-text-muted">
                  {show(a.value).value} →{" "}
                  <span className="font-semibold text-text">
                    {show(b.value).value} {show(b.value).unit}
                  </span>
                </span>
                {change && (
                  <span
                    className={cn(
                      "block text-[12px] font-medium",
                      change.tone === "good"
                        ? "text-good"
                        : change.tone === "bad"
                          ? "text-warn"
                          : "text-text-muted",
                    )}
                  >
                    {change.percent > 0 ? "+" : "−"}
                    {Math.abs(change.percent).toFixed(1).replace(".", ",")} %
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
