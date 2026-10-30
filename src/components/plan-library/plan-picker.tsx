"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { normalize } from "@/lib/command-search";
import { formatDate } from "@/lib/format";
import { defaultLevel } from "@/lib/plan-library/queue";
import { queuePhase } from "@/lib/plan-library/queue-actions";
import { routes } from "@/lib/routes";

import { PhaseLadder } from "./phase-ladder";

/** En plan i väljaren, med det som behövs för att välja utan att lämna sidan. */
export type PickerPlan = {
  versionId: string;
  slug: string;
  title: string;
  summary: string | null;
  category: string | null;
  focus: string | null;
  focusLabel: string | null;
  /** Planen hör till adeptens gren. */
  forSport: boolean;
  minWeeks: number;
  maxWeeks: number;
  /** Timmarna per vecka över nivåerna, "4–14 h/vecka". */
  hours: string;
  phases: { id: string; name: string; weeks: number; specificity: number | null }[];
  /** Högst först, med timmarna i etiketten. */
  levels: { id: string; key: string; label: string }[];
};

/** Ett förslag ur testet och huvudloppet, med planerna som har fokuset. */
export type PickerSuggestion = {
  focus: string;
  label: string;
  reason: string;
  versionIds: string[];
};

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const weeksText = (p: PickerPlan) =>
  p.minWeeks === p.maxWeeks ? `${p.maxWeeks} veckor` : `${p.minWeeks}–${p.maxWeeks} veckor`;

const pill = (active: boolean) =>
  cn(
    "rounded-md border px-2.5 py-1 text-[0.8125rem] transition-colors",
    active
      ? "border-text-subtle bg-surface-3 font-medium text-text"
      : "border-line-strong text-text-muted hover:border-text-subtle hover:text-text",
  );

/**
 * Välj plan för en adept: förslagen ur testet och huvudloppet först, sedan
 * planerna för adeptens gren med sökning och fokus. En rad fälls ut med
 * veckor, nivå och datum, så att fasen läggs på utan att coachen lämnar
 * adepten.
 */
export function PlanPicker({
  open,
  onClose,
  onAdded,
  adept,
  plans,
  suggestions,
  sportName,
  fixedStart,
  defaultStart,
  previousLevelKey,
  initialFocus,
  initialVersionId,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  adept: { id: string; firstName: string };
  plans: PickerPlan[];
  suggestions: PickerSuggestion[];
  /** Adeptens gren i text, "löpning"; null när den saknas. */
  sportName: string | null;
  /** Dagen fasen börjar när adepten har en kö, och fasen före. */
  fixedStart: { start: string; after: string } | null;
  /** Förvald start när kön är tom. */
  defaultStart: string;
  previousLevelKey: string | null;
  initialFocus: string | null;
  initialVersionId: string | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const focuses = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of plans) if (p.focus && p.focusLabel) seen.set(p.focus, p.focusLabel);
    return [...seen.entries()];
  }, [plans]);
  const [focus, setFocus] = useState(
    initialFocus && focuses.some(([key]) => key === initialFocus) ? initialFocus : "alla",
  );
  const hasSport = plans.some((p) => p.forSport);
  // En plan som pekats ut i adressen står utfälld när väljaren öppnas.
  const initial = plans.find((p) => p.versionId === initialVersionId) ?? null;
  const [scope, setScope] = useState<"gren" | "alla">(
    hasSport && (!initial || initial.forSport) ? "gren" : "alla",
  );

  // En rad i taget är utfälld: förslagen och listan har egna nycklar.
  const [expanded, setExpanded] = useState<string | null>(
    initial ? `lista-${initial.versionId}` : null,
  );
  const [weeks, setWeeks] = useState(initial ? String(initial.maxWeeks) : "");
  const [levelId, setLevelId] = useState(
    initial ? (defaultLevel(initial.levels, previousLevelKey)?.id ?? "") : "",
  );
  const [startDate, setStartDate] = useState(defaultStart);

  const expand = (key: string, plan: PickerPlan) => {
    setError(null);
    if (expanded === key) {
      setExpanded(null);
      return;
    }
    setExpanded(key);
    setWeeks(String(plan.maxWeeks));
    setLevelId(defaultLevel(plan.levels, previousLevelKey)?.id ?? "");
  };

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const words = normalize(query).split(/\s+/).filter(Boolean);
  const matches = (p: PickerPlan) =>
    (scope === "alla" || p.forSport) &&
    (focus === "alla" || p.focus === focus) &&
    words.every((w) =>
      normalize([p.title, p.summary, p.category, p.focusLabel].filter(Boolean).join(" ")).includes(w),
    );
  const shown = plans.filter(matches);
  const suggested = words.length
    ? []
    : suggestions
        .map((s) => ({
          ...s,
          plans: s.versionIds
            .map((id) => plans.find((p) => p.versionId === id))
            .filter((p): p is PickerPlan => !!p && (scope === "alla" || p.forSport)),
        }))
        .filter((s) => s.plans.length > 0);

  const submit = (plan: PickerPlan) => {
    setError(null);
    startTransition(async () => {
      const result = await queuePhase({
        adeptId: adept.id,
        versionId: plan.versionId,
        weeks: Number(weeks),
        levelId,
        startDate: fixedStart ? null : startDate,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setExpanded(null);
      onAdded();
    });
  };

  const row = (key: string, plan: PickerPlan) => {
    const isOpen = expanded === key;
    const start = fixedStart?.start ?? startDate;
    const n = Number(weeks);
    const ends = Number.isFinite(n) && n > 0 && start ? addDays(start, n * 7 - 1) : null;
    return (
      <li key={key} className="rounded-md border border-line bg-surface">
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => expand(key, plan)}
          className="flex w-full flex-col gap-2 rounded-md px-4 py-3 text-left transition-colors hover:bg-surface-2"
        >
          <span className="flex w-full items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="block font-medium text-text">{plan.title}</span>
              <span className="block text-[0.75rem] text-text-muted">
                {[plan.category, plan.focusLabel, weeksText(plan), plan.hours]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            <ChevronDown
              aria-hidden
              className={cn(
                "mt-0.5 size-4 shrink-0 text-text-subtle transition-transform",
                isOpen && "rotate-180",
              )}
            />
          </span>
          {plan.phases.length > 0 && (
            <PhaseLadder phases={plan.phases} showLabels={false} className="opacity-90" />
          )}
        </button>

        {isOpen && (
          <form
            className="space-y-4 border-t border-line px-4 py-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit(plan);
            }}
          >
            {plan.summary && (
              <p className="text-[0.8125rem] leading-relaxed text-text-muted">{plan.summary}</p>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Veckor" htmlFor={`${key}-veckor`} hint={weeksText(plan)}>
                <Input
                  id={`${key}-veckor`}
                  type="number"
                  inputMode="numeric"
                  min={plan.minWeeks}
                  max={plan.maxWeeks}
                  value={weeks}
                  onChange={(e) => setWeeks(e.target.value)}
                />
              </Field>
              <Field label="Nivå" htmlFor={`${key}-niva`}>
                <Select
                  id={`${key}-niva`}
                  value={levelId}
                  onChange={(e) => setLevelId(e.target.value)}
                >
                  {plan.levels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </Select>
              </Field>
              {fixedStart ? (
                <Field
                  label="Börjar"
                  htmlFor={`${key}-start`}
                  hint={`Direkt efter ${fixedStart.after}.`}
                >
                  <Input id={`${key}-start`} value={formatDate(fixedStart.start)} disabled readOnly />
                </Field>
              ) : (
                <Field label="Börjar" htmlFor={`${key}-start`} hint="Måndag är förvalt.">
                  <Input
                    id={`${key}-start`}
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </Field>
              )}
            </div>
            {ends && (
              <p className="text-[0.8125rem] text-text-muted tabular-nums">
                {formatDate(start)} till {formatDate(ends)}
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-warn">
                {error}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={pending} className="font-semibold">
                {pending ? "Lägger på …" : `Lägg på ${adept.firstName}`}
              </Button>
              <Link
                href={`${routes.planLibrary}/${plan.slug}?adept=${adept.id}`}
                className="text-[0.8125rem] font-medium text-accent-text hover:underline"
              >
                Se hela planen
              </Link>
            </div>
          </form>
        )}
      </li>
    );
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="valj-plan-rubrik"
      className="m-auto max-h-[min(92dvh,56rem)] w-[min(52rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-line bg-surface p-0 text-text shadow-2xl backdrop:bg-black/60"
    >
      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.75rem] font-medium text-text-muted">Lägg till fas</p>
            <h2 id="valj-plan-rubrik" className="text-lg font-semibold">
              Välj plan för {adept.firstName}
            </h2>
            <p className="mt-1 text-[0.8125rem] text-text-muted">
              {fixedStart
                ? `Fasen börjar ${formatDate(fixedStart.start)}, direkt efter ${fixedStart.after}.`
                : "Den första fasen. Du väljer startdag när du fäller ut planen."}
            </p>
          </div>
          <button
            type="button"
            aria-label="Stäng"
            onClick={onClose}
            className="-mr-2 -mt-1 rounded-full p-2 text-text-subtle hover:bg-surface-2 hover:text-text"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="relative block">
            <span className="sr-only">Sök plan</span>
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-subtle"
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Sök på namn, mål eller fokus"
              className="pl-9"
            />
          </label>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Fokus">
            {[["alla", "Alla"] as [string, string], ...focuses].map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={focus === key}
                onClick={() => setFocus(key)}
                className={pill(focus === key)}
              >
                {label}
              </button>
            ))}
          </div>
          {hasSport && sportName && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Gren">
              <button
                type="button"
                aria-pressed={scope === "gren"}
                onClick={() => setScope("gren")}
                className={pill(scope === "gren")}
              >
                Planer för {sportName}
              </button>
              <button
                type="button"
                aria-pressed={scope === "alla"}
                onClick={() => setScope("alla")}
                className={pill(scope === "alla")}
              >
                Alla grenar
              </button>
            </div>
          )}
        </div>

        {suggested.length > 0 && (
          <section aria-labelledby="valj-plan-forslag" className="space-y-3">
            <h3 id="valj-plan-forslag" className="text-sm font-semibold text-text">
              Förslag ur testet och huvudloppet
            </h3>
            {suggested.map((s) => (
              <div key={s.focus} className="space-y-2">
                <p className="text-[0.8125rem] leading-relaxed text-text-muted">
                  <span className="font-medium text-text">{s.label}.</span> {s.reason}
                </p>
                <ul className="space-y-2">
                  {s.plans.map((p) => row(`forslag-${s.focus}-${p.versionId}`, p))}
                </ul>
              </div>
            ))}
          </section>
        )}

        <section aria-labelledby="valj-plan-alla" className="space-y-3">
          <h3 id="valj-plan-alla" className="text-sm font-semibold text-text">
            {suggested.length > 0 ? "Alla planer" : "Planer"}{" "}
            <span className="font-normal text-text-subtle">· {shown.length}</span>
          </h3>
          {shown.length === 0 ? (
            <p className="text-sm text-text-muted">
              Ingen plan passar valen.{" "}
              {scope === "gren" && (
                <button
                  type="button"
                  onClick={() => setScope("alla")}
                  className="font-medium text-accent-text hover:underline"
                >
                  Visa alla grenar
                </button>
              )}
            </p>
          ) : (
            <ul className="space-y-2">{shown.map((p) => row(`lista-${p.versionId}`, p))}</ul>
          )}
        </section>

        <p className="border-t border-line pt-4 text-[0.8125rem] text-text-muted">
          Vill du läsa planerna i lugn och ro?{" "}
          <Link
            href={`${routes.planLibrary}?adept=${adept.id}`}
            className="font-medium text-accent-text hover:underline"
          >
            Öppna planbiblioteket för {adept.firstName}
          </Link>
        </p>
      </div>
    </dialog>
  );
}
