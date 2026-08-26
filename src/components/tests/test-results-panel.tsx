"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";

import { TestChart, type ChartPoint } from "@/components/tests/test-chart";
import { TestResultForm } from "@/components/tests/test-result-form";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, EmptyState } from "@/components/ui/card";
import { formatDate, formatValue } from "@/lib/format";
import { deleteTestResult } from "@/lib/tests/actions";
import type { TestResultWithType } from "@/lib/tests/queries";
import type { TestType } from "@/lib/types/database";

export function TestResultsPanel({
  adeptId,
  adeptName,
  results,
  testTypes,
  canEdit,
}: {
  adeptId: string;
  adeptName: string;
  results: TestResultWithType[];
  testTypes: TestType[];
  canEdit: boolean;
}) {
  const [formOpen, setFormOpen] = useState(false);

  // Only types this adept actually has results for can be plotted.
  const plottableTypes = useMemo(() => {
    const seen = new Map<string, string>();
    for (const result of results) {
      if (result.test_type) seen.set(result.test_type.id, result.test_type.label);
    }
    return [...seen].map(([id, label]) => ({ id, label }));
  }, [results]);

  const [selectedType, setSelectedType] = useState<string | null>(null);
  // Falls back to the first plottable type, and follows along when a brand new
  // type is added — without freezing on a type that no longer has results.
  const activeType =
    plottableTypes.find((type) => type.id === selectedType)?.id ??
    plottableTypes[0]?.id ??
    null;

  const seriesResults = results.filter(
    (result) => result.test_type_id === activeType,
  );

  const points: ChartPoint[] = seriesResults.map((result) => ({
    // slice() because a date column can come back as a bare "YYYY-MM-DD" or
    // as a full ISO timestamp depending on the client's type parsing.
    t: Date.parse(`${result.tested_on.slice(0, 10)}T00:00:00Z`),
    value: Number(result.value),
    label: formatDate(result.tested_on),
  }));

  const activeLabel =
    plottableTypes.find((type) => type.id === activeType)?.label ?? "";
  const activeUnit = seriesResults[seriesResults.length - 1]?.unit ?? "";

  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="flex justify-end">
          <Button
            onClick={() => setFormOpen((open) => !open)}
            variant={formOpen ? "secondary" : "primary"}
            className="font-semibold"
          >
            {formOpen ? (
              <>
                <X aria-hidden className="size-4" />
                Avbryt
              </>
            ) : (
              <>
                <Plus aria-hidden className="size-4" />
                Lägg till testresultat
              </>
            )}
          </Button>
        </div>
      )}

      {canEdit && formOpen && (
        <Card>
          <CardTitle>Nytt testresultat</CardTitle>
          <TestResultForm
            adeptId={adeptId}
            testTypes={testTypes}
            onDone={() => setFormOpen(false)}
          />
        </Card>
      )}

      {results.length === 0 ? (
        <EmptyState
          title="Inga testresultat ännu"
          description={
            canEdit
              ? `Registrera ${adeptName.split(" ")[0]}s första test så ritas kurvan upp här.`
              : "När din coach registrerat ett test dyker det upp här."
          }
        />
      ) : (
        <>
          <Card>
            <CardTitle
              action={
                plottableTypes.length > 1 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {plottableTypes.map((type) => {
                      const active = type.id === activeType;
                      return (
                        <button
                          key={type.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setSelectedType(type.id)}
                          className={
                            active
                              ? "rounded-md border border-accent bg-accent-soft px-2.5 py-1 text-[12px] font-medium text-ink-50"
                              : "rounded-md border border-ink-600 px-2.5 py-1 text-[12px] text-ink-300 hover:border-ink-500 hover:text-ink-100"
                          }
                        >
                          {type.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null
              }
            >
              {/* One series, so the title names it and no legend box is needed. */}
              {activeLabel}
              {activeUnit && (
                <span className="ml-1.5 font-normal normal-case tracking-normal text-ink-400">
                  ({activeUnit})
                </span>
              )}
            </CardTitle>

            {points.length > 0 && (
              <TestChart points={points} unit={activeUnit} />
            )}
          </Card>

          <Card className="p-0 sm:p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-ink-800 text-left">
                    <th className="px-4 py-3 font-medium text-ink-300">Datum</th>
                    <th className="px-4 py-3 font-medium text-ink-300">
                      Testtyp
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-ink-300">
                      Resultat
                    </th>
                    <th className="px-4 py-3 font-medium text-ink-300">Enhet</th>
                    <th className="px-4 py-3 font-medium text-ink-300">
                      Kommentar
                    </th>
                    {canEdit && (
                      <th className="w-10 px-4 py-3">
                        <span className="sr-only">Ta bort</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {[...results]
                    .sort((a, b) => b.tested_on.localeCompare(a.tested_on))
                    .map((result) => (
                      <tr
                        key={result.id}
                        className="border-b border-ink-800 last:border-b-0"
                      >
                        <td className="px-4 py-3 text-ink-200">
                          {formatDate(result.tested_on)}
                        </td>
                        <td className="px-4 py-3 text-ink-200">
                          {result.test_type?.label ?? "–"}
                        </td>
                        {/* Right-aligned + tabular so the numbers line up. */}
                        <td className="px-4 py-3 text-right font-medium text-ink-50 tabular-nums">
                          {formatValue(Number(result.value))}
                        </td>
                        <td className="px-4 py-3 text-ink-400">{result.unit}</td>
                        <td className="px-4 py-3 text-ink-400">
                          {result.comment ?? "–"}
                        </td>
                        {canEdit && (
                          <td className="px-4 py-3 text-right">
                            <form action={deleteTestResult}>
                              <input
                                type="hidden"
                                name="id"
                                value={result.id}
                              />
                              <input
                                type="hidden"
                                name="adept_id"
                                value={adeptId}
                              />
                              <button
                                type="submit"
                                aria-label={`Ta bort testresultat från ${formatDate(result.tested_on)}`}
                                className="text-ink-500 hover:text-red-400"
                              >
                                <Trash2 aria-hidden className="size-4" />
                              </button>
                            </form>
                          </td>
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
