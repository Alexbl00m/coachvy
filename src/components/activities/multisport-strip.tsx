import Link from "next/link";

import { formatClock } from "@/lib/activities/analysis";
import { partLabels, type MultisportPart } from "@/lib/activities/multisport";
import { cn } from "@/lib/cn";

const km = (m: number | null) =>
  m === null || m <= 0
    ? null
    : m >= 1000
      ? `${(m / 1000).toFixed(1).replace(".", ",")} km`
      : `${Math.round(m)} m`;

/**
 * Loppet i delar: grenarna med tid och sträcka, växlingarna smalare. Delarnas
 * bredd följer tiden. En gren med länk går till grenens analys.
 */
export function MultisportStrip({
  parts,
  hrefs,
  current,
}: {
  parts: MultisportPart[];
  /** Länken till varje gren, i grenarnas ordning. */
  hrefs?: (string | null)[];
  /** Grenen som visas nu, från 0. */
  current?: number;
}) {
  const labels = partLabels(parts);
  const total = parts.reduce((sum, p) => sum + p.seconds, 0) || 1;
  // Grenens plats bland grenarna, för varje del.
  const legIndexes = parts.map(
    (_, i) => parts.slice(0, i + 1).filter((x) => x.kind === "gren").length - 1,
  );
  return (
    <ol className="flex w-full gap-1 overflow-x-auto">
      {parts.map((p, i) => {
        const transition = p.kind === "växling";
        const legIndex = legIndexes[i];
        const href = !transition ? (hrefs?.[legIndex] ?? null) : null;
        const active = !transition && current === legIndex;
        const body = (
          <>
            <span
              className={cn(
                "block text-[0.6875rem] font-semibold tracking-[0.08em] uppercase",
                active ? "text-accent" : "text-text-subtle",
              )}
            >
              {labels[i]}
            </span>
            <span className="block font-mono text-[0.8125rem] whitespace-nowrap tabular-nums text-text">
              {formatClock(p.seconds)}
            </span>
            {!transition && km(p.distanceM) && (
              <span className="block text-[0.6875rem] whitespace-nowrap tabular-nums text-text-muted">
                {km(p.distanceM)}
              </span>
            )}
          </>
        );
        return (
          <li
            key={`${p.startedAt}-${i}`}
            style={{
              flex: transition
                ? "0 0 auto"
                : `${Math.max(p.seconds / total, 0.12)} 1 0`,
            }}
            className={cn(
              "min-w-0 rounded-md border px-2.5 py-2",
              transition
                ? "border-dashed border-line bg-transparent"
                : active
                  ? "border-accent/60 bg-accent-soft"
                  : "border-line bg-surface-2",
            )}
          >
            {href ? (
              <Link href={href} className="block hover:underline">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ol>
  );
}
