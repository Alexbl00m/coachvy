"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { predictVlamax, type VlamaxInput } from "@/lib/vlamax/model";
import type { Adept, VlamaxSample } from "@/lib/types/database";

import { SaveAsTestResult } from "@/components/vlamax/save-as-test-result";

/** Samma standardvärden som Streamlit-appen öppnade med. */
const DEFAULTS: VlamaxInput = {
  sex: "man",
  weightKg: 70,
  bodyFatPct: 15,
  sprintSeconds: 20,
  wattAvg: 650,
  wattPeak: 900,
};

function decimal(raw: string): number {
  return Number(raw.replace(",", "."));
}

export function VlamaxCalculator({
  samples,
  adepts,
}: {
  samples: VlamaxSample[];
  adepts: Adept[];
}) {
  const [input, setInput] = useState<VlamaxInput>(DEFAULTS);

  // Modellen är liten nog att räknas om vid varje tangenttryck.
  const prediction = useMemo(
    () => predictVlamax(samples, input),
    [samples, input],
  );

  const set = (patch: Partial<VlamaxInput>) =>
    setInput((current) => ({ ...current, ...patch }));

  const valid =
    prediction !== null &&
    Number.isFinite(input.weightKg) &&
    Number.isFinite(input.bodyFatPct) &&
    Number.isFinite(input.sprintSeconds) &&
    Number.isFinite(input.wattAvg) &&
    Number.isFinite(input.wattPeak);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardTitle>Sprinttest</CardTitle>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kön" htmlFor="sex">
            <Select
              id="sex"
              value={input.sex}
              onChange={(e) =>
                set({ sex: e.target.value as VlamaxInput["sex"] })
              }
            >
              <option value="man">Man</option>
              <option value="kvinna">Kvinna</option>
            </Select>
          </Field>

          <Field label="Vikt" htmlFor="weight" hint="kg">
            <Input
              id="weight"
              inputMode="decimal"
              defaultValue={String(DEFAULTS.weightKg)}
              onChange={(e) => set({ weightKg: decimal(e.target.value) })}
            />
          </Field>

          <Field label="Kroppsfett" htmlFor="fat" hint="%">
            <Input
              id="fat"
              inputMode="decimal"
              defaultValue={String(DEFAULTS.bodyFatPct)}
              onChange={(e) => set({ bodyFatPct: decimal(e.target.value) })}
            />
          </Field>

          <Field label="Sprintlängd" htmlFor="duration" hint="sekunder">
            <Input
              id="duration"
              inputMode="decimal"
              defaultValue={String(DEFAULTS.sprintSeconds)}
              onChange={(e) => set({ sprintSeconds: decimal(e.target.value) })}
            />
          </Field>

          <Field label="Snitteffekt" htmlFor="avg" hint="W">
            <Input
              id="avg"
              inputMode="decimal"
              defaultValue={String(DEFAULTS.wattAvg)}
              onChange={(e) => set({ wattAvg: decimal(e.target.value) })}
            />
          </Field>

          <Field label="Toppeffekt" htmlFor="peak" hint="W">
            <Input
              id="peak"
              inputMode="decimal"
              defaultValue={String(DEFAULTS.wattPeak)}
              onChange={(e) => set({ wattPeak: decimal(e.target.value) })}
            />
          </Field>
        </div>

        <p className="mt-5 border-t border-line pt-4 text-[12px] leading-relaxed text-text-subtle">
          Längd och ålder ingår inte i modellen — den använder fettfri massa,
          sprintlängd, snitteffekt, toppeffekt och kön. Vikt och kroppsfett
          räknas ihop till fettfri massa:{" "}
          <span className="text-text-muted">
            {Number.isFinite(input.weightKg) && Number.isFinite(input.bodyFatPct)
              ? `${(input.weightKg * (1 - input.bodyFatPct / 100)).toFixed(1)} kg`
              : "–"}
          </span>
        </p>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardTitle>Beräknad VLamax</CardTitle>

          {valid && prediction ? (
            <>
              <p className="text-4xl font-semibold tracking-tight text-text tabular-nums">
                {prediction.value.toFixed(2)}
                <span className="ml-2 text-base font-normal text-text-muted">
                  mmol/l/s
                </span>
              </p>
              <p className="mt-2 text-[13px] text-text-muted">
                Typiskt fel ±{prediction.rmse.toFixed(2)} på en atlet modellen
                inte sett.
              </p>
              <p className="mt-1 text-[12px] text-text-subtle">
                Tränad på {prediction.sampleCount} uppmätta atleter.
              </p>

              {prediction.outOfRange.length > 0 && (
                <div className="mt-4 rounded-md border border-accent/40 bg-accent-soft p-3">
                  <p className="flex items-center gap-2 text-[13px] font-medium text-text">
                    <AlertTriangle aria-hidden className="size-4 text-accent" />
                    Utanför referensdatan
                  </p>
                  <ul className="mt-2 space-y-1 text-[12px] text-text-muted">
                    {prediction.outOfRange.map((warning) => (
                      <li key={warning.label}>
                        {warning.label}: {warning.value} {warning.unit} — datan
                        täcker {warning.min}–{warning.max} {warning.unit}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[12px] text-text-muted">
                    Siffran är en extrapolation här och bör inte litas på.
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-text-muted">
              Fyll i alla fält med tal för att få en beräkning.
            </p>
          )}
        </Card>

        {valid && prediction && prediction.outOfRange.length === 0 && (
          <SaveAsTestResult adepts={adepts} value={prediction.value} />
        )}
      </div>
    </div>
  );
}
