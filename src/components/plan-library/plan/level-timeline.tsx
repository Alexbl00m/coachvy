import { cn } from "@/lib/cn";

/**
 * Nivån vecka för vecka som en rad rutor. Högre nivå är mörkare orange;
 * rutor som ändras av ett föreslaget byte får en ring.
 */
export function LevelTimeline({
  timeline,
  levels,
  currentWeek,
  changed,
  label,
}: {
  timeline: string[];
  levels: { id: string; key: string; rank: number }[];
  currentWeek: number;
  changed?: Set<number>;
  label: string;
}) {
  const maxRank = Math.max(...levels.map((l) => l.rank), 1);
  return (
    <ol aria-label={label} className="flex flex-wrap gap-1">
      {timeline.map((id, i) => {
        const level = levels.find((l) => l.id === id);
        const week = i + 1;
        const strength = level ? level.rank / maxRank : 0;
        return (
          <li
            key={week}
            title={`Vecka ${week}: ${level?.key ?? "?"}`}
            className={cn(
              "flex h-8 w-8 flex-col items-center justify-center rounded-[4px] text-[11px] leading-none tabular-nums",
              week < currentWeek && "opacity-45",
              week === currentWeek &&
                "outline outline-1 outline-offset-1 outline-text-muted",
              changed?.has(week) && "ring-2 ring-text ring-inset",
            )}
            style={{
              backgroundColor: `color-mix(in oklab, var(--accent) ${Math.round(20 + 60 * strength)}%, var(--surface-2))`,
              color: strength > 0.6 ? "var(--accent-on)" : "var(--text)",
            }}
          >
            <span className="font-semibold">{level?.key ?? "?"}</span>
            <span className="text-[9px] opacity-80">{week}</span>
          </li>
        );
      })}
    </ol>
  );
}
