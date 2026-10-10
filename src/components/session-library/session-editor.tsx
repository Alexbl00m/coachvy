"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useAction } from "@/components/plan-library/use-action";
import { WorkoutStrip } from "@/components/workouts/workout-strip";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import type { Sport } from "@/lib/calculators/lactate";
import { templateProfile } from "@/lib/plan-library/profile";
import { parseStructure } from "@/lib/plan-library/structure";
import { saveLibrarySession } from "@/lib/session-library/actions";
import {
  amountText,
  BASES_FOR_SPORT,
  basisName,
  LIBRARY_SPORTS,
  type LibraryInput,
  type LibrarySession,
} from "@/lib/session-library/library";
import { TRAINING_PHASES } from "@/lib/tests/phases";
import type { TargetBasis } from "@/lib/workouts/schema";

const KINDS = [
  "Kvalitet",
  "Specifikt",
  "Distans",
  "Långpass",
  "Återhämtning",
  "Test",
];
const INTENSITIES = [
  "Lugn distans",
  "Maratontempo",
  "Halvmaratonfart",
  "Tröskel",
  "Milfart",
  "Intervall",
  "Snabbhet",
];

export const emptyLibraryInput = (sport: Sport = "löpning"): LibraryInput => ({
  title: "",
  sport,
  kind: "",
  intensity: "",
  purpose: "",
  description: "",
  progression: "",
  phases: [],
  basis: BASES_FOR_SPORT[sport][0],
  structure: "",
  shared: false,
});

export const inputOf = (s: LibrarySession): LibraryInput => ({
  title: s.title,
  sport: s.sport,
  kind: s.kind,
  intensity: s.intensity,
  purpose: s.purpose,
  description: s.description,
  progression: s.progression,
  phases: s.phases,
  basis: s.basis,
  structure: s.structure,
  shared: s.shared,
});

const PLACEHOLDER: Partial<Record<TargetBasis, string>> = {
  MP: "3 km @LO; 4x(2 km @HM-10K + 2 min @RK); 2 km @LO",
  FTP: "15 min 65%; 4x(8 min 95% + 3 min 55%); 10 min 60%",
  CSS: "400 m 75%; 8x(100 m 105% + 15 s 0%); 200 m 70%",
};

/**
 * Ett pass i biblioteket, nytt eller ändrat. Strukturen tolkas medan den
 * skrivs, så att felet och profilen syns innan något sparas.
 */
export function SessionEditor({
  open,
  onClose,
  sessionId,
  initial,
  isAdmin,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  /** Passet som ändras; null för ett nytt. */
  sessionId: string | null;
  initial: LibraryInput;
  isAdmin: boolean;
  onSaved?: (id: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(initial);
  const { pending, error, run } = useAction();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const patch = (p: Partial<LibraryInput>) => setDraft((d) => ({ ...d, ...p }));
  const parsed = useMemo(
    () => (draft.structure.trim() ? parseStructure(draft.structure) : null),
    [draft.structure],
  );
  const zonesWithoutMp =
    draft.structure.includes("@") && draft.basis !== "MP";
  const profile =
    parsed && parsed.ok ? templateProfile(parsed.blocks, draft.basis) : [];
  const bases = BASES_FOR_SPORT[draft.sport];
  const id = (name: string) => `bib-${name}`;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={id("titel-rubrik")}
      className="m-auto w-[min(48rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-0 text-text shadow-2xl backdrop:bg-black/60"
    >
      <form
        method="dialog"
        className="max-h-[88vh] overflow-y-auto p-5 sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => saveLibrarySession({ ...draft, id: sessionId }),
            (result) => {
              onClose();
              if (result.id) onSaved?.(result.id);
            },
          );
        }}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id={id("titel-rubrik")} className="text-lg font-semibold">
              {sessionId ? "Ändra pass i biblioteket" : "Nytt pass i biblioteket"}
            </h2>
            <p className="text-[13px] text-text-subtle">
              Skriv syftet och hur passet byggs på, så följer det med när
              passet används.
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Stäng
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-6">
          <div className="sm:col-span-4">
            <Field label="Namn" htmlFor={id("titel")}>
              <Input
                id={id("titel")}
                value={draft.title}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder="Tröskeldrag"
                required
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Gren" htmlFor={id("gren")}>
              <Select
                id={id("gren")}
                value={draft.sport}
                onChange={(e) => {
                  const sport = e.target.value as Sport;
                  patch({
                    sport,
                    basis: BASES_FOR_SPORT[sport].includes(draft.basis)
                      ? draft.basis
                      : BASES_FOR_SPORT[sport][0],
                  });
                }}
              >
                {LIBRARY_SPORTS.map((s) => (
                  <option key={s} value={s}>
                    {s[0].toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Typ" htmlFor={id("typ")} optional>
              <Input
                id={id("typ")}
                list={id("typer")}
                value={draft.kind}
                onChange={(e) => patch({ kind: e.target.value })}
                placeholder="Kvalitet"
              />
              <datalist id={id("typer")}>
                {KINDS.map((k) => (
                  <option key={k} value={k} />
                ))}
              </datalist>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Intensitet" htmlFor={id("intensitet")} optional>
              <Input
                id={id("intensitet")}
                list={id("intensiteter")}
                value={draft.intensity}
                onChange={(e) => patch({ intensity: e.target.value })}
                placeholder="Tröskel"
              />
              <datalist id={id("intensiteter")}>
                {INTENSITIES.map((k) => (
                  <option key={k} value={k} />
                ))}
              </datalist>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Procent av" htmlFor={id("bas")}>
              <Select
                id={id("bas")}
                value={draft.basis}
                onChange={(e) =>
                  patch({ basis: e.target.value as TargetBasis })
                }
              >
                {bases.map((b) => (
                  <option key={b} value={b}>
                    {b === "MP" ? "Maratonfart (zoner)" : basisName(b)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="sm:col-span-6">
            <Field label="Struktur" htmlFor={id("struktur")}>
              <Input
                id={id("struktur")}
                value={draft.structure}
                onChange={(e) => patch({ structure: e.target.value })}
                placeholder={PLACEHOLDER[draft.basis] ?? PLACEHOLDER.MP}
                className="font-mono text-[13px]"
                required
              />
            </Field>
            <div className="mt-1.5 min-h-5 text-[12px]">
              {parsed && !parsed.ok && (
                <p className="text-warn">{parsed.error}</p>
              )}
              {zonesWithoutMp && (
                <p className="text-warn">
                  Zoner som @LO och @HM står mot maratonfart – välj
                  Maratonfart som bas, eller skriv procent.
                </p>
              )}
              {parsed && parsed.ok && !zonesWithoutMp && (
                <div className="flex items-center gap-3">
                  <WorkoutStrip blocks={profile} className="h-6 flex-1" />
                  <span className="shrink-0 tabular-nums text-text-muted">
                    {amountText(parsed.blocks)}
                  </span>
                </div>
              )}
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-text-subtle">
              Som i planmallarna: steg skiljs med semikolon, en repetition
              skrivs <code className="text-text-muted">5x(…)</code>. Med
              maratonfart som bas går zonerna RK, LO, MT, S, I, loppfarterna
              HM, 10K, 5K och spann som{" "}
              <code className="text-text-muted">@HM-10K</code>.
            </p>
          </div>

          <div className="sm:col-span-6">
            <Field
              label="Syfte"
              htmlFor={id("syfte")}
              hint="Vilken egenskap utvecklas, vilken begränsning påverkas, och hur bidrar passet till loppet?"
              optional
            >
              <Textarea
                id={id("syfte")}
                rows={2}
                value={draft.purpose}
                onChange={(e) => patch({ purpose: e.target.value })}
              />
            </Field>
          </div>
          <div className="sm:col-span-3">
            <Field
              label="Instruktion"
              htmlFor={id("instruktion")}
              hint="Till den som tränar: hur det ska kännas."
              optional
            >
              <Textarea
                id={id("instruktion")}
                rows={3}
                value={draft.description}
                onChange={(e) => patch({ description: e.target.value })}
              />
            </Field>
          </div>
          <div className="sm:col-span-3">
            <Field
              label="Så byggs det på"
              htmlFor={id("progression")}
              hint="En variabel i taget: antal drag, draglängd, vila eller fart."
              optional
            >
              <Textarea
                id={id("progression")}
                rows={3}
                value={draft.progression}
                onChange={(e) => patch({ progression: e.target.value })}
              />
            </Field>
          </div>

          <fieldset className="sm:col-span-6">
            <legend className="mb-1.5 text-[13px] font-medium text-text">
              Faser <span className="text-[11px] font-normal text-text-subtle">valfritt</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {TRAINING_PHASES.map((p) => {
                const on = draft.phases.includes(p.key);
                return (
                  <label
                    key={p.key}
                    className={cn(
                      "cursor-pointer rounded-md border px-2.5 py-1 text-[13px] transition-colors",
                      on
                        ? "border-text-subtle bg-surface-3 text-text"
                        : "border-line-strong text-text-muted hover:text-text",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={on}
                      onChange={(e) =>
                        patch({
                          phases: e.target.checked
                            ? [...draft.phases, p.key]
                            : draft.phases.filter((x) => x !== p.key),
                        })
                      }
                    />
                    {p.label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {isAdmin && (
            <label className="flex items-center gap-2 text-sm sm:col-span-6">
              <input
                type="checkbox"
                checked={draft.shared}
                onChange={(e) => patch({ shared: e.target.checked })}
                className="size-4 accent-[var(--accent)]"
              />
              Dela med alla coacher
              <span className="text-[12px] text-text-subtle">
                – de kan använda och kopiera passet, men inte ändra det.
              </span>
            </label>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          {error && (
            <span role="alert" className="text-sm text-warn">
              {error}
            </span>
          )}
          <Button type="submit" disabled={pending}>
            Spara i biblioteket
          </Button>
        </div>
      </form>
    </dialog>
  );
}
