"use client";

import { Fragment, useState } from "react";
import { Trash2 } from "lucide-react";

import { Input } from "@/components/ui/field";
import { SERIES } from "@/lib/calculators/chart-colors";
import { cn } from "@/lib/cn";
import { parseDuration } from "@/lib/tests/use-protocol-calculator";
import {
  formatDuration,
  formatPace,
  resolveStep,
  type StepKind,
  type Workout,
  type WorkoutStep,
} from "@/lib/workouts/schema";

/**
 * Passet som tabell, och passet som formulär – samma sak.
 *
 * Ett genererat pass träffar sällan helt rätt första gången, och alternativet
 * till att kunna ändra en siffra är att skriva om hela prompten. Därför är
 * varje längd och varje mål ett fält: ändringen slår igenom i grafen och i
 * W′bal direkt, utan att modellen behöver tillfrågas igen.
 *
 * Utan `onChange` läses tabellen bara. Ett sparat pass är en föreskrift, och
 * den ska inte gå att ändra av misstag när den öppnas.
 */

const KIND_COLOR: Record<StepKind, string> = {
  uppvärmning: "var(--text-subtle)",
  intervall: SERIES.primary,
  vila: SERIES.secondary,
  distans: SERIES.tertiary,
  nedvarvning: "var(--text-subtle)",
};

const sv = (value: number, digits: number) =>
  value.toFixed(digits).replace(".", ",");

/** Adressen till ett steg i blocklistan. */
type Address = { blockIndex: number; stepIndex: number };
const keyOf = (a: Address) => `${a.blockIndex}:${a.stepIndex}`;

const th =
  "pb-2 pr-3 text-left text-[12px] font-medium uppercase tracking-[0.08em] text-text-muted";

export function WorkoutSteps({
  workout,
  reference,
  onChange,
}: {
  workout: Workout;
  reference: number;
  onChange?: (next: Workout) => void;
}) {
  /**
   * Utkast för längdfältet.
   *
   * Ett fält som tolkas vid varje tangenttryck kan inte innehålla "1:" på
   * vägen till "1:30" – det skulle skrivas om till något giltigt mitt i
   * inmatningen. Utkastet får stå kvar som text tills det går att tolka.
   */
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const editable = typeof onChange === "function";

  const patchStep = (address: Address, patch: Partial<WorkoutStep>) => {
    if (!onChange) return;
    onChange({
      ...workout,
      blocks: workout.blocks.map((block, blockIndex) => {
        if (blockIndex !== address.blockIndex) return block;
        if (block.type === "steg") {
          return { ...block, step: { ...block.step, ...patch } };
        }
        return {
          ...block,
          steps: block.steps.map((step, stepIndex) =>
            stepIndex === address.stepIndex ? { ...step, ...patch } : step,
          ),
        };
      }),
    });
  };

  const setTimes = (blockIndex: number, times: number) => {
    if (!onChange) return;
    onChange({
      ...workout,
      blocks: workout.blocks.map((block, index) =>
        index === blockIndex && block.type === "repetition"
          ? { ...block, times: Math.max(1, Math.round(times)) }
          : block,
      ),
    });
  };

  const removeStep = (address: Address) => {
    if (!onChange) return;
    const blocks = workout.blocks.flatMap((block, blockIndex) => {
      if (blockIndex !== address.blockIndex) return [block];
      if (block.type === "steg") return [];
      const steps = block.steps.filter((_, i) => i !== address.stepIndex);
      return steps.length === 0 ? [] : [{ ...block, steps }];
    });
    // Ett pass utan steg är inget pass. Sista raden går inte att ta bort.
    if (blocks.length === 0) return;
    onChange({ ...workout, blocks });
  };

  const rows: { address: Address; step: WorkoutStep; inRepeat: boolean }[] = [];
  const headers = new Map<number, number>();

  workout.blocks.forEach((block, blockIndex) => {
    if (block.type === "steg") {
      rows.push({
        address: { blockIndex, stepIndex: 0 },
        step: block.step,
        inRepeat: false,
      });
      return;
    }
    headers.set(blockIndex, block.times);
    block.steps.forEach((step, stepIndex) => {
      rows.push({ address: { blockIndex, stepIndex }, step, inRepeat: true });
    });
  });

  let lastHeader = -1;

  return (
    <div className="overflow-x-auto">
      <table
        className="w-full border-collapse text-sm"
        style={{ minWidth: "560px" }}
      >
        <thead>
          <tr className="border-b border-line">
            <th className={th}>Steg</th>
            <th className={th}>Längd</th>
            <th className={th}>Mål (% av {workout.basis})</th>
            <th className={th}>I tal</th>
            {editable && <th className="pb-2 print:hidden" />}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ address, step, inRepeat }) => {
            const showHeader =
              inRepeat &&
              address.blockIndex !== lastHeader &&
              headers.has(address.blockIndex);
            if (showHeader) lastHeader = address.blockIndex;

            const byDistance =
              step.durationSeconds === null && step.distanceM !== null;
            const key = keyOf(address);
            const committed = byDistance
              ? String(Math.round(step.distanceM as number))
              : formatDuration(step.durationSeconds ?? 0);
            const resolved = resolveStep(step, reference, workout.sport);
            const target =
              step.low === step.high
                ? `${Math.round(step.low * 100)} %`
                : `${Math.round(step.low * 100)}–${Math.round(step.high * 100)} %`;

            return (
              <Fragment key={key}>
                {showHeader && (
                  <tr className="border-b border-line/60">
                    <td colSpan={editable ? 5 : 4} className="py-2">
                      {editable ? (
                        <label className="flex items-center gap-2 text-[13px] text-text-muted">
                          <Input
                            aria-label="Antal varv"
                            inputMode="numeric"
                            className="h-7 w-16 px-2 py-1 text-[13px]"
                            value={String(headers.get(address.blockIndex))}
                            onChange={(e) =>
                              setTimes(
                                address.blockIndex,
                                Number(e.target.value) || 1,
                              )
                            }
                          />
                          <span>× följande</span>
                        </label>
                      ) : (
                        <span className="text-[13px] font-medium text-text">
                          {headers.get(address.blockIndex)} × följande
                        </span>
                      )}
                    </td>
                  </tr>
                )}

                <tr className="border-b border-line last:border-b-0">
                  <td className={cn("py-2 pr-3", inRepeat && "pl-5")}>
                    <span className="flex items-baseline gap-2">
                      <span
                        aria-hidden
                        className="size-2 shrink-0 translate-y-px rounded-full"
                        style={{ backgroundColor: KIND_COLOR[step.kind] }}
                      />
                      <span className="text-text">{step.kind}</span>
                      {step.label && (
                        <span className="text-[12px] text-text-subtle">
                          {step.label}
                        </span>
                      )}
                    </span>
                  </td>

                  <td className="py-2 pr-3">
                    {editable ? (
                      <span className="flex items-baseline gap-1.5">
                        <Input
                          aria-label={`Längd ${step.kind}`}
                          className="h-8 w-24 px-2 py-1 tabular-nums"
                          value={drafts[key] ?? committed}
                          onChange={(e) => {
                            const raw = e.target.value;
                            setDrafts((d) => ({ ...d, [key]: raw }));
                            if (byDistance) {
                              const metres = Number(raw.replace(",", "."));
                              if (Number.isFinite(metres) && metres > 0) {
                                patchStep(address, { distanceM: metres });
                              }
                              return;
                            }
                            const seconds = parseDuration(raw);
                            if (seconds !== null && seconds > 0) {
                              patchStep(address, { durationSeconds: seconds });
                            }
                          }}
                          onBlur={() =>
                            setDrafts((d) => {
                              const next = { ...d };
                              delete next[key];
                              return next;
                            })
                          }
                        />
                        <span className="text-[12px] text-text-subtle">
                          {byDistance ? "m" : "m:ss"}
                        </span>
                      </span>
                    ) : (
                      <span className="text-text tabular-nums">
                        {committed}
                        <span className="ml-1 text-[12px] text-text-subtle">
                          {byDistance ? "m" : ""}
                        </span>
                      </span>
                    )}
                  </td>

                  <td className="py-2 pr-3">
                    {editable ? (
                      <span className="flex items-center gap-1.5">
                        <Input
                          aria-label={`Mål ${step.kind}`}
                          inputMode="numeric"
                          className="h-8 w-16 px-2 py-1 tabular-nums"
                          value={String(Math.round(step.low * 100))}
                          onChange={(e) => {
                            const low = Number(e.target.value) / 100;
                            if (!Number.isFinite(low) || low < 0) return;
                            patchStep(address, {
                              low,
                              high: Math.max(low, step.high),
                            });
                          }}
                        />
                        <span className="text-[12px] text-text-subtle">–</span>
                        <Input
                          aria-label={`Övre mål ${step.kind}`}
                          inputMode="numeric"
                          className="h-8 w-16 px-2 py-1 tabular-nums"
                          value={String(Math.round(step.high * 100))}
                          onChange={(e) => {
                            const high = Number(e.target.value) / 100;
                            if (!Number.isFinite(high) || high < 0) return;
                            patchStep(address, {
                              low: Math.min(step.low, high),
                              high,
                            });
                          }}
                        />
                      </span>
                    ) : (
                      <span className="text-text tabular-nums">{target}</span>
                    )}
                  </td>

                  <td className="py-2 pr-3 text-[13px] text-text-muted tabular-nums">
                    {resolved === null ? (
                      "–"
                    ) : workout.sport === "cykling" ? (
                      resolved.low === resolved.high
                        ? `${Math.round(resolved.low)} W`
                        : `${Math.round(resolved.low)}–${Math.round(resolved.high)} W`
                    ) : (
                      <>
                        {formatPace(resolved.high, workout.sport)}
                        {resolved.high !== resolved.low &&
                          `–${formatPace(resolved.low, workout.sport)}`}
                        <span className="ml-2 text-text-subtle">
                          {sv(resolved.target, 2)} m/s
                        </span>
                      </>
                    )}
                    {resolved !== null && byDistance && (
                      <span className="ml-2 text-text-subtle">
                        {formatDuration(resolved.seconds)}
                      </span>
                    )}
                  </td>

                  {editable && (
                    <td className="py-2 print:hidden">
                      <button
                        type="button"
                        aria-label={`Ta bort ${step.kind}`}
                        onClick={() => removeStep(address)}
                        className="rounded-md p-1.5 text-text-subtle transition-colors hover:text-accent"
                      >
                        <Trash2 aria-hidden className="size-4" />
                      </button>
                    </td>
                  )}
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
