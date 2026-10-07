"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { saveReferenceLevels } from "@/lib/benchmarks/actions";
import type { Sex } from "@/lib/benchmarks/coggan";
import {
  MAX_GROUPS,
  METRICS,
  type MetricKey,
  type ReferenceGroup,
} from "@/lib/benchmarks/reference-levels";
import { cn } from "@/lib/cn";

type Draft = {
  id: string;
  name: string;
  /** Fälten som text, så att "4," går att skriva på vägen till "4,5". */
  values: Record<Sex, Partial<Record<MetricKey, string>>>;
};

const toText = (v: number | undefined) =>
  v === undefined ? "" : String(v).replace(".", ",");

function toDraft(groups: ReferenceGroup[]): Draft[] {
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    values: {
      man: Object.fromEntries(
        METRICS.map((m) => [m.key, toText(g.values.man[m.key])]),
      ),
      kvinna: Object.fromEntries(
        METRICS.map((m) => [m.key, toText(g.values.kvinna[m.key])]),
      ),
    },
  }));
}

const SEXES: { key: Sex; label: string }[] = [
  { key: "man", label: "Män" },
  { key: "kvinna", label: "Kvinnor" },
];

/**
 * Coachens referensgrupper: namn, ordning och värden per mått och kön.
 * Grupperna står från lägst till högst nivå.
 */
export function ReferenceLevelsEditor({
  groups,
  isDefault,
}: {
  groups: ReferenceGroup[];
  isDefault: boolean;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>(() => toDraft(groups));
  const [sex, setSex] = useState<Sex>("man");
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const update = (index: number, patch: (d: Draft) => Draft) => {
    setMessage(null);
    setDrafts((list) => list.map((d, i) => (i === index ? patch(d) : d)));
  };

  const move = (index: number, by: -1 | 1) => {
    setMessage(null);
    setDrafts((list) => {
      const next = [...list];
      const [item] = next.splice(index, 1);
      next.splice(index + by, 0, item);
      return next;
    });
  };

  const save = () =>
    start(async () => {
      const payload = {
        groups: drafts.map((d) => ({
          id: d.id,
          name: d.name,
          values: {
            man: Object.fromEntries(
              Object.entries(d.values.man).filter(([, v]) => v && v.trim()),
            ),
            kvinna: Object.fromEntries(
              Object.entries(d.values.kvinna).filter(([, v]) => v && v.trim()),
            ),
          },
        })),
      };
      const result = await saveReferenceLevels(payload);
      setMessage(result.ok ? "Sparat." : result.error);
      if (result.ok) router.refresh();
    });

  const reset = () =>
    start(async () => {
      const result = await saveReferenceLevels(null);
      setMessage(result.ok ? "Utgångsnivåerna gäller igen." : result.error);
      if (result.ok) router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5" role="group" aria-label="Kön">
          {SEXES.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={sex === s.key}
              onClick={() => setSex(s.key)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-[13px] transition-colors",
                sex === s.key
                  ? "border-text-subtle bg-surface-3 text-text"
                  : "border-line-strong text-text-muted hover:text-text",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={drafts.length >= MAX_GROUPS}
          onClick={() => {
            setMessage(null);
            setDrafts((list) => [
              ...list,
              {
                id: `grupp-${Date.now().toString(36)}`,
                name: "Ny grupp",
                values: { man: {}, kvinna: {} },
              },
            ]);
          }}
        >
          <Plus aria-hidden className="size-4" />
          Lägg till grupp
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line align-bottom">
              <th className="py-2 pr-3 text-left text-[12px] font-medium text-text-muted">
                Mått
              </th>
              {drafts.map((d, i) => (
                <th key={d.id} className="min-w-[8.5rem] py-2 pr-2 text-left">
                  <Input
                    aria-label={`Namn på grupp ${i + 1}`}
                    value={d.name}
                    maxLength={30}
                    className="h-8 px-2 py-1 text-[13px] font-medium"
                    onChange={(e) =>
                      update(i, (g) => ({ ...g, name: e.target.value }))
                    }
                  />
                  <span className="mt-1 flex gap-0.5">
                    <button
                      type="button"
                      aria-label={`Flytta ${d.name} ett steg lägre`}
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                      className="rounded p-1 text-text-subtle hover:text-text disabled:opacity-30"
                    >
                      <ChevronLeft aria-hidden className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Flytta ${d.name} ett steg högre`}
                      disabled={i === drafts.length - 1}
                      onClick={() => move(i, 1)}
                      className="rounded p-1 text-text-subtle hover:text-text disabled:opacity-30"
                    >
                      <ChevronRight aria-hidden className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Ta bort ${d.name}`}
                      disabled={drafts.length <= 2}
                      onClick={() => {
                        setMessage(null);
                        setDrafts((list) => list.filter((_, j) => j !== i));
                      }}
                      className="ml-auto rounded p-1 text-text-subtle hover:text-accent disabled:opacity-30"
                    >
                      <Trash2 aria-hidden className="size-3.5" />
                    </button>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map((m) => (
              <tr key={m.key} className="border-b border-line last:border-0">
                <td className="py-2 pr-3 text-text">
                  {m.label}
                  <span className="block text-[12px] text-text-subtle">
                    {m.unit}
                  </span>
                </td>
                {drafts.map((d, i) => (
                  <td key={d.id} className="py-2 pr-2">
                    <Input
                      aria-label={`${m.label}, ${d.name}`}
                      inputMode="decimal"
                      className="h-8 px-2 py-1 tabular-nums"
                      value={d.values[sex][m.key] ?? ""}
                      onChange={(e) =>
                        update(i, (g) => ({
                          ...g,
                          values: {
                            ...g.values,
                            [sex]: {
                              ...g.values[sex],
                              [m.key]: e.target.value,
                            },
                          },
                        }))
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? "Sparar …" : "Spara nivåerna"}
        </Button>
        {!isDefault && (
          <Button
            type="button"
            variant="ghost"
            onClick={reset}
            disabled={pending}
          >
            Återställ utgångsnivåerna
          </Button>
        )}
        {message && (
          <span className="text-[13px] text-text-muted" role="status">
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
