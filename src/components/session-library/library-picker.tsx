"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { routes } from "@/lib/routes";
import type { LibrarySession } from "@/lib/session-library/library";

import { LibraryCard } from "./library-card";

/**
 * Välj ett pass ur biblioteket. Används i planmallarnas passdialog; passet
 * fylls i på varje nivå och kan sedan skalas per nivå.
 */
export function LibraryPicker({
  open,
  onClose,
  sessions,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  sessions: LibrarySession[];
  onPick: (session: LibrarySession) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions.filter(
      (s) =>
        !q ||
        [s.title, s.kind, s.intensity, s.purpose, s.structure]
          .join(" ")
          .toLowerCase()
          .includes(q),
    );
  }, [sessions, query]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="bib-valj-rubrik"
      className="m-auto w-[min(52rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-0 text-text shadow-2xl backdrop:bg-black/60"
    >
      <div className="max-h-[85vh] overflow-y-auto p-5 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="bib-valj-rubrik" className="text-lg font-semibold">
              Hämta från passbiblioteket
            </h2>
            <p className="text-[13px] text-text-subtle">
              Namn, typ och struktur fylls i på varje nivå. Skala sedan
              nivåerna – samma format, olika mängd.
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Stäng
          </Button>
        </div>

        {sessions.length === 0 ? (
          <div className="space-y-3 text-sm text-text-muted">
            <p>Biblioteket är tomt.</p>
            <ButtonLink href={routes.sessionLibrary} size="sm" variant="secondary">
              Till passbiblioteket
            </ButtonLink>
          </div>
        ) : (
          <>
            <label htmlFor="bib-valj-sok" className="sr-only">
              Sök
            </label>
            <Input
              id="bib-valj-sok"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Sök på namn, syfte eller struktur"
              autoFocus
            />
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {shown.map((s) => (
                <li key={s.id}>
                  <LibraryCard
                    session={s}
                    compact
                    actions={
                      <Button
                        size="sm"
                        onClick={() => {
                          onPick(s);
                          onClose();
                        }}
                      >
                        Använd
                      </Button>
                    }
                  />
                </li>
              ))}
            </ul>
            {shown.length === 0 && (
              <p className="mt-4 text-sm text-text-muted">Inga pass matchar.</p>
            )}
          </>
        )}
      </div>
    </dialog>
  );
}
