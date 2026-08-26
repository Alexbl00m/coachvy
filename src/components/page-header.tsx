import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 pb-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-50">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-sm text-ink-300">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
