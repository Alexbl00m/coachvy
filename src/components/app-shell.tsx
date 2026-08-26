"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { LayoutDashboard, LogOut, Menu, Plus, X } from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import { Logo } from "@/components/logo";
import { Button, ButtonLink } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { cn } from "@/lib/cn";
import { routes } from "@/lib/routes";
import type { AccountRole } from "@/lib/types/database";

export type AppShellUser = {
  name: string;
  email: string;
  role: AccountRole | null;
  roleLabel: string;
};

export function AppShell({
  user,
  children,
}: {
  user: AppShellUser;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const initials = user.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-15 shrink-0 items-center gap-3 border-b border-ink-800 bg-ink-900/95 px-4 backdrop-blur">
        <Button
          variant="ghost"
          size="sm"
          className="px-2 lg:hidden"
          aria-label={mobileNavOpen ? "Stäng meny" : "Öppna meny"}
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          {mobileNavOpen ? (
            <X aria-hidden className="size-5" />
          ) : (
            <Menu aria-hidden className="size-5" />
          )}
        </Button>

        <Link
          href={routes.dashboard}
          className="rounded-md focus-visible:outline-offset-4"
        >
          <Logo />
        </Link>

        <nav aria-label="Genvägar" className="ml-4 hidden items-center sm:flex">
          <Link
            href={routes.dashboard}
            aria-current={pathname === routes.dashboard ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              pathname === routes.dashboard
                ? "text-ink-50"
                : "text-ink-300 hover:text-ink-50",
            )}
          >
            <LayoutDashboard aria-hidden className="size-4" />
            Min översikt
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ButtonLink href={routes.newPlan} size="sm" className="font-semibold">
            <Plus aria-hidden className="size-4" />
            <span className="hidden sm:inline">Skapa ny plan</span>
            <span className="sr-only sm:hidden">Skapa ny plan</span>
          </ButtonLink>

          <div className="hidden items-center gap-2.5 border-l border-ink-800 pl-3 md:flex">
            <span
              aria-hidden
              className="grid size-8 place-items-center rounded-full bg-ink-800 text-[12px] font-semibold text-ink-200"
            >
              {initials || "?"}
            </span>
            <span className="leading-tight">
              <span className="block text-[13px] font-medium text-ink-100">
                {user.name}
              </span>
              <span className="block text-[11px] text-ink-400">
                {user.roleLabel}
              </span>
            </span>
          </div>

          <form action={signOut}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="px-2"
              aria-label="Logga ut"
              title="Logga ut"
            >
              <LogOut aria-hidden className="size-4" />
            </Button>
          </form>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="sticky top-15 hidden h-[calc(100vh-3.75rem)] w-64 shrink-0 border-r border-ink-800 lg:block">
          <AppSidebar role={user.role} />
        </aside>

        {mobileNavOpen && (
          <div className="fixed inset-0 top-15 z-20 lg:hidden">
            <button
              type="button"
              aria-label="Stäng meny"
              className="absolute inset-0 bg-ink-950/70"
              onClick={() => setMobileNavOpen(false)}
            />
            <aside className="relative h-full w-64 border-r border-ink-800 bg-ink-900">
              {/* Closing on navigation keeps the drawer off the next page. */}
              <AppSidebar role={user.role} onNavigate={() => setMobileNavOpen(false)} />
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
