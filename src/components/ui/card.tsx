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
  lead: "lift rounded-lg border border-line-strong bg-surface-2 p-5 sm:p-6",
  default: "lift rounded-lg border border-line bg-surface p-5 sm:p-6",
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

export function CardTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <h2 className="text-base font-semibold tracking-[-0.005em] text-text">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong bg-surface-2/60 px-6 py-12 text-center">
      <p className="text-sm font-medium text-text">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-text-muted">{description}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
