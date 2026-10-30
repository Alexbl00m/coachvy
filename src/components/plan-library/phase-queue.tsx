"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { formatDate } from "@/lib/format";
import { defaultLevel } from "@/lib/plan-library/queue";
import {
  endActivePhase,
  queuePhase,
  removeQueuedPhase,
} from "@/lib/plan-library/queue-actions";
import { adeptHref, routes } from "@/lib/routes";

export type QueueItem = {
  id: string;
  title: string;
  status: "aktiv" | "kommande";
  startDate: string;
  /** Första dagen efter sista veckan. */
  endDate: string;
  weeks: number;
};

export type QueueOption = {
  versionId: string;
  title: string;
  group: string;
  minWeeks: number;
  maxWeeks: number;
  /** Högst först, med timmarna i etiketten. */
  levels: { id: string; key: string; label: string }[];
};

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * Adeptens faser i ordning: den aktiva och de som står i kö. Coachen lägger
 * till en plan sist i kön, i så många veckor planen tillåter, tar bort en
 * kommande fas och avslutar den pågående; faserna efter flyttas fram.
 */
export function PhaseQueue({
  adeptId,
  items,
  options,
  defaultStart,
  previousLevelKey,
}: {
  adeptId: string;
  items: QueueItem[];
  options: QueueOption[];
  /** Förvald start när kön är tom: i dag om det är måndag, annars nästa måndag. */
  defaultStart: string;
  /** Nivån fasen före börjar på; en ny fas förväljs på samma nivå. */
  previousLevelKey: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [versionId, setVersionId] = useState(options[0]?.versionId ?? "");
  const chosen = options.find((o) => o.versionId === versionId) ?? null;
  const [weeks, setWeeks] = useState(String(chosen?.maxWeeks ?? 4));
  const [levelId, setLevelId] = useState(
    chosen ? (defaultLevel(chosen.levels, previousLevelKey)?.id ?? "") : "",
  );
  const [startDate, setStartDate] = useState(defaultStart);

  const groups = useMemo(() => {
    const out = new Map<string, QueueOption[]>();
    for (const o of options) out.set(o.group, [...(out.get(o.group) ?? []), o]);
    return [...out.entries()];
  }, [options]);

  const last = items.at(-1);
  const startsOn = last ? last.endDate : startDate;
  const weeksNumber = Number(weeks);
  const endsOn =
    Number.isFinite(weeksNumber) && weeksNumber > 0
      ? addDays(startsOn, weeksNumber * 7 - 1)
      : null;

  const choose = (id: string) => {
    setVersionId(id);
    const o = options.find((x) => x.versionId === id);
    if (o) {
      setWeeks(String(o.maxWeeks));
      setLevelId(defaultLevel(o.levels, previousLevelKey)?.id ?? "");
    }
  };

  const run = (action: () => Promise<{ ok: true } | { ok: false; error: string }>, done?: () => void) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      done?.();
      router.refresh();
    });
  };

  return (
    <Card className="mb-6">
      <CardTitle
        action={
          !adding && options.length > 0 ? (
            <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
              <Plus aria-hidden className="size-4" />
              Lägg till fas
            </Button>
          ) : undefined
        }
      >
        Faser
      </CardTitle>

      {items.length === 0 ? (
        <p className="text-sm text-text-muted">
          Ingen plan igång. Lägg till den första fasen, en grundperiod i så
          många veckor du vill, och bygg på med nästa.
        </p>
      ) : (
        <ol className="divide-y divide-line rounded-md border border-line">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-text">{item.title}</span>
                <span className="text-[0.8125rem] text-text-muted">
                  {formatDate(item.startDate)} – {formatDate(addDays(item.endDate, -1))} ·{" "}
                  {item.weeks} veckor
                </span>
              </span>
              <span
                className={
                  item.status === "aktiv"
                    ? "text-[0.8125rem] font-medium text-accent-text"
                    : "text-[0.8125rem] text-text-subtle"
                }
              >
                {item.status === "aktiv" ? "Pågår" : "I kö"}
              </span>
              {item.status === "aktiv" && (
                <span className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem]">
                  <Link
                    href={adeptHref(adeptId, "bibliotek")}
                    className="font-medium text-accent-text hover:underline"
                  >
                    Veckoplanen
                  </Link>
                  <Link
                    href={`${routes.calendar}?adept=${adeptId}`}
                    className="font-medium text-accent-text hover:underline"
                  >
                    Se passen i kalendern
                  </Link>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      const next = items.find((i) => i.status === "kommande");
                      const message = next
                        ? `Avsluta ${item.title} nu? ${next.title} flyttas fram och börjar i dag eller närmast efter, på samma veckodag.`
                        : `Avsluta ${item.title} nu? Planens pass försvinner ur kalendern.`;
                      if (!window.confirm(message)) return;
                      run(() => endActivePhase({ adeptId, instanceId: item.id }));
                    }}
                    className="ml-auto rounded-md px-2.5 py-1.5 text-text-muted hover:bg-surface-2 hover:text-text"
                  >
                    Avsluta fasen
                  </button>
                </span>
              )}
              {item.status === "kommande" && (
                <button
                  type="button"
                  aria-label={`Ta bort ${item.title} ur kön`}
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm(`Ta bort ${item.title} ur kön? Faserna efter flyttas fram.`)) return;
                    run(() => removeQueuedPhase({ adeptId, instanceId: item.id }));
                  }}
                  className="-my-1 rounded-full p-2 text-text-subtle hover:bg-surface-2 hover:text-text"
                >
                  <X aria-hidden className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ol>
      )}

      {adding && chosen && (
        <form
          className="mt-5 space-y-4 border-t border-line pt-5"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                queuePhase({
                  adeptId,
                  versionId,
                  weeks: weeksNumber,
                  levelId,
                  startDate: last ? null : startDate,
                }),
              () => setAdding(false),
            );
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Plan" htmlFor="fas-plan">
              <Select id="fas-plan" value={versionId} onChange={(e) => choose(e.target.value)}>
                {groups.map(([group, list]) => (
                  <optgroup key={group} label={group}>
                    {list.map((o) => (
                      <option key={o.versionId} value={o.versionId}>
                        {o.title}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </Field>
            <Field
              label="Veckor"
              htmlFor="fas-veckor"
              hint={`${chosen.minWeeks}–${chosen.maxWeeks} veckor. Kortare planer kortas i den ospecifika delen.`}
            >
              <Input
                id="fas-veckor"
                type="number"
                inputMode="numeric"
                min={chosen.minWeeks}
                max={chosen.maxWeeks}
                value={weeks}
                onChange={(e) => setWeeks(e.target.value)}
              />
            </Field>
            <Field label="Nivå" htmlFor="fas-niva">
              <Select id="fas-niva" value={levelId} onChange={(e) => setLevelId(e.target.value)}>
                {chosen.levels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </Field>
            {last ? (
              <Field label="Börjar" htmlFor="fas-start" hint="Direkt efter fasen före.">
                <Input id="fas-start" value={formatDate(startsOn)} disabled readOnly />
              </Field>
            ) : (
              <Field
                label="Börjar"
                htmlFor="fas-start"
                hint="Planens veckor börjar på den här veckodagen. Måndag är förvalt."
              >
                <Input
                  id="fas-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </Field>
            )}
          </div>
          {endsOn && (
            <p className="text-[0.8125rem] text-text-muted">
              {formatDate(startsOn)} – {formatDate(endsOn)}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Lägger till …" : "Lägg till i kön"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              Avbryt
            </Button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-warn">
          {error}
        </p>
      )}
    </Card>
  );
}
