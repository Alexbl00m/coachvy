"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import { sections } from "@/lib/site";

export function MobileNav({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="sm"
        className="px-2"
        aria-label={open ? "Stäng meny" : "Öppna meny"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? (
          <X aria-hidden className="size-5" />
        ) : (
          <Menu aria-hidden className="size-5" />
        )}
      </Button>

      {open && (
        <div className="fixed inset-x-0 top-18 z-40 border-b border-line bg-canvas shadow-lg">
          <nav aria-label="Sidnavigering" className="flex flex-col p-4">
            {sections.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-base font-medium text-text hover:bg-surface-2"
              >
                {item.label}
              </a>
            ))}
            {!signedIn && (
              <Link
                href={routes.signIn}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-base font-medium text-accent hover:bg-surface-2"
              >
                Logga in
              </Link>
            )}
          </nav>
        </div>
      )}
    </div>
  );
}
