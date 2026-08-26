"use client";

import { useMemo, useState } from "react";

import { MetabolicChart } from "@/components/calculators/metabolic-chart";
import { ResultGrid } from "@/components/calculators/result-grid";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import {
  MADER_DEFAULTS,
  calculateMetabolicProfile,
} from "@/lib/calculators/metabolic";

const DEFAULTS = {
  vo2max: "65",
  vlamax: "0,5",
  vo2maxPower: "380",
  weightKg: "72",
  maxHeartRate: "190",
};

const decimal = (raw: string) => Number(raw.replace(",", "."));

export function MetabolicCalculator() {
  const [values, setValues] = useState(DEFAULTS);
  const [constants, setConstants] = useState({
    ks1: String(MADER_DEFAULTS.ks1),
    ks2: String(MADER_DEFAULTS.ks2),
    volRel: String(MADER_DEFAULTS.volRel),
  });
  const [showConstants, setShowConstants] = useState(false);
  const [series, setSeries] = useState<"lactate" | "fuel">("lactate");

  const set = (patch: Partial<typeof values>) =>
    setValues((current) => ({ ...current, ...patch }));

  const profile = useMemo(() => {
    const ks1 = decimal(constants.ks1);
    const ks2 = decimal(constants.ks2);
    const volRel = decimal(constants.volRel);

    return calculateMetabolicProfile(
      {
        vo2max: decimal(values.vo2max),
        vlamax: decimal(values.vlamax),
        vo2maxPower: decimal(values.vo2maxPower),
        weightKg: decimal(values.weightKg),
        maxHeartRate: decimal(values.maxHeartRate) || null,
      },
      {
        ks1: Number.isFinite(ks1) && ks1 > 0 ? ks1 : MADER_DEFAULTS.ks1,
        ks2: Number.isFinite(ks2) && ks2 > 0 ? ks2 : MADER_DEFAULTS.ks2,
        volRel:
          Number.isFinite(volRel) && volRel > 0 ? volRel : MADER_DEFAULTS.volRel,
        laCombConstant: MADER_DEFAULTS.laCombConstant,
      },
    );
  }, [values, constants]);

  const { anaerobicThreshold: at, fatMax } = profile.thresholds;
  const vo2maxPower = decimal(values.vo2maxPower);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card>
          <CardTitle>Atletens värden</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="VO2max" htmlFor="vo2max" hint="ml/kg/min">
              <Input
                id="vo2max"
                inputMode="decimal"
                value={values.vo2max}
                onChange={(e) => set({ vo2max: e.target.value })}
              />
            </Field>
            <Field label="VLamax" htmlFor="vlamax" hint="mmol/l/s">
              <Input
                id="vlamax"
                inputMode="decimal"
                value={values.vlamax}
                onChange={(e) => set({ vlamax: e.target.value })}
              />
            </Field>
            <Field label="Effekt vid VO2max" htmlFor="vo2maxPower" hint="W">
              <Input
                id="vo2maxPower"
                inputMode="decimal"
                value={values.vo2maxPower}
                onChange={(e) => set({ vo2maxPower: e.target.value })}
              />
            </Field>
            <Field label="Kroppsvikt" htmlFor="weightKg" hint="kg">
              <Input
                id="weightKg"
                inputMode="decimal"
                value={values.weightKg}
                onChange={(e) => set({ weightKg: e.target.value })}
              />
            </Field>
            <Field label="Maxpuls" htmlFor="maxHeartRate" hint="slag/min" optional>
              <Input
                id="maxHeartRate"
                inputMode="decimal"
                value={values.maxHeartRate}
                onChange={(e) => set({ maxHeartRate: e.target.value })}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <CardTitle
            action={
              <button
                type="button"
                onClick={() => setShowConstants((v) => !v)}
                className="text-[12px] font-medium text-accent hover:text-accent-strong"
              >
                {showConstants ? "Dölj" : "Visa"}
              </button>
            }
          >
            Modellkonstanter
          </CardTitle>

          {showConstants ? (
            <div className="space-y-4">
              <Field label="Ks1" htmlFor="ks1" hint="ADP-kinetik">
                <Input
                  id="ks1"
                  inputMode="decimal"
                  value={constants.ks1}
                  onChange={(e) =>
                    setConstants((c) => ({ ...c, ks1: e.target.value }))
                  }
                />
              </Field>
              <Field label="Ks2" htmlFor="ks2" hint="Laktatproduktion">
                <Input
                  id="ks2"
                  inputMode="decimal"
                  value={constants.ks2}
                  onChange={(e) =>
                    setConstants((c) => ({ ...c, ks2: e.target.value }))
                  }
                />
              </Field>
              <Field label="VolRel" htmlFor="volRel" hint="Fördelningsvolym">
                <Input
                  id="volRel"
                  inputMode="decimal"
                  value={constants.volRel}
                  onChange={(e) =>
                    setConstants((c) => ({ ...c, volRel: e.target.value }))
                  }
                />
              </Field>
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-text-muted">
              Standardvärdena kommer från Mader & Heck (1986) och Hauser (2014).
              Ändra dem bara om du har skäl att kalibrera mot egna mätningar.
            </p>
          )}
        </Card>
      </div>

      {profile.points.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong bg-surface-2/60 px-6 py-8 text-center text-sm text-text-muted">
          Fyll i VO2max, effekt vid VO2max och kroppsvikt med tal större än noll.
        </p>
      ) : (
        <>
          <ResultGrid
            items={[
              {
                label: "Anaerob tröskel",
                value: at ? Math.round(at.power) : "–",
                unit: at ? "W" : undefined,
                hint: at
                  ? `${at.percentOfMax} % av effekten vid VO2max${at.heartRate ? ` · puls ${at.heartRate}` : ""}`
                  : "Ingen korsning inom intervallet",
              },
              {
                label: "Tröskel per kg",
                value:
                  at && decimal(values.weightKg) > 0
                    ? (at.power / decimal(values.weightKg)).toFixed(2)
                    : "–",
                unit: "W/kg",
              },
              {
                label: "FatMax",
                value: fatMax ? Math.round(fatMax.power) : "–",
                unit: fatMax ? "W" : undefined,
                hint: fatMax ? `${fatMax.fatPerHour} g fett/h` : undefined,
              },
              {
                label: "Kolhydrat vid tröskel",
                value: at ? Math.round(at.carbsPerHour) : "–",
                unit: "g/h",
              },
            ]}
          />

          <Card>
            <CardTitle
              action={
                <div className="flex gap-1.5">
                  {(
                    [
                      ["lactate", "Laktat"],
                      ["fuel", "Bränsle"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={series === key}
                      onClick={() => setSeries(key)}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-[12px] transition-colors",
                        series === key
                          ? "border-accent bg-accent-soft font-medium text-text"
                          : "border-line-strong text-text-muted hover:border-accent hover:text-text",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              }
            >
              {series === "lactate"
                ? "Laktatproduktion mot förbränning"
                : "Substratomsättning"}
            </CardTitle>

            <MetabolicChart
              points={profile.points}
              series={series}
              thresholdPower={at ? at.power : null}
            />

            <p className="mt-4 border-t border-line pt-4 text-[13px] leading-relaxed text-text-muted">
              {series === "lactate" ? (
                <>
                  Under tröskeln hinner kroppen förbränna allt laktat som bildas.
                  Där kurvorna korsar varandra börjar det ackumuleras — det är
                  den anaeroba tröskeln.
                </>
              ) : (
                <>
                  Fettförbränningen toppar långt under tröskeln och faller mot
                  noll när glykolysen tar över. Kolhydratsiffran är den takt
                  kroppen förbrukar dem i, inte vad som går att tillföra.
                </>
              )}
            </p>
          </Card>

          <p className="text-[13px] leading-relaxed text-text-subtle">
            Modellen räknar upp till {Math.round(vo2maxPower)} W. Den beskriver
            en steady state och tar inte hänsyn till uthållighet, värme eller
            dagsform — den säger var trösklarna ligger fysiologiskt, inte vad
            adepten klarar i ett lopp.
          </p>
        </>
      )}
    </div>
  );
}
