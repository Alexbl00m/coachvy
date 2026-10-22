"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus } from "lucide-react";

import {
  datesFor,
  RepeatPicker,
  repeatFor,
  type Repeat,
} from "@/components/calendar/repeat-picker";
import { Button, ButtonLink } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Field, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { routes } from "@/lib/routes";
import {
  longDate,
  shortDate,
  todayIso,
  weekdayName,
} from "@/lib/season/season";
import {
  amountText,
  levelOf,
  type LibraryLevelKey,
  type LibrarySession,
} from "@/lib/session-library/library";
import { scheduleLibrarySession } from "@/lib/session-library/schedule-actions";

type Done = {
  id: string;
  adeptId: string;
  adeptName: string;
  date: string;
  /** Alla datum, när passet lades in återkommande. */
  dates: string[];
  level: LibraryLevelKey | null;
  note: string | null;
};

/**
 * Ett pass ur biblioteket rakt in i en adepts kalender: adept, nivå och
 * datum, sedan sparas passet omräknat mot adeptens värden. Den som vill
 * justera stegen först öppnar det i passbyggaren härifrån.
 */
export function ScheduleDialog({
  session,
  onClose,
  adepts,
  initialLevel = null,
  initialAdeptId = null,
  initialDate = null,
}: {
  /** Passet; null stänger dialogen. */
  session: LibrarySession | null;
  onClose: () => void;
  adepts: { id: string; full_name: string }[];
  initialLevel?: LibraryLevelKey | null;
  /** Låser adepten, som från kalendern när en adept redan är vald. */
  initialAdeptId?: string | null;
  initialDate?: string | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adeptId, setAdeptId] = useState(
    initialAdeptId ?? (adepts.length === 1 ? adepts[0].id : ""),
  );
  const [level, setLevel] = useState<LibraryLevelKey | null>(initialLevel);
  const [date, setDate] = useState(initialDate ?? todayIso());
  const [repeat, setRepeat] = useState<Repeat>(() =>
    repeatFor(initialDate ?? todayIso()),
  );
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  const open = session !== null;
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  if (!session) {
    return <dialog ref={ref} onClose={onClose} />;
  }

  const hasLevels = session.levels.length > 0;
  const chosen = hasLevels ? (level ?? "B") : null;
  const locked = initialAdeptId !== null;
  const adeptName = adepts.find((a) => a.id === adeptId)?.full_name ?? "";
  const dates = datesFor(date, repeat);

  const builderHref = () => {
    const params = new URLSearchParams({
      adept: adeptId,
      bibliotek: session.id,
    });
    if (chosen) params.set("niva", chosen);
    return `${routes.workoutBuilder}?${params.toString()}`;
  };

  const submit = () => {
    if (!adeptId) {
      setError("Välj en adept.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await scheduleLibrarySession({
        libraryId: session.id,
        adeptId,
        level: chosen,
        date,
        dates,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone({
        id: result.id,
        adeptId,
        adeptName,
        date: dates[0] ?? date,
        dates,
        level: chosen,
        note: result.note,
      });
      router.refresh();
    });
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="schema-rubrik"
      // Synlig överkant: datumväljarens kalender får sticka ut nedanför.
      className="m-auto w-[min(30rem,calc(100vw-2rem))] overflow-visible rounded-lg border border-line bg-surface p-0 text-text shadow-2xl backdrop:bg-black/60"
    >
      <div className="space-y-4 p-5 sm:p-6">
        <div>
          <p className="text-[0.75rem] font-medium text-text-muted">
            Lägg i kalendern
          </p>
          <h2 id="schema-rubrik" className="text-lg font-semibold">
            {session.title}
          </h2>
        </div>

        {done ? (
          <div className="space-y-3">
            <p role="status" className="text-sm text-text">
              {done.dates.length > 1
                ? `Inlagt för ${done.adeptName}: ${done.dates.length} pass, ${weekdayName(done.date)} ${shortDate(done.date)} till ${weekdayName(done.dates[done.dates.length - 1])} ${shortDate(done.dates[done.dates.length - 1])}`
                : `Inlagt för ${done.adeptName}, ${weekdayName(done.date)} ${longDate(done.date, todayIso())}`}
              {done.level ? `, nivå ${done.level}` : ""}.
            </p>
            {done.note && (
              <p className="text-[0.8125rem] text-text-muted">{done.note}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <ButtonLink
                href={`${routes.calendar}?adept=${done.adeptId}&manad=${done.date.slice(0, 7)}&dag=${done.date}`}
                size="sm"
                className="font-semibold"
              >
                Visa i kalendern
              </ButtonLink>
              <ButtonLink
                href={`${routes.adepts}/${done.adeptId}/pass/${done.id}`}
                size="sm"
                variant="secondary"
              >
                Öppna passet
              </ButtonLink>
              <Button size="sm" variant="ghost" onClick={() => setDone(null)}>
                Lägg in igen
              </Button>
              <Button size="sm" variant="ghost" onClick={onClose}>
                Stäng
              </Button>
            </div>
          </div>
        ) : (
          <>
            {hasLevels && (
              <div className="space-y-1.5">
                <p className="text-[0.8125rem] font-medium">Nivå</p>
                <div
                  role="group"
                  aria-label="Nivå"
                  className="grid grid-cols-3 gap-1.5"
                >
                  {session.levels.map((l) => (
                    <button
                      key={l.key}
                      type="button"
                      aria-pressed={l.key === chosen}
                      onClick={() => setLevel(l.key)}
                      className={cn(
                        "rounded-md border px-2 py-1.5 text-left transition-colors",
                        l.key === chosen
                          ? "border-accent bg-accent-soft"
                          : "border-line hover:border-line-strong",
                      )}
                    >
                      <span className="block text-[0.8125rem] font-medium">
                        Nivå {l.key}
                      </span>
                      <span className="block text-[0.6875rem] text-text-muted tabular-nums">
                        {amountText(levelOf(session, l.key).blocks)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Adept" htmlFor="schema-adept">
                {locked ? (
                  <p
                    id="schema-adept"
                    className="rounded-md border border-line px-3 py-2 text-sm"
                  >
                    {adeptName}
                  </p>
                ) : (
                  <Select
                    id="schema-adept"
                    value={adeptId}
                    onChange={(e) => setAdeptId(e.target.value)}
                  >
                    <option value="" disabled>
                      Välj adept…
                    </option>
                    {adepts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.full_name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Datum" htmlFor="schema-datum">
                <DatePicker id="schema-datum" value={date} onChange={setDate} />
              </Field>
            </div>

            <RepeatPicker start={date} value={repeat} onChange={setRepeat} />

            <p className="text-[0.75rem] text-text-subtle">
              Zonerna räknas om mot adeptens tröskel i passets gren – löpzonerna
              mot formuppskattningen. Passet går att ändra i passbyggaren
              efteråt.
            </p>

            {error && (
              <p role="alert" className="text-sm text-bad">
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={submit}
                disabled={pending || !adeptId || dates.length === 0}
                className="font-semibold"
              >
                <CalendarPlus aria-hidden className="size-4" />
                {pending
                  ? "Lägger in…"
                  : dates.length > 1
                    ? `Lägg in ${dates.length} pass`
                    : "Lägg i kalendern"}
              </Button>
              {adeptId ? (
                <Link
                  href={builderHref()}
                  className="text-[0.8125rem] font-medium text-text underline decoration-line-strong underline-offset-2 hover:decoration-text"
                >
                  Anpassa i passbyggaren först
                </Link>
              ) : null}
              <Button variant="ghost" className="ml-auto" onClick={onClose}>
                Avbryt
              </Button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
