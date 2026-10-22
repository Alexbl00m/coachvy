"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";
import {
  activeHref as findActive,
  activeItem,
  getNavSections,
  hrefsOf,
} from "@/lib/nav";

/**
 * Adeptens fem avsnitt som en fast rad i botten av telefonen – inom tummens
 * räckhåll, alltid synlig. Raden lämnar plats för hemindikatorn med
 * `safe-area-inset-bottom`.
 */
export function AdeptBottomNav({ adeptId }: { adeptId: string | null }) {
  const pathname = usePathname();
  const sections = getNavSections("adept", false, adeptId);
  const items = sections.flatMap((s) => s.items);
  const active = activeItem(sections, pathname);

  return (
    <nav
      aria-label="Huvudmeny"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {items.map((item) => {
          const current = item === active;
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex h-15 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium transition-colors [-webkit-tap-highlight-color:transparent]",
                  current ? "text-text" : "text-text-subtle hover:text-text",
                )}
              >
                <Icon
                  aria-hidden
                  className={cn("size-5", current && "text-accent")}
                />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Undersidorna i avsnittet adepten står i – Kalender · Min plan · Säsong –
 * överst på sidan i telefonen. På datorn står de i sidomenyn i stället.
 */
export function AdeptSectionNav({ adeptId }: { adeptId: string | null }) {
  const pathname = usePathname();
  const sections = getNavSections("adept", false, adeptId);
  const item = activeItem(sections, pathname);
  const current = findActive(sections, pathname);
  const children = item?.children ?? [];
  // Navsidorna Logga och Mer listar själva sina undersidor.
  if (
    children.length < 2 ||
    (current === item?.href && !children.some((c) => c.href === current))
  )
    return null;

  return (
    <nav
      aria-label={item?.label}
      // Fast under sidhuvudet, så att undersidorna finns kvar vid scroll.
      className="sticky top-15 z-20 -mt-6 mb-4 flex gap-1 overflow-x-auto bg-canvas py-2 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden"
    >
      {children.map((child) => {
        const selected = hrefsOf(child).includes(current ?? "");
        return (
          <Link
            key={child.href}
            href={child.href}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-[0.8125rem] transition-colors",
              selected
                ? "bg-surface-3 font-medium text-text"
                : "text-text-muted hover:bg-surface-2 hover:text-text",
            )}
          >
            {child.label}
          </Link>
        );
      })}
    </nav>
  );
}
