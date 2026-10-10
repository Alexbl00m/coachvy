"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { setPaceSource } from "@/lib/plan-library/actions";
import { raceTimeText } from "@/lib/plan-library/paces";
import type { Race } from "@/lib/plan-library/races";
import { ZONES, type ZoneKey } from "@/lib/plan-library/zones";
import { formatDuration } from "@/lib/workouts/schema";

import { useAction } from "../use-action";

type Props = {
  instanceId: string;
  editable: boolean;
  mode: "form" | "mål";
  goalSeconds: number | null;
  /** Loppet planen leder fram till; måltiden gäller det. */
  race: Race;
  /** Farten i m/s som zonerna räknas mot. Null: ingen uppskattning. */
  zoneSpeed: number | null;
  /** Zonerna planen använder, i ordning. Tom: planen står inte i zoner. */
  zones: ZoneKey[];
  /** LT2 ur laktattestet i m/s, att jämföra tröskeln med. */
  lt2: number | null;
};

const choice = (selected: boolean) =>
  cn(
    "rounded-md border px-3 py-2 text-left text-sm transition-colors",
    selected
      ? "border-text-subtle bg-surface-3 text-text"
      : "border-line-strong text-text-muted hover:border-text-subtle hover:text-text",
  );

/** Tempo per kilometer ur en fart i m/s: "4:08". */
const perKm = (speed: number) => formatDuration(1000 / speed);

/**
 * Vad tempona räknas ur – formuppskattningen eller en måltid för planens
 * lopp – och, för planer i zoner, vad zonerna blir i tempo.
 */
export function PaceSource({
  instanceId,
  editable,
  mode,
  goalSeconds,
  race,
  zoneSpeed,
  zones,
  lt2,
}: Props) {
  const { pending, error, run } = useAction();
  const [draftMode, setDraftMode] = useState(mode);
  const [goal, setGoal] = useState(
    goalSeconds ? raceTimeText(goalSeconds) : "",
  );
  const changed =
    draftMode !== mode ||
    (draftMode === "mål" &&
      goal !== (goalSeconds ? raceTimeText(goalSeconds) : ""));
  const label = `Måltid för ${race.name}`;
  const shown = ZONES.filter((z) => zones.includes(z.key));

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <button
          type="button"
          disabled={!editable}
          aria-pressed={draftMode === "form"}
          onClick={() => setDraftMode("form")}
          className={choice(draftMode === "form")}
        >
          <span className="block font-medium">Min form</span>
          <span className="block text-[12px] text-text-subtle">
            Tempona följer dina tester och tider, och ändras när de gör det.
          </span>
        </button>
        <button
          type="button"
          disabled={!editable}
          aria-pressed={draftMode === "mål"}
          onClick={() => setDraftMode("mål")}
          className={choice(draftMode === "mål")}
        >
          <span className="block font-medium">Min måltid</span>
          <span className="block text-[12px] text-text-subtle">
            Tempona räknas ur den tid du vill springa {race.name} på.
          </span>
        </button>
      </div>
      {draftMode === "mål" && (
        <label className="block text-sm text-text-muted">
          {label}
          <Input
            aria-label={label}
            inputMode="numeric"
            placeholder={race.example}
            disabled={!editable}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="mt-1"
          />
        </label>
      )}
      {editable && changed && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              run(() =>
                setPaceSource({ instanceId, mode: draftMode, goalTime: goal }),
              )
            }
          >
            Byt
          </Button>
          {error && (
            <span role="alert" className="text-[13px] text-warn">
              {error}
            </span>
          )}
        </div>
      )}
      <p className="text-[12px] leading-snug text-text-subtle">
        Procenten i passen ändras inte, bara tempona. Du kan byta när som helst.
      </p>

      {shown.length > 0 && zoneSpeed && (
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-text">Dina zoner</p>
          <ul className="divide-y divide-line rounded-md border border-line text-[13px] tabular-nums">
            {shown.map((z) => (
              <li
                key={z.key}
                className="flex items-baseline justify-between gap-3 px-3 py-1.5"
              >
                <span className="min-w-0">
                  <span className="mr-2 rounded-sm bg-surface-3 px-1 text-[11px] font-medium text-text">
                    {z.key}
                  </span>
                  <span className="text-text-muted">{z.name}</span>
                </span>
                <span className="shrink-0 text-text">
                  {z.low === z.high
                    ? perKm(zoneSpeed * z.low)
                    : `${perKm(zoneSpeed * z.high)}–${perKm(zoneSpeed * z.low)}`}
                  <span className="text-text-subtle">/km</span>
                </span>
              </li>
            ))}
            {lt2 && (
              <li className="flex items-baseline justify-between gap-3 px-3 py-1.5">
                <span className="text-text-muted">LT2 ur laktattestet</span>
                <span className="shrink-0 text-text-muted">
                  {perKm(lt2)}
                  <span className="text-text-subtle">/km</span>
                </span>
              </li>
            )}
          </ul>
          <p className="mt-1.5 text-[11px] leading-snug text-text-subtle">
            Zonerna räknas ur farten på {race.name} och är en vägledning. Lugn
            distans ska kännas lugn även när benen orkar mer.
            {lt2
              ? " Ligger LT2 långt från tröskelzonen, säg till din coach – modellen och testet ska stämma."
              : ""}
          </p>
        </div>
      )}
    </div>
  );
}
