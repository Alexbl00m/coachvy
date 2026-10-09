"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Trash2 } from "lucide-react";

import { WorkoutStrip } from "@/components/workouts/workout-strip";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import {
  deleteSession,
  saveSession,
  type VariantInput,
} from "@/lib/plan-library/admin-actions";
import { DAY_LONG } from "@/lib/plan-library/labels";
import { templateProfile } from "@/lib/plan-library/profile";
import { formatStructure, parseStructure } from "@/lib/plan-library/structure";
import type { TemplateSession } from "@/lib/plan-library/types";
import {
  BASIS_LABEL,
  TARGET_BASES,
  type TargetBasis,
} from "@/lib/workouts/schema";

import { useAction } from "../use-action";

export type DisciplineOption = {
  key: string;
  name: string;
  structureSport: string | null;
};

const DEFAULT_BASIS: Record<string, TargetBasis> = {
  cykling: "FTP",
  löpning: "CS",
  simning: "CSS",
};

type Draft = {
  id: string | null;
  weekId: string;
  day: number | null;
  discipline: string;
  type: string;
  title: string;
  description: string;
  variants: VariantInput[];
};

function draftOf(
  session: TemplateSession | null,
  weekId: string,
  day: number | null,
  levels: { id: string }[],
  disciplines: DisciplineOption[],
  defaultDiscipline: string,
): Draft {
  const discipline = session?.discipline ?? defaultDiscipline;
  const sport = disciplines.find((d) => d.key === discipline)?.structureSport;
  return {
    id: session?.id ?? null,
    weekId,
    day: session ? session.day : day,
    discipline,
    type: session?.type ?? "",
    title: session?.title ?? "",
    description: session?.description ?? "",
    variants: levels.map((l) => {
      const v = session?.variants.find((x) => x.levelId === l.id);
      return {
        levelId: l.id,
        included: session ? Boolean(v) : true,
        description: v?.description ?? "",
        durationMin: v?.durationS ? Math.round(v.durationS / 60) : null,
        distanceKm: v?.distanceM ? v.distanceM / 1000 : null,
        zone: v?.zone ?? "",
        basis: v?.basis ?? (sport ? DEFAULT_BASIS[sport] : null) ?? null,
        structure: v?.blocks
          ? formatStructure(v.blocks, { zones: v.basis === "MP" })
          : "",
      };
    }),
  };
}

const numberOrNull = (raw: string) => {
  const n = Number(raw.replace(",", "."));
  return raw.trim() && Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Ett pass och dess variant på varje nivå. En nivå utan variant har inte
 * passet – så får en lägre nivå färre pass.
 */
export function SessionDialog({
  open,
  onClose,
  versionId,
  weekLabel,
  session,
  weekId,
  day,
  levels,
  disciplines,
  defaultDiscipline,
}: {
  open: boolean;
  onClose: () => void;
  versionId: string;
  weekLabel: string;
  session: TemplateSession | null;
  weekId: string;
  day: number | null;
  levels: { id: string; key: string; name: string }[];
  disciplines: DisciplineOption[];
  /** Disciplinen ett nytt pass börjar med. */
  defaultDiscipline: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(() =>
    draftOf(session, weekId, day, levels, disciplines, defaultDiscipline),
  );
  const { pending, error, setError, run } = useAction();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  const patchVariant = (i: number, p: Partial<VariantInput>) =>
    setDraft((d) => ({
      ...d,
      variants: d.variants.map((v, j) => (j === i ? { ...v, ...p } : v)),
    }));

  const parsed = useMemo(
    () =>
      draft.variants.map((v) =>
        v.structure.trim() ? parseStructure(v.structure) : null,
      ),
    [draft.variants],
  );

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="pass-dialog-titel"
      className="m-auto w-[min(56rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-0 text-text shadow-2xl backdrop:bg-black/60"
    >
      <form
        method="dialog"
        className="max-h-[85vh] overflow-y-auto p-5 sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => saveSession({ ...draft, versionId }),
            () => onClose(),
          );
        }}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="pass-dialog-titel" className="text-lg font-semibold">
              {session ? "Ändra pass" : "Nytt pass"}
            </h2>
            <p className="text-[13px] text-text-subtle">{weekLabel}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Stäng
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Field label="Namn" htmlFor="pass-titel">
              <Input
                id="pass-titel"
                value={draft.title}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder="Tröskelintervaller"
                required
              />
            </Field>
          </div>
          <Field label="Disciplin" htmlFor="pass-disciplin">
            <Select
              id="pass-disciplin"
              value={draft.discipline}
              onChange={(e) => {
                const discipline = e.target.value;
                const sport = disciplines.find(
                  (d) => d.key === discipline,
                )?.structureSport;
                setDraft((d) => ({
                  ...d,
                  discipline,
                  variants: d.variants.map((v) => ({
                    ...v,
                    basis: sport ? (DEFAULT_BASIS[sport] ?? v.basis) : null,
                  })),
                }));
              }}
            >
              {disciplines.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Dag" htmlFor="pass-dag">
            <Select
              id="pass-dag"
              value={draft.day ?? ""}
              onChange={(e) =>
                patch({
                  day: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            >
              {DAY_LONG.map((d, i) => (
                <option key={d} value={i}>
                  Dag {i + 1} ({d})
                </option>
              ))}
              <option value="">Valfri dag</option>
            </Select>
          </Field>
          <Field label="Typ" htmlFor="pass-typ" optional>
            <Input
              id="pass-typ"
              value={draft.type}
              onChange={(e) => patch({ type: e.target.value })}
              placeholder="Intervaller"
            />
          </Field>
          <div className="sm:col-span-3">
            <Field label="Om passet" htmlFor="pass-beskrivning" optional>
              <Input
                id="pass-beskrivning"
                value={draft.description}
                onChange={(e) => patch({ description: e.target.value })}
                placeholder="Syftet, och hur det ska kännas"
              />
            </Field>
          </div>
        </div>

        <p className="mt-5 max-w-3xl text-[12px] leading-relaxed text-text-subtle">
          Strukturen skrivs som en rad:{" "}
          <code className="text-text-muted">
            15 min 65%; 5x(4 min 105% + 2 min 60%); 10 min 60%
          </code>
          . Längd i s, min, h, m eller km, målet i procent av basen. Tiden
          räknas fram ur strukturen när den bara har tider. Med maratonfart som
          bas går zoner också:{" "}
          <code className="text-text-muted">
            3 km @LO; 2x(5 km @MT + 1 km @LO); 2 km @LO
          </code>{" "}
          (RK, LO, MT, S, I, WK).
        </p>

        <div className="mt-3 space-y-3">
          {draft.variants.map((v, i) => {
            const level = levels[i];
            const result = parsed[i];
            const profile =
              result && result.ok
                ? templateProfile(result.blocks, v.basis)
                : [];
            return (
              <fieldset
                key={v.levelId}
                className="rounded-lg border border-line bg-surface-2/40 p-4"
              >
                <legend className="sr-only">{level.name}</legend>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={v.included}
                      onChange={(e) =>
                        patchVariant(i, { included: e.target.checked })
                      }
                      className="size-4 accent-[var(--accent)]"
                    />
                    {level.key} · {level.name}
                  </label>
                  {i > 0 && v.included && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        patchVariant(i, {
                          ...draft.variants[i - 1],
                          levelId: v.levelId,
                          included: true,
                        })
                      }
                    >
                      <Copy aria-hidden className="size-3.5" />
                      Kopiera från {levels[i - 1].key}
                    </Button>
                  )}
                </div>
                {v.included ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-4">
                    <Field label="Tid, min" htmlFor={`v-tid-${i}`} optional>
                      <Input
                        id={`v-tid-${i}`}
                        inputMode="decimal"
                        value={v.durationMin ?? ""}
                        onChange={(e) =>
                          patchVariant(i, {
                            durationMin: numberOrNull(e.target.value),
                          })
                        }
                      />
                    </Field>
                    <Field label="Distans, km" htmlFor={`v-km-${i}`} optional>
                      <Input
                        id={`v-km-${i}`}
                        inputMode="decimal"
                        value={v.distanceKm ?? ""}
                        onChange={(e) =>
                          patchVariant(i, {
                            distanceKm: numberOrNull(e.target.value),
                          })
                        }
                      />
                    </Field>
                    <Field label="Zon" htmlFor={`v-zon-${i}`} optional>
                      <Input
                        id={`v-zon-${i}`}
                        value={v.zone}
                        onChange={(e) =>
                          patchVariant(i, { zone: e.target.value })
                        }
                        placeholder="Z2"
                      />
                    </Field>
                    <Field label="Procent av" htmlFor={`v-bas-${i}`}>
                      <Select
                        id={`v-bas-${i}`}
                        value={v.basis ?? ""}
                        onChange={(e) =>
                          patchVariant(i, {
                            basis: (e.target.value ||
                              null) as TargetBasis | null,
                          })
                        }
                      >
                        <option value="">Ingen struktur</option>
                        {TARGET_BASES.map((b) => (
                          <option key={b} value={b}>
                            {BASIS_LABEL[b] === b
                              ? b
                              : `${BASIS_LABEL[b][0].toUpperCase()}${BASIS_LABEL[b].slice(1)}`}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <div className="sm:col-span-4">
                      <Field
                        label="Struktur"
                        htmlFor={`v-struktur-${i}`}
                        optional
                      >
                        <Input
                          id={`v-struktur-${i}`}
                          value={v.structure}
                          disabled={!v.basis}
                          onChange={(e) =>
                            patchVariant(i, { structure: e.target.value })
                          }
                          placeholder={
                            v.basis === "MP"
                              ? "3 km @LO; 2x(5 km @MT + 1 km @LO); 2 km @LO"
                              : v.basis
                                ? "15 min 65%; 3x(10 min 95% + 3 min 60%); 10 min 60%"
                                : "Välj vad procenten räknas mot först"
                          }
                          className="font-mono text-[13px]"
                        />
                      </Field>
                      {result && !result.ok && (
                        <p className="mt-1 text-[12px] text-warn">
                          {result.error}
                        </p>
                      )}
                      {profile.length > 0 && (
                        <WorkoutStrip blocks={profile} className="mt-2 h-6" />
                      )}
                    </div>
                    <div className="sm:col-span-4">
                      <Field
                        label="Instruktion på nivån"
                        htmlFor={`v-text-${i}`}
                        optional
                      >
                        <Textarea
                          id={`v-text-${i}`}
                          rows={2}
                          value={v.description}
                          onChange={(e) =>
                            patchVariant(i, { description: e.target.value })
                          }
                        />
                      </Field>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-[13px] text-text-subtle">
                    Passet ingår inte på den här nivån.
                  </p>
                )}
              </fieldset>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          {session ? (
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => {
                if (!confirm(`Ta bort ${session.title} på alla nivåer?`))
                  return;
                setError(null);
                run(
                  () => deleteSession(session.id),
                  () => onClose(),
                );
              }}
            >
              <Trash2 aria-hidden className="size-4" />
              Ta bort passet
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3">
            {error && (
              <span role="alert" className="text-sm text-warn">
                {error}
              </span>
            )}
            <Button type="submit" disabled={pending}>
              Spara passet
            </Button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
