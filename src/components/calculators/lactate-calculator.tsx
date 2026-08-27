"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import {
  LactateChart,
  MethodSpread,
} from "@/components/calculators/lactate-chart";
import { DataTable, ResultGrid } from "@/components/calculators/result-grid";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import {
  METHOD_CATEGORIES,
  analyseLactateTest,
  summariseThresholds,
  type FitName,
  type MethodCategory,
  type Sport,
} from "@/lib/calculators/lactate";
import { cn } from "@/lib/cn";

type Row = { id: number; intensity: string; lactate: string; heartRate: string };

/** Ett cykelstegtest på 25 W-steg – samma data som lactater-paketets demo. */
const DEMO: Row[] = [
  { id: 0, intensity: "0", lactate: "0,93", heartRate: "96" },
  { id: 1, intensity: "50", lactate: "0,98", heartRate: "114" },
  { id: 2, intensity: "75", lactate: "1,23", heartRate: "134" },
  { id: 3, intensity: "100", lactate: "1,88", heartRate: "154" },
  { id: 4, intensity: "125", lactate: "2,80", heartRate: "170" },
  { id: 5, intensity: "150", lactate: "4,21", heartRate: "182" },
  { id: 6, intensity: "175", lactate: "6,66", heartRate: "193" },
  { id: 7, intensity: "191", lactate: "8,64", heartRate: "198" },
];

const SPORTS: { id: Sport; label: string; unit: string }[] = [
  { id: "cykling", label: "Cykling", unit: "W" },
  { id: "löpning", label: "Löpning", unit: "m/s" },
  { id: "simning", label: "Simning", unit: "m/s" },
];

const FITS: FitName[] = [
  "3:e gradens polynom",
  "4:e gradens polynom",
  "Naturlig spline",
  "Exponentiell",
];

const decimal = (raw: string) => Number(raw.replace(",", "."));
const sv = (value: number, digits: number) =>
  value.toFixed(digits).replace(".", ",");

export function LactateCalculator() {
  const [rows, setRows] = useState<Row[]>(DEMO);
  const [nextId, setNextId] = useState(DEMO.length);
  const [sport, setSport] = useState<Sport>("cykling");
  const [fit, setFit] = useState<FitName>("3:e gradens polynom");
  const [includeBaseline, setIncludeBaseline] = useState(true);
  const [methods, setMethods] = useState<MethodCategory[]>(
    METHOD_CATEGORIES.map((m) => m.id),
  );

  const unit = SPORTS.find((s) => s.id === sport)?.unit ?? "W";
  const digits = sport === "cykling" ? 1 : 2;

  const setRow = (id: number, patch: Partial<Row>) =>
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );

  const addRow = () => {
    setRows((current) => [
      ...current,
      { id: nextId, intensity: "", lactate: "", heartRate: "" },
    ]);
    setNextId((n) => n + 1);
  };

  const toggleMethod = (id: MethodCategory) =>
    setMethods((current) =>
      current.includes(id)
        ? current.filter((m) => m !== id)
        : [...METHOD_CATEGORIES.map((m) => m.id)].filter(
            (m) => current.includes(m) || m === id,
          ),
    );

  const analysis = useMemo(() => {
    const steps = rows
      .map((row) => ({
        intensity: decimal(row.intensity),
        lactate: decimal(row.lactate),
        heartRate: row.heartRate.trim() ? decimal(row.heartRate) : null,
      }))
      .filter(
        (s) => Number.isFinite(s.intensity) && Number.isFinite(s.lactate),
      );

    return analyseLactateTest({
      steps,
      sport,
      fit,
      includeBaseline,
      methods,
      loglogRestrainer: 1,
    });
  }, [rows, sport, fit, includeBaseline, methods]);

  const summary = useMemo(
    () => (analysis ? summariseThresholds(analysis.results) : null),
    [analysis],
  );

  const results = [
    {
      label: "LT1 · aerob tröskel",
      value: summary?.lt1 !== null && summary?.lt1 !== undefined
        ? sv(summary.lt1, digits)
        : "–",
      unit,
      hint: summary?.lt1Methods.length
        ? `median av ${summary.lt1Methods.length} metoder`
        : undefined,
    },
    {
      label: "LT2 · anaerob tröskel",
      value: summary?.lt2 !== null && summary?.lt2 !== undefined
        ? sv(summary.lt2, digits)
        : "–",
      unit,
      hint: summary?.lt2Methods.length
        ? `median av ${summary.lt2Methods.length} metoder`
        : undefined,
    },
    {
      label: "Zon 2 · spann",
      value:
        summary?.lt1 != null && summary?.lt2 != null
          ? `${sv(summary.lt1, digits)}–${sv(summary.lt2, digits)}`
          : "–",
      unit,
      hint: "mellan trösklarna",
    },
    {
      label: "Metoder",
      value: analysis
        ? analysis.results.filter((r) => r.intensity !== null).length
        : "–",
      hint: analysis ? `av ${analysis.results.length} beräknade` : undefined,
    },
  ];

  return (
    <div className="space-y-6">
      <ResultGrid items={results} />

      {!analysis && (
        <Card>
          <p className="text-sm text-text-muted">
            Fyll i minst fyra steg med både belastning och laktat. Ett
            vilovärde på belastning 0 är valfritt men gör Bsln+ användbar.
          </p>
        </Card>
      )}

      {analysis?.warnings.map((warning) => (
        <Card key={warning}>
          <p className="text-sm text-text-muted">{warning}</p>
        </Card>
      ))}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="min-w-0">
          <CardTitle
            action={
              <Button type="button" variant="ghost" size="sm" onClick={addRow}>
                <Plus aria-hidden className="size-4" />
                Lägg till steg
              </Button>
            }
          >
            Stegtestet
          </CardTitle>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm" style={{ minWidth: "440px" }}>
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="pb-2 pr-3 text-[12px] font-medium uppercase tracking-[0.08em] text-text-muted">
                    Steg
                  </th>
                  <th className="pb-2 pr-3 text-[12px] font-medium uppercase tracking-[0.08em] text-text-muted">
                    Belastning ({unit})
                  </th>
                  <th className="pb-2 pr-3 text-[12px] font-medium uppercase tracking-[0.08em] text-text-muted">
                    Laktat (mmol/l)
                  </th>
                  <th className="pb-2 pr-3 text-[12px] font-medium uppercase tracking-[0.08em] text-text-muted">
                    Puls
                  </th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id} className="border-b border-line last:border-b-0">
                    <td className="py-2 pr-3 text-[13px] text-text-subtle tabular-nums">
                      {index === 0 && decimal(row.intensity) === 0 ? "Vila" : index}
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        aria-label={`Belastning steg ${index}`}
                        inputMode="decimal"
                        value={row.intensity}
                        onChange={(e) => setRow(row.id, { intensity: e.target.value })}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        aria-label={`Laktat steg ${index}`}
                        inputMode="decimal"
                        value={row.lactate}
                        onChange={(e) => setRow(row.id, { lactate: e.target.value })}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        aria-label={`Puls steg ${index}`}
                        inputMode="numeric"
                        value={row.heartRate}
                        onChange={(e) => setRow(row.id, { heartRate: e.target.value })}
                      />
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        aria-label={`Ta bort steg ${index}`}
                        onClick={() =>
                          setRows((current) => current.filter((r) => r.id !== row.id))
                        }
                        disabled={rows.length <= 4}
                        className="rounded-md p-1.5 text-text-subtle transition-colors hover:text-accent disabled:opacity-30 disabled:hover:text-text-subtle"
                      >
                        <Trash2 aria-hidden className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="min-w-0">
          <CardTitle>Inställningar</CardTitle>
          <div className="space-y-4">
            <Field label="Gren" htmlFor="sport">
              <Select
                id="sport"
                value={sport}
                onChange={(e) => setSport(e.target.value as Sport)}
              >
                {SPORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Kurvanpassning"
              htmlFor="fit"
              hint="Dmax och LTratio har egna, fasta kurvor"
            >
              <Select
                id="fit"
                value={fit}
                onChange={(e) => setFit(e.target.value as FitName)}
              >
                {FITS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </Select>
            </Field>

            <label className="flex items-start gap-2.5 text-[13px] text-text">
              <input
                type="checkbox"
                checked={includeBaseline}
                onChange={(e) => setIncludeBaseline(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-accent"
              />
              <span>
                Ta med vilovärdet i kurvan
                <span className="mt-0.5 block text-[11px] text-text-subtle">
                  Påverkar var kurvan börjar böja.
                </span>
              </span>
            </label>

            <div className="border-t border-line pt-4">
              <p className="mb-2 text-[13px] font-medium text-text">Metoder</p>
              <div className="flex flex-wrap gap-1.5">
                {METHOD_CATEGORIES.map((category) => {
                  const active = methods.includes(category.id);
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => toggleMethod(category.id)}
                      aria-pressed={active}
                      title={category.description}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-[12px] transition-colors",
                        active
                          ? "border-accent bg-accent-soft text-text"
                          : "border-line-strong text-text-muted hover:border-accent/60 hover:text-text",
                      )}
                    >
                      {category.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {analysis && summary && (
        <>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card className="min-w-0">
              <CardTitle>Laktatkurvan</CardTitle>
              <LactateChart
                curve={analysis.curve}
                steps={analysis.steps}
                sport={sport}
                lt1={summary.lt1}
                lt2={summary.lt2}
              />
            </Card>

            <Card className="min-w-0">
              <CardTitle>Spridning mellan metoder</CardTitle>
              <MethodSpread
                rows={analysis.results}
                sport={sport}
                lt1={summary.lt1}
                lt2={summary.lt2}
              />
            </Card>
          </div>

          <Card>
            <CardTitle>Alla metoder</CardTitle>
            <DataTable
              headers={["Metod", "Kurva", `Belastning (${unit})`, "Laktat (mmol/l)", "Puls"]}
              minWidth={680}
              rows={analysis.results.map((r) => [
                <span key="m" className="flex items-baseline gap-2">
                  {r.method}
                  {r.note && (
                    <span className="text-[11px] font-normal text-text-subtle">
                      {r.note}
                    </span>
                  )}
                </span>,
                <span key="f" className="text-[12px]">
                  {r.fitting}
                </span>,
                r.intensity === null
                  ? "–"
                  : sport === "simning" && r.pace
                    ? `${sv(r.intensity, digits)} (${sv(r.pace, 1)} s/100m)`
                    : sv(r.intensity, digits),
                r.lactate === null ? "–" : sv(r.lactate, 1),
                r.heartRate === null ? "–" : r.heartRate,
              ])}
            />
          </Card>

          {summary.lt1 !== null && summary.lt2 !== null && (
            <Card>
              <CardTitle>Träningszoner ur trösklarna</CardTitle>
              <DataTable
                headers={["Zon", `Belastning (${unit})`, "Vad den gör"]}
                minWidth={520}
                rows={[
                  [
                    "Zon 1 – under LT1",
                    `< ${sv(summary.lt1, digits)}`,
                    "Laktatet stannar på vilonivå. Här ligger merparten av volymen.",
                  ],
                  [
                    "Zon 2 – mellan trösklarna",
                    `${sv(summary.lt1, digits)}–${sv(summary.lt2, digits)}`,
                    "Laktatet är förhöjt men stabilt. Tempo- och tröskelarbete.",
                  ],
                  [
                    "Zon 3 – över LT2",
                    `> ${sv(summary.lt2, digits)}`,
                    "Laktatet stiger tills arbetet avbryts. Intervaller.",
                  ],
                ]}
              />
              <p className="mt-3 text-[12px] leading-relaxed text-text-subtle">
                Trezonsmodellen är det trösklarna faktiskt definierar: under
                LT1, mellan trösklarna, över LT2. Vill du ha din egen
                femzonsindelning behöver jag procentsatserna du använder – de
                varierar mellan skolor och är inget testet i sig ger.
              </p>
            </Card>
          )}
        </>
      )}

      <Card>
        <CardTitle>Om metoderna</CardTitle>
        <dl className="space-y-3 text-sm leading-relaxed">
          {METHOD_CATEGORIES.map((category) => (
            <div key={category.id}>
              <dt className="font-medium text-text">{category.label}</dt>
              <dd className="text-text-muted">{category.description}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 border-t border-line pt-4 text-[12px] leading-relaxed text-text-subtle">
          Beräkningarna är portade från R-paketet{" "}
          <a
            href="https://github.com/fmmattioni/lactater"
            target="_blank"
            rel="noreferrer"
            className="text-text-muted underline underline-offset-2 hover:text-accent"
          >
            lactater
          </a>{" "}
          av Felipe Mattioni Maturana (MIT-licens), och ger samma svar som det
          paketet på dess egen demodata. Metoderna vilar på publicerad
          forskning – Beaver m.fl. (1985), Heck m.fl. (1985), Cheng m.fl.
          (1992), Bishop m.fl. (1998), Hofmann &amp; Tschakert (2017) med
          flera.
        </p>
      </Card>
    </div>
  );
}
