"use client";

import { useState } from "react";
import { Lock, Plus, Trash2 } from "lucide-react";

import { DataTable, ResultGrid } from "@/components/calculators/result-grid";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import type { IntensityUnit, Sport } from "@/lib/calculators/lactate";
import { cn } from "@/lib/cn";
import type { SessionAnalysis } from "@/lib/tests/analysis";
import type { Protocol, ProtocolKey } from "@/lib/tests/protocols";
import {
  peakFromRamp,
  type EffortRow,
  type ProtocolCalculator,
} from "@/lib/tests/use-protocol-calculator";

const SPORTS: { id: Sport; label: string }[] = [
  { id: "cykling", label: "Cykling" },
  { id: "löpning", label: "Löpning" },
  { id: "simning", label: "Simning" },
];

const sv = (value: number, digits: number) =>
  value.toFixed(digits).replace(".", ",");

/** Watt och meter är heltal; farter och kvoter behöver decimaler. */
const digitsFor = (unit: string) =>
  ["W", "m", "%", "ml/kg/min", "g/h", "slag/min"].includes(unit)
    ? 0
    : unit === "kJ" || unit === "mmol/l" || unit === "km/h"
      ? 1
      : 2;

/** Gren och protokoll. Samma val i appen och på den publika sidan. */
export function ProtocolPicker({
  sport,
  onSport,
  protocol,
  onProtocol,
  available,
  isLocked = () => false,
}: {
  sport: Sport;
  onSport: (next: Sport) => void;
  protocol: ProtocolKey;
  onProtocol: (next: ProtocolKey) => void;
  available: Protocol[];
  /** Protokoll som syns men kräver medlemskap. */
  isLocked?: (key: ProtocolKey) => boolean;
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
          const locked = isLocked(item.key);
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onProtocol(item.key)}
              aria-pressed={active}
              disabled={locked}
              className={cn(
                "w-full rounded-lg border p-4 text-left transition-colors",
                active
                  ? "border-accent bg-accent-soft"
                  : locked
                    ? "cursor-not-allowed border-dashed border-line opacity-70"
                    : "border-line hover:border-accent/60",
              )}
            >
              <span className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-medium text-text">{item.label}</span>
                <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-text-muted">
                  {item.remote ? "på distans" : "på plats"}
                </span>
                {item.membersOnly && (
                  <span className="inline-flex items-center gap-1 rounded bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent">
                    <Lock aria-hidden className="size-3" />
                    {locked ? "Ingår i medlemskapet" : "Medlem"}
                  </span>
                )}
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

/**
 * Vikt, och för protokoll som räknar per fettfri massa även kroppsfett och kön.
 *
 * För de flesta protokoll är vikten ett tillägg som ger W/kg. För den metabola
 * profilen bär den hela kedjan – utan den ingen VO2max, och utan kroppsfett
 * ingen VLamax – och då ska fältet inte se valfritt ut.
 */
export function BodyFields({ calc }: { calc: ProtocolCalculator }) {
  const needsBody = Boolean(calc.spec?.needsBodyComposition);

  return (
    <>
      <Field
        label="Vikt vid testet"
        htmlFor="weight"
        hint={needsBody ? "kg" : "kg – ger W/kg"}
        optional={!needsBody}
      >
        <Input
          id="weight"
          inputMode="decimal"
          value={calc.weight}
          onChange={(e) => calc.setWeight(e.target.value)}
        />
      </Field>

      {needsBody && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kroppsfett" htmlFor="body_fat" hint="%">
            <Input
              id="body_fat"
              inputMode="decimal"
              value={calc.bodyFat}
              onChange={(e) => calc.setBodyFat(e.target.value)}
            />
          </Field>
          <Field label="Kön" htmlFor="sex">
            <Select
              id="sex"
              value={calc.sex}
              onChange={(e) => calc.setSex(e.target.value as ProtocolCalculator["sex"])}
            >
              <option value="">–</option>
              <option value="man">Man</option>
              <option value="kvinna">Kvinna</option>
            </Select>
          </Field>
        </div>
      )}
    </>
  );
}

/** "17,50" till "17,5" och "17,00" till "17" – men "380" förblir "380". */
const trimDecimals = (text: string) =>
  text.includes(",") ? text.replace(/0+$/, "").replace(/,$/, "") : text;

/**
 * Slutet på ett stegtest: all-out, antingen som en ramp till utmattning eller
 * ett VO2max-test.
 *
 * Toppen kan skrivas in direkt eller räknas ur rampen. Räknehjälpen fyller
 * bara i fältet – det som sparas är toppen, precis som om den skrivits in.
 */
export function FinishCard({ calc }: { calc: ProtocolCalculator }) {
  const [ramp, setRamp] = useState({ last: "", increment: "", seconds: "", onNext: "" });
  if (!calc.spec?.hasFinish) return null;

  const watts = calc.unit === "W";
  const peakName = watts ? "Wmax" : "Vmax";
  const num = (raw: string) => Number(raw.replace(",", "."));
  const fromRamp = peakFromRamp(num(ramp.last), num(ramp.increment), num(ramp.seconds), num(ramp.onNext));
  const setRampField = (patch: Partial<typeof ramp>) => setRamp((r) => ({ ...r, ...patch }));

  return (
    <Card className="min-w-0 print:hidden">
      <CardTitle>Slutet på testet</CardTitle>
      <p className="-mt-1 mb-4 text-[13px] leading-relaxed text-text-muted">
        Avsluta all-out: en ramp till utmattning eller ett VO2max-test. Toppen
        är det tröskeln mäts mot, och det som gör att VLamax kan räknas ur testet.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={peakName} htmlFor="finish_peak" hint={calc.unit} optional>
          <Input
            id="finish_peak"
            inputMode="decimal"
            value={calc.finish.peak}
            onChange={(e) => calc.setFinish({ peak: e.target.value })}
          />
        </Field>
        <Field label="VO2max" htmlFor="finish_vo2max" hint="uppmätt, ml/kg/min" optional>
          <Input
            id="finish_vo2max"
            inputMode="decimal"
            value={calc.finish.vo2max}
            onChange={(e) => calc.setFinish({ vo2max: e.target.value })}
          />
        </Field>
        <Field label="Maxlaktat" htmlFor="finish_lactate" hint="mmol/l" optional>
          <Input
            id="finish_lactate"
            inputMode="decimal"
            value={calc.finish.peakLactate}
            onChange={(e) => calc.setFinish({ peakLactate: e.target.value })}
          />
        </Field>
        <Field label="Maxpuls" htmlFor="finish_hr" hint="slag/min" optional>
          <Input
            id="finish_hr"
            inputMode="decimal"
            value={calc.finish.peakHeartRate}
            onChange={(e) => calc.setFinish({ peakHeartRate: e.target.value })}
          />
        </Field>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <p className="text-[13px] font-medium text-text">{peakName} ur rampen</p>
        <p className="mt-1 text-[12px] leading-relaxed text-text-subtle">
          Sista nivån atleten klarade helt, plus den del av nästa som hanns med.
        </p>
        <div className="mt-3 grid grid-cols-2 items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          <Field label="Sista hela nivån" htmlFor="ramp_last" hint={calc.unit}>
            <Input id="ramp_last" inputMode="decimal" value={ramp.last} onChange={(e) => setRampField({ last: e.target.value })} />
          </Field>
          <Field label="Ökning per nivå" htmlFor="ramp_inc" hint={calc.unit}>
            <Input id="ramp_inc" inputMode="decimal" value={ramp.increment} onChange={(e) => setRampField({ increment: e.target.value })} />
          </Field>
          <Field label="Tid per nivå" htmlFor="ramp_sec" hint="sekunder">
            <Input id="ramp_sec" inputMode="decimal" value={ramp.seconds} onChange={(e) => setRampField({ seconds: e.target.value })} />
          </Field>
          <Field label="Tid på nästa" htmlFor="ramp_next" hint="sekunder">
            <Input id="ramp_next" inputMode="decimal" value={ramp.onNext} onChange={(e) => setRampField({ onNext: e.target.value })} />
          </Field>
          <button
            type="button"
            disabled={fromRamp === null}
            onClick={() =>
              fromRamp !== null &&
              calc.setFinish({ peak: trimDecimals(sv(fromRamp, watts ? 0 : 2)) })
            }
            className="col-span-2 mb-[22px] rounded-md border border-line-strong px-3 py-2 text-[13px] text-text transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-1"
          >
            {fromRamp !== null ? `Använd ${sv(fromRamp, watts ? 0 : 2)}` : "Använd"}
          </button>
        </div>
      </div>
    </Card>
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
