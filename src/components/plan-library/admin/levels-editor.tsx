"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { saveLevels, type LevelInput } from "@/lib/plan-library/admin-actions";

import { useAction } from "../use-action";
import { IntensityInput } from "./intensity-input";

const EMPTY = { låg: 0, medel: 0, hög: 0 };

const numberOrNull = (raw: string) => {
  const n = Number(raw.replace(",", "."));
  return raw.trim() && Number.isFinite(n) ? n : null;
};

/**
 * Nivåerna, högst först. Ordningen är ranken: den översta är den mest
 * krävande. Riktvärdena hjälper medlemmen att välja – de styr ingenting.
 */
export function LevelsEditor({
  versionId,
  editable,
  initial,
}: {
  versionId: string;
  editable: boolean;
  initial: LevelInput[];
}) {
  const [levels, setLevels] = useState(initial);
  const [saved, setSaved] = useState(false);
  const { pending, error, run } = useAction();

  const patch = (i: number, p: Partial<LevelInput>) => {
    setSaved(false);
    setLevels((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));
  };
  const move = (i: number, d: number) => {
    setSaved(false);
    setLevels((ls) => {
      const next = [...ls];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const removed = initial.filter(
          (l) => !levels.some((x) => x.id === l.id),
        );
        if (
          removed.length > 0 &&
          !confirm(
            `${removed.map((l) => l.name).join(", ")} tas bort, med alla sina varianter av passen. Fortsätta?`,
          )
        )
          return;
        run(
          () => saveLevels({ versionId, levels }),
          () => setSaved(true),
        );
      }}
      className="space-y-4"
    >
      <fieldset disabled={!editable} className="space-y-4">
        {levels.map((level, i) => (
          <div
            key={level.id ?? `ny-${i}`}
            className="rounded-lg border border-line bg-surface-2/40 p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[13px] font-medium text-text-muted">
                {i === 0
                  ? "Högst"
                  : i === levels.length - 1
                    ? "Lägst"
                    : `Nivå ${i + 1} uppifrån`}
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
                    disabled={i === levels.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown aria-hidden className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Ta bort ${level.name}`}
                    disabled={levels.length === 1}
                    onClick={() => {
                      setSaved(false);
                      setLevels((ls) => ls.filter((_, j) => j !== i));
                    }}
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </Button>
                </div>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-[6rem_1fr]">
              <Field label="Beteckning" htmlFor={`lvl-key-${i}`}>
                <Input
                  id={`lvl-key-${i}`}
                  value={level.key}
                  maxLength={12}
                  onChange={(e) => patch(i, { key: e.target.value })}
                />
              </Field>
              <Field label="Namn" htmlFor={`lvl-name-${i}`}>
                <Input
                  id={`lvl-name-${i}`}
                  value={level.name}
                  onChange={(e) => patch(i, { name: e.target.value })}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="För vem" htmlFor={`lvl-desc-${i}`} optional>
                  <Textarea
                    id={`lvl-desc-${i}`}
                    rows={2}
                    value={level.description}
                    onChange={(e) => patch(i, { description: e.target.value })}
                  />
                </Field>
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_1.4fr]">
              <fieldset className="space-y-1.5">
                <legend className="text-[13px] font-medium text-text">
                  Timmar per vecka
                </legend>
                <div className="flex items-center gap-2">
                  <Input
                    aria-label="Minst timmar"
                    inputMode="decimal"
                    value={level.hoursMin ?? ""}
                    onChange={(e) =>
                      patch(i, { hoursMin: numberOrNull(e.target.value) })
                    }
                  />
                  <span className="text-text-subtle">–</span>
                  <Input
                    aria-label="Högst timmar"
                    inputMode="decimal"
                    value={level.hoursMax ?? ""}
                    onChange={(e) =>
                      patch(i, { hoursMax: numberOrNull(e.target.value) })
                    }
                  />
                </div>
              </fieldset>
              <fieldset className="space-y-1.5">
                <legend className="text-[13px] font-medium text-text">
                  Pass per vecka
                </legend>
                <div className="flex items-center gap-2">
                  <Input
                    aria-label="Minst pass"
                    inputMode="numeric"
                    value={level.sessionsMin ?? ""}
                    onChange={(e) =>
                      patch(i, { sessionsMin: numberOrNull(e.target.value) })
                    }
                  />
                  <span className="text-text-subtle">–</span>
                  <Input
                    aria-label="Högst pass"
                    inputMode="numeric"
                    value={level.sessionsMax ?? ""}
                    onChange={(e) =>
                      patch(i, { sessionsMax: numberOrNull(e.target.value) })
                    }
                  />
                </div>
              </fieldset>
              <IntensityInput
                id={`lvl-int-${i}`}
                value={level.intensity ?? EMPTY}
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
              setLevels((ls) => [
                ...ls,
                {
                  id: null,
                  key: String.fromCharCode(65 + ls.length),
                  name: `Nivå ${String.fromCharCode(65 + ls.length)}`,
                  description: "",
                  hoursMin: null,
                  hoursMax: null,
                  sessionsMin: null,
                  sessionsMax: null,
                  intensity: null,
                },
              ]);
            }}
          >
            <Plus aria-hidden className="size-4" />
            Lägg till nivå
          </Button>
          <Button type="submit" disabled={pending}>
            Spara nivåerna
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
