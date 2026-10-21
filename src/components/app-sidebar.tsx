"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";
import { activeHref as findActive, getNavSections, hrefsOf } from "@/lib/nav";
import type { AccountRole } from "@/lib/types/database";

export function AppSidebar({
  role,
  isAdmin = false,
  adeptId = null,
  onNavigate,
}: {
  role: AccountRole | null;
  isAdmin?: boolean;
  adeptId?: string | null;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const navSections = getNavSections(role, isAdmin, adeptId);
  const activeHref = findActive(navSections, pathname);

  return (
    <nav
      aria-label="Huvudmeny"
      className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-5"
    >
      {navSections.map((section, index) => (
        <div key={section.title ?? `section-${index}`} className="space-y-1">
          {section.title && (
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              {section.title}
            </p>
          )}
          {section.items.map((item) => {
            // Avsnittet är öppet när man står på posten eller en undersida.
            const open = hrefsOf(item).includes(activeHref ?? "");
            const active = item.href === activeHref;
            const Icon = item.icon;

            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active || (open && item.children)
                      ? "bg-surface-3 font-medium text-text"
                      : "text-text-muted hover:bg-surface-2 hover:text-text",
                  )}
                >
                  <Icon
                    aria-hidden
                    className={cn(
                      "size-4 shrink-0",
                      open ? "text-accent" : "text-text-subtle",
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                </Link>
                {open && item.children && item.children.length > 0 && (
                  <ul className="mb-1 ml-[1.375rem] mt-1 space-y-0.5 border-l border-line pl-3">
                    {item.children.map((child) => {
                      const current = child.href === activeHref;
                      return (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            onClick={onNavigate}
                            aria-current={current ? "page" : undefined}
                            className={cn(
                              "block truncate rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                              current
                                ? "font-medium text-text"
                                : "text-text-muted hover:text-text",
                            )}
                          >
                            {child.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
