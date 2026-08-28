"use client";

import { useState } from "react";
import { Printer } from "lucide-react";

import {
  EffortTable,
  ProtocolPicker,
  ProtocolResults,
  UnitField,
} from "@/components/calculators/protocol-parts";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { useProtocolCalculator } from "@/lib/tests/use-protocol-calculator";
import { site } from "@/lib/site";

/**
 * Testprotokollen som fri räknare: samma beräkning som i appen, men utan
 * konto och utan att något sparas.
 *
 * Utskriften går via webbläsarens egen dialog i stället för ett PDF-bibliotek.
 * Det ger vektortext, fungerar på alla plattformar utan extra kod, och
 * "Spara som PDF" ligger redan i den dialogen. Ett bibliotek hade lagt till
 * hundratals kilobyte för att göra samma sak sämre.
 */
export function PublicTestCalculator() {
  const calc = useProtocolCalculator();
  const [name, setName] = useState("");
  const [performedOn, setPerformedOn] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const canPrint = calc.analysis.metrics.length > 0;

  return (
    <div className="space-y-6">
      {/* Bara i utskriften: rubrik med namn, protokoll och datum. */}
      <div className="hidden print:block">
        <p className="text-[13px] font-medium uppercase tracking-[0.12em] text-accent">
          {site.name}
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-text">
          {calc.spec?.label ?? "Testberäkning"}
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          {[name, performedOn].filter(Boolean).join(" · ")}
        </p>
      </div>

      <ProtocolResults analysis={calc.analysis} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] print:hidden">
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
            <Field label="Namn" htmlFor="name" hint="hamnar på utskriften" optional>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Datum" htmlFor="performed_on">
              <Input
                id="performed_on"
                type="date"
                value={performedOn}
                onChange={(e) => setPerformedOn(e.target.value)}
              />
            </Field>
            <UnitField
              sport={calc.sport}
              unit={calc.unit}
              onChange={calc.setUnit}
            />
            <Field label="Vikt" htmlFor="weight" hint="kg – ger W/kg" optional>
              <Input
                id="weight"
                inputMode="decimal"
                value={calc.weight}
                onChange={(e) => calc.setWeight(e.target.value)}
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

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Button
          type="button"
          onClick={() => window.print()}
          disabled={!canPrint}
        >
          <Printer aria-hidden className="size-4" />
          Skriv ut eller spara som PDF
        </Button>
        <span className="text-[13px] text-text-subtle">
          {canPrint
            ? "Inget sparas här – ta med dig resultatet som fil."
            : `Fyll i minst ${calc.spec?.minEfforts ?? 2} rader så räknas testet ut.`}
        </span>
      </div>

      <p className="hidden text-[11px] text-text-subtle print:block">
        Beräknat med {site.name}s öppna testverktyg · {site.website}
      </p>
    </div>
  );
}
