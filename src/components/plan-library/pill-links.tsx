import Link from "next/link";

import { cn } from "@/lib/cn";

/** Flikar som länkar, så att varje flik har en egen adress. */
export function PillLinks({
  items,
  active,
  label,
}: {
  items: { key: string; label: string; href: string }[];
  active: string;
  label: string;
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.key === active ? "page" : undefined}
          className={cn(
            "rounded-md border px-2.5 py-1 text-[13px] transition-colors",
            item.key === active
              ? "border-text-subtle bg-surface-3 font-medium text-text"
              : "border-line-strong text-text-muted hover:border-text-subtle hover:text-text",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
