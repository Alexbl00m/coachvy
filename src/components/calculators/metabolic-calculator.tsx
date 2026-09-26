"use client";

import { useMemo, useState } from "react";

import { MetabolicChart } from "@/components/calculators/metabolic-chart";
import { ResultGrid } from "@/components/calculators/result-grid";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import {
  CARB_MAX_GRAMS_PER_HOUR,
  MADER_DEFAULTS,
  calculateMetabolicProfile,
  calculateRunningProfile,
  paceFromSpeed,
  runningEconomyFrom,
  speedAtVo2max,
  type MetabolicPoint,
} from "@/lib/calculators/metabolic";

type Mode = "cykling" | "löpning";

const DEFAULTS = {
  vo2max: "65",
  vlamax: "0,5",
  vo2maxPower: "380",
  runningEconomy: "210",
  weightKg: "72",
  maxHeartRate: "190",
};

const decimal = (raw: string) => Number(raw.replace(",", "."));
const sv = (value: number, digits: number) => value.toFixed(digits).replace(".", ",");

/** Belastningen i punktens enhet: watt på cykel, tempo och km/h i löpning. */
function intensity(point: MetabolicPoint, mode: Mode) {
  return mode === "cykling"
    ? { value: String(Math.round(point.power)), unit: "W", extra: "" }
    : {
        value: paceFromSpeed(point.power),
        unit: "/km",
        extra: `${sv(point.power * 3.6, 1)} km/h`,
      };
}

export function MetabolicCalculator() {
  const [mode, setMode] = useState<Mode>("cykling");
  const [values, setValues] = useState(DEFAULTS);
  const [measured, setMeasured] = useState({ vo2: "", speed: "" });
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

    const model = {
      ks1: Number.isFinite(ks1) && ks1 > 0 ? ks1 : MADER_DEFAULTS.ks1,
      ks2: Number.isFinite(ks2) && ks2 > 0 ? ks2 : MADER_DEFAULTS.ks2,
      volRel:
        Number.isFinite(volRel) && volRel > 0 ? volRel : MADER_DEFAULTS.volRel,
      laCombConstant: MADER_DEFAULTS.laCombConstant,
    };
    const shared = {
      vo2max: decimal(values.vo2max),
      vlamax: decimal(values.vlamax),
      weightKg: decimal(values.weightKg),
      maxHeartRate: decimal(values.maxHeartRate) || null,
    };

    return mode === "cykling"
      ? calculateMetabolicProfile(
          { ...shared, vo2maxPower: decimal(values.vo2maxPower) },
          model,
        )
      : calculateRunningProfile(
          { ...shared, runningEconomy: decimal(values.runningEconomy) },
          model,
        );
  }, [mode, values, constants]);

  const { anaerobicThreshold: at, fatMax, carbMax } = profile.thresholds;
  const top =
    mode === "cykling"
      ? decimal(values.vo2maxPower)
      : speedAtVo2max(decimal(values.vo2max), decimal(values.runningEconomy));
  const derivedEconomy = runningEconomyFrom(decimal(measured.vo2), decimal(measured.speed));

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card>
          <CardTitle
            action={
              <div className="flex gap-1.5">
                {(["cykling", "löpning"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={mode === key}
                    onClick={() => setMode(key)}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-[12px] capitalize transition-colors",
                      mode === key
                        ? "border-accent bg-accent-soft font-medium text-text"
                        : "border-line-strong text-text-muted hover:border-accent hover:text-text",
                    )}
                  >
                    {key}
                  </button>
                ))}
              </div>
            }
          >
            Atletens värden
          </CardTitle>
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
            {mode === "cykling" ? (
              <Field label="Effekt vid VO2max" htmlFor="vo2maxPower" hint="W">
                <Input
                  id="vo2maxPower"
                  inputMode="decimal"
                  value={values.vo2maxPower}
                  onChange={(e) => set({ vo2maxPower: e.target.value })}
                />
              </Field>
            ) : (
              <Field
                label="Löpekonomi"
                htmlFor="runningEconomy"
                hint="ml/kg/km – tränade löpare ofta 190–220"
              >
                <Input
                  id="runningEconomy"
                  inputMode="decimal"
                  value={values.runningEconomy}
                  onChange={(e) => set({ runningEconomy: e.target.value })}
                />
              </Field>
            )}
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

          {mode === "löpning" && (
            <div className="mt-5 border-t border-line pt-4">
              <p className="text-[13px] font-medium text-text">
                Löpekonomi ur ett löpbandstest
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-text-subtle">
                Syreupptaget vid en jämn fart under tröskeln. Löpekonomin skiljer
                mycket mellan löpare, så ett uppmätt värde gör mer för
                precisionen än något annat här.
              </p>
              <div className="mt-3 grid grid-cols-[1fr_1fr_auto] items-end gap-3">
                <Field label="VO2" htmlFor="measuredVo2" hint="ml/kg/min">
                  <Input
                    id="measuredVo2"
                    inputMode="decimal"
                    value={measured.vo2}
                    onChange={(e) => setMeasured((m) => ({ ...m, vo2: e.target.value }))}
                  />
                </Field>
                <Field label="Vid fart" htmlFor="measuredSpeed" hint="km/h">
                  <Input
                    id="measuredSpeed"
                    inputMode="decimal"
                    value={measured.speed}
                    onChange={(e) => setMeasured((m) => ({ ...m, speed: e.target.value }))}
                  />
                </Field>
                <button
                  type="button"
                  disabled={!(derivedEconomy > 0)}
                  onClick={() => set({ runningEconomy: String(Math.round(derivedEconomy)) })}
                  className="mb-[22px] rounded-md border border-line-strong px-3 py-2 text-[13px] text-text transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {derivedEconomy > 0 ? `Använd ${Math.round(derivedEconomy)}` : "Använd"}
                </button>
              </div>
            </div>
          )}
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
          {mode === "cykling"
            ? "Fyll i VO2max, effekt vid VO2max och kroppsvikt med tal större än noll."
            : "Fyll i VO2max, löpekonomi och kroppsvikt med tal större än noll."}
        </p>
      ) : (
        <>
          <ResultGrid
            items={[
              {
                label: "Anaerob tröskel",
                value: at ? intensity(at, mode).value : "–",
                unit: at ? intensity(at, mode).unit : undefined,
                hint: at
                  ? [
                      intensity(at, mode).extra,
                      `${at.percentOfMax} % av ${mode === "cykling" ? "effekten" : "farten"} vid VO2max`,
                      at.heartRate ? `puls ${at.heartRate}` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : "Ingen korsning inom intervallet",
              },
              mode === "cykling"
                ? {
                    label: "Tröskel per kg",
                    value:
                      at && decimal(values.weightKg) > 0
                        ? sv(at.power / decimal(values.weightKg), 2)
                        : "–",
                    unit: "W/kg",
                  }
                : {
                    label: "Fart vid VO2max",
                    value: top > 0 ? paceFromSpeed(top) : "–",
                    unit: "/km",
                    hint: top > 0 ? `${sv(top * 3.6, 1)} km/h` : undefined,
                  },
              {
                label: "FatMax",
                value: fatMax ? intensity(fatMax, mode).value : "–",
                unit: fatMax ? intensity(fatMax, mode).unit : undefined,
                hint: fatMax
                  ? [intensity(fatMax, mode).extra, `${sv(fatMax.fatPerHour, 1)} g fett/h`]
                      .filter(Boolean)
                      .join(" · ")
                  : undefined,
              },
              {
                label: `CarbMax ${CARB_MAX_GRAMS_PER_HOUR} g/h`,
                value: carbMax ? intensity(carbMax, mode).value : "–",
                unit: carbMax ? intensity(carbMax, mode).unit : undefined,
                hint: [
                  carbMax ? intensity(carbMax, mode).extra : "",
                  at ? `vid tröskeln ${Math.round(at.carbsPerHour)} g/h` : "",
                ]
                  .filter(Boolean)
                  .join(" · ") || undefined,
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
              mode={mode}
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
                  kroppen förbrukar dem i, inte vad som går att tillföra – över
                  CarbMax går det åt mer än de {CARB_MAX_GRAMS_PER_HOUR} g/h som
                  magen normalt klarar att ta upp under ett lopp.
                </>
              )}
            </p>
          </Card>

          <p className="text-[13px] leading-relaxed text-text-subtle">
            Modellen räknar upp till{" "}
            {mode === "cykling"
              ? `${Math.round(top)} W`
              : `${paceFromSpeed(top)}/km, farten där syrekostnaden når VO2max`}
            . Den beskriver en steady state och tar inte hänsyn till
            uthållighet, värme eller dagsform — den säger var trösklarna ligger
            fysiologiskt, inte vad adepten klarar i ett lopp.
          </p>

          {mode === "löpning" && (
            <p className="text-[13px] leading-relaxed text-text-subtle">
              I löpning avgör löpekonomin hur fort en viss syremängd bär, och
              den kan skilja 20–30 % mellan löpare på samma fart – en uppskattad
              löpekonomi flyttar alla tempon lika mycket. VLamax ska vara ett
              löpvärde: forskningen visar att den skiljer sig mellan löpning och
              cykling hos samma atlet, så ett cykelvärde går inte att flytta
              över rakt av.
            </p>
          )}
        </>
      )}
    </div>
  );
}
