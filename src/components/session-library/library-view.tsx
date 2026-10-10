"use client";

import { useMemo, useState } from "react";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";

import { useAction } from "@/components/plan-library/use-action";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { routes } from "@/lib/routes";
import {
  copyLibrarySession,
  deleteLibrarySession,
} from "@/lib/session-library/actions";
import {
  LIBRARY_SPORTS,
  type LibraryInput,
  type LibrarySession,
} from "@/lib/session-library/library";
import { TRAINING_PHASES } from "@/lib/tests/phases";

import { LibraryCard } from "./library-card";
import { emptyLibraryInput, inputOf, SessionEditor } from "./session-editor";

type Owner = "alla" | "mina" | "delade";

const matches = (s: LibrarySession, q: string) =>
  !q ||
  [s.title, s.kind, s.intensity, s.purpose, s.structure]
    .join(" ")
    .toLowerCase()
    .includes(q);

/**
 * Biblioteket med sök och filter. Ett pass öppnas i passbyggaren för en
 * adept med ett vanligt formulär, så att länken går att spara.
 */
export function LibraryView({
  sessions,
  adepts,
  isAdmin,
}: {
  sessions: LibrarySession[];
  /** Coachens adepter; tom för en admin utan egna adepter. */
  adepts: { id: string; full_name: string }[];
  isAdmin: boolean;
}) {
  const [query, setQuery] = useState("");
  const [sport, setSport] = useState("alla");
  const [phase, setPhase] = useState("alla");
  const [owner, setOwner] = useState<Owner>("alla");
  const [editing, setEditing] = useState<{
    key: string;
    id: string | null;
    initial: LibraryInput;
  } | null>(null);
  const { pending, error, run } = useAction();

  const hasShared = sessions.some((s) => !s.own);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions.filter(
      (s) =>
        matches(s, q) &&
        (sport === "alla" || s.sport === sport) &&
        (phase === "alla" || s.phases.includes(phase as never)) &&
        (owner === "alla" || (owner === "mina" ? s.own : !s.own)),
    );
  }, [sessions, query, sport, phase, owner]);

  const openNew = () =>
    setEditing({
      key: `ny-${Date.now()}`,
      id: null,
      initial: emptyLibraryInput(sport === "alla" ? "löpning" : (sport as never)),
    });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label htmlFor="bib-sok" className="sr-only">
            Sök
          </label>
          <Input
            id="bib-sok"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sök på namn, syfte eller struktur"
          />
        </div>
        <label className="sr-only" htmlFor="bib-gren">
          Gren
        </label>
        <Select
          id="bib-gren"
          value={sport}
          onChange={(e) => setSport(e.target.value)}
          className="sm:w-auto"
        >
          <option value="alla">Alla grenar</option>
          {LIBRARY_SPORTS.map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </Select>
        <label className="sr-only" htmlFor="bib-fas">
          Fas
        </label>
        <Select
          id="bib-fas"
          value={phase}
          onChange={(e) => setPhase(e.target.value)}
          className="sm:w-auto"
        >
          <option value="alla">Alla faser</option>
          {TRAINING_PHASES.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </Select>
        {hasShared && (
          <>
            <label className="sr-only" htmlFor="bib-agare">
              Visa
            </label>
            <Select
              id="bib-agare"
              value={owner}
              onChange={(e) => setOwner(e.target.value as Owner)}
              className="sm:w-auto"
            >
              <option value="alla">Mina och delade</option>
              <option value="mina">Bara mina</option>
              <option value="delade">Bara delade</option>
            </Select>
          </>
        )}
        <Button onClick={openNew}>
          <Plus aria-hidden className="size-4" />
          Nytt pass
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-warn">
          {error}
        </p>
      )}

      {sessions.length === 0 ? (
        <EmptyState
          title="Biblioteket är tomt"
          description="Lägg in de kvalitetsformat du återkommer till – med syfte och hur de byggs på – så hämtar du dem till planmallar och till adepter i passbyggaren."
          action={<Button onClick={openNew}>Lägg in första passet</Button>}
        />
      ) : shown.length === 0 ? (
        <p className="text-sm text-text-muted">Inga pass matchar filtret.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((s) => (
            <li key={s.id}>
              <LibraryCard
                session={s}
                actions={
                  <>
                    {s.own && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          setEditing({ key: s.id, id: s.id, initial: inputOf(s) })
                        }
                      >
                        <Pencil aria-hidden className="size-3.5" />
                        Ändra
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => run(() => copyLibrarySession(s.id))}
                    >
                      <Copy aria-hidden className="size-3.5" />
                      {s.own ? "Kopiera" : "Kopiera till mina"}
                    </Button>
                    {s.own && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => {
                          if (!confirm(`Ta bort ${s.title} ur biblioteket?`)) return;
                          run(() => deleteLibrarySession(s.id));
                        }}
                      >
                        <Trash2 aria-hidden className="size-3.5" />
                        Ta bort
                      </Button>
                    )}
                    {adepts.length > 0 && (
                      <form
                        action={routes.workoutBuilder}
                        className="flex w-full items-center gap-1.5"
                      >
                        <input type="hidden" name="bibliotek" value={s.id} />
                        <label className="sr-only" htmlFor={`adept-${s.id}`}>
                          Adept
                        </label>
                        <Select
                          id={`adept-${s.id}`}
                          name="adept"
                          required
                          defaultValue=""
                          className="h-8 min-w-0 flex-1 py-0 text-[13px]"
                        >
                          <option value="" disabled>
                            Adept…
                          </option>
                          {adepts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.full_name}
                            </option>
                          ))}
                        </Select>
                        <Button
                          type="submit"
                          size="sm"
                          variant="secondary"
                          className="shrink-0 whitespace-nowrap"
                        >
                          Till passbyggaren
                        </Button>
                      </form>
                    )}
                  </>
                }
              />
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <SessionEditor
          key={editing.key}
          open
          onClose={() => setEditing(null)}
          sessionId={editing.id}
          initial={editing.initial}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
