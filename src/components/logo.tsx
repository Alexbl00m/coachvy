import { cn } from "@/lib/cn";

type LogoProps = {
  /** Hide the wordmark and render the mark only. */
  markOnly?: boolean;
  className?: string;
};

/**
 * Placeholder logo. Swap the SVG mark for the final artwork when it lands —
 * the wordmark and sizing stay the same.
 */
export function Logo({ markOnly = false, className }: LogoProps) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-md bg-accent font-bold text-[15px] tracking-tight text-accent-on"
      >
        C
      </span>
      <span
        className={cn(
          "text-[17px] font-semibold tracking-tight text-text",
          markOnly && "sr-only",
        )}
      >
        Coachvy
      </span>
    </span>
  );
}
