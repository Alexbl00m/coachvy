"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { deleteBlock, saveBlock } from "@/lib/season/actions";
import { addDays, dateRange, daysBetween } from "@/lib/season/season";
import { TRAINING_PHASES, type TrainingPhase } from "@/lib/tests/phases";
import type { TrainingBlockRow } from "@/lib/types/database";
import { PHASE_SHORT, phaseFill } from "./phase-style";

/** Fasen som brukar följa, för att förifylla nästa period. */
const NEXT: Record<TrainingPhase, TrainingPhase> = {
  grund: "uppbyggnad",
  uppbyggnad: "specifik",
  specifik: "topp",
  topp: "vila",
  vila: "grund",
};

/** Förslag på längd för en ny period, dagar: åtta veckors grund, sex
 * veckors uppbyggnad, fyra specifika, två veckors toppning och vila. */
const LENGTH: Record<TrainingPhase, number> = {
  grund: 56,
  uppbyggnad: 42,
  specifik: 28,
  topp: 14,
  vila: 14,
};

type Draft = {
  id: string | null;
  phase: TrainingPhase;
  startsOn: string;
  endsOn: string;
  focus: string;
};

function draftAfter(blocks: TrainingBlockRow[], today: string): Draft {
  const last = [...blocks].sort((a, b) =>
    b.ends_on.localeCompare(a.ends_on),
  )[0];
  const phase = last ? NEXT[last.phase] : "grund";
  // Fortsätt där planen slutar, eller i dag om den redan är slut.
  const startsOn =
    last && last.ends_on >= today ? addDays(last.ends_on, 1) : today;
  return {
    id: null,
    phase,
    startsOn,
    endsOn: addDays(startsOn, LENGTH[phase] - 1),
    focus: "",
  };
}

/**
 * Perioderna i säsongsplanen, som lista och formulär.
 *
 * En ny period förifylls där planen slutar, med fasen som brukar komma sedan.
 * Planen är coachens; en adept utan coach planerar sin egen.
 */
export function BlockEditor({
  adeptId,
  blocks,
  today,
  canEdit,
  openNew,
}: {
  adeptId: string;
  blocks: TrainingBlockRow[];
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
  const [error, setError] = useState<string | null>(null);
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

  const save = () => {
    if (!draft) return;
    startTransition(async () => {
      setError(null);
      const result = await saveBlock({
        id: draft.id,
        adeptId,
        phase: draft.phase,
        startsOn: draft.startsOn,
        endsOn: draft.endsOn,
        focus: draft.focus,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDraft(null);
      router.refresh();
    });
  };

  const remove = (block: TrainingBlockRow) => {
    const label = TRAINING_PHASES.find((p) => p.key === block.phase)?.label;
    if (
      !window.confirm(
        `Ta bort ${label?.toLowerCase()} ${block.starts_on}–${block.ends_on}?`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      setError(null);
      const result = await deleteBlock(block.id, adeptId);
      if (!result.ok) setError(result.error ?? "Kunde inte ta bort perioden.");
      router.refresh();
    });
  };

  return (
    <Card className="min-w-0">
      <CardTitle
        action={
          canEdit && !draft ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setDraft(draftAfter(blocks, today))}
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
            const days = daysBetween(block.starts_on, block.ends_on) + 1;
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
                    {TRAINING_PHASES.find((p) => p.key === block.phase)?.label}
                    {now && (
                      <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent">
                        pågår
                      </span>
                    )}
                  </p>
                  <p className="text-[12px] text-text-subtle tabular-nums">
                    {dateRange(block.starts_on, block.ends_on, today)} · {days}{" "}
                    dagar
                    {now && ` · ${daysBetween(today, block.ends_on)} kvar`}
                  </p>
                  {block.focus && (
                    <p className="mt-0.5 text-[13px] text-text-muted">
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
                      aria-label="Ändra perioden"
                      disabled={pending}
                      onClick={() =>
                        setDraft({
                          id: block.id,
                          phase: block.phase,
                          startsOn: block.starts_on,
                          endsOn: block.ends_on,
                          focus: block.focus ?? "",
                        })
                      }
                    >
                      <Pencil aria-hidden className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="px-2"
                      aria-label="Ta bort perioden"
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

      {draft && (
        <div
          ref={form}
          className="enter mt-4 space-y-4 rounded-md border border-line-strong bg-surface-2/60 p-4"
        >
          <p className="text-sm font-medium text-text">
            {draft.id ? "Ändra perioden" : "Ny period"}
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
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
                  setDraft({
                    ...draft,
                    phase,
                    // En ny period får fasens normala längd; en befintlig
                    // behåller sina datum.
                    endsOn: draft.id
                      ? draft.endsOn
                      : addDays(draft.startsOn, LENGTH[phase] - 1),
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
            <Field label="Från" htmlFor="block-start">
              <Input
                id="block-start"
                type="date"
                value={draft.startsOn}
                onChange={(e) =>
                  setDraft({ ...draft, startsOn: e.target.value })
                }
              />
            </Field>
            <Field
              label="Till och med"
              htmlFor="block-end"
              hint={
                draft.startsOn && draft.endsOn >= draft.startsOn
                  ? `${daysBetween(draft.startsOn, draft.endsOn) + 1} dagar`
                  : undefined
              }
            >
              <Input
                id="block-end"
                type="date"
                value={draft.endsOn}
                min={draft.startsOn}
                onChange={(e) => setDraft({ ...draft, endsOn: e.target.value })}
              />
            </Field>
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
          <div className="flex gap-2">
            <Button onClick={save} disabled={pending} className="font-semibold">
              {pending ? "Sparar…" : "Spara period"}
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
