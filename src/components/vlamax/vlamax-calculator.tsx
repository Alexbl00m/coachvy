"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { BodyFatEstimate } from "@/components/calculators/body-fat-estimate";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { vlamaxFromSprintLactate } from "@/lib/vlamax/lactate";
import { predictVlamax, sprintPerFfm, type VlamaxInput } from "@/lib/vlamax/model";
import type { Adept, VlamaxSample } from "@/lib/types/database";

import { SaveAsTestResult } from "@/components/vlamax/save-as-test-result";

/** Samma standardvärden som Streamlit-appen öppnade med. */
const DEFAULTS: VlamaxInput = {
  sex: "man",
  weightKg: 70,
  bodyFatPct: 15,
  sprintSeconds: 20,
  wattAvg: 650,
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
  // Styrt fält, så att en uppskattning ur BMI kan fyllas i.
  const [fatText, setFatText] = useState(String(DEFAULTS.bodyFatPct));
  const [lactate, setLactate] = useState({ peak: "", rest: "" });

  // Modellen är liten nog att räknas om vid varje tangenttryck.
  const prediction = useMemo(
    () => predictVlamax(samples, input),
    [samples, input],
  );

  // Uppmätt laktat går före watten: watten säger lite om VLamax hos atleter
  // med mycket explosiv sprint.
  const fromLactate = lactate.peak.trim()
    ? vlamaxFromSprintLactate(
        decimal(lactate.peak),
        lactate.rest.trim() ? decimal(lactate.rest) : null,
        input.sprintSeconds,
      )
    : null;
  const lactateInvalid = lactate.peak.trim() !== "" && fromLactate === null;

  const set = (patch: Partial<VlamaxInput>) =>
    setInput((current) => ({ ...current, ...patch }));

  const valid =
    prediction !== null &&
    Number.isFinite(input.weightKg) &&
    Number.isFinite(input.bodyFatPct) &&
    Number.isFinite(input.sprintSeconds) &&
    Number.isFinite(input.wattAvg);

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

          <div className="space-y-2">
            <Field label="Kroppsfett" htmlFor="fat" hint="%">
              <Input
                id="fat"
                inputMode="decimal"
                value={fatText}
                onChange={(e) => {
                  setFatText(e.target.value);
                  set({ bodyFatPct: decimal(e.target.value) });
                }}
              />
            </Field>
            <BodyFatEstimate
              weightKg={input.weightKg}
              sex={input.sex}
              onUse={(pct) => {
                setFatText(String(pct).replace(".", ","));
                set({ bodyFatPct: pct });
              }}
            />
          </div>

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

          <Field
            label="Högsta laktat efter"
            htmlFor="peakLactate"
            hint="mmol/l, 3–7 minuter efter sprinten"
            optional
          >
            <Input
              id="peakLactate"
              inputMode="decimal"
              value={lactate.peak}
              onChange={(e) => setLactate((l) => ({ ...l, peak: e.target.value }))}
            />
          </Field>

          <Field label="Vilolaktat före" htmlFor="restLactate" hint="mmol/l, 1,0 om tomt" optional>
            <Input
              id="restLactate"
              inputMode="decimal"
              value={lactate.rest}
              onChange={(e) => setLactate((l) => ({ ...l, rest: e.target.value }))}
            />
          </Field>

        </div>

        <p className="mt-5 border-t border-line pt-4 text-[0.8125rem] leading-relaxed text-text-muted">
          Med laktat räknas VLamax som (högsta − vila) / (sprinttid − 3,5 s),
          samma formel som testerna använder. Utan laktat skattas den ur watten:
          modellen läser sprinteffekten per kilo fettfri massa, plus kön. VLamax
          är glykolytisk förmåga per muskelmassa, och det är det måttet som
          följer den – en tung atlet med stor sprint kan ha lägre VLamax än en
          lätt med mindre. Just nu:{" "}
          <span className="text-text-muted tabular-nums">
            {Number.isFinite(input.weightKg) &&
            Number.isFinite(input.bodyFatPct) &&
            Number.isFinite(input.wattAvg)
              ? `${sprintPerFfm(input.wattAvg, input.weightKg, input.bodyFatPct).toFixed(1).replace(".", ",")} W/kg fettfri massa`
              : "–"}
          </span>
          . Sprintlängden räknas inte in men vaktas – referensdatan är 17–23 s.
        </p>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardTitle>Beräknad VLamax</CardTitle>

          {fromLactate !== null ? (
            <>
              <p className="text-4xl font-semibold tracking-tight text-text tabular-nums">
                {fromLactate.toFixed(2).replace(".", ",")}
                <span className="ml-2 text-base font-normal text-text-muted">
                  mmol/l/s
                </span>
              </p>
              <p className="mt-2 text-[0.8125rem] text-text-muted">
                Ur sprintlaktatet. Samma formel som testerna.
              </p>
              {valid && prediction && (
                <p className="mt-1 text-[0.75rem] text-text-subtle">
                  Ur watten skulle den bli {prediction.value.toFixed(2).replace(".", ",")}.
                  {Math.abs(prediction.value - fromLactate) > 0.1 &&
                    " Skillnaden är stor: lita på laktatet."}
                </p>
              )}
            </>
          ) : valid && prediction ? (
            <>
              <p className="text-4xl font-semibold tracking-tight text-text tabular-nums">
                {prediction.value.toFixed(2).replace(".", ",")}
                <span className="ml-2 text-base font-normal text-text-muted">
                  mmol/l/s
                </span>
              </p>
              <p className="mt-2 text-[0.8125rem] text-text-muted">
                Typiskt fel ±{prediction.rmse.toFixed(2).replace(".", ",")} på en atlet modellen
                inte sett.
              </p>
              <p className="mt-1 text-[0.75rem] text-text-subtle">
                Tränad på {prediction.sampleCount} uppmätta atleter.
              </p>
              {lactateInvalid ? (
                <p role="alert" className="mt-4 text-[0.8125rem] text-warn">
                  Laktatet går inte att räkna på: högsta värdet ska vara 2–30 mmol/l
                  och högre än vilan, och sprinten minst 5 s.
                </p>
              ) : (
                <p className="mt-4 text-[0.8125rem] leading-relaxed text-warn">
                  Skattad ur watten. Atleter med mycket explosiv sprint får för
                  hög VLamax på det sättet. Mät laktat efter sprinten för ett
                  säkert värde.
                </p>
              )}

              {prediction.outOfRange.length > 0 && (
                <div className="mt-4 rounded-md border border-accent/40 bg-accent-soft p-3">
                  <p className="flex items-center gap-2 text-[0.8125rem] font-medium text-text">
                    <AlertTriangle aria-hidden className="size-4 text-warn" />
                    Utanför referensdatan
                  </p>
                  <ul className="mt-2 space-y-1 text-[0.75rem] text-text-muted">
                    {prediction.outOfRange.map((warning) => (
                      <li key={warning.label}>
                        {warning.label}: {warning.value} {warning.unit} — datan
                        täcker {warning.min}–{warning.max} {warning.unit}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[0.75rem] text-text-muted">
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

        {fromLactate !== null ? (
          <SaveAsTestResult
            adepts={adepts}
            value={fromLactate}
            comment="Ur sprintlaktat med VLamax-kalkylen"
          />
        ) : (
          valid &&
          prediction &&
          prediction.outOfRange.length === 0 && (
            <SaveAsTestResult adepts={adepts} value={prediction.value} />
          )
        )}
      </div>
    </div>
  );
}
