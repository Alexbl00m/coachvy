import { WorkoutStrip } from "@/components/workouts/workout-strip";
import { cn } from "@/lib/cn";
import { distanceText, hoursMinutes } from "@/lib/plan-library/labels";
import { templateProfile } from "@/lib/plan-library/profile";
import type { TemplateSession, Variant } from "@/lib/plan-library/types";

/** Ett pass i en vecka: namnet, tiden, zonen och profilen. */
export function SessionCard({
  session,
  variant,
  disciplineName,
  className,
}: {
  session: TemplateSession;
  variant: Variant;
  disciplineName: string;
  className?: string;
}) {
  const profile = templateProfile(variant.blocks, variant.basis);
  const facts = [
    hoursMinutes(variant.durationS),
    distanceText(variant.distanceM),
    variant.zone,
  ].filter(Boolean);
  return (
    <span className={cn("block min-w-0", className)}>
      <span className="block truncate text-[13px] font-medium text-text">
        {session.title}
      </span>
      <span className="block truncate text-[11px] text-text-subtle">
        {[disciplineName, session.type].filter(Boolean).join(" · ")}
      </span>
      {facts.length > 0 && (
        <span className="mt-0.5 block truncate text-[11px] text-text-muted tabular-nums">
          {facts.join(" · ")}
        </span>
      )}
      {profile.length > 0 && (
        <WorkoutStrip blocks={profile} className="mt-1.5 h-5" />
      )}
    </span>
  );
}
