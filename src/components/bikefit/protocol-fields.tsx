"use client";

import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

import { Field, Input, Textarea } from "@/components/ui/field";
import {
  AREAS,
  BODY,
  INTAKE,
  SCREENING,
  bodyKeys,
  type Screening,
} from "@/lib/bikefit/protocol";
import {
  MEASURE_GROUPS,
  type BikeMeasure,
  type MeasureGroup,
} from "@/lib/bikefit/templates";

export type Strings = Record<string, string>;
/** Funktionstesterna som text, per test: l, r, value och note. */
export type ScreeningStrings = Record<string, Strings>;

const sv = (v: number | undefined) =>
  v === undefined ? "" : String(v).replace(".", ",");
const filled = (s: Strings) =>
  Object.values(s).filter((v) => v.trim() !== "").length;

/**
 * Ett avsnitt som går att fälla ihop, med hur mycket som är ifyllt i
 * rubriken – så att ett långt protokoll går att överblicka.
 */
export function Section({
  title,
  status,
  defaultOpen = false,
  children,
}: {
  title: string;
  status?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group lift min-w-0 rounded-lg border border-line bg-surface"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 p-5 sm:px-6 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-text-subtle transition-transform group-open:rotate-90"
        />
        <h2 className="text-base font-semibold tracking-[-0.005em] text-text">
          {title}
        </h2>
        {status && (
          <span className="ml-auto text-[12px] text-text-subtle">{status}</span>
        )}
      </summary>
      <div className="px-5 pb-5 sm:px-6 sm:pb-6">{children}</div>
    </details>
  );
}

export function IntakeFields({
  value,
  onChange,
}: {
  value: Strings;
  onChange: (key: string, v: string) => void;
}) {
  return (
    <Section
      title="Samtalet"
      status={`${filled(value)} av ${INTAKE.length} ifyllda`}
      defaultOpen
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {INTAKE.map((f) => (
          <Field
            key={f.key}
            label={f.label}
            htmlFor={`samtal-${f.key}`}
            hint={"hint" in f ? f.hint : undefined}
            optional
          >
            <Textarea
              id={`samtal-${f.key}`}
              rows={2}
              maxLength={2000}
              value={value[f.key] ?? ""}
              onChange={(e) => onChange(f.key, e.target.value)}
            />
          </Field>
        ))}
      </div>
    </Section>
  );
}

export function BodyFields({
  value,
  onChange,
  carried,
}: {
  value: Strings;
  onChange: (key: string, v: string) => void;
  /** Måtten kom från förra fiten. */
  carried: boolean;
}) {
  return (
    <Section
      title="Kroppen"
      status={`${filled(value)} mått`}
      defaultOpen={!carried}
    >
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {BODY.map((m) =>
          m.sides ? (
            <fieldset key={m.key} className="min-w-0">
              <legend className="text-[13px] font-medium text-text">
                {m.label}, {m.unit}
              </legend>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {bodyKeys(m).map((key, i) => (
                  <Input
                    key={key}
                    aria-label={`${m.label}, ${i === 0 ? "vänster" : "höger"}`}
                    placeholder={i === 0 ? "vänster" : "höger"}
                    inputMode="decimal"
                    value={value[key] ?? ""}
                    onChange={(e) => onChange(key, e.target.value)}
                  />
                ))}
              </div>
              {m.hint && (
                <p className="mt-1.5 text-[11px] text-text-subtle">{m.hint}</p>
              )}
            </fieldset>
          ) : (
            <Field
              key={m.key}
              label={`${m.label}, ${m.unit}`}
              htmlFor={`kropp-${m.key}`}
              hint={m.hint}
            >
              <Input
                id={`kropp-${m.key}`}
                inputMode="decimal"
                value={value[m.key] ?? ""}
                onChange={(e) => onChange(m.key, e.target.value)}
              />
            </Field>
          ),
        )}
      </div>
      <p className="mt-3 text-[12px] text-text-subtle">
        {carried ? "Ifyllt från förra fiten – ändra det som mätts om. " : ""}
        Lårben och underben räknar om knäböjningen till millimeter sadelhöjd;
        den filmade sidan används när båda är mätta.
      </p>
    </Section>
  );
}

export function ScreeningFields({
  value,
  onChange,
  previous,
}: {
  value: ScreeningStrings;
  onChange: (test: string, field: string, v: string) => void;
  /** Förra fitens värden, som jämförelse i fälten. */
  previous: Screening | null;
}) {
  const count = Object.values(value).filter((t) => filled(t) > 0).length;
  return (
    <Section
      title="Funktionstester av cykeln"
      status={`${count} av ${SCREENING.length} gjorda`}
    >
      <div className="space-y-3">
        {SCREENING.map((t) => {
          const v = value[t.key] ?? {};
          const prev = previous?.[t.key];
          const prevText = (k: "l" | "r" | "value") =>
            prev?.[k] !== undefined ? `förra: ${sv(prev[k])}` : undefined;
          return (
            <div
              key={t.key}
              className="grid gap-2 border-t border-line pt-3 first:border-0 first:pt-0 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]"
            >
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-text">{t.label}</p>
                <p className="text-[12px] text-text-subtle">
                  {t.about}
                  {t.hint ? ` · ${t.hint}` : ""}
                </p>
              </div>
              <div className="flex min-w-0 flex-wrap gap-2">
                {t.unit &&
                  (t.sides ? (["l", "r"] as const) : (["value"] as const)).map(
                    (k) => (
                      <label key={k} className="w-28 shrink-0">
                        <span className="sr-only">
                          {t.label},{" "}
                          {k === "l"
                            ? "vänster"
                            : k === "r"
                              ? "höger"
                              : "värde"}
                        </span>
                        <span
                          aria-hidden
                          className="mb-1 block text-[11px] text-text-subtle"
                        >
                          {k === "l"
                            ? "Vänster"
                            : k === "r"
                              ? "Höger"
                              : "Värde"}
                          , {t.unit}
                        </span>
                        <Input
                          inputMode="decimal"
                          placeholder={prevText(k)}
                          value={v[k] ?? ""}
                          onChange={(e) => onChange(t.key, k, e.target.value)}
                        />
                      </label>
                    ),
                  )}
                <label className="min-w-[12rem] flex-1">
                  <span
                    aria-hidden
                    className="mb-1 block text-[11px] text-text-subtle"
                  >
                    Kommentar
                  </span>
                  <span className="sr-only">{t.label}, kommentar</span>
                  <Input
                    maxLength={500}
                    placeholder={prev?.note ? `förra: ${prev.note}` : undefined}
                    value={v.note ?? ""}
                    onChange={(e) => onChange(t.key, "note", e.target.value)}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/**
 * Cykelns mått före och efter, per del av cykeln. Ett tomt efter-fält
 * betyder oförändrat – det är ändringarna som ska synas.
 */
export function MeasureFields({
  measures,
  before,
  after,
  onBefore,
  onAfter,
  carried,
}: {
  measures: BikeMeasure[];
  before: Strings;
  after: Strings;
  onBefore: (key: string, v: string) => void;
  onAfter: (key: string, v: string) => void;
  carried: boolean;
}) {
  const groups = (Object.keys(MEASURE_GROUPS) as MeasureGroup[])
    .map((g) => ({ g, items: measures.filter((m) => m.group === g) }))
    .filter((x) => x.items.length > 0);
  const changed = measures.filter(
    (m) => (after[m.key] ?? "").trim() !== "" && after[m.key] !== before[m.key],
  ).length;
  return (
    <Section
      title="Cykelns mått"
      status={`${filled(before)} mätta · ${changed} ändrade`}
      defaultOpen
    >
      <p className="mb-4 max-w-3xl text-[13px] text-text-muted">
        Före är cykeln som den kom
        {carried ? " – ifyllt från förra fitens slutläge" : ""}. Fyll i efter
        bara där du ändrade något; tomt betyder oförändrat.
      </p>
      <div className="space-y-5">
        {groups.map(({ g, items }) => (
          <div key={g} className="min-w-0">
            <h3 className="mb-2 text-[13px] font-semibold text-text">
              {MEASURE_GROUPS[g]}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[30rem] text-[13px]">
                <thead className="sr-only">
                  <tr>
                    <th scope="col">Mått</th>
                    <th scope="col">Före</th>
                    <th scope="col">Efter</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((m) => {
                    const unit = m.unit === "text" ? "" : `, ${m.unit}`;
                    return (
                      <tr key={m.key} className="border-t border-line">
                        <th
                          scope="row"
                          className="w-[40%] py-1.5 pr-3 text-left align-top font-normal"
                        >
                          <span className="block text-text">
                            {m.label}
                            {unit}
                          </span>
                          {m.hint && (
                            <span className="block text-[11px] text-text-subtle">
                              {m.hint}
                            </span>
                          )}
                        </th>
                        <td className="py-1.5 pr-2 align-top">
                          <Input
                            aria-label={`${m.label}, före`}
                            placeholder="före"
                            inputMode={m.unit === "text" ? "text" : "decimal"}
                            maxLength={120}
                            value={before[m.key] ?? ""}
                            onChange={(e) => onBefore(m.key, e.target.value)}
                          />
                        </td>
                        <td className="py-1.5 align-top">
                          <Input
                            aria-label={`${m.label}, efter`}
                            placeholder={before[m.key] ? "oförändrat" : "efter"}
                            inputMode={m.unit === "text" ? "text" : "decimal"}
                            maxLength={120}
                            value={after[m.key] ?? ""}
                            onChange={(e) => onAfter(m.key, e.target.value)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function FindingsFields({
  value,
  onChange,
  children,
}: {
  value: Strings;
  onChange: (key: string, v: string) => void;
  /** Checklistan, sammanfattningen och övrigt. */
  children: ReactNode;
}) {
  return (
    <Section
      title="På cykeln: fynd och åtgärder"
      status={`${filled(value)} av ${AREAS.length} områden`}
      defaultOpen
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {AREAS.map((a) => (
          <Field
            key={a.key}
            label={a.label}
            htmlFor={`fynd-${a.key}`}
            hint={a.hint}
            optional
          >
            <Textarea
              id={`fynd-${a.key}`}
              rows={3}
              maxLength={2000}
              value={value[a.key] ?? ""}
              onChange={(e) => onChange(a.key, e.target.value)}
            />
          </Field>
        ))}
      </div>
      <div className="mt-5 border-t border-line pt-5">{children}</div>
    </Section>
  );
}
