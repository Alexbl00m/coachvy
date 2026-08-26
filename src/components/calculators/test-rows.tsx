"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

export type TestRow = { id: number; first: string; second: string };

/**
 * Delad inmatning för critical power och critical speed: en lista med
 * testrader där varje rad har två fält. Modellen behöver minst två rader.
 */
export function TestRows({
  rows,
  onChange,
  firstLabel,
  secondLabel,
  firstPlaceholder,
  secondPlaceholder,
}: {
  rows: TestRow[];
  onChange: (rows: TestRow[]) => void;
  firstLabel: string;
  secondLabel: string;
  firstPlaceholder: string;
  secondPlaceholder: string;
}) {
  const update = (id: number, patch: Partial<TestRow>) =>
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  const add = () =>
    onChange([
      ...rows,
      { id: Math.max(0, ...rows.map((r) => r.id)) + 1, first: "", second: "" },
    ]);

  const remove = (id: number) => onChange(rows.filter((row) => row.id !== id));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_1fr_auto] gap-3">
        <span className="text-[13px] font-medium text-text">{firstLabel}</span>
        <span className="text-[13px] font-medium text-text">{secondLabel}</span>
        <span className="w-8" />
      </div>

      {rows.map((row, index) => (
        <div key={row.id} className="grid grid-cols-[1fr_1fr_auto] gap-3">
          <Input
            aria-label={`${firstLabel}, test ${index + 1}`}
            inputMode="decimal"
            value={row.first}
            onChange={(e) => update(row.id, { first: e.target.value })}
            placeholder={firstPlaceholder}
          />
          <Input
            aria-label={`${secondLabel}, test ${index + 1}`}
            inputMode="decimal"
            value={row.second}
            onChange={(e) => update(row.id, { second: e.target.value })}
            placeholder={secondPlaceholder}
          />
          <button
            type="button"
            onClick={() => remove(row.id)}
            disabled={rows.length <= 2}
            aria-label={`Ta bort test ${index + 1}`}
            className="grid w-8 place-items-center rounded-md text-text-subtle transition-colors hover:text-red-400 disabled:opacity-30"
          >
            <Trash2 aria-hidden className="size-4" />
          </button>
        </div>
      ))}

      <Button variant="secondary" size="sm" onClick={add}>
        <Plus aria-hidden className="size-3.5" />
        Lägg till test
      </Button>
    </div>
  );
}
