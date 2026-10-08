"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { savePhases, type PhaseInput } from "@/lib/plan-library/admin-actions";
import { SPECIFICITY_LABEL } from "@/lib/plan-library/labels";
import { TRAINING_PHASES } from "@/lib/tests/phases";
import type { SeasonPhase } from "@/lib/plan-library/types";

import { useAction } from "../use-action";
import { IntensityInput } from "./intensity-input";

const EMPTY = { låg: 0, medel: 0, hög: 0 };

/**
 * Faserna i ordning, från ospecifikt till specifikt. Varje fas har ett syfte
 * och en specificitet, och en regel för hur den kortas när en medlem väljer
 * en kortare plan.
 */
export function PhasesEditor({
  versionId,
  editable,
  initial,
  weeksPerPhase,
}: {
  versionId: string;
  editable: boolean;
  initial: PhaseInput[];
  weeksPerPhase: Record<string, number>;
}) {
  const [phases, setPhases] = useState(initial);
  const [saved, setSaved] = useState(false);
  const { pending, error, run } = useAction();

  const patch = (i: number, p: Partial<PhaseInput>) => {
    setSaved(false);
    setPhases((ps) => ps.map((x, j) => (j === i ? { ...x, ...p } : x)));
  };
  const move = (i: number, d: number) => {
    setSaved(false);
    setPhases((ps) => {
      const next = [...ps];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });
  };
  const trimmable = phases.filter((p) => p.trimOrder !== null).length;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const removed = initial.filter(
          (p) => !phases.some((x) => x.id === p.id),
        );
        if (
          removed.length > 0 &&
          !confirm(
            `${removed.map((p) => p.name).join(", ")} tas bort, med sina veckor och pass. Fortsätta?`,
          )
        )
          return;
        run(
          () => savePhases({ versionId, phases }),
          () => setSaved(true),
        );
      }}
      className="space-y-4"
    >
      <p className="max-w-3xl text-[13px] leading-relaxed text-text-subtle">
        När en medlem väljer en kortare plan kortas faserna en vecka i taget,
        från fasens början, i ordningen nedan – först den som kortas först.
        Faser som inte kortas behåller alla sina veckor, typiskt den specifika
        fasen och tapern.
      </p>
      <fieldset disabled={!editable} className="space-y-4">
        {phases.map((phase, i) => (
          <div
            key={phase.id ?? `ny-${i}`}
            className="rounded-lg border border-line bg-surface-2/40 p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[13px] font-medium text-text-muted">
                Fas {i + 1}
                {phase.id && weeksPerPhase[phase.id] !== undefined && (
                  <span className="text-text-subtle">
                    {" "}
                    · {weeksPerPhase[phase.id]} veckor
                  </span>
                )}
              </p>
              {editable && (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Flytta upp"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp aria-hidden className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Flytta ned"
                    disabled={i === phases.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown aria-hidden className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Ta bort ${phase.name}`}
                    disabled={phases.length === 1}
                    onClick={() => {
                      setSaved(false);
                      setPhases((ps) => ps.filter((_, j) => j !== i));
                    }}
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </Button>
                </div>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Namn" htmlFor={`ph-name-${i}`}>
                <Input
                  id={`ph-name-${i}`}
                  value={phase.name}
                  onChange={(e) => patch(i, { name: e.target.value })}
                />
              </Field>
              <Field
                label="Fas i säsongsplanen"
                htmlFor={`ph-season-${i}`}
                hint="Färgar kalendern och översikten."
              >
                <Select
                  id={`ph-season-${i}`}
                  value={phase.seasonPhase ?? ""}
                  onChange={(e) =>
                    patch(i, {
                      seasonPhase: (e.target.value ||
                        null) as SeasonPhase | null,
                    })
                  }
                >
                  <option value="">Ingen</option>
                  {TRAINING_PHASES.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Specificitet" htmlFor={`ph-spec-${i}`}>
                <Select
                  id={`ph-spec-${i}`}
                  value={phase.specificity ?? ""}
                  onChange={(e) =>
                    patch(i, {
                      specificity: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                >
                  <option value="">Inte angiven</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} – {SPECIFICITY_LABEL[n]}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="sm:col-span-3 grid gap-3 sm:grid-cols-2">
                <Field label="Syfte" htmlFor={`ph-purpose-${i}`} optional>
                  <Textarea
                    id={`ph-purpose-${i}`}
                    rows={2}
                    value={phase.purpose}
                    onChange={(e) => patch(i, { purpose: e.target.value })}
                  />
                </Field>
                <Field label="Fokus" htmlFor={`ph-focus-${i}`} optional>
                  <Textarea
                    id={`ph-focus-${i}`}
                    rows={2}
                    value={phase.focus}
                    onChange={(e) => patch(i, { focus: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Kortas" htmlFor={`ph-trim-${i}`}>
                <Select
                  id={`ph-trim-${i}`}
                  value={phase.trimOrder ?? ""}
                  onChange={(e) =>
                    patch(i, {
                      trimOrder: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                >
                  <option value="">Aldrig</option>
                  {Array.from(
                    {
                      length: Math.max(
                        trimmable + (phase.trimOrder === null ? 1 : 0),
                        1,
                      ),
                    },
                    (_, n) => (
                      <option key={n} value={n + 1}>
                        {n === 0 ? "Först" : `I ${n + 1}:a hand`}
                      </option>
                    ),
                  )}
                </Select>
              </Field>
              <Field
                label="Kortast"
                htmlFor={`ph-min-${i}`}
                hint="Veckor kvar när fasen kortats så långt det går."
              >
                <Input
                  id={`ph-min-${i}`}
                  type="number"
                  min={0}
                  disabled={phase.trimOrder === null}
                  value={phase.minWeeks}
                  onChange={(e) =>
                    patch(i, { minWeeks: Number(e.target.value) })
                  }
                />
              </Field>
              <IntensityInput
                id={`ph-int-${i}`}
                value={phase.intensity ?? EMPTY}
                onChange={(intensity) => patch(i, { intensity })}
              />
            </div>
          </div>
        ))}
      </fieldset>

      {editable && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              setSaved(false);
              setPhases((ps) => [
                ...ps,
                {
                  id: null,
                  name: "Ny fas",
                  seasonPhase: null,
                  purpose: "",
                  focus: "",
                  specificity: null,
                  intensity: null,
                  minWeeks: 1,
                  trimOrder: null,
                },
              ]);
            }}
          >
            <Plus aria-hidden className="size-4" />
            Lägg till fas
          </Button>
          <Button type="submit" disabled={pending}>
            Spara faserna
          </Button>
          {saved && <span className="text-sm text-text-muted">Sparat.</span>}
          {error && (
            <span role="alert" className="text-sm text-warn">
              {error}
            </span>
          )}
        </div>
      )}
    </form>
  );
}
