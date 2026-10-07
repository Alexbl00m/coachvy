import { cn } from "@/lib/cn";
import type { ProfileBlock } from "@/lib/workouts/blocks";
import { ZONE_NAMES, zoneColor } from "@/lib/workouts/intensity";
import { formatDuration } from "@/lib/workouts/schema";

/**
 * Passets profil i miniatyr, för listor och kalendern.
 *
 * Byggd med flexbox i stället för SVG: blocken växer i proportion till sin
 * tid och mellanrummet mellan dem är exakt en pixel oavsett bredd, utan att
 * något behöver mätas. Den kan därför ritas på servern.
 */
export function WorkoutStrip({
  blocks,
  className,
}: {
  blocks: ProfileBlock[];
  className?: string;
}) {
  if (blocks.length === 0) return null;

  const top = Math.max(110, ...blocks.map((b) => b.percent));
  const total = blocks.reduce((sum, b) => sum + b.seconds, 0);
  const hardest = blocks.reduce((max, b) => (b.zone > max.zone ? b : max));

  return (
    // Ett span och inte en div: remsan står ofta inne i en länk med text.
    <span
      role="img"
      aria-label={`Profil: ${blocks.length} steg på ${formatDuration(total)}, som hårdast ${ZONE_NAMES[hardest.zone].toLowerCase()}`}
      className={cn("flex h-8 items-end gap-px", className)}
    >
      {blocks.map((block, index) => (
        <span
          key={index}
          className="min-w-0 rounded-t-[2px]"
          style={{
            flex: `${block.seconds} 1 0`,
            // Även vila och nedvarvning ska synas som ett block.
            height: `${Math.max(10, (block.percent / top) * 100)}%`,
            backgroundColor: zoneColor(block.zone),
          }}
        />
      ))}
    </span>
  );
}
