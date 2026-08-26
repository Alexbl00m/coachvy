"use client";

import { useMemo, useState } from "react";

import { DataTable, ResultGrid } from "@/components/calculators/result-grid";
import { TestRows, type TestRow } from "@/components/calculators/test-rows";
import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import {
  calculateCriticalSpeed,
  formatSpeed,
  paceForecasts,
  speedZones,
  type Discipline,
} from "@/lib/calculators/critical-speed";
import { isError } from "@/lib/calculators/critical-power";
import { parseMinutes } from "@/lib/calculators/time";

const PRESETS: Record<Discipline, TestRow[]> = {
  löpning: [
    { id: 1, first: "", second: "1500" },
    { id: 2, first: "", second: "5000" },
  ],
  simning: [
    { id: 1, first: "", second: "200" },
    { id: 2, first: "", second: "800" },
  ],
};

export function CriticalSpeedCalculator() {
  const [discipline, setDiscipline] = useState<Discipline>("löpning");
  const [rows, setRows] = useState<TestRow[]>(PRESETS["löpning"]);

  const outcome = useMemo(() => {
    const tests = rows.map((row) => ({
      minutes: parseMinutes(row.first),
      metres: Number(row.second.replace(",", ".")),
    }));
    return calculateCriticalSpeed(
      tests.filter((t) => Number.isFinite(t.minutes) && Number.isFinite(t.metres)),
      discipline,
    );
  }, [rows, discipline]);

  const result = isError(outcome) ? null : outcome;
  const paceUnit = discipline === "simning" ? "/100 m" : "/km";

  function switchDiscipline(next: Discipline) {
    setDiscipline(next);
    setRows(PRESETS[next]);
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {(["löpning", "simning"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={discipline === option}
            onClick={() => switchDiscipline(option)}
            className={cn(
              "rounded-md border px-4 py-2 text-sm font-medium capitalize transition-colors",
              discipline === option
                ? "border-accent bg-accent-soft text-text"
                : "border-line-strong text-text-muted hover:border-accent hover:text-text",
            )}
          >
            {option}
          </button>
        ))}
      </div>

      <Card>
        <CardTitle>Tidtagna distanser</CardTitle>
        <p className="mb-5 text-sm leading-relaxed text-text-muted">
          Två maximala test på olika distanser räcker. Skriv tiden som{" "}
          <span className="text-text">mm:ss</span>. Testerna bör ligga mellan
          ungefär 2 och 20 minuter — kortare än så domineras resultatet av
          distanskapaciteten snarare än av uthålligheten.
        </p>
        <TestRows
          rows={rows}
          onChange={setRows}
          firstLabel="Tid (mm:ss)"
          secondLabel="Distans (m)"
          firstPlaceholder="5:30"
          secondPlaceholder="1500"
        />
      </Card>

      {isError(outcome) ? (
        <p className="rounded-lg border border-dashed border-line-strong bg-surface-2/60 px-6 py-8 text-center text-sm text-text-muted">
          {outcome.error}
        </p>
      ) : (
        result && (
          <>
            <ResultGrid
              items={[
                {
                  label: "Critical speed",
                  value: formatSpeed(result.criticalSpeed, discipline),
                  unit: paceUnit,
                  hint: `${result.criticalSpeed.toFixed(2)} m/s`,
                },
                {
                  label: "D'",
                  value: Math.round(result.dPrime),
                  unit: "m",
                  hint: "Distanskapacitet över CS",
                },
                {
                  label: "Laktattröskel",
                  value: formatSpeed(result.lactateThreshold, discipline),
                  unit: paceUnit,
                  hint: "90 % av CS",
                },
                {
                  label: "VO2max (skattad)",
                  value: result.vo2max ?? "–",
                  unit: result.vo2max ? "ml/kg/min" : undefined,
                  hint: result.vo2max
                    ? "Från farten vid VO2max"
                    : "Skattas inte för simning",
                },
              ]}
            />

            <p className="text-[13px] text-text-subtle">
              {result.goodnessOfFit === null
                ? "Två test definierar linjen exakt, så ingen anpassningsgrad går att mäta. Lägg till ett tredje test för det."
                : `Anpassning R² ${result.goodnessOfFit} % på ${result.testCount} test.`}
            </p>

            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.1em] text-text-muted">
                Tempozoner
              </h2>
              <DataTable
                minWidth={520}
                headers={["Zon", `Långsammast${paceUnit}`, `Mål${paceUnit}`, `Snabbast${paceUnit}`]}
                rows={speedZones(result.criticalSpeed, discipline).map((z) => [
                  z.zone,
                  z.minPace,
                  z.targetPace,
                  z.maxPace,
                ])}
              />
            </div>

            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.1em] text-text-muted">
                Loppprognoser
              </h2>
              <DataTable
                minWidth={520}
                headers={["Distans", "Prognos", `Snittfart${paceUnit}`]}
                rows={paceForecasts(
                  result.criticalSpeed,
                  result.dPrime,
                  discipline,
                ).map((f) => [f.label, f.time, f.pace])}
              />
              <p className="mt-3 text-[12px] text-text-subtle">
                Prognoserna extrapolerar från två korta test. Ju längre distans,
                desto mer beror utfallet på uthållighet som modellen inte mäter —
                behandla maratonraden som en riktning, inte ett mål.
              </p>
            </div>
          </>
        )
      )}
    </div>
  );
}
