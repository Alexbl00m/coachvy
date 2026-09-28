"use client";

import { useId, useState } from "react";
import { FileUp, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { bestEfforts, FIT_SLOTS, type FoundEffort } from "@/lib/tests/fit-efforts";
import { readRides } from "@/lib/tests/fit-read";
import {
  formatDuration,
  type EffortRow,
} from "@/lib/tests/use-protocol-calculator";

type Patch = Partial<Omit<EffortRow, "id">>;

/**
 * Hämtar insatserna ur cykeldatorns filer.
 *
 * Coachen väljer en eller flera .fit-filer – en per testdag – och ser vad som
 * hittades per längd innan något fylls i. Bara riktiga insatser är förvalda;
 * ett bästa fönster som kan ligga mitt i en längre insats visas men måste
 * väljas aktivt.
 */
export function FitImport({
  protocol,
  onApply,
}: {
  protocol: string;
  /** Raderna, i protokollets ordning, och den senaste dagen en insats gjordes. */
  onApply: (rows: Patch[], lastDate: string) => void;
}) {
  const slots = FIT_SLOTS[protocol];
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<(FoundEffort | null)[] | null>(null);
  const [chosen, setChosen] = useState<boolean[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [fileCount, setFileCount] = useState(0);
  const [dragging, setDragging] = useState(false);

  if (!slots) return null;

  const read = async (files: File[]) => {
    if (files.length === 0) return;
    setBusy(true);
    setProblems([]);
    try {
      const { rides, problems: issues } = await readRides(files);
      const result = rides.length > 0 ? bestEfforts(rides, slots) : null;
      setFound(result);
      setChosen(result ? result.map((f) => Boolean(f?.isolated)) : []);
      setFileCount(rides.length);
      setProblems(issues);
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!found) return;
    // Protokoll med givna längder (den metabola profilen) behåller en rad per
    // längd, också de som inte hittades. Övriga får bara de valda.
    const keepAll = protocol === "metabol-profil";
    const rows: Patch[] = [];
    const dates: string[] = [];
    found.forEach((f, i) => {
      if (f && chosen[i]) {
        rows.push({
          intensity: String(f.watts),
          duration: formatDuration(f.seconds),
          heartRate: f.heartRateAvg ? String(f.heartRateAvg) : "",
          heartRateMax: f.heartRateMax ? String(f.heartRateMax) : "",
          date: f.date,
        });
        dates.push(f.date);
      } else if (keepAll) {
        rows.push({ duration: formatDuration(slots[i].target) });
      }
    });
    if (dates.length === 0) return;
    onApply(rows, [...dates].sort().at(-1) as string);
  };

  const count = chosen.filter(Boolean).length;

  return (
    <div className="mb-5 space-y-3 print:hidden">
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void read(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          "flex cursor-pointer flex-wrap items-center gap-3 rounded-lg border border-dashed px-4 py-3 text-sm transition-colors",
          dragging ? "border-accent bg-accent-soft" : "border-line-strong hover:border-accent/60",
        )}
      >
        <FileUp aria-hidden className="size-5 shrink-0 text-accent" />
        <span className="min-w-0 flex-1">
          <span className="font-medium text-text">
            {busy ? "Läser filerna …" : "Hämta insatserna ur cykeldatorn"}
          </span>
          <span className="block text-[12px] text-text-subtle">
            Välj eller släpp en .fit-fil per testdag – från Garmin, Wahoo, Hammerhead eller
            Zwift. Filen läses här i webbläsaren och laddas aldrig upp.
          </span>
        </span>
        <input
          id={inputId}
          type="file"
          accept=".fit,.FIT"
          multiple
          className="sr-only"
          onChange={(e) => {
            void read(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </label>

      {problems.length > 0 && (
        <ul className="space-y-1 text-[13px] text-text-muted">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      {found && (
        <div className="rounded-lg border border-line">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm" style={{ minWidth: 560 }}>
              <thead>
                <tr className="border-b border-line text-left text-[12px] uppercase tracking-[0.08em] text-text-muted">
                  <th className="px-3 py-2 font-medium">Använd</th>
                  <th className="px-3 py-2 font-medium">Längd</th>
                  <th className="px-3 py-2 text-right font-medium">Effekt</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Puls snitt / max</th>
                  <th className="px-3 py-2 font-medium">Dag</th>
                </tr>
              </thead>
              <tbody>
                {slots.map((slot, i) => {
                  const f = found[i];
                  return (
                    <tr key={slot.label} className="border-b border-line align-top last:border-b-0">
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          aria-label={`Använd ${slot.label}`}
                          disabled={!f}
                          checked={Boolean(chosen[i])}
                          onChange={(e) =>
                            setChosen((c) => c.map((v, k) => (k === i ? e.target.checked : v)))
                          }
                          className="size-4 accent-[var(--color-accent)]"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-medium text-text">{slot.label}</span>
                        {f && (
                          <span className="ml-2 text-[12px] text-text-subtle tabular-nums">
                            {formatDuration(f.seconds)}
                          </span>
                        )}
                        {f && !f.isolated && (
                          <span className="mt-1 flex items-start gap-1.5 text-[12px] text-text-muted">
                            <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0 text-accent" />
                            Ingen egen insats på den här längden – bästa fönstret i passet, troligen
                            en del av en längre insats.
                          </span>
                        )}
                        {!f && <span className="ml-2 text-[12px] text-text-subtle">hittades inte</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-text">
                        {f ? `${f.watts} W` : "–"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-text-muted">
                        {f?.heartRateAvg ? `${f.heartRateAvg} / ${f.heartRateMax}` : "–"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-text-muted">{f?.date ?? "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-line px-3 py-2.5">
            <Button type="button" size="sm" onClick={apply} disabled={count === 0}>
              Fyll i {count} {count === 1 ? "insats" : "insatser"}
            </Button>
            <span className="text-[12px] text-text-subtle">
              Ur {fileCount} pass. Raderna går att ändra efteråt.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
