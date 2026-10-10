"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import {
  deleteFitnessEstimate,
  saveFitnessEstimate,
} from "@/lib/plan-library/actions";
import { raceTimeText, type FitnessEstimate } from "@/lib/plan-library/paces";
import { RACES, type RaceKey } from "@/lib/plan-library/races";
import { formatPace } from "@/lib/workouts/schema";

import { useAction } from "../use-action";

type Entry = {
  id: string;
  times: Partial<Record<RaceKey, number>>;
  note: string | null;
  createdAt: string;
  own: boolean;
};

const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));

const capital = (s: string) => `${s[0].toUpperCase()}${s.slice(1)}`;

const EMPTY: Record<RaceKey, string> = { "5K": "", "10K": "", HM: "", M: "" };

/**
 * Formuppskattningen tempona i planen räknas ur, och ett sätt att ange en
 * ny. Den nyaste gäller – ur ett test eller inskriven – och tiden närmast
 * planens lopp styr.
 */
export function FitnessCard({
  adeptId,
  editable,
  current,
  fromTests,
  measured,
  race,
  entries,
}: {
  adeptId: string;
  editable: boolean;
  current: FitnessEstimate | null;
  fromTests: FitnessEstimate | null;
  /** CS och LT2 ur testerna, i m/s. */
  measured: { cs: number | null; lt2: number | null };
  /** Loppet planen leder fram till. */
  race: RaceKey | null;
  entries: Entry[];
}) {
  const { pending, error, run } = useAction();
  const [times, setTimes] = useState(EMPTY);
  const [note, setNote] = useState("");

  return (
    <div className="space-y-4">
      {current ? (
        <>
          <dl className="grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-1.5 text-sm tabular-nums">
            {RACES.map((r) => (
              <div key={r.key} className="contents">
                <dt
                  className={
                    r.key === race ? "font-medium text-text" : "text-text-muted"
                  }
                >
                  {capital(r.name)}
                </dt>
                <dd className="text-text">
                  {raceTimeText(current.times[r.key])}
                  {current.derived.includes(r.key) && (
                    <span className="text-text-subtle"> · uträknad</span>
                  )}
                </dd>
                <dd className="text-right text-text-muted">
                  {formatPace(r.metres / current.times[r.key], "löpning")}
                </dd>
              </div>
            ))}
            {measured.cs && (
              <>
                <dt className="text-text-muted">CS</dt>
                <dd className="text-text-subtle">ur testerna</dd>
                <dd className="text-right text-text-muted">
                  {formatPace(measured.cs, "löpning")}
                </dd>
              </>
            )}
            {measured.lt2 && (
              <>
                <dt className="text-text-muted">LT2</dt>
                <dd className="text-text-subtle">ur laktattestet</dd>
                <dd className="text-right text-text-muted">
                  {formatPace(measured.lt2, "löpning")}
                </dd>
              </>
            )}
          </dl>
          <p className="text-[12px] leading-snug text-text-subtle">
            {current.source === "test"
              ? `Ur testerna och loppen, senast ${shortDate(current.date)}.`
              : `Inskriven ${shortDate(current.date)}.`}{" "}
            De uträknade tiderna kommer ur den angivna tid som ligger närmast i
            distans. En 10 km- eller halvmaratontid träffar bättre än en 5
            km-tid för de längre loppen.
          </p>
        </>
      ) : (
        <p className="text-sm text-text-muted">
          Ingen formuppskattning än. Ange en tid – ur ett lopp, ett test eller
          en ärlig gissning – så räknas tempona i passen fram. Ju närmare
          planens lopp i distans, desto bättre. Ett löptest gör samma sak.
        </p>
      )}
      <p className="text-[12px] leading-snug text-text-muted">
        Procenten i passen ligger fast. En ny tid ger nya tempon med samma
        relation till loppfarten.
      </p>

      {editable && (
        <details open={!current}>
          <summary className="cursor-pointer text-sm font-medium text-text marker:text-text-subtle">
            Ange en ny tid
          </summary>
          <form
            className="mt-3 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () => saveFitnessEstimate({ adeptId, times, note }),
                () => {
                  setTimes(EMPTY);
                  setNote("");
                },
              );
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              {RACES.map((r) => (
                <Field
                  key={r.key}
                  label={capital(r.name)}
                  htmlFor={`fitness-${r.key}`}
                  optional
                >
                  <Input
                    id={`fitness-${r.key}`}
                    inputMode="numeric"
                    placeholder={r.example}
                    value={times[r.key]}
                    onChange={(e) =>
                      setTimes((t) => ({ ...t, [r.key]: e.target.value }))
                    }
                  />
                </Field>
              ))}
            </div>
            <Field label="Anteckning" htmlFor="fitness-note" optional>
              <Input
                id="fitness-note"
                placeholder="Testlopp, avstämning vecka 12 …"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" size="sm" disabled={pending}>
                Spara
              </Button>
              {error && (
                <span role="alert" className="text-[13px] text-warn">
                  {error}
                </span>
              )}
            </div>
          </form>
        </details>
      )}

      {(entries.length > 0 || fromTests) && (
        <details>
          <summary className="cursor-pointer text-sm font-medium text-text marker:text-text-subtle">
            Tidigare
          </summary>
          <ul className="mt-2 space-y-1.5 text-[13px] tabular-nums">
            {fromTests && (
              <li className="text-text-muted">
                {shortDate(fromTests.date)} · test: 5 km{" "}
                {raceTimeText(fromTests.times["5K"])}
              </li>
            )}
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-2 text-text-muted"
              >
                <span className="min-w-0 flex-1">
                  {shortDate(e.createdAt)} ·{" "}
                  {RACES.filter((r) => e.times[r.key])
                    .map((r) => `${r.name} ${raceTimeText(e.times[r.key]!)}`)
                    .join(", ")}
                  {e.note ? ` · ${e.note}` : ""}
                </span>
                {editable && e.own && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    aria-label="Ta bort tiden"
                    onClick={() =>
                      run(() => deleteFitnessEstimate({ adeptId, id: e.id }))
                    }
                  >
                    <Trash2 aria-hidden className="size-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
