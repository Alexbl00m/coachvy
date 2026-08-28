"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  EffortTable,
  ProtocolPicker,
  ProtocolResults,
  UnitField,
} from "@/components/calculators/protocol-parts";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import type { Sport } from "@/lib/calculators/lactate";
import { routes } from "@/lib/routes";
import { saveTestSession } from "@/lib/tests/session-actions";
import { useProtocolCalculator } from "@/lib/tests/use-protocol-calculator";

const decimal = (raw: string) => Number(raw.replace(",", "."));

/**
 * Registrerar ett testtillfälle på en adept.
 *
 * Protokollval, rådatatabell och resultatvy delas med den publika räknaren –
 * det enda som skiljer är att den här sparar.
 */
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
  const calc = useProtocolCalculator(
    adeptSport,
    adeptWeight ? String(adeptWeight) : "",
  );

  const [performedOn, setPerformedOn] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await saveTestSession({
        adeptId,
        protocol: calc.protocol,
        sport: calc.sport,
        unit: calc.unit,
        performedOn,
        weightKg: calc.weight.trim() ? decimal(calc.weight) : null,
        notes: notes.trim() || null,
        efforts: calc.filled,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`${routes.adepts}/${adeptId}/test/${result.sessionId}`);
    });
  };

  const canSave = calc.analysis.metrics.length > 0 && !pending;
  const stepwise = Boolean(calc.spec?.shape.lactate);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="min-w-0">
          <CardTitle>Protokoll</CardTitle>
          <ProtocolPicker
            sport={calc.sport}
            onSport={calc.setSport}
            protocol={calc.protocol}
            onProtocol={calc.setProtocol}
            available={calc.available}
          />
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

            <UnitField sport={calc.sport} unit={calc.unit} onChange={calc.setUnit} />

            <Field label="Vikt vid testet" htmlFor="weight" hint="kg – ger W/kg" optional>
              <Input
                id="weight"
                inputMode="decimal"
                value={calc.weight}
                onChange={(e) => calc.setWeight(e.target.value)}
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

          {calc.spec && (
            <p className="mt-4 border-t border-line pt-3 text-[12px] leading-relaxed text-text-subtle">
              {calc.spec.howTo}
            </p>
          )}
        </Card>
      </div>

      <EffortTable
        rows={calc.rows}
        spec={calc.spec}
        unit={calc.unit}
        onChange={calc.setRow}
        onAdd={calc.addRow}
        onRemove={calc.removeRow}
      />

      <ProtocolResults analysis={calc.analysis} />

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
          {calc.analysis.metrics.length === 0
            ? `Fyll i minst ${calc.spec?.minEfforts ?? 2} rader så räknas testet ut.`
            : `${calc.filled.length} ${stepwise ? "steg" : "insatser"} · ${calc.analysis.metrics.length} värden sparas`}
        </span>
      </div>
    </div>
  );
}
