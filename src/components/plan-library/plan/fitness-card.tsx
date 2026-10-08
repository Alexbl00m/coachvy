"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import {
  deleteFitnessEstimate,
  saveFitnessEstimate,
} from "@/lib/plan-library/actions";
import {
  raceTimeText,
  type FitnessEstimate,
  type ReferenceSpeeds,
} from "@/lib/plan-library/paces";
import { formatPace } from "@/lib/workouts/schema";

import { useAction } from "../use-action";

type Entry = {
  id: string;
  fiveKSeconds: number | null;
  marathonSeconds: number | null;
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

/**
 * Formuppskattningen tempona i planen räknas ur, och ett sätt att ange en
 * ny. Den nyaste gäller – ur ett test eller inskriven.
 */
export function FitnessCard({
  adeptId,
  editable,
  current,
  fromTests,
  refs,
  entries,
}: {
  adeptId: string;
  editable: boolean;
  current: FitnessEstimate | null;
  fromTests: FitnessEstimate | null;
  refs: ReferenceSpeeds;
  entries: Entry[];
}) {
  const { pending, error, run } = useAction();
  const [fiveK, setFiveK] = useState("");
  const [marathon, setMarathon] = useState("");
  const [note, setNote] = useState("");

  return (
    <div className="space-y-4">
      {current ? (
        <>
          <dl className="grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-1.5 text-sm tabular-nums">
            <dt className="text-text-muted">5 km</dt>
            <dd className="text-text">
              {raceTimeText(current.fiveKSeconds)}
              {current.derived === "5K" && (
                <span className="text-text-subtle"> · uträknad</span>
              )}
            </dd>
            <dd className="text-right text-text-muted">
              {formatPace(refs["5K"] ?? 0, "löpning")}
            </dd>
            <dt className="text-text-muted">Maraton</dt>
            <dd className="text-text">
              {raceTimeText(current.marathonSeconds)}
              {current.derived === "MP" && (
                <span className="text-text-subtle"> · uträknad</span>
              )}
            </dd>
            <dd className="text-right text-text-muted">
              {formatPace(refs.MP ?? 0, "löpning")}
            </dd>
            {refs.CS && (
              <>
                <dt className="text-text-muted">CS</dt>
                <dd className="text-text-subtle">ur testerna</dd>
                <dd className="text-right text-text-muted">
                  {formatPace(refs.CS, "löpning")}
                </dd>
              </>
            )}
            {refs.LT2 && (
              <>
                <dt className="text-text-muted">LT2</dt>
                <dd className="text-text-subtle">ur testerna</dd>
                <dd className="text-right text-text-muted">
                  {formatPace(refs.LT2, "löpning")}
                </dd>
              </>
            )}
          </dl>
          <p className="text-[12px] leading-snug text-text-subtle">
            {current.source === "test"
              ? `Ur testerna och loppen, senast ${shortDate(current.date)}.`
              : `Inskriven ${shortDate(current.date)}.`}{" "}
            {current.derived === "MP" &&
              "Maratontiden är räknad ur 5 km-tiden och brukar vara i snabbaste laget – ange en egen om du har en bättre uppskattning."}
            {current.derived === "5K" &&
              "5 km-tiden är räknad ur maratontiden."}
          </p>
        </>
      ) : (
        <p className="text-sm text-text-muted">
          Ingen formuppskattning än. Ange en 5 km-tid – ur ett lopp, ett test
          eller en ärlig gissning – så räknas tempona i passen fram. Ett löptest
          gör samma sak.
        </p>
      )}
      <p className="text-[12px] leading-snug text-text-muted">
        Procenten i passen ligger fast. Ett nytt test eller en ny tid ger nya
        tempon med samma relation till 5 km-farten och maratonfarten.
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
                () => saveFitnessEstimate({ adeptId, fiveK, marathon, note }),
                () => {
                  setFiveK("");
                  setMarathon("");
                  setNote("");
                },
              );
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="5 km" htmlFor="fitness-5k" optional>
                <Input
                  id="fitness-5k"
                  inputMode="numeric"
                  placeholder="19:45"
                  value={fiveK}
                  onChange={(e) => setFiveK(e.target.value)}
                />
              </Field>
              <Field label="Maraton" htmlFor="fitness-mp" optional>
                <Input
                  id="fitness-mp"
                  inputMode="numeric"
                  placeholder="3:15:00"
                  value={marathon}
                  onChange={(e) => setMarathon(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Anteckning" htmlFor="fitness-note" optional>
              <Input
                id="fitness-note"
                placeholder="Testlopp, avstämning vecka 10 …"
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
                {raceTimeText(fromTests.fiveKSeconds)}
              </li>
            )}
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-2 text-text-muted"
              >
                <span className="min-w-0 flex-1">
                  {shortDate(e.createdAt)} ·{" "}
                  {[
                    e.fiveKSeconds
                      ? `5 km ${raceTimeText(e.fiveKSeconds)}`
                      : null,
                    e.marathonSeconds
                      ? `maraton ${raceTimeText(e.marathonSeconds)}`
                      : null,
                  ]
                    .filter(Boolean)
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
