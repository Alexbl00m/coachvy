"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { routes } from "@/lib/routes";
import { deleteRace, saveRace } from "@/lib/season/actions";
import {
  RACE_PRIORITIES,
  RACE_SPORTS,
  countdownText,
  daysBetween,
  longDate,
  raceSportLabel,
} from "@/lib/season/season";
import type {
  AdeptRaceRow,
  RacePriority,
  RaceSport,
} from "@/lib/types/database";
import { PriorityBadge } from "./priority-badge";

type Draft = {
  id: string | null;
  name: string;
  raceDate: string;
  priority: RacePriority;
  sport: RaceSport | "";
  distance: string;
  target: string;
  note: string;
};

const empty = (sport: RaceSport | ""): Draft => ({
  id: null,
  name: "",
  raceDate: "",
  priority: "B",
  sport,
  distance: "",
  target: "",
  note: "",
});

/**
 * Tävlingarna i säsongen. Både coachen och adepten lägger till: det är
 * atletens kalender, och hen vet ofta först att ett lopp tillkommit.
 */
export function RaceEditor({
  adeptId,
  races,
  today,
  defaultSport,
  analyses = {},
}: {
  adeptId: string;
  races: AdeptRaceRow[];
  today: string;
  defaultSport: RaceSport | "";
  /** Tävlingens uppladdade lopp, när det finns ett. */
  analyses?: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);

  const upcoming = races
    .filter((r) => r.race_date >= today)
    .sort((a, b) => a.race_date.localeCompare(b.race_date));
  const past = races
    .filter((r) => r.race_date < today)
    .sort((a, b) => b.race_date.localeCompare(a.race_date));

  const save = () => {
    if (!draft) return;
    startTransition(async () => {
      setError(null);
      const result = await saveRace({
        id: draft.id,
        adeptId,
        name: draft.name,
        raceDate: draft.raceDate,
        priority: draft.priority,
        sport: draft.sport === "" ? null : draft.sport,
        distance: draft.distance,
        target: draft.target,
        note: draft.note,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDraft(null);
      router.refresh();
    });
  };

  const remove = (race: AdeptRaceRow) => {
    if (!window.confirm(`Ta bort ${race.name}?`)) return;
    startTransition(async () => {
      setError(null);
      const result = await deleteRace(race.id, adeptId);
      if (!result.ok) setError(result.error ?? "Kunde inte ta bort tävlingen.");
      router.refresh();
    });
  };

  const row = (race: AdeptRaceRow) => {
    const days = daysBetween(today, race.race_date);
    const details = [
      raceSportLabel(race.sport),
      race.distance,
      race.target ? `mål: ${race.target}` : null,
    ].filter(Boolean);
    return (
      <li key={race.id} className="flex items-start gap-3 py-3">
        <PriorityBadge priority={race.priority} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text">{race.name}</p>
          <p className="text-[12px] text-text-subtle tabular-nums">
            {longDate(race.race_date, today)} · {countdownText(days)}
          </p>
          {details.length > 0 && (
            <p className="mt-0.5 text-[13px] text-text-muted">
              {details.join(" · ")}
            </p>
          )}
          {race.note && (
            <p className="mt-0.5 text-[12px] text-text-subtle">{race.note}</p>
          )}
          {analyses[race.id] && (
            <Link
              href={`${routes.adepts}/${adeptId}/aktivitet/${analyses[race.id]}`}
              className="mt-1 inline-block text-[13px] font-medium text-accent hover:text-accent-strong"
            >
              Se loppanalysen
            </Link>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="px-2"
            aria-label={`Ändra ${race.name}`}
            disabled={pending}
            onClick={() =>
              setDraft({
                id: race.id,
                name: race.name,
                raceDate: race.race_date,
                priority: race.priority,
                sport: race.sport ?? "",
                distance: race.distance ?? "",
                target: race.target ?? "",
                note: race.note ?? "",
              })
            }
          >
            <Pencil aria-hidden className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="px-2"
            aria-label={`Ta bort ${race.name}`}
            disabled={pending}
            onClick={() => remove(race)}
          >
            <Trash2 aria-hidden className="size-4" />
          </Button>
        </div>
      </li>
    );
  };

  return (
    <Card className="min-w-0">
      <CardTitle
        action={
          !draft ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setDraft(empty(defaultSport))}
            >
              <Plus aria-hidden className="size-4" />
              Ny tävling
            </Button>
          ) : null
        }
      >
        Tävlingar
      </CardTitle>

      {upcoming.length === 0 && !draft ? (
        <p className="text-sm text-text-muted">
          Inga kommande tävlingar. Lägg in säsongens mål som A-lopp – då räknar
          översikten ned mot det, och planen kan pröva att toppningen ligger
          rätt.
        </p>
      ) : (
        <ul className="divide-y divide-line">{upcoming.map(row)}</ul>
      )}

      {past.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowPast((v) => !v)}
            className="text-[12px] text-text-subtle hover:text-text"
            aria-expanded={showPast}
          >
            {showPast ? "Dölj" : "Visa"} genomförda ({past.length})
          </button>
          {showPast && (
            <ul className="divide-y divide-line opacity-70">{past.map(row)}</ul>
          )}
        </div>
      )}

      {draft && (
        <div className="mt-4 space-y-4 rounded-md border border-line-strong bg-surface-2/60 p-4">
          <p className="text-sm font-medium text-text">
            {draft.id ? "Ändra tävlingen" : "Ny tävling"}
          </p>

          <fieldset>
            <legend className="pb-1.5 text-[13px] font-medium text-text">
              Prioritet
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {RACE_PRIORITIES.map((p) => {
                const on = draft.priority === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setDraft({ ...draft, priority: p.key })}
                    className={cn(
                      "rounded-md border px-3 py-2 text-left transition-colors",
                      on
                        ? "border-accent bg-accent-soft"
                        : "border-line-strong bg-surface hover:border-accent/60",
                    )}
                  >
                    <span className="block text-sm font-medium text-text">
                      {p.label}
                    </span>
                    <span className="block text-[11px] leading-snug text-text-subtle">
                      {p.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Namn" htmlFor="race-name">
              <Input
                id="race-name"
                value={draft.name}
                maxLength={120}
                placeholder="T.ex. Vansbrosimningen"
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>
            <Field label="Datum" htmlFor="race-date">
              <Input
                id="race-date"
                type="date"
                value={draft.raceDate}
                onChange={(e) =>
                  setDraft({ ...draft, raceDate: e.target.value })
                }
              />
            </Field>
            <Field label="Gren" htmlFor="race-sport" optional>
              <Select
                id="race-sport"
                value={draft.sport}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    sport: e.target.value as RaceSport | "",
                  })
                }
              >
                <option value="">–</option>
                {RACE_SPORTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Distans" htmlFor="race-distance" optional>
              <Input
                id="race-distance"
                value={draft.distance}
                maxLength={80}
                placeholder="T.ex. 3 km eller 1,9/90/21,1"
                onChange={(e) =>
                  setDraft({ ...draft, distance: e.target.value })
                }
              />
            </Field>
          </div>
          <Field label="Mål" htmlFor="race-target" optional>
            <Input
              id="race-target"
              value={draft.target}
              maxLength={200}
              placeholder="T.ex. under 50 minuter, eller topp 10 i klassen"
              onChange={(e) => setDraft({ ...draft, target: e.target.value })}
            />
          </Field>
          <Field label="Anteckning" htmlFor="race-note" optional>
            <Textarea
              id="race-note"
              rows={2}
              value={draft.note}
              maxLength={1000}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            />
          </Field>
          {error && (
            <p role="alert" className="text-sm text-bad">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button onClick={save} disabled={pending} className="font-semibold">
              {pending ? "Sparar…" : "Spara tävling"}
            </Button>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setDraft(null);
                setError(null);
              }}
            >
              Avbryt
            </Button>
          </div>
        </div>
      )}
      {error && !draft && (
        <p role="alert" className="mt-3 text-sm text-bad">
          {error}
        </p>
      )}
    </Card>
  );
}
