import { cn } from "@/lib/cn";
import { shortDate } from "@/lib/season/season";
import { entryText, type ExerciseProgress } from "@/lib/strength/strength";

const sv = (value: number, digits = 0) =>
  value.toFixed(digits).replace(".", ",");

/** Skattat 1RM över passen, som en liten linje med sista punkten markerad. */
function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="block h-6 w-24" aria-hidden />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => (i / (values.length - 1)) * 92 + 4;
  const y = (v: number) => 20 - ((v - min) / span) * 16;
  const path = values.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join("");
  const last = values.length - 1;
  return (
    <svg viewBox="0 0 100 24" className="h-6 w-24" aria-hidden>
      <path
        d={path}
        fill="none"
        stroke="var(--zone-4)"
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={x(last)} cy={y(values[last])} r="2.6" fill="var(--zone-4)" />
    </svg>
  );
}

/**
 * Progressionen per övning de senaste sexton veckorna: senaste passets bästa
 * set, skattat 1RM och förändringen sedan första passet i fönstret.
 */
export function StrengthProgress({
  progress,
  perWeek,
}: {
  progress: ExerciseProgress[];
  /** Pass per vecka, de senaste åtta veckorna, äldst först. */
  perWeek: number[];
}) {
  const weighted = progress.filter((p) => p.latest.weightKg !== null);
  const other = progress.filter((p) => p.latest.weightKg === null);
  const top = Math.max(1, ...perWeek);
  const total = perWeek.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[13px] font-medium text-text">Pass per vecka</p>
          <p className="text-[12px] text-text-subtle tabular-nums">
            {total} på åtta veckor · {sv(total / 8, 1)} per vecka
          </p>
        </div>
        <div className="mt-2 flex h-12 items-end gap-1.5" aria-hidden>
          {perWeek.map((count, i) => (
            <span
              key={i}
              className={cn(
                "flex-1 rounded-t-[3px]",
                count > 0 ? "bg-[var(--zone-3)]" : "bg-surface-2",
              )}
              style={{ height: `${count > 0 ? (count / top) * 100 : 8}%` }}
            />
          ))}
        </div>
        <p className="sr-only">
          Pass per vecka, äldst först: {perWeek.join(", ")}.
        </p>
      </div>

      {weighted.length > 0 ? (
        <ul className="divide-y divide-line">
          {weighted.map((p) => (
            <li
              key={p.key}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-2.5 sm:grid-cols-[minmax(0,1fr)_6rem_5.5rem]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text">
                  {p.name}
                </p>
                <p className="text-[12px] text-text-muted tabular-nums">
                  {entryText(p.latest)} · {shortDate(p.latest.date)}
                  {p.points.length > 1 && ` · från ${entryText(p.first)}`}
                </p>
              </div>
              <Spark
                values={p.points
                  .map((pt) => pt.e1rm)
                  .filter((v): v is number => v !== null)}
              />
              <div className="col-span-2 text-left sm:col-span-1 sm:text-right">
                <p className="text-sm font-semibold text-text tabular-nums">
                  {p.latest.e1rm !== null ? `${sv(p.latest.e1rm)} kg` : "–"}
                </p>
                <p
                  className={cn(
                    "text-[12px] tabular-nums",
                    p.changePct === null
                      ? "text-text-subtle"
                      : p.changePct >= 0
                        ? "text-good"
                        : "text-bad",
                  )}
                >
                  {p.changePct === null
                    ? `${p.points.length} pass`
                    : `${p.changePct >= 0 ? "▲ +" : "▼ −"}${sv(Math.abs(p.changePct))} %`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-text-subtle">
          Ingen övning med vikt loggad ännu. Progressionen räknas på övningar
          med set, repetitioner och vikt.
        </p>
      )}

      {other.length > 0 && (
        <p className="text-[12px] text-text-muted">
          <span className="font-medium text-text">Utan vikt:</span>{" "}
          {other.map((p) => `${p.name} (${p.points.length})`).join(", ")}
        </p>
      )}

      <p className="text-[13px] leading-relaxed text-text-muted">
        Talet till höger är skattat 1RM ur passets tyngsta set (Epley), så att
        3×10 på 40 kg och 4×8 på 50 kg går att jämföra. Förändringen räknas från
        första passet de senaste sexton veckorna.
      </p>
    </div>
  );
}
