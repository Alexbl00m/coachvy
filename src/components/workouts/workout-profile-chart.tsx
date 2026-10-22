import { cn } from "@/lib/cn";
import type { ProfileBlock } from "@/lib/workouts/blocks";
import { ZONE_NAMES, zoneColor } from "@/lib/workouts/intensity";
import { hoursMinutes } from "@/lib/plan-library/labels";

/** Avståndet mellan tidsaxelns streck, efter passets längd. */
function tickStep(totalMinutes: number) {
  if (totalMinutes <= 50) return 10;
  if (totalMinutes <= 100) return 20;
  if (totalMinutes <= 180) return 30;
  return 60;
}

/**
 * Passets profil i stort, med tidsaxel: blocken i zonernas färg, höjden efter
 * målet. Som remsan byggd med flexbox, så att den ritas på servern och
 * mellanrummen är exakta i alla bredder.
 */
export function WorkoutProfileChart({
  blocks,
  className,
}: {
  blocks: ProfileBlock[];
  className?: string;
}) {
  if (blocks.length === 0) return null;
  const top = Math.max(110, ...blocks.map((b) => b.percent));
  const total = blocks.reduce((sum, b) => sum + b.seconds, 0);
  const minutes = total / 60;
  const step = tickStep(minutes);
  const ticks: number[] = [];
  for (let t = 0; t < minutes - step * 0.6; t += step) ticks.push(t);
  const hardest = blocks.reduce((max, b) => (b.zone > max.zone ? b : max));

  return (
    <figure className={cn("min-w-0", className)}>
      <div
        role="img"
        aria-label={`Profil: ${blocks.length} steg på ${hoursMinutes(total)}, som hårdast ${ZONE_NAMES[hardest.zone].toLowerCase()}`}
        className="flex h-36 items-end gap-[3px] border-b border-line-strong sm:h-48"
      >
        {blocks.map((block, index) => (
          <span
            key={index}
            className="min-w-0 rounded-t-[4px]"
            style={{
              flex: `${block.seconds} 1 0`,
              height: `${Math.max(8, (block.percent / top) * 100)}%`,
              backgroundColor: zoneColor(block.zone),
            }}
          />
        ))}
      </div>
      <div
        aria-hidden
        className="relative mt-2.5 h-4 font-mono text-[0.75rem] text-text-subtle tabular-nums"
      >
        {ticks.map((t) => (
          <span
            key={t}
            className={cn("absolute", t > 0 && "-translate-x-1/2")}
            style={{ left: `${(t / minutes) * 100}%` }}
          >
            {t}
          </span>
        ))}
        <span className="absolute right-0">≈ {hoursMinutes(total)}</span>
      </div>
    </figure>
  );
}
