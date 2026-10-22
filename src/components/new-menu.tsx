"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Plus } from "lucide-react";

import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { adeptHref, routes } from "@/lib/routes";

type Entry = { href: string; label: string; hint?: string };

/** Adepten sidan gäller, ur adressen: /app/adepter/<id>/… */
function adeptInPath(pathname: string): string | null {
  const match = pathname.match(/^\/app\/adepter\/([^/]+)/);
  return match && match[1] !== "ny" ? match[1] : null;
}

function entriesFor(pathname: string): { title: string; entries: Entry[] }[] {
  const adeptId = adeptInPath(pathname);
  const general: Entry[] = [
    { href: routes.workoutBuilder, label: "Pass", hint: "Passbyggaren" },
    { href: routes.newAdept, label: "Adept" },
  ];
  if (!adeptId) return [{ title: "Ny", entries: general }];
  return [
    {
      title: "För adepten",
      entries: [
        {
          href: `${routes.workoutBuilder}?adept=${adeptId}`,
          label: "Pass",
        },
        { href: `${routes.adepts}/${adeptId}/test/nytt`, label: "Test" },
        {
          href: `${adeptHref(adeptId, "plan")}?ny=period`,
          label: "Period i säsongsplanen",
        },
        { href: adeptHref(adeptId, "styrka"), label: "Styrkepass" },
      ],
    },
    { title: "Övrigt", entries: [{ href: routes.newAdept, label: "Adept" }] },
  ];
}

/**
 * "+ Ny" i sidhuvudet, för coachen: det som går att skapa där man står. På en
 * adept gäller valen den adepten; annars de allmänna. Knappen är neutral –
 * den primära handlingen hör till sidan, inte till sidhuvudet. Adepten har
 * Logga i sin egen meny i stället.
 */
export function NewMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  // Stäng vid klick utanför och med Escape, och lämna fokus på knappen.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Byter sidan stängs menyn.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  const groups = entriesFor(pathname);

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={buttonClass({ variant: "secondary", size: "sm" })}
      >
        <Plus aria-hidden className="size-4" />
        <span className="hidden sm:inline">Ny</span>
        <span className="sr-only sm:hidden">Ny</span>
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-64 rounded-lg border border-line-strong bg-surface p-1.5 shadow-lg shadow-black/30"
        >
          {groups.map((group, i) => (
            <div
              key={group.title}
              role="group"
              aria-label={group.title}
              className={cn(i > 0 && "mt-1 border-t border-line pt-1")}
            >
              <p className="px-2.5 pb-1 pt-1.5 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-text-subtle">
                {group.title}
              </p>
              {group.entries.map((entry) => (
                <Link
                  key={entry.href}
                  href={entry.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-2.5 py-2 text-sm text-text hover:bg-surface-2 focus-visible:bg-surface-2"
                >
                  {entry.label}
                  {entry.hint && (
                    <span className="block text-[0.75rem] text-text-subtle">
                      {entry.hint}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
