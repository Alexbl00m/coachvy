"use client";

import { useMemo, useState } from "react";

import { DataTable, ResultGrid } from "@/components/calculators/result-grid";
import { TestRows, type TestRow } from "@/components/calculators/test-rows";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import {
  calculateCriticalPower,
  intervalZones,
  isError,
  powerForDuration,
  timeToExhaustion,
  trainingZones,
} from "@/lib/calculators/critical-power";
import { formatDuration, parseMinutes } from "@/lib/calculators/time";

const INITIAL: TestRow[] = [
  { id: 1, first: "3", second: "" },
  { id: 2, first: "12", second: "" },
];

export function CriticalPowerCalculator() {
  const [rows, setRows] = useState<TestRow[]>(INITIAL);
  const [weight, setWeight] = useState("");
  const [targetWatts, setTargetWatts] = useState("");

  const outcome = useMemo(() => {
    const tests = rows.map((row) => ({
      minutes: parseMinutes(row.first),
      watts: Number(row.second.replace(",", ".")),
    }));
    const weightKg = Number(weight.replace(",", "."));
    return calculateCriticalPower(
      tests.filter((t) => Number.isFinite(t.minutes) && Number.isFinite(t.watts)),
      Number.isFinite(weightKg) && weightKg > 0 ? weightKg : null,
    );
  }, [rows, weight]);

  const result = isError(outcome) ? null : outcome;
  const target = Number(targetWatts.replace(",", "."));
  const tte =
    result && Number.isFinite(target)
      ? timeToExhaustion(result.wPrime, result.criticalPower, target)
      : null;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardTitle>Maxtester</CardTitle>
          <p className="mb-5 text-sm leading-relaxed text-text-muted">
            Två test räcker, men tre eller fler ger ett mått på hur väl modellen
            passar. Testerna bör vara mellan 3 och 20 minuter långa och köras
            maximalt jämnt — helst inte samma dag.
          </p>
          <TestRows
            rows={rows}
            onChange={setRows}
            firstLabel="Längd (minuter)"
            secondLabel="Medeleffekt (W)"
            firstPlaceholder="3"
            secondPlaceholder="380"
          />
        </Card>

        <Card>
          <CardTitle>Kroppsvikt</CardTitle>
          <Field label="Vikt" htmlFor="cp-weight" hint="kg – används för VO2max-skattningen" optional>
            <Input
              id="cp-weight"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="72"
            />
          </Field>
        </Card>
      </div>

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
                  label: "Critical power",
                  value: result.criticalPower,
                  unit: "W",
                  hint: weight ? `${(result.criticalPower / Number(weight.replace(",", "."))).toFixed(2)} W/kg` : undefined,
                },
                { label: "W'", value: result.wPrime, unit: "kJ" },
                {
                  label: "FTP (skattad)",
                  value: result.ftp,
                  unit: "W",
                  hint: "95 % av CP",
                },
                {
                  label: "VO2max (skattad)",
                  value: result.vo2max ?? "–",
                  unit: result.vo2max ? "ml/kg/min" : undefined,
                  hint: result.vo2max ? "ACSM:s cykelekvation" : "Ange vikt",
                },
              ]}
            />

            <p className="text-[13px] text-text-subtle">
              {result.goodnessOfFit === null
                ? `Två test definierar linjen exakt, så ingen anpassningsgrad går att mäta. Lägg till ett tredje test för det.`
                : `Anpassning R² ${result.goodnessOfFit} % på ${result.testCount} test.`}
            </p>

            <Card>
              <CardTitle>Tid till utmattning</CardTitle>
              <div className="grid gap-4 sm:grid-cols-[200px_1fr] sm:items-end">
                <Field label="Måleffekt" htmlFor="cp-target" hint="W">
                  <Input
                    id="cp-target"
                    inputMode="decimal"
                    value={targetWatts}
                    onChange={(e) => setTargetWatts(e.target.value)}
                    placeholder={String(result.criticalPower + 40)}
                  />
                </Field>
                <p className="pb-2 text-sm text-text-muted">
                  {tte
                    ? `Håller i ungefär ${formatDuration(tte)} innan W' är tömt.`
                    : `Ange en effekt över ${result.criticalPower} W — under CP är tiden i modellen obegränsad.`}
                </p>
              </div>

              <div className="mt-5 border-t border-line pt-5">
                <p className="mb-3 text-[13px] font-medium text-text">
                  Effekt som bör kunna hållas
                </p>
                <DataTable
                  minWidth={420}
                  headers={["Varaktighet", "Effekt"]}
                  rows={[60, 300, 600, 1200, 3600].map((seconds) => [
                    formatDuration(seconds),
                    `${powerForDuration(result.wPrime, result.criticalPower, seconds)} W`,
                  ])}
                />
              </div>
            </Card>

            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.1em] text-text-muted">
                Träningszoner
              </h2>
              <DataTable
                headers={["Zon", "Min", "Mitt", "Max", "Kadens", "RPE"]}
                rows={trainingZones(result.criticalPower).map((z) => [
                  z.zone,
                  `${z.min} W`,
                  `${z.mid} W`,
                  `${z.max} W`,
                  z.cadence,
                  z.rpe,
                ])}
              />
            </div>

            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.1em] text-text-muted">
                Intervallzoner
              </h2>
              <DataTable
                headers={["Typ", "Min", "Mitt", "Max", "Vila", "Kadens"]}
                rows={intervalZones(result.criticalPower).map((z) => [
                  z.type,
                  `${z.min} W`,
                  `${z.mid} W`,
                  `${z.max} W`,
                  `${z.recovery} W`,
                  z.cadence,
                ])}
              />
            </div>
          </>
        )
      )}
    </div>
  );
}
