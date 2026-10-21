"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { LogOut, Menu, X } from "lucide-react";

import { AdeptBottomNav, AdeptSectionNav } from "@/components/adept-nav";
import { AppSidebar } from "@/components/app-sidebar";
import {
  CommandPalette,
  type PaletteAdept,
} from "@/components/command-palette";
import { Logo } from "@/components/logo";
import { NewMenu } from "@/components/new-menu";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { cn } from "@/lib/cn";
import { routes } from "@/lib/routes";
import type { AccountRole } from "@/lib/types/database";

export type AppShellUser = {
  name: string;
  email: string;
  role: AccountRole | null;
  roleLabel: string;
  isAdmin?: boolean;
  /** Adeptkontots egen adeptrad, för länkarna till adeptens egna sidor. */
  adeptId?: string | null;
  /** Coachens adepter, för sökningen. */
  adepts?: PaletteAdept[];
};

export function AppShell({
  user,
  children,
}: {
  user: AppShellUser;
  children: ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Adepten har en egen app: fem avsnitt i en bottenrad på telefonen i
  // stället för en meny bakom en knapp.
  const adept = user.role === "adept";
  const adeptId = user.adeptId ?? null;

  const initials = user.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-15 shrink-0 items-center gap-3 border-b border-ink-800 bg-ink-900/95 px-4 backdrop-blur">
        {!adept && (
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
        )}

        <Link
          href={routes.dashboard}
          className="rounded-md focus-visible:outline-offset-4"
        >
          <Logo />
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <CommandPalette
            role={user.role}
            isAdmin={user.isAdmin}
            ownAdeptId={adeptId}
            adepts={user.adepts}
          />
          {!adept && <NewMenu />}

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
          <AppSidebar
            role={user.role}
            isAdmin={user.isAdmin}
            adeptId={adeptId}
          />
        </aside>

        {/* Menyn ligger kvar i sidan, så att den kan glida både in och ut från
            vänster – samma kant som knappen. Stängd är den `inert`: varken
            klickbar, fokuserbar eller synlig för skärmläsare. */}
        {!adept && (
          <div
            data-open={mobileNavOpen}
            inert={!mobileNavOpen}
            className="group pointer-events-none fixed inset-0 top-15 z-20 data-[open=true]:pointer-events-auto lg:hidden"
          >
            <button
              type="button"
              aria-label="Stäng meny"
              tabIndex={-1}
              className="absolute inset-0 bg-ink-950/70 opacity-0 transition-opacity duration-200 ease-out group-data-[open=true]:opacity-100"
              onClick={() => setMobileNavOpen(false)}
            />
            <aside className="relative h-full w-64 -translate-x-full border-r border-ink-800 bg-ink-900 transition-transform duration-200 ease-drawer group-data-[open=true]:translate-x-0 group-data-[open=true]:duration-240 motion-reduce:translate-x-0 motion-reduce:opacity-0 motion-reduce:transition-opacity motion-reduce:duration-150 motion-reduce:group-data-[open=true]:opacity-100">
              {/* Closing on navigation keeps the drawer off the next page. */}
              <AppSidebar
                role={user.role}
                isAdmin={user.isAdmin}
                onNavigate={() => setMobileNavOpen(false)}
              />
            </aside>
          </div>
        )}

        <main
          className={cn(
            "min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8",
            // Plats för bottenraden och hemindikatorn under sista innehållet.
            adept && "pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-6",
          )}
        >
          <div className="mx-auto w-full max-w-6xl">
            {adept && <AdeptSectionNav adeptId={adeptId} />}
            {children}
          </div>
        </main>
      </div>

      {adept && <AdeptBottomNav adeptId={adeptId} />}
    </div>
  );
}
