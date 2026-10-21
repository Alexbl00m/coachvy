import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";

export type ActionItem = {
  href: string;
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Kort läge till höger, som "Klar i dag" eller ett antal. */
  status?: string;
  /** Läget är något som väntar på adepten. */
  pending?: boolean;
};

/**
 * Stora rader att trycka på, en per sak att göra – gjorda för tummen, med
 * hela raden som yta.
 */
export function ActionList({
  items,
  label,
}: {
  items: ActionItem[];
  label?: string;
}) {
  return (
    <ul
      aria-label={label}
      className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface"
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex min-h-16 items-center gap-3.5 px-4 py-3 transition-colors hover:bg-surface-2 [-webkit-tap-highlight-color:transparent]"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-2 text-text-muted">
                <Icon aria-hidden className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium text-text">
                  {item.title}
                </span>
                {item.description && (
                  <span className="block text-[13px] leading-snug text-text-muted">
                    {item.description}
                  </span>
                )}
                {item.status && (
                  <span
                    className={cn(
                      "mt-1 block text-[12px] tabular-nums",
                      item.pending
                        ? "font-medium text-warn"
                        : "text-text-subtle",
                    )}
                  >
                    {item.status}
                  </span>
                )}
              </span>
              <ChevronRight
                aria-hidden
                className="size-4 shrink-0 text-text-subtle"
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
