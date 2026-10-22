"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Field, Input, Select } from "@/components/ui/field";
import { deleteBlock, saveBlock } from "@/lib/season/actions";
import {
  addDays,
  blockText,
  dateRange,
  daysBetween,
  lengthText,
  longDate,
  mondayOf,
  overlapping,
  shortDate,
  weekdayIndex,
  weekdayName,
  weekSpan,
} from "@/lib/season/season";
import { TRAINING_PHASES, type TrainingPhase } from "@/lib/tests/phases";
import type { AdeptRaceRow, TrainingBlockRow } from "@/lib/types/database";
import { seasonMarks } from "./marks";
import { PHASE_SHORT, phaseFill } from "./phase-style";

/** Fasen som brukar följa, för att förifylla nästa period. */
const NEXT: Record<TrainingPhase, TrainingPhase> = {
  grund: "uppbyggnad",
  uppbyggnad: "specifik",
  specifik: "topp",
  topp: "vila",
  vila: "grund",
};

/** Förslag på längd för en ny period, i veckor: åtta veckors grund, sex
 * veckors uppbyggnad, fyra specifika, två veckors toppning och vila. */
const WEEKS: Record<TrainingPhase, number> = {
  grund: 8,
  uppbyggnad: 6,
  specifik: 4,
  topp: 2,
  vila: 2,
};

/** Längsta period i veckor; servern tillåter ett år. */
const MAX_WEEKS = 52;

const phaseName = (phase: TrainingPhase) =>
  TRAINING_PHASES.find((p) => p.key === phase)?.label ?? PHASE_SHORT[phase];

type Draft = {
  id: string | null;
  phase: TrainingPhase;
  name: string;
  startsOn: string;
  endsOn: string;
  focus: string;
};

/** En ny period med fasens normala längd, i hela veckor. */
const fresh = (phase: TrainingPhase, startsOn: string): Draft => ({
  id: null,
  phase,
  name: "",
  startsOn,
  endsOn: addDays(startsOn, WEEKS[phase] * 7 - 1),
  focus: "",
});

function draftAfter(blocks: TrainingBlockRow[], today: string): Draft {
  const last = [...blocks].sort((a, b) =>
    b.ends_on.localeCompare(a.ends_on),
  )[0];
  // Fortsätt där planen slutar. Är den redan slut, eller tom, börjar
  // perioden på veckans måndag – men aldrig inne i en tidigare period.
  const thisMonday = mondayOf(today);
  const after = last ? addDays(last.ends_on, 1) : thisMonday;
  return fresh(
    last ? NEXT[last.phase] : "grund",
    after > thisMonday ? after : thisMonday,
  );
}

/** Närmaste måndag: den förra i början av veckan, annars nästa. */
const nearestMonday = (iso: string) =>
  weekdayIndex(iso) <= 3 ? mondayOf(iso) : addDays(mondayOf(iso), 7);

/**
 * Perioderna i säsongsplanen, som lista och formulär.
 *
 * En period planeras med start och antal veckor; slutdatumet räknas ut och
 * går att ändra för en period som inte är hela veckor. Datumväljaren visar
 * veckonummer, de andra perioderna och tävlingarna. En ny period förifylls
 * där planen slutar, med fasen som brukar komma sedan, och "Spara och lägg
 * till nästa" bygger säsongen period för period.
 *
 * Planen är coachens; en adept utan coach planerar sin egen.
 */
export function BlockEditor({
  adeptId,
  blocks,
  races = [],
  today,
  canEdit,
  openNew,
}: {
  adeptId: string;
  blocks: TrainingBlockRow[];
  races?: AdeptRaceRow[];
  today: string;
  canEdit: boolean;
  /** Öppna formuläret för en ny period direkt, som från "Skapa ny plan". */
  openNew?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(
    openNew && canEdit ? draftAfter(blocks, today) : null,
  );
  // Veckorna medan de skrivs; tomt fält ska inte flytta slutdatumet.
  const [weeksInput, setWeeksInput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const form = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openNew && form.current) {
      form.current.scrollIntoView({ block: "center" });
      form.current.querySelector("select")?.focus();
    }
  }, [openNew]);

  const sorted = [...blocks].sort((a, b) =>
    a.starts_on.localeCompare(b.starts_on),
  );

  const open = (next: Draft | null) => {
    setDraft(next);
    setWeeksInput(null);
    setError(null);
  };

  const save = (thenNext: boolean) => {
    if (!draft) return;
    startTransition(async () => {
      setError(null);
      const result = await saveBlock({
        id: draft.id,
        adeptId,
        phase: draft.phase,
        name: draft.name,
        startsOn: draft.startsOn,
        endsOn: draft.endsOn,
        focus: draft.focus,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const label = draft.name.trim() || phaseName(draft.phase);
      setSaved(
        `Sparad: ${label}, ${shortDate(draft.startsOn)}–${shortDate(draft.endsOn)}.`,
      );
      open(
        thenNext ? fresh(NEXT[draft.phase], addDays(draft.endsOn, 1)) : null,
      );
      router.refresh();
    });
  };

  const remove = (block: TrainingBlockRow) => {
    if (
      !window.confirm(
        `Ta bort ${blockText(block)} ${shortDate(block.starts_on)}–${shortDate(block.ends_on)}?`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      setError(null);
      setSaved(null);
      const result = await deleteBlock(block.id, adeptId);
      if (!result.ok) setError(result.error ?? "Kunde inte ta bort perioden.");
      router.refresh();
    });
  };

  const days = draft ? daysBetween(draft.startsOn, draft.endsOn) + 1 : 0;
  const weeks = Math.floor(days / 7);
  const setWeeks = (count: number) => {
    if (!draft) return;
    const next = Math.min(Math.max(count, 1), MAX_WEEKS);
    setDraft({ ...draft, endsOn: addDays(draft.startsOn, next * 7 - 1) });
  };
  const clash = draft
    ? overlapping(blocks, {
        id: draft.id,
        starts_on: draft.startsOn,
        ends_on: draft.endsOn,
      })
    : null;
  const marks = seasonMarks({ blocks, races, exceptBlock: draft?.id });

  return (
    <Card className="min-w-0">
      <CardTitle
        action={
          canEdit && !draft ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setSaved(null);
                open(draftAfter(blocks, today));
              }}
            >
              <Plus aria-hidden className="size-4" />
              Ny period
            </Button>
          ) : null
        }
      >
        Perioder
      </CardTitle>

      {sorted.length === 0 && !draft ? (
        <p className="text-sm text-text-muted">
          {canEdit
            ? "Ingen period inlagd. Börja med grundperioden – nästa period förifylls där den förra slutar."
            : "Coachen har inte lagt upp säsongen ännu."}
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {sorted.map((block) => {
            const length = daysBetween(block.starts_on, block.ends_on) + 1;
            const now = block.starts_on <= today && today <= block.ends_on;
            const past = block.ends_on < today;
            return (
              <li
                key={block.id}
                className={`flex items-start gap-3 py-3 ${past ? "opacity-60" : ""}`}
              >
                <span
                  aria-hidden
                  className="mt-1 h-3 w-5 shrink-0 rounded-[3px]"
                  style={{ background: phaseFill(block.phase) }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text">
                    {block.name?.trim() || phaseName(block.phase)}
                    {block.name?.trim() && (
                      <span className="ml-2 text-[0.75rem] font-normal text-text-subtle">
                        {PHASE_SHORT[block.phase]}
                      </span>
                    )}
                    {now && (
                      <span className="ml-2 rounded bg-surface-3 px-1.5 py-0.5 text-[0.6875rem] font-medium text-text">
                        pågår
                      </span>
                    )}
                  </p>
                  <p className="text-[0.75rem] text-text-subtle tabular-nums">
                    {dateRange(block.starts_on, block.ends_on, today)} ·{" "}
                    {weekSpan(block.starts_on, block.ends_on)} ·{" "}
                    {lengthText(length)}
                    {now &&
                      ` · ${lengthText(daysBetween(today, block.ends_on))} kvar`}
                  </p>
                  {block.focus && (
                    <p className="mt-0.5 text-[0.8125rem] text-text-muted">
                      {block.focus}
                    </p>
                  )}
                </div>
                {canEdit && (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="px-2"
                      aria-label={`Ändra ${blockText(block)}`}
                      disabled={pending}
                      onClick={() => {
                        setSaved(null);
                        open({
                          id: block.id,
                          phase: block.phase,
                          name: block.name ?? "",
                          startsOn: block.starts_on,
                          endsOn: block.ends_on,
                          focus: block.focus ?? "",
                        });
                      }}
                    >
                      <Pencil aria-hidden className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="px-2"
                      aria-label={`Ta bort ${blockText(block)}`}
                      disabled={pending}
                      onClick={() => remove(block)}
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {saved && (
        <p role="status" className="mt-3 text-[0.8125rem] text-good">
          {saved}
        </p>
      )}

      {draft && (
        <div
          ref={form}
          className="enter mt-4 space-y-4 rounded-md border border-line-strong bg-surface-2/60 p-4"
        >
          <p className="text-sm font-medium text-text">
            {draft.id ? "Ändra perioden" : "Ny period"}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Fas"
              htmlFor="block-phase"
              hint={TRAINING_PHASES.find((p) => p.key === draft.phase)?.hint}
            >
              <Select
                id="block-phase"
                value={draft.phase}
                onChange={(e) => {
                  const phase = e.target.value as TrainingPhase;
                  setWeeksInput(null);
                  setDraft({
                    ...draft,
                    phase,
                    // En ny period får fasens normala längd; en befintlig
                    // behåller sina datum.
                    endsOn: draft.id
                      ? draft.endsOn
                      : addDays(draft.startsOn, WEEKS[phase] * 7 - 1),
                  });
                }}
              >
                {TRAINING_PHASES.map((p) => (
                  <option key={p.key} value={p.key}>
                    {PHASE_SHORT[p.key]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Namn"
              htmlFor="block-name"
              optional
              hint="Visas i stället för fasens namn. Fasen styr färgen och AI-coachen."
            >
              <Input
                id="block-name"
                value={draft.name}
                maxLength={60}
                placeholder={phaseName(draft.phase)}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9.5rem]">
            <Field label="Startar" htmlFor="block-start">
              <DatePicker
                id="block-start"
                value={draft.startsOn}
                marks={marks}
                range={{ from: draft.startsOn, to: draft.endsOn }}
                onChange={(startsOn) =>
                  // Perioden flyttas med sin längd.
                  setDraft({
                    ...draft,
                    startsOn,
                    endsOn: addDays(startsOn, days - 1),
                  })
                }
              />
            </Field>
            <Field
              label="Veckor"
              htmlFor="block-weeks"
              hint={
                days % 7 === 0
                  ? undefined
                  : weeks === 0
                    ? `Bara ${lengthText(days)}`
                    : `+ ${lengthText(days % 7)}`
              }
            >
              <div className="flex items-center gap-1">
                <Button
                  variant="secondary"
                  className="size-10 shrink-0 px-0"
                  aria-label="En vecka kortare"
                  disabled={weeks <= 1 && days <= 7}
                  onClick={() => {
                    setWeeksInput(null);
                    setWeeks(days % 7 === 0 ? weeks - 1 : weeks);
                  }}
                >
                  <Minus aria-hidden className="size-4 shrink-0" />
                </Button>
                <Input
                  id="block-weeks"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_WEEKS}
                  value={weeksInput ?? String(weeks)}
                  onChange={(e) => {
                    setWeeksInput(e.target.value);
                    const count = Number(e.target.value);
                    if (Number.isInteger(count) && count >= 1) setWeeks(count);
                  }}
                  onBlur={() => setWeeksInput(null)}
                  className="min-w-0 px-1 text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <Button
                  variant="secondary"
                  className="size-10 shrink-0 px-0"
                  aria-label="En vecka längre"
                  disabled={weeks >= MAX_WEEKS}
                  onClick={() => {
                    setWeeksInput(null);
                    setWeeks(weeks + 1);
                  }}
                >
                  <Plus aria-hidden className="size-4 shrink-0" />
                </Button>
              </div>
            </Field>
            <Field
              label="Slutar"
              htmlFor="block-end"
              hint="Räknas ut ur veckorna. Välj ett annat datum för en period som inte är hela veckor."
            >
              <DatePicker
                id="block-end"
                value={draft.endsOn}
                min={draft.startsOn}
                max={addDays(draft.startsOn, 365)}
                marks={marks}
                range={{ from: draft.startsOn, to: draft.endsOn }}
                onChange={(endsOn) => {
                  setWeeksInput(null);
                  setDraft({ ...draft, endsOn });
                }}
              />
            </Field>
          </div>

          <div className="space-y-1.5 text-[0.8125rem]">
            <p className="text-text-muted tabular-nums">
              {lengthText(days)} · {weekSpan(draft.startsOn, draft.endsOn)} ·{" "}
              {longDate(draft.startsOn, today)} – {weekdayName(draft.endsOn)}{" "}
              {longDate(draft.endsOn, today)}
            </p>
            {weekdayIndex(draft.startsOn) !== 0 && (
              <p className="text-text-subtle">
                Startar en {weekdayName(draft.startsOn)}.{" "}
                <button
                  type="button"
                  className="font-medium text-text underline decoration-line-strong underline-offset-2 hover:decoration-text"
                  onClick={() => {
                    const startsOn = nearestMonday(draft.startsOn);
                    setDraft({
                      ...draft,
                      startsOn,
                      endsOn: addDays(startsOn, days - 1),
                    });
                  }}
                >
                  Flytta till måndag {shortDate(nearestMonday(draft.startsOn))}
                </button>
              </p>
            )}
            {clash && (
              <p role="alert" className="text-warn">
                Krockar med {blockText(clash)} {shortDate(clash.starts_on)}–
                {shortDate(clash.ends_on)}. Perioderna får inte överlappa.
              </p>
            )}
          </div>

          <Field label="Fokus" htmlFor="block-focus" optional>
            <Input
              id="block-focus"
              value={draft.focus}
              maxLength={300}
              placeholder="T.ex. volym i zon 1–2, styrka två gånger i veckan"
              onChange={(e) => setDraft({ ...draft, focus: e.target.value })}
            />
          </Field>
          {error && (
            <p role="alert" className="text-sm text-bad">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => save(false)}
              disabled={pending || clash !== null}
              className="font-semibold"
            >
              {pending ? "Sparar…" : "Spara period"}
            </Button>
            {!draft.id && (
              <Button
                variant="secondary"
                onClick={() => save(true)}
                disabled={pending || clash !== null}
              >
                Spara och lägg till{" "}
                {PHASE_SHORT[NEXT[draft.phase]].toLowerCase()}
              </Button>
            )}
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => open(null)}
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
