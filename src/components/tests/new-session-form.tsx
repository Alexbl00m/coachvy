"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import { DataTable, ResultGrid } from "@/components/calculators/result-grid";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { IntensityUnit, Sport } from "@/lib/calculators/lactate";
import { cn } from "@/lib/cn";
import { routes } from "@/lib/routes";
import { analyseSession, type Effort } from "@/lib/tests/analysis";
import {
  defaultUnitFor,
  protocolByKey,
  protocolsForSport,
  type ProtocolKey,
} from "@/lib/tests/protocols";
import { saveTestSession } from "@/lib/tests/session-actions";

type Row = {
  id: number;
  intensity: string;
  duration: string;
  distance: string;
  lactate: string;
  heartRate: string;
};

const SPORTS: { id: Sport; label: string }[] = [
  { id: "cykling", label: "Cykling" },
  { id: "löpning", label: "Löpning" },
  { id: "simning", label: "Simning" },
];

const decimal = (raw: string) => Number(raw.replace(",", "."));
const sv = (value: number, digits: number) =>
  value.toFixed(digits).replace(".", ",");

/** "3:30" eller "210" till sekunder. */
function parseDuration(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return null;
  if (trimmed.includes(":")) {
    const [m, s = "0"] = trimmed.split(":");
    const minutes = Number(m);
    const seconds = Number(s);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
    return minutes * 60 + seconds;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

const emptyRow = (id: number): Row => ({
  id,
  intensity: "",
  duration: "",
  distance: "",
  lactate: "",
  heartRate: "",
});

export function NewSessionForm({
  adeptId,
  adeptSport,
  adeptWeight,
}: {
  adeptId: string;
  adeptSport: Sport;
  adeptWeight: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [sport, setSport] = useState<Sport>(adeptSport);
  const [protocol, setProtocol] = useState<ProtocolKey>(
    protocolsForSport(adeptSport)[0]?.key ?? "laktat-steg",
  );
  const [unit, setUnit] = useState<IntensityUnit>(defaultUnitFor(adeptSport));
  const [performedOn, setPerformedOn] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [weight, setWeight] = useState(adeptWeight ? String(adeptWeight) : "");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[]>([0, 1, 2].map(emptyRow));
  const [nextId, setNextId] = useState(3);
  const [error, setError] = useState<string | null>(null);

  const spec = protocolByKey(protocol);
  const available = protocolsForSport(sport);

  const selectSport = (next: Sport) => {
    setSport(next);
    setUnit(defaultUnitFor(next));
    const first = protocolsForSport(next)[0];
    if (first && !first.sports.includes(sport)) setProtocol(first.key);
    else if (!protocolsForSport(next).some((p) => p.key === protocol)) {
      setProtocol(protocolsForSport(next)[0].key);
    }
  };

  const setRow = (id: number, patch: Partial<Row>) =>
    setRows((current) =>
      current.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );

  const addRow = () => {
    setRows((current) => [...current, emptyRow(nextId)]);
    setNextId((n) => n + 1);
  };

  const efforts: Effort[] = useMemo(
    () =>
      rows.map((row, index) => {
        const intensity = decimal(row.intensity);
        const distance = decimal(row.distance);
        const lactate = decimal(row.lactate);
        const heartRate = decimal(row.heartRate);
        return {
          ordinal: index,
          intensity: row.intensity.trim() && Number.isFinite(intensity) ? intensity : null,
          durationSeconds: parseDuration(row.duration),
          distanceM: row.distance.trim() && Number.isFinite(distance) ? distance : null,
          lactate: row.lactate.trim() && Number.isFinite(lactate) ? lactate : null,
          heartRate: row.heartRate.trim() && Number.isFinite(heartRate) ? heartRate : null,
        };
      }),
    [rows],
  );

  const filled = efforts.filter(
    (e) =>
      e.intensity !== null ||
      e.distanceM !== null ||
      e.durationSeconds !== null ||
      e.lactate !== null,
  );

  const analysis = useMemo(
    () =>
      analyseSession({
        protocol,
        sport,
        unit,
        efforts: filled,
        weightKg: weight.trim() ? decimal(weight) : null,
      }),
    [protocol, sport, unit, filled, weight],
  );

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await saveTestSession({
        adeptId,
        protocol,
        sport,
        unit,
        performedOn,
        weightKg: weight.trim() ? decimal(weight) : null,
        notes: notes.trim() || null,
        efforts: filled,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`${routes.adepts}/${adeptId}/test/${result.sessionId}`);
    });
  };

  const shape = spec?.shape;
  const canSave = analysis.metrics.length > 0 && !pending;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="min-w-0">
          <CardTitle>Protokoll</CardTitle>

          <div className="mb-4 flex flex-wrap gap-2">
            {SPORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => selectSport(s.id)}
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
                  onClick={() => setProtocol(item.key)}
                  aria-pressed={active}
                  className={cn(
                    "w-full rounded-lg border p-4 text-left transition-colors",
                    active
                      ? "border-accent bg-accent-soft"
                      : "border-line hover:border-accent/60",
                  )}
                >
                  <span className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-medium text-text">
                      {item.label}
                    </span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[11px]",
                        item.remote
                          ? "bg-surface-2 text-text-muted"
                          : "bg-surface-2 text-text-subtle",
                      )}
                    >
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
        </Card>

        <Card className="min-w-0">
          <CardTitle>Om testet</CardTitle>
          <div className="space-y-4">
            <Field label="Datum" htmlFor="performed_on">
              <Input
                id="performed_on"
                type="date"
                value={performedOn}
                onChange={(e) => setPerformedOn(e.target.value)}
              />
            </Field>

            {sport !== "cykling" && (
              <Field label="Enhet" htmlFor="unit" hint="Rullband rapporteras oftast i km/h">
                <Select
                  id="unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as IntensityUnit)}
                >
                  <option value="km/h">km/h</option>
                  <option value="m/s">m/s</option>
                </Select>
              </Field>
            )}

            <Field label="Vikt vid testet" htmlFor="weight" hint="kg – ger W/kg" optional>
              <Input
                id="weight"
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </Field>

            <Field label="Anteckning" htmlFor="notes" optional>
              <Textarea
                id="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </div>

          {spec && (
            <p className="mt-4 border-t border-line pt-3 text-[12px] leading-relaxed text-text-subtle">
              {spec.howTo}
            </p>
          )}
        </Card>
      </div>

      <Card className="min-w-0">
        <CardTitle
          action={
            <Button type="button" variant="ghost" size="sm" onClick={addRow}>
              <Plus aria-hidden className="size-4" />
              {shape?.lactate ? "Lägg till steg" : "Lägg till insats"}
            </Button>
          }
        >
          {shape?.lactate ? "Stegen" : "Insatserna"}
        </CardTitle>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm" style={{ minWidth: "480px" }}>
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
                <th className="pb-2" />
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
                        onChange={(e) => setRow(row.id, { intensity: e.target.value })}
                      />
                    </td>
                  )}
                  {shape?.duration && (
                    <td className="py-2 pr-3">
                      <Input
                        aria-label={`Längd ${index}`}
                        value={row.duration}
                        placeholder="3:00"
                        onChange={(e) => setRow(row.id, { duration: e.target.value })}
                      />
                    </td>
                  )}
                  {shape?.distance && (
                    <td className="py-2 pr-3">
                      <Input
                        aria-label={`Sträcka ${index}`}
                        inputMode="decimal"
                        value={row.distance}
                        onChange={(e) => setRow(row.id, { distance: e.target.value })}
                      />
                    </td>
                  )}
                  {shape?.lactate && (
                    <td className="py-2 pr-3">
                      <Input
                        aria-label={`Laktat ${index}`}
                        inputMode="decimal"
                        value={row.lactate}
                        onChange={(e) => setRow(row.id, { lactate: e.target.value })}
                      />
                    </td>
                  )}
                  {shape?.heartRate && (
                    <td className="py-2 pr-3">
                      <Input
                        aria-label={`Puls ${index}`}
                        inputMode="numeric"
                        value={row.heartRate}
                        onChange={(e) => setRow(row.id, { heartRate: e.target.value })}
                      />
                    </td>
                  )}
                  <td className="py-2">
                    <button
                      type="button"
                      aria-label={`Ta bort rad ${index}`}
                      onClick={() =>
                        setRows((current) => current.filter((r) => r.id !== row.id))
                      }
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

      {analysis.metrics.length > 0 && (
        <>
          <ResultGrid
            items={analysis.metrics
              .filter((m) => m.isPrimary)
              .slice(0, 4)
              .map((m) => ({
                label: m.label,
                value: sv(m.value, m.unit === "W" || m.unit === "m" ? 0 : 2),
                unit: m.unit,
                hint: m.method,
              }))}
          />

          {analysis.zones.length > 0 && (
            <Card>
              <CardTitle>Zoner</CardTitle>
              <DataTable
                headers={["Zon", `Spann (${analysis.zoneUnit})`, "Vad den gör"]}
                minWidth={520}
                rows={analysis.zones.map((z) => [
                  z.zone,
                  z.min === null
                    ? `< ${sv(z.max as number, 1)}`
                    : z.max === null
                      ? `> ${sv(z.min, 1)}`
                      : `${sv(z.min, 1)}–${sv(z.max, 1)}`,
                  z.description,
                ])}
              />
            </Card>
          )}
        </>
      )}

      {analysis.warnings.length > 0 && (
        <Card>
          <ul className="space-y-1.5 text-sm text-text-muted">
            {analysis.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Card>
      )}

      {error && (
        <Card>
          <p className="text-sm text-text">{error}</p>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={!canSave}>
          {pending ? "Sparar …" : "Spara testtillfället"}
        </Button>
        <span className="text-[13px] text-text-subtle">
          {analysis.metrics.length === 0
            ? `Fyll i minst ${spec?.minEfforts ?? 2} rader så räknas testet ut.`
            : `${filled.length} ${shape?.lactate ? "steg" : "insatser"} · ${analysis.metrics.length} värden sparas`}
        </span>
      </div>
    </div>
  );
}

