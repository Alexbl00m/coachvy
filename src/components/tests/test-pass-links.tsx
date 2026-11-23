"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { FlaskConical, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import type { Sport } from "@/lib/calculators/lactate";
import { routes } from "@/lib/routes";
import { longDate } from "@/lib/season/season";
import { formatClock } from "@/lib/activities/analysis";
import { protocolsForSport } from "@/lib/tests/protocols";
import {
  linkTestPass,
  setWorkoutTest,
  unlinkTestPass,
} from "@/lib/tests/test-pass-actions";
import type { PassRef, TestRef } from "@/lib/tests/test-pass-queries";
import { testName } from "@/lib/tests/test-passes";

const testText = (t: TestRef) =>
  `${testName(t.protocol)} · ${longDate(t.performed_on)}`;
const passText = (p: PassRef) =>
  [
    p.name,
    longDate(p.performed_on),
    p.moving_s ? formatClock(p.moving_s) : null,
  ]
    .filter(Boolean)
    .join(" · ");

function useRun() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (action: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "Det gick inte.");
      else router.refresh();
    });
  };
  return { pending, error, run };
}

/**
 * Testen ett genomfört pass hör till, på aktivitetens sida. Passet läggs i
 * ett test två veckor runt dagen, eller i ett nytt test där insatserna
 * fylls i. Samma pass kan ingå i flera test.
 */
export function ActivityTests({
  activityId,
  adeptId,
  linked,
  nearby,
  newTestHref,
  canEdit,
}: {
  activityId: string;
  adeptId: string;
  linked: TestRef[];
  nearby: TestRef[];
  newTestHref: string;
  canEdit: boolean;
}) {
  const id = useId();
  const { pending, error, run } = useRun();
  const options = nearby.filter((t) => !linked.some((l) => l.id === t.id));
  const [choice, setChoice] = useState("");

  return (
    <div className="space-y-3">
      {linked.length === 0 ? (
        <p className="text-sm text-text-muted">
          Passet är inte en del av något test.
        </p>
      ) : (
        <ul className="space-y-1">
          {linked.map((t) => (
            <li key={t.id} className="flex items-center gap-2">
              <FlaskConical
                aria-hidden
                className="size-4 shrink-0 text-text-subtle"
              />
              <Link
                href={`${routes.adepts}/${adeptId}/test/${t.id}`}
                className="min-w-0 flex-1 truncate text-sm font-medium text-accent-text hover:underline"
              >
                {testText(t)}
              </Link>
              {canEdit && (
                <button
                  type="button"
                  disabled={pending}
                  aria-label={`Ta passet ur ${testText(t)}`}
                  onClick={() =>
                    run(() =>
                      unlinkTestPass({ sessionId: t.id, activityId, adeptId }),
                    )
                  }
                  className="rounded-md p-2 text-text-subtle hover:bg-surface-2 hover:text-text"
                >
                  <X aria-hidden className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="flex flex-wrap items-end gap-2">
          {options.length > 0 && (
            <>
              <div className="min-w-0 flex-1 sm:max-w-sm">
                <label
                  htmlFor={id}
                  className="mb-1 block text-[0.8125rem] font-medium text-text"
                >
                  Lägg passet i ett test
                </label>
                <Select
                  id={id}
                  value={choice}
                  onChange={(e) => setChoice(e.target.value)}
                  className="h-9"
                >
                  <option value="">Välj test …</option>
                  {options.map((t) => (
                    <option key={t.id} value={t.id}>
                      {testText(t)}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                size="sm"
                disabled={pending || !choice}
                onClick={() =>
                  run(async () => {
                    const result = await linkTestPass({
                      sessionId: choice,
                      activityId,
                      adeptId,
                    });
                    if (result.ok) setChoice("");
                    return result;
                  })
                }
              >
                Lägg till
              </Button>
            </>
          )}
          <Link
            href={newTestHref}
            className="inline-flex h-9 items-center gap-1.5 text-[0.8125rem] font-medium text-accent-text hover:underline"
          >
            <Plus aria-hidden className="size-4" />
            Nytt test med passet
          </Link>
        </div>
      )}
      {error && (
        <p role="alert" className="text-[0.8125rem] text-warn">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Passen ett test bygger på, på testets sida. Pass samma dagar som
 * insatserna föreslås, och andra pass två veckor runt testet går att välja.
 */
export function TestPasses({
  sessionId,
  adeptId,
  linked,
  suggested,
  nearby,
  canEdit,
}: {
  sessionId: string;
  adeptId: string;
  linked: PassRef[];
  suggested: PassRef[];
  nearby: PassRef[];
  canEdit: boolean;
}) {
  const id = useId();
  const { pending, error, run } = useRun();
  const [choice, setChoice] = useState("");
  const others = nearby.filter(
    (p) =>
      !linked.some((l) => l.id === p.id) &&
      !suggested.some((s) => s.id === p.id),
  );
  const link = (activityId: string) =>
    run(() => linkTestPass({ sessionId, activityId, adeptId }));

  return (
    <div className="space-y-3">
      {linked.length === 0 ? (
        <p className="text-sm text-text-muted">
          Inga pass kopplade. Koppla passen insatserna kom ur, så syns de som
          test i kalendern och i träningen.
        </p>
      ) : (
        <ul className="space-y-1">
          {linked.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <Link
                href={`${routes.adepts}/${adeptId}/aktivitet/${p.id}`}
                className="min-w-0 flex-1 truncate text-sm text-text hover:underline"
              >
                {passText(p)}
              </Link>
              {canEdit && (
                <button
                  type="button"
                  disabled={pending}
                  aria-label={`Ta ${p.name} ur testet`}
                  onClick={() =>
                    run(() =>
                      unlinkTestPass({ sessionId, activityId: p.id, adeptId }),
                    )
                  }
                  className="rounded-md p-2 text-text-subtle hover:bg-surface-2 hover:text-text"
                >
                  <X aria-hidden className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && suggested.length > 0 && (
        <div className="rounded-md border border-line bg-surface-2/60 p-3">
          <p className="mb-2 text-[0.8125rem] font-medium text-text">
            Pass samma dagar som insatserna
          </p>
          <ul className="space-y-1.5">
            {suggested.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm text-text-muted">
                  {passText(p)}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => link(p.id)}
                >
                  Koppla
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {canEdit && others.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1 sm:max-w-sm">
            <label
              htmlFor={id}
              className="mb-1 block text-[0.8125rem] font-medium text-text"
            >
              Annat pass två veckor runt testet
            </label>
            <Select
              id={id}
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
              className="h-9"
            >
              <option value="">Välj pass …</option>
              {others.map((p) => (
                <option key={p.id} value={p.id}>
                  {passText(p)}
                </option>
              ))}
            </Select>
          </div>
          <Button
            size="sm"
            disabled={pending || !choice}
            onClick={() => {
              link(choice);
              setChoice("");
            }}
          >
            Koppla
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-[0.8125rem] text-warn">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Ett planerat pass som del av ett test: protokollet det hör till. Passet
 * syns då som test i kalendern innan det är gjort.
 */
export function WorkoutTestSelect({
  workoutId,
  adeptId,
  sport,
  protocol,
}: {
  workoutId: string;
  adeptId: string;
  sport: Sport;
  protocol: string | null;
}) {
  const id = useId();
  const { pending, error, run } = useRun();
  const [value, setValue] = useState(protocol ?? "");
  const options = protocolsForSport(sport, { includeMembersOnly: true });

  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="block text-[0.8125rem] font-medium text-text"
      >
        Del av ett test
      </label>
      <Select
        id={id}
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          run(() =>
            setWorkoutTest({ workoutId, adeptId, protocol: next || null }),
          );
        }}
        className="h-9 sm:max-w-sm"
      >
        <option value="">Nej, ett träningspass</option>
        {options.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </Select>
      {error && (
        <p role="alert" className="text-[0.8125rem] text-warn">
          {error}
        </p>
      )}
    </div>
  );
}
