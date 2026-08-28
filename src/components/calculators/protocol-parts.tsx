"use client";

import { Plus, Trash2 } from "lucide-react";

import { DataTable, ResultGrid } from "@/components/calculators/result-grid";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import type { IntensityUnit, Sport } from "@/lib/calculators/lactate";
import { cn } from "@/lib/cn";
import type { SessionAnalysis } from "@/lib/tests/analysis";
import type { Protocol, ProtocolKey } from "@/lib/tests/protocols";
import type { EffortRow } from "@/lib/tests/use-protocol-calculator";

const SPORTS: { id: Sport; label: string }[] = [
  { id: "cykling", label: "Cykling" },
  { id: "löpning", label: "Löpning" },
  { id: "simning", label: "Simning" },
];

const sv = (value: number, digits: number) =>
  value.toFixed(digits).replace(".", ",");

/** Watt och meter är heltal; farter och kvoter behöver decimaler. */
const digitsFor = (unit: string) =>
  unit === "W" || unit === "m" || unit === "%" || unit === "ml/kg/min" ? 0 : 2;

/** Gren och protokoll. Samma val i appen och på den publika sidan. */
export function ProtocolPicker({
  sport,
  onSport,
  protocol,
  onProtocol,
  available,
}: {
  sport: Sport;
  onSport: (next: Sport) => void;
  protocol: ProtocolKey;
  onProtocol: (next: ProtocolKey) => void;
  available: Protocol[];
}) {
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {SPORTS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSport(s.id)}
            aria-pressed={sport === s.id}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm transition-colors",
              sport === s.id
                ? "border-accent bg-accent-soft text-text"
                : "border-line-strong text-text-muted hover:border-accent/60 hover:text-text",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {available.map((item) => {
          const active = item.key === protocol;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onProtocol(item.key)}
              aria-pressed={active}
              className={cn(
                "w-full rounded-lg border p-4 text-left transition-colors",
                active
                  ? "border-accent bg-accent-soft"
                  : "border-line hover:border-accent/60",
              )}
            >
              <span className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-medium text-text">{item.label}</span>
                <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-text-muted">
                  {item.remote ? "på distans" : "på plats"}
                </span>
              </span>
              <span className="mt-1.5 block text-[13px] leading-relaxed text-text-muted">
                {item.purpose}
              </span>
              <span className="mt-2 block text-[12px] text-text-subtle">
                Ger: {item.produces.join(", ")}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

/** Rådatatabellen. Vilka kolumner som visas styrs av protokollets form. */
export function EffortTable({
  rows,
  spec,
  unit,
  onChange,
  onAdd,
  onRemove,
}: {
  rows: EffortRow[];
  spec: Protocol | null;
  unit: IntensityUnit;
  onChange: (id: number, patch: Partial<EffortRow>) => void;
  onAdd: () => void;
  onRemove: (id: number) => void;
}) {
  const shape = spec?.shape;
  const stepwise = Boolean(shape?.lactate);

  return (
    <Card className="min-w-0">
      <CardTitle
        action={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onAdd}
            className="print:hidden"
          >
            <Plus aria-hidden className="size-4" />
            {stepwise ? "Lägg till steg" : "Lägg till insats"}
          </Button>
        }
      >
        {stepwise ? "Stegen" : "Insatserna"}
      </CardTitle>

      <div className="overflow-x-auto">
        <table
          className="w-full border-collapse text-sm"
          style={{ minWidth: "480px" }}
        >
          <thead>
            <tr className="border-b border-line text-left">
              <th className="pb-2 pr-3 text-[12px] font-medium uppercase tracking-[0.08em] text-text-muted">
                #
              </th>
              {shape?.intensity && (
                <th className="pb-2 pr-3 text-[12px] font-medium uppercase tracking-[0.08em] text-text-muted">
                  Belastning ({unit})
                </th>
              )}
              {shape?.duration && (
                <th className="pb-2 pr-3 text-[12px] font-medium uppercase tracking-[0.08em] text-text-muted">
                  Längd (m:ss)
                </th>
              )}
              {shape?.distance && (
                <th className="pb-2 pr-3 text-[12px] font-medium uppercase tracking-[0.08em] text-text-muted">
                  Sträcka (m)
                </th>
              )}
              {shape?.lactate && (
                <th className="pb-2 pr-3 text-[12px] font-medium uppercase tracking-[0.08em] text-text-muted">
                  Laktat
                </th>
              )}
              {shape?.heartRate && (
                <th className="pb-2 pr-3 text-[12px] font-medium uppercase tracking-[0.08em] text-text-muted">
                  Puls
                </th>
              )}
              <th className="pb-2 print:hidden" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id} className="border-b border-line last:border-b-0">
                <td className="py-2 pr-3 text-[13px] text-text-subtle tabular-nums">
                  {index}
                </td>
                {shape?.intensity && (
                  <td className="py-2 pr-3">
                    <Input
                      aria-label={`Belastning ${index}`}
                      inputMode="decimal"
                      value={row.intensity}
                      onChange={(e) => onChange(row.id, { intensity: e.target.value })}
                    />
                  </td>
                )}
                {shape?.duration && (
                  <td className="py-2 pr-3">
                    <Input
                      aria-label={`Längd ${index}`}
                      value={row.duration}
                      placeholder="3:00"
                      onChange={(e) => onChange(row.id, { duration: e.target.value })}
                    />
                  </td>
                )}
                {shape?.distance && (
                  <td className="py-2 pr-3">
                    <Input
                      aria-label={`Sträcka ${index}`}
                      inputMode="decimal"
                      value={row.distance}
                      onChange={(e) => onChange(row.id, { distance: e.target.value })}
                    />
                  </td>
                )}
                {shape?.lactate && (
                  <td className="py-2 pr-3">
                    <Input
                      aria-label={`Laktat ${index}`}
                      inputMode="decimal"
                      value={row.lactate}
                      onChange={(e) => onChange(row.id, { lactate: e.target.value })}
                    />
                  </td>
                )}
                {shape?.heartRate && (
                  <td className="py-2 pr-3">
                    <Input
                      aria-label={`Puls ${index}`}
                      inputMode="numeric"
                      value={row.heartRate}
                      onChange={(e) => onChange(row.id, { heartRate: e.target.value })}
                    />
                  </td>
                )}
                <td className="py-2 print:hidden">
                  <button
                    type="button"
                    aria-label={`Ta bort rad ${index}`}
                    onClick={() => onRemove(row.id)}
                    disabled={rows.length <= 1}
                    className="rounded-md p-1.5 text-text-subtle transition-colors hover:text-accent disabled:opacity-30"
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
  );
}

/** Enhetsval för löpning och simning. Cykel har bara watt. */
export function UnitField({
  sport,
  unit,
  onChange,
}: {
  sport: Sport;
  unit: IntensityUnit;
  onChange: (next: IntensityUnit) => void;
}) {
  if (sport === "cykling") return null;

  return (
    <Field
      label="Enhet"
      htmlFor="unit"
      hint={sport === "löpning" ? "Rullband rapporteras oftast i km/h" : undefined}
    >
      <Select
        id="unit"
        value={unit}
        onChange={(e) => onChange(e.target.value as IntensityUnit)}
      >
        <option value="km/h">km/h</option>
        <option value="m/s">m/s</option>
      </Select>
    </Field>
  );
}

/** Nyckeltal, zoner och varningar. */
export function ProtocolResults({ analysis }: { analysis: SessionAnalysis }) {
  if (analysis.metrics.length === 0 && analysis.warnings.length === 0) return null;

  return (
    <>
      {analysis.metrics.length > 0 && (
        <ResultGrid
          items={analysis.metrics
            .filter((m) => m.isPrimary)
            .slice(0, 4)
            .map((m) => ({
              label: m.label,
              value: sv(m.value, digitsFor(m.unit)),
              unit: m.unit,
              hint: m.method,
            }))}
        />
      )}

      {analysis.metrics.some((m) => !m.isPrimary) && (
        <Card className="min-w-0">
          <CardTitle>Alla värden</CardTitle>
          <DataTable
            headers={["Storhet", "Metod", "Värde"]}
            minWidth={460}
            rows={analysis.metrics.map((m) => [
              m.label,
              m.method ?? "–",
              `${sv(m.value, digitsFor(m.unit))} ${m.unit}`,
            ])}
          />
        </Card>
      )}

      {analysis.zones.length > 0 && (
        <Card className="min-w-0">
          <CardTitle>Zoner</CardTitle>
          <DataTable
            headers={["Zon", `Spann (${analysis.zoneUnit})`, "Vad den gör"]}
            minWidth={520}
            rows={analysis.zones.map((z) => {
              const d = digitsFor(analysis.zoneUnit);
              return [
                z.zone,
                z.min === null
                  ? `< ${sv(z.max as number, d)}`
                  : z.max === null
                    ? `> ${sv(z.min, d)}`
                    : `${sv(z.min, d)}–${sv(z.max, d)}`,
                z.description,
              ];
            })}
          />
        </Card>
      )}

      {analysis.warnings.length > 0 && (
        <Card>
          <CardTitle>Att veta om resultatet</CardTitle>
          <ul className="space-y-2 text-sm leading-relaxed text-text-muted">
            {analysis.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
