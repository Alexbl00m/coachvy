"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, Copy, Pencil, Plus, Share2, Trash2 } from "lucide-react";

import { useAction } from "@/components/plan-library/use-action";
import { ShareDialog } from "@/components/sharing/share-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import {
  copyLibrarySession,
  deleteLibrarySession,
} from "@/lib/session-library/actions";
import {
  LIBRARY_SPORTS,
  type LibraryInput,
  type LibraryLevelKey,
  type LibrarySession,
} from "@/lib/session-library/library";
import { TRAINING_PHASES } from "@/lib/tests/phases";

import { LibraryCard } from "./library-card";
import { ScheduleDialog } from "./schedule-dialog";
import { emptyLibraryInput, inputOf, SessionEditor } from "./session-editor";

type Owner = "alla" | "mina" | "andras";

const matches = (s: LibrarySession, q: string) =>
  !q ||
  [s.title, s.kind, s.intensity, s.purpose, s.adaptations, s.structure]
    .join(" ")
    .toLowerCase()
    .includes(q);

/**
 * Biblioteket med sök och filter. Coachen lägger ett pass direkt i en
 * adepts kalender, öppnar det i passbyggaren, eller delar det. En adept ser
 * det som delats med hen, och lägger det i sin egen kalender som medlem.
 */
export function LibraryView({
  sessions,
  adepts,
  isAdmin,
  self = null,
  initialQuery = "",
}: {
  sessions: LibrarySession[];
  /** Sökningen sidan öppnas med, som från granskningen. */
  initialQuery?: string;
  /** Coachens adepter; tom för en admin utan egna adepter. */
  adepts: { id: string; full_name: string }[];
  isAdmin: boolean;
  /**
   * Adepten som tittar. Utan medlemskap (`canSchedule` falskt) är passen
   * till för att läsa; coachen lägger in dem.
   */
  self?: { id: string; full_name: string; canSchedule: boolean } | null;
}) {
  const coach = self === null;
  const [query, setQuery] = useState(initialQuery);
  const [sport, setSport] = useState("alla");
  const [phase, setPhase] = useState("alla");
  const [intensity, setIntensity] = useState("alla");
  const [owner, setOwner] = useState<Owner>("alla");
  const [editing, setEditing] = useState<{
    key: string;
    id: string | null;
    initial: LibraryInput;
  } | null>(null);
  const [scheduling, setScheduling] = useState<{
    session: LibrarySession;
    level: LibraryLevelKey | null;
  } | null>(null);
  const [sharing, setSharing] = useState<LibrarySession | null>(null);
  const { pending, error, run } = useAction();

  const hasShared = sessions.some((s) => !s.own);
  // Intensiteterna som finns, i bokstavsordning – "Z1 Återhämtning" till
  // "Z5 VO₂max" hamnar då i zonordning.
  // Bara den valda grenens intensiteter: cykelns Z5 VO₂max och löpningens
  // Z5 Intervall är olika val.
  const intensities = useMemo(
    () =>
      [
        ...new Set(
          sessions
            .filter((s) => sport === "alla" || s.sport === sport)
            .map((s) => s.intensity)
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b, "sv")),
    [sessions, sport],
  );
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions.filter(
      (s) =>
        matches(s, q) &&
        (sport === "alla" || s.sport === sport) &&
        (phase === "alla" || s.phases.includes(phase as never)) &&
        (intensity === "alla" || s.intensity === intensity) &&
        (owner === "alla" || (owner === "mina" ? s.own : !s.own)),
    );
  }, [sessions, query, sport, phase, intensity, owner]);

  const openNew = () =>
    setEditing({
      key: `ny-${Date.now()}`,
      id: null,
      initial: emptyLibraryInput(
        sport === "alla" ? "löpning" : (sport as never),
      ),
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
          onChange={(e) => {
            setSport(e.target.value);
            setIntensity("alla");
          }}
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
        {intensities.length > 1 && (
          <>
            <label className="sr-only" htmlFor="bib-intensitet">
              Intensitet
            </label>
            <Select
              id="bib-intensitet"
              value={intensity}
              onChange={(e) => setIntensity(e.target.value)}
              className="sm:w-auto"
            >
              <option value="alla">Alla intensiteter</option>
              {intensities.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </Select>
          </>
        )}
        {coach && hasShared && (
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
              <option value="alla">Mina och andras</option>
              <option value="mina">Bara mina</option>
              <option value="andras">Från andra</option>
            </Select>
          </>
        )}
        {coach && (
          <Button onClick={openNew}>
            <Plus aria-hidden className="size-4" />
            Nytt pass
          </Button>
        )}
      </div>

      {self && !self.canSchedule && sessions.length > 0 && (
        <p className="text-[0.8125rem] text-text-muted">
          Din coach lägger in passen i din kalender. Att lägga in dem själv
          ingår i medlemskapet.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-warn">
          {error}
        </p>
      )}

      {sessions.length === 0 ? (
        coach ? (
          <EmptyState
            title="Biblioteket är tomt"
            description="Lägg in de kvalitetsformat du återkommer till, med syfte och hur de byggs på. Sedan hämtar du dem till planmallar och till adepter i passbyggaren."
            action={<Button onClick={openNew}>Lägg in första passet</Button>}
          />
        ) : (
          <EmptyState
            title="Inga pass än"
            description="Här hamnar passen din coach delar med dig, och passen Coachvy delar med medlemmarna."
          />
        )
      ) : shown.length === 0 ? (
        <p className="text-sm text-text-muted">Inga pass matchar filtret.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((s) => (
            <li key={s.id}>
              <LibraryCard
                session={s}
                actions={(level) => (
                  <>
                    {self?.canSchedule && (
                      <Button
                        size="sm"
                        className="font-semibold"
                        onClick={() =>
                          setScheduling({ session: s, level: level ?? null })
                        }
                      >
                        <CalendarPlus aria-hidden className="size-3.5" />
                        {level
                          ? `Nivå ${level} i min kalender`
                          : "Lägg i min kalender"}
                      </Button>
                    )}
                    {s.own && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          setEditing({
                            key: s.id,
                            id: s.id,
                            initial: inputOf(s),
                          })
                        }
                      >
                        <Pencil aria-hidden className="size-3.5" />
                        Ändra
                      </Button>
                    )}
                    {s.own && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSharing(s)}
                      >
                        <Share2 aria-hidden className="size-3.5" />
                        Dela
                      </Button>
                    )}
                    {coach && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => run(() => copyLibrarySession(s.id))}
                      >
                        <Copy aria-hidden className="size-3.5" />
                        {s.own ? "Kopiera" : "Kopiera till mina"}
                      </Button>
                    )}
                    {s.own && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => {
                          if (!confirm(`Ta bort ${s.title} ur biblioteket?`))
                            return;
                          run(() => deleteLibrarySession(s.id));
                        }}
                      >
                        <Trash2 aria-hidden className="size-3.5" />
                        Ta bort
                      </Button>
                    )}
                    {coach && adepts.length > 0 && (
                      <Button
                        size="sm"
                        className="font-semibold"
                        onClick={() =>
                          setScheduling({ session: s, level: level ?? null })
                        }
                      >
                        <CalendarPlus aria-hidden className="size-3.5" />
                        {level
                          ? `Nivå ${level} i kalendern`
                          : "Lägg i kalendern"}
                      </Button>
                    )}
                  </>
                )}
              />
            </li>
          ))}
        </ul>
      )}

      <ScheduleDialog
        key={
          scheduling ? `${scheduling.session.id}-${scheduling.level}` : "stängd"
        }
        session={scheduling?.session ?? null}
        initialLevel={scheduling?.level ?? null}
        adepts={self ? [{ id: self.id, full_name: self.full_name }] : adepts}
        initialAdeptId={self?.id ?? null}
        self={self !== null}
        onClose={() => setScheduling(null)}
      />

      {sharing && (
        <ShareDialog
          key={sharing.id}
          open
          onClose={() => setSharing(null)}
          kind="pass"
          itemId={sharing.id}
          title={sharing.title}
          shares={sharing.shares}
          adepts={adepts}
          ownerIsAdmin={isAdmin}
        />
      )}

      {editing && (
        <SessionEditor
          key={editing.key}
          open
          onClose={() => setEditing(null)}
          sessionId={editing.id}
          initial={editing.initial}
        />
      )}
    </div>
  );
}
