import { cn } from "@/lib/cn";
import { RACE_PRIORITIES } from "@/lib/season/season";
import type { RacePriority } from "@/lib/types/database";

/** A, B eller C som en liten etikett. A-loppet står ut, C är nedtonat. */
export function PriorityBadge({
  priority,
  className,
}: {
  priority: RacePriority;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-grid size-6 shrink-0 place-items-center rounded-md text-[12px] font-semibold",
        priority === "A" && "bg-text text-canvas",
        priority === "B" && "border border-line-strong text-text",
        priority === "C" &&
          "border border-dashed border-line-strong text-text-subtle",
        className,
      )}
      title={RACE_PRIORITIES.find((p) => p.key === priority)?.hint}
    >
      {priority}
    </span>
  );
}
