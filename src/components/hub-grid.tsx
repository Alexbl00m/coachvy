import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

export type HubItem = {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
};

/** Sidorna i ett avsnitt av menyn, som kort med en rad om vad de är till för. */
export function HubGrid({ items }: { items: HubItem[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              className="group flex h-full flex-col rounded-lg border border-line bg-surface p-5 transition-colors hover:border-line-strong hover:bg-surface-2 sm:p-6"
            >
              <Icon aria-hidden className="size-5 text-text-muted" />
              <h2 className="mt-3 flex items-center gap-2 text-base font-semibold text-text">
                {item.title}
                <ArrowRight
                  aria-hidden
                  className="size-4 text-text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-text"
                />
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
                {item.description}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
