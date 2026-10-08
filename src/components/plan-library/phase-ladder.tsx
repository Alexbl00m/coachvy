import { cn } from "@/lib/cn";
import { SPECIFICITY_LABEL } from "@/lib/plan-library/labels";

/**
 * Faserna som en trappa: varje steg lika brett som fasen är lång, lika högt
 * som den är specifik. Från ospecifikt till specifikt syns som en trappa
 * uppåt mot målet.
 */
export function PhaseLadder({
  phases,
  className,
  showLabels = true,
}: {
  phases: {
    id: string;
    name: string;
    weeks: number;
    specificity: number | null;
  }[];
  className?: string;
  showLabels?: boolean;
}) {
  return (
    <div className={cn("w-full", className)}>
      <div
        role="img"
        aria-label={`Faser: ${phases
          .map(
            (p) =>
              `${p.name}, ${p.weeks} ${p.weeks === 1 ? "vecka" : "veckor"}${p.specificity ? `, ${SPECIFICITY_LABEL[p.specificity].toLowerCase()}` : ""}`,
          )
          .join("; ")}`}
        className="flex h-10 items-end gap-0.5"
      >
        {phases.map((p, i) => (
          <span
            key={p.id}
            className="rounded-t-[3px] bg-accent"
            style={{
              flex: `${Math.max(1, p.weeks)} 1 0`,
              height: `${((p.specificity ?? i + 1) / 5) * 100}%`,
              // Tydligare ju mer specifik fasen är.
              opacity: 0.35 + 0.13 * (p.specificity ?? i + 1),
            }}
          />
        ))}
      </div>
      {showLabels && (
        <div className="mt-1.5 flex gap-0.5">
          {phases.map((p) => (
            <span
              key={p.id}
              className="min-w-0 truncate text-[11px] text-text-subtle"
              style={{ flex: `${Math.max(1, p.weeks)} 1 0` }}
            >
              {p.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
