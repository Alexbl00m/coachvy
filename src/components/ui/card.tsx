import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Tre nivåer av kort, så att ögat får en startpunkt:
 *
 * - `lead` – det sidan handlar om: ljusare yta och tydligare kant. Högst ett
 *   eller två per sida.
 * - `default` – stöd och detaljer.
 * - `flat` – listor och metadata utan egen ram, inne i ett annat kort eller
 *   direkt på sidan.
 */
export type CardLevel = "lead" | "default" | "flat";

const LEVELS: Record<CardLevel, string> = {
  lead: "lift rounded-lg border border-line-strong bg-surface-2 p-5 sm:p-7",
  default: "lift rounded-lg border border-line bg-surface p-5 sm:p-7",
  flat: "",
};

export function Card({
  children,
  className,
  level = "default",
}: {
  children: ReactNode;
  className?: string;
  level?: CardLevel;
}) {
  return <div className={cn(LEVELS[level], className)}>{children}</div>;
}

/** Kortets rubrik i sans, med en åtgärd till höger: "Veckan", "Perioder". */
export function CardTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <h2 className="text-[1.0625rem] font-semibold tracking-[-0.01em] text-text">
        {children}
      </h2>
      {action}
    </div>
  );
}

/**
 * Kortets etikett i versaler – "FASEN NU", "INCHECKNING" – med något kort
 * till höger, för kort som har en rubrik i serif under sig.
 */
export function CardLabel({
  children,
  aside,
  as: Tag = "h2",
  className,
}: {
  children: ReactNode;
  aside?: ReactNode;
  as?: "h2" | "h3" | "p";
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4", className)}>
      <Tag className="eyebrow text-text-subtle">{children}</Tag>
      {aside && (
        <span className="text-[0.8125rem] text-text-muted tabular-nums">
          {aside}
        </span>
      )}
    </div>
  );
}

/** Kortets påstående i serif: "Övergång", "Inget mål inlagt än." */
export function CardHeadline({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "headline mt-3 text-[clamp(1.75rem,1.4rem+1vw,2.25rem)] leading-[1.05] text-text",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong px-6 py-10 sm:px-8">
      {icon && <div className="mb-4 text-text-muted">{icon}</div>}
      <p className="headline text-[1.75rem] leading-[1.1] text-text">{title}</p>
      <p className="mt-3 max-w-md text-[0.9375rem] leading-relaxed text-text-muted">
        {description}
      </p>
      {action && <div className="mt-6 flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}
