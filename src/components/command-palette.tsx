"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { CornerDownLeft, Search } from "lucide-react";

import { cn } from "@/lib/cn";
import {
  searchCommands,
  type Command,
  type CommandGroup,
} from "@/lib/command-search";
import { getNavSections } from "@/lib/nav";
import { adeptHref, routes, type AdeptSection } from "@/lib/routes";
import type { AccountRole } from "@/lib/types/database";

export type PaletteAdept = { id: string; name: string };

/** Adeptens flikar och undervyer, med ord att hitta dem på. */
const ADEPT_PAGES: [AdeptSection, string, string[]][] = [
  ["plan", "Säsongsplan", ["plan", "säsong", "perioder", "tävlingar"]],
  ["pass", "Pass", ["plan", "byggda pass"]],
  ["bibliotek", "Planbiblioteket", ["plan", "bibliotek"]],
  ["traning", "Lopp och aktiviteter", ["träning", "fit", "klockan"]],
  ["styrka", "Styrka", ["träning", "gym"]],
  ["tester", "Tester", ["testtillfällen", "laktat"]],
  ["progression", "Progression", ["tester", "utveckling"]],
  ["varden", "Enstaka värden", ["tester", "testresultat"]],
  ["bikefit", "Bikefit", ["sittposition", "sadelhöjd", "cykel", "video"]],
  ["maende", "Mående", ["incheckning", "återhämtning", "belastning"]],
  ["meddelanden", "Meddelanden", ["chatt"]],
  ["profil", "Profil", ["uppgifter", "inbjudan", "samtycke"]],
];

function buildCommands({
  role,
  isAdmin,
  ownAdeptId,
  adepts,
}: {
  role: AccountRole | null;
  isAdmin: boolean;
  ownAdeptId: string | null;
  adepts: PaletteAdept[];
}): Command[] {
  const out: Command[] = [];
  const seen = new Set<string>();
  for (const section of getNavSections(role, isAdmin, ownAdeptId)) {
    for (const item of section.items) {
      for (const entry of [item, ...(item.children ?? [])]) {
        if (seen.has(entry.href)) continue;
        seen.add(entry.href);
        out.push({
          id: `sida-${entry.href}`,
          group: "Sidor",
          label: entry.label,
          hint: entry === item ? undefined : item.label,
          href: entry.href,
        });
      }
    }
  }

  for (const adept of adepts) {
    out.push({
      id: `adept-${adept.id}`,
      group: "Adepter",
      label: adept.name,
      hint: "Läge",
      href: adeptHref(adept.id),
    });
    for (const [section, label, keywords] of ADEPT_PAGES) {
      out.push({
        id: `adept-${adept.id}-${section}`,
        group: "Adepter",
        label,
        hint: adept.name,
        href: adeptHref(adept.id, section),
        keywords,
        deep: true,
      });
    }
  }

  if (role === "adept") {
    if (ownAdeptId) {
      out.push({
        id: "gor-checka-in",
        group: "Handlingar",
        label: "Checka in",
        href: adeptHref(ownAdeptId, "maende"),
        keywords: ["incheckning", "mående", "logga"],
      });
    }
    out.push({
      id: "gor-styrka",
      group: "Handlingar",
      label: "Logga styrkepass",
      href: routes.strength,
      keywords: ["styrka", "gym"],
    });
  } else {
    out.push(
      {
        id: "gor-pass",
        group: "Handlingar",
        label: "Bygg ett pass",
        href: routes.workoutBuilder,
        keywords: ["passbyggare", "nytt pass"],
      },
      {
        id: "gor-adept",
        group: "Handlingar",
        label: "Lägg till adept",
        href: routes.newAdept,
        keywords: ["ny adept", "bjud in"],
      },
    );
  }
  return out;
}

const GROUP_ORDER: CommandGroup[] = ["Adepter", "Sidor", "Handlingar"];

/**
 * Sökningen i sidhuvudet: ⌘K (Ctrl+K) öppnar den var man än står. Den hittar
 * sidor, adepter och en adepts flikar – "tobias tester" – och de vanligaste
 * handlingarna. Piltangenterna väljer, Enter öppnar, Escape stänger.
 */
export function CommandPalette({
  role,
  isAdmin = false,
  ownAdeptId = null,
  adepts = [],
}: {
  role: AccountRole | null;
  isAdmin?: boolean;
  ownAdeptId?: string | null;
  adepts?: PaletteAdept[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  // Mac visar ⌘K, annat Ctrl K. Servern vet inte vilket; texten får skilja.
  const [mac] = useState(
    () =>
      typeof navigator === "undefined" ||
      /Mac|iPhone|iPad/.test(navigator.platform),
  );
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const listId = useId();

  const commands = useMemo(
    () => buildCommands({ role, isAdmin, ownAdeptId, adepts }),
    [role, isAdmin, ownAdeptId, adepts],
  );
  const results = useMemo(
    () => searchCommands(commands, query, query.trim() ? 12 : 30),
    [commands, query],
  );
  // Grupperat för visningen, men i samma ordning som piltangenterna går.
  const ordered = useMemo(
    () =>
      GROUP_ORDER.flatMap((group) => results.filter((r) => r.group === group)),
    [results],
  );

  const close = useCallback(() => {
    setOpen(false);
    trigger.current?.focus();
  }, []);

  // Tangentbordsgenvägen fungerar överallt i appen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuery("");
        setActive(0);
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Öppen: fokus i fältet och sidan bakom står still.
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);

  // Byter sidan stängs sökningen.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  const go = (command: Command | undefined) => {
    if (!command) return;
    setOpen(false);
    router.push(command.href);
  };

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, ordered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(ordered[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      // Allt i rutan nås från fältet; fokus stannar här.
      e.preventDefault();
    }
  };

  // Det valda alternativet hålls synligt när man stegar förbi kanten.
  useEffect(() => {
    if (!open) return;
    document
      .getElementById(`${listId}-${active}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open, listId]);

  const optionId = (i: number) => `${listId}-${i}`;

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => {
          setQuery("");
          setActive(0);
          setOpen(true);
        }}
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
        className="flex h-8 items-center gap-2 rounded-md border border-line-strong bg-surface-2 px-2 text-[13px] text-text-muted transition-colors hover:bg-surface-3 hover:text-text sm:w-56 sm:px-2.5"
      >
        <Search aria-hidden className="size-4 shrink-0" />
        <span className="sr-only sm:not-sr-only sm:flex-1 sm:text-left">
          Sök
        </span>
        <kbd
          suppressHydrationWarning
          className="hidden rounded border border-line-strong px-1.5 font-mono text-[11px] text-text-subtle sm:inline"
        >
          {mac ? "⌘K" : "Ctrl K"}
        </kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
          <button
            type="button"
            aria-label="Stäng sökningen"
            tabIndex={-1}
            onClick={close}
            className="enter absolute inset-0 bg-canvas/70 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Sök i Coachvy"
            className="enter-up relative w-full max-w-lg overflow-hidden rounded-xl border border-line-strong bg-surface shadow-2xl shadow-black/40"
          >
            <div className="flex items-center gap-2.5 border-b border-line px-4">
              <Search aria-hidden className="size-4 shrink-0 text-text-muted" />
              <input
                ref={input}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onInputKey}
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-activedescendant={
                  ordered.length > 0 ? optionId(active) : undefined
                }
                aria-autocomplete="list"
                placeholder={
                  adepts.length > 0
                    ? 'Sök sida eller adept – "tobias tester"'
                    : "Sök sida eller handling"
                }
                className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-text placeholder:text-text-subtle focus:outline-none focus-visible:outline-none"
              />
            </div>

            <ul
              id={listId}
              role="listbox"
              aria-label="Träffar"
              className="max-h-[min(60vh,26rem)] overflow-y-auto p-1.5"
            >
              {ordered.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-text-muted">
                  Inget som heter så. Pröva ett annat ord.
                </li>
              )}
              {ordered.map((command, i) => {
                const first = i === 0 || ordered[i - 1].group !== command.group;
                const selected = i === active;
                return (
                  <li key={command.id} role="presentation">
                    {first && (
                      <p
                        role="presentation"
                        className="px-3 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-text-subtle"
                      >
                        {command.group}
                      </p>
                    )}
                    <div
                      id={optionId(i)}
                      role="option"
                      aria-selected={selected}
                      onMouseMove={() => setActive(i)}
                      onClick={() => go(command)}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm",
                        selected ? "bg-surface-3 text-text" : "text-text",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {command.label}
                        {command.hint && (
                          <span className="ml-2 text-[13px] text-text-muted">
                            {command.hint}
                          </span>
                        )}
                      </span>
                      {selected && (
                        <CornerDownLeft
                          aria-hidden
                          className="size-3.5 shrink-0 text-text-subtle"
                        />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            <p className="flex gap-4 border-t border-line px-4 py-2 text-[12px] text-text-subtle">
              <span>↑↓ välj</span>
              <span>↵ öppna</span>
              <span>esc stäng</span>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
