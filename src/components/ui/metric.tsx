import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

const SIZES = {
  xl: "text-[clamp(2.75rem,2rem+2.6vw,4rem)]",
  lg: "text-[clamp(2.25rem,1.8rem+1.6vw,3.25rem)]",
  md: "text-[2rem]",
  sm: "text-[1.5rem]",
} as const;

/**
 * Ett nyckeltal: etiketten i versaler, värdet stort och tunt, enheten liten i
 * mono bredvid. Värdet bär rutan; allt runt det är dämpat.
 */
export function Metric({
  label,
  value,
  unit,
  hint,
  aside,
  size = "lg",
  className,
}: {
  label?: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  /** En rad sammanhang under värdet: datum, källa. */
  hint?: ReactNode;
  /** Något kort till höger om värdet, t.ex. en förändring. */
  aside?: ReactNode;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      {label && <p className="eyebrow text-text-subtle">{label}</p>}
      <div
        className={cn("flex items-baseline gap-3", label ? "mt-2" : undefined)}
      >
        <p
          className={cn(
            "font-light leading-none tracking-[-0.035em] text-text tabular-nums",
            SIZES[size],
          )}
        >
          {value}
          {unit && <Unit>{unit}</Unit>}
        </p>
        {aside && <span className="ml-auto shrink-0">{aside}</span>}
      </div>
      {hint && (
        <p className="mt-2 truncate text-[0.8125rem] text-text-subtle">{hint}</p>
      )}
    </div>
  );
}

/** Enheten bredvid ett stort tal: "min", "W", "/km". */
export function Unit({ children }: { children: ReactNode }) {
  return (
    <span className="ml-1.5 font-mono text-[0.8125rem] font-normal tracking-normal text-text-muted">
      {children}
    </span>
  );
}

/**
 * Förändringen mot förra värdet, med pil – färgen säger aldrig något ensam.
 * `better` avgör vilket håll som är framåt (för tempo är lägre bättre).
 */
export function Delta({
  value,
  text,
  better = "up",
  className,
}: {
  value: number;
  text: string;
  better?: "up" | "down";
  className?: string;
}) {
  const good = better === "up" ? value > 0 : value < 0;
  const flat = value === 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[0.8125rem] font-medium tabular-nums",
        flat ? "text-text-muted" : good ? "text-good" : "text-bad",
        className,
      )}
    >
      <span aria-hidden>{flat ? "→" : value > 0 ? "↗" : "↘"}</span>
      {text}
    </span>
  );
}
