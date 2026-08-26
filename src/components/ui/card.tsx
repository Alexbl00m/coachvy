import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-ink-800 bg-ink-850 p-5 sm:p-6",
        className,
      )}
    >
      {children}
    </div>
  );
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
      <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-ink-300">
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
    <div className="rounded-lg border border-dashed border-ink-700 bg-ink-850/50 px-6 py-12 text-center">
      <p className="text-sm font-medium text-ink-100">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-400">{description}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
