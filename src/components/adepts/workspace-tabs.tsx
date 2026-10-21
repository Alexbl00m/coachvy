"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

export type WorkspaceTab = {
  href: string;
  label: string;
  /** Räknare efter etiketten, som olästa meddelanden. */
  count?: number;
  /** Fliken är vald bara på exakt den här adressen, inte under den. */
  exact?: boolean;
};

const isActive = (pathname: string, tab: WorkspaceTab) =>
  tab.exact
    ? pathname === tab.href
    : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

/**
 * Flikarna i adeptens arbetsyta. Valet följer adressen, så att en undervy –
 * Tester › Progression – håller fliken Tester markerad.
 */
export function WorkspaceTabs({
  tabs,
  label,
}: {
  tabs: WorkspaceTab[];
  label: string;
}) {
  const pathname = usePathname();
  return (
    <nav
      aria-label={label}
      // Sju flikar får inte plats på en telefon. Raden scrollar i sidled i
      // stället för att skjuta ut hela sidan – en sida som går att dra
      // vågrätt känns trasig, en flikrad som gör det är en känd gest.
      // Fast under sidhuvudet, så att flikarna finns kvar på långa sidor.
      className="sticky top-15 z-20 mb-6 flex gap-1 overflow-x-auto border-b border-line bg-canvas [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab) => {
        const active = isActive(pathname, tab);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm transition-colors",
              active
                ? "border-accent font-medium text-text"
                : "border-transparent text-text-muted hover:text-text",
            )}
          >
            {tab.label}
            {tab.count ? (
              <span className="ml-1.5 rounded-full bg-surface-3 px-1.5 py-0.5 text-[11px] font-medium text-text tabular-nums">
                {tab.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Undervyerna i en flik – Säsong · Pass · Planbiblioteket – som en rad små
 * knappar under flikraden.
 */
export function WorkspaceSubnav({
  items,
  label,
}: {
  items: WorkspaceTab[];
  label: string;
}) {
  const pathname = usePathname();
  // Den längsta adressen som passar vinner, så att Tester inte också är vald
  // på Tester › Progression.
  const active = items
    .filter((item) => isActive(pathname, { ...item, exact: false }))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return (
    <nav
      aria-label={label}
      // Fast under flikraden (41 px hög), med samma bakgrund som sidan.
      className="sticky top-[calc(3.75rem+41px)] z-10 -mt-6 mb-4 flex gap-1 overflow-x-auto bg-canvas py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map((item) => {
        const current = item.href === active?.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] transition-colors",
              current
                ? "bg-surface-3 font-medium text-text"
                : "text-text-muted hover:bg-surface-2 hover:text-text",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
