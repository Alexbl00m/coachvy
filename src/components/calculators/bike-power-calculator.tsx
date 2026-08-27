"use client";

import { useMemo, useState } from "react";

import {
  PowerSplitBar,
  SpeedPowerChart,
} from "@/components/calculators/bike-power-chart";
import { DataTable, ResultGrid } from "@/components/calculators/result-grid";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import {
  EVENT_TYPES,
  POSITIONS,
  TIRES,
  airDensity,
  averageGrade,
  powerZones,
  sensitivity,
  solveRide,
  speedPowerCurve,
  type RideParams,
  type Target,
} from "@/lib/calculators/bike-power";
import { formatDuration } from "@/lib/calculators/time";
import { cn } from "@/lib/cn";

const DEFAULTS = {
  riderWeight: "75",
  gearWeight: "1,5",
  bikeWeight: "8",
  drivetrain: "97,5",
  ftp: "250",

  distance: "40",
  climb: "300",
  wind: "0",
  temperature: "15",
  altitude: "50",

  position: "drops",
  cda: "0,320",
  tire: "race",
  crr: "0,0033",

  targetWatts: "250",
  targetKmh: "35",
  targetHours: "1",
  targetMinutes: "5",
};

const decimal = (raw: string) => Number(raw.replace(",", "."));

/** Visar decimaler med komma, som resten av appen. */
const sv = (value: number, digits: number) =>
  value.toFixed(digits).replace(".", ",");

type TargetKind = "power" | "speed" | "time";

const TARGET_LABELS: Record<TargetKind, string> = {
  power: "Effekt",
  speed: "Fart",
  time: "Tid",
};

export function BikePowerCalculator() {
  const [values, setValues] = useState(DEFAULTS);
  const [targetKind, setTargetKind] = useState<TargetKind>("power");

  const set = (patch: Partial<typeof values>) =>
    setValues((current) => ({ ...current, ...patch }));

  /** Byte av position eller däck skriver över överstyrningen. */
  const selectPosition = (id: string) => {
    const preset = POSITIONS.find((p) => p.id === id);
    set({ position: id, ...(preset ? { cda: sv(preset.cda, 3) } : {}) });
  };

  const selectTire = (id: string) => {
    const preset = TIRES.find((t) => t.id === id);
    set({ tire: id, ...(preset ? { crr: sv(preset.crr, 4) } : {}) });
  };

  const model = useMemo(() => {
    const riderWeight = decimal(values.riderWeight);
    const totalWeightKg =
      riderWeight + decimal(values.gearWeight) + decimal(values.bikeWeight);
    const distanceKm = decimal(values.distance);
    const climbM = decimal(values.climb);
    const density = airDensity(
      decimal(values.altitude),
      decimal(values.temperature),
    );

    const params: RideParams = {
      totalWeightKg,
      gradePercent: averageGrade(climbM, distanceKm),
      cda: decimal(values.cda),
      crr: decimal(values.crr),
      windMs: decimal(values.wind) / 3.6,
      airDensityKgM3: density,
      drivetrainEfficiency: decimal(values.drivetrain) / 100,
    };

    const target: Target =
      targetKind === "power"
        ? { kind: "power", watts: decimal(values.targetWatts) }
        : targetKind === "speed"
          ? { kind: "speed", kmh: decimal(values.targetKmh) }
          : {
              kind: "time",
              seconds:
                decimal(values.targetHours) * 3600 +
                decimal(values.targetMinutes) * 60,
            };

    const ftp = decimal(values.ftp);
    const solution = solveRide({
      params,
      distanceKm,
      target,
      riderWeightKg: riderWeight > 0 ? riderWeight : null,
      ftp: ftp > 0 ? ftp : null,
    });

    return {
      params,
      density,
      totalWeightKg,
      distanceKm,
      ftp: ftp > 0 ? ftp : null,
      solution,
      curve: speedPowerCurve(params),
      rows:
        solution && solution.riderWatts > 0
          ? sensitivity(solution.riderWatts, params, distanceKm)
          : [],
    };
  }, [values, targetKind]);

  const { solution } = model;

  const results = [
    {
      label: "Effekt",
      value: solution ? Math.round(solution.riderWatts) : "–",
      unit: "W",
      hint: solution?.wattsPerKg
        ? `${sv(solution.wattsPerKg, 2)} W/kg`
        : undefined,
    },
    {
      label: "Fart",
      value: solution ? sv(solution.speedMs * 3.6, 1) : "–",
      unit: "km/h",
      hint: `${sv(model.params.gradePercent, 2)} % snittlutning`,
    },
    {
      label: "Måltid",
      value: solution ? formatDuration(solution.seconds) : "–",
      hint: `${sv(model.distanceKm, 1)} km`,
    },
    {
      label: "Belastning",
      value: solution?.tss ? Math.round(solution.tss) : "–",
      unit: "TSS",
      hint: solution?.intensityFactor
        ? `IF ${sv(solution.intensityFactor, 2)}${solution.zone ? ` · ${solution.zone.zone} ${solution.zone.name}` : ""}`
        : undefined,
    },
  ];

  // En orimligt lång måltid betyder nästan alltid att effekten inte räcker för
  // lutningen. Bättre att säga det än att skriva ut "412:35:00".
  const impossible =
    solution !== null && solution.seconds > 24 * 3600;

  return (
    <div className="space-y-6">
      <ResultGrid items={results} />

      {solution === null && (
        <Card>
          <p className="text-sm text-text-muted">
            Modellen hittar ingen lösning med de här värdena. Vanligaste
            orsaken är att effekten inte räcker för lutningen, eller att en
            siffra saknas.
          </p>
        </Card>
      )}

      {impossible && (
        <Card>
          <p className="text-sm text-text-muted">
            Måltiden blir längre än ett dygn. Effekten räcker knappt för
            stigningen – höj effekten eller kontrollera stigningen.
          </p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardTitle>Cyklist och cykel</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <Field label="Cyklistens vikt" htmlFor="riderWeight" hint="kg">
              <Input
                id="riderWeight"
                inputMode="decimal"
                value={values.riderWeight}
                onChange={(e) => set({ riderWeight: e.target.value })}
              />
            </Field>
            <Field label="Kläder och utrustning" htmlFor="gearWeight" hint="kg">
              <Input
                id="gearWeight"
                inputMode="decimal"
                value={values.gearWeight}
                onChange={(e) => set({ gearWeight: e.target.value })}
              />
            </Field>
            <Field label="Cykelns vikt" htmlFor="bikeWeight" hint="kg">
              <Input
                id="bikeWeight"
                inputMode="decimal"
                value={values.bikeWeight}
                onChange={(e) => set({ bikeWeight: e.target.value })}
              />
            </Field>
            <Field
              label="Drivlinans verkningsgrad"
              htmlFor="drivetrain"
              hint="% – 95–98 för en ren kedja"
            >
              <Input
                id="drivetrain"
                inputMode="decimal"
                value={values.drivetrain}
                onChange={(e) => set({ drivetrain: e.target.value })}
              />
            </Field>
            <Field label="FTP" htmlFor="ftp" hint="W – används för IF och TSS">
              <Input
                id="ftp"
                inputMode="decimal"
                value={values.ftp}
                onChange={(e) => set({ ftp: e.target.value })}
              />
            </Field>
          </div>
          <p className="mt-4 border-t border-line pt-3 text-[12px] text-text-subtle">
            Systemvikt {sv(model.totalWeightKg, 1)} kg
          </p>
        </Card>

        <Card>
          <CardTitle>Sträcka och väder</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <Field label="Distans" htmlFor="distance" hint="km">
              <Input
                id="distance"
                inputMode="decimal"
                value={values.distance}
                onChange={(e) => set({ distance: e.target.value })}
              />
            </Field>
            <Field
              label="Total stigning"
              htmlFor="climb"
              hint="m – räknas om till en jämn snittlutning"
            >
              <Input
                id="climb"
                inputMode="decimal"
                value={values.climb}
                onChange={(e) => set({ climb: e.target.value })}
              />
            </Field>
            <Field
              label="Vind"
              htmlFor="wind"
              hint="km/h – positivt = motvind, negativt = medvind"
            >
              <Input
                id="wind"
                inputMode="decimal"
                value={values.wind}
                onChange={(e) => set({ wind: e.target.value })}
              />
            </Field>
            <Field label="Temperatur" htmlFor="temperature" hint="°C">
              <Input
                id="temperature"
                inputMode="decimal"
                value={values.temperature}
                onChange={(e) => set({ temperature: e.target.value })}
              />
            </Field>
            <Field label="Höjd över havet" htmlFor="altitude" hint="m">
              <Input
                id="altitude"
                inputMode="decimal"
                value={values.altitude}
                onChange={(e) => set({ altitude: e.target.value })}
              />
            </Field>
          </div>
          <p className="mt-4 border-t border-line pt-3 text-[12px] text-text-subtle">
            Luftdensitet {sv(model.density, 3)} kg/m³
          </p>
        </Card>

        <Card>
          <CardTitle>Position och däck</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <Field label="Position" htmlFor="position">
              <Select
                id="position"
                value={values.position}
                onChange={(e) => selectPosition(e.target.value)}
              >
                {POSITIONS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="CdA"
              htmlFor="cda"
              hint="m² – riktvärde för 75 kg, skriv över med ett mätt värde"
            >
              <Input
                id="cda"
                inputMode="decimal"
                value={values.cda}
                onChange={(e) => set({ cda: e.target.value })}
              />
            </Field>
            <Field label="Däck" htmlFor="tire">
              <Select
                id="tire"
                value={values.tire}
                onChange={(e) => selectTire(e.target.value)}
              >
                {TIRES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Crr" htmlFor="crr" hint="rullmotstånd på asfalt">
              <Input
                id="crr"
                inputMode="decimal"
                value={values.crr}
                onChange={(e) => set({ crr: e.target.value })}
              />
            </Field>
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle>Vad vill du räkna ut?</CardTitle>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(TARGET_LABELS) as TargetKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setTargetKind(kind)}
              aria-pressed={targetKind === kind}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm transition-colors",
                targetKind === kind
                  ? "border-accent bg-accent-soft text-text"
                  : "border-line-strong text-text-muted hover:border-accent/60 hover:text-text",
              )}
            >
              Utgå från {TARGET_LABELS[kind].toLowerCase()}
            </button>
          ))}
        </div>

        <p className="mt-3 text-[12px] text-text-subtle">
          {targetKind === "power"
            ? "Du anger effekten – fart och tid räknas fram."
            : targetKind === "speed"
              ? "Du anger farten – effekt och tid räknas fram."
              : "Du anger måltiden – fart och effekt räknas fram."}
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {targetKind === "power" && (
            <>
              <Field label="Måleffekt" htmlFor="targetWatts" hint="W">
                <Input
                  id="targetWatts"
                  inputMode="decimal"
                  value={values.targetWatts}
                  onChange={(e) => set({ targetWatts: e.target.value })}
                />
              </Field>
              <Field
                label="Eller från lopptyp"
                htmlFor="eventType"
                hint="andel av FTP som brukar hållas"
              >
                <Select
                  id="eventType"
                  value=""
                  onChange={(e) => {
                    const event = EVENT_TYPES.find(
                      (x) => x.id === e.target.value,
                    );
                    const ftp = decimal(values.ftp);
                    if (event && ftp > 0) {
                      set({
                        targetWatts: String(Math.round(ftp * event.ftpFraction)),
                      });
                    }
                  }}
                >
                  <option value="">Välj …</option>
                  {EVENT_TYPES.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.label} ({Math.round(event.ftpFraction * 100)} % av FTP)
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          )}

          {targetKind === "speed" && (
            <Field label="Målfart" htmlFor="targetKmh" hint="km/h">
              <Input
                id="targetKmh"
                inputMode="decimal"
                value={values.targetKmh}
                onChange={(e) => set({ targetKmh: e.target.value })}
              />
            </Field>
          )}

          {targetKind === "time" && (
            <>
              <Field label="Timmar" htmlFor="targetHours">
                <Input
                  id="targetHours"
                  inputMode="numeric"
                  value={values.targetHours}
                  onChange={(e) => set({ targetHours: e.target.value })}
                />
              </Field>
              <Field label="Minuter" htmlFor="targetMinutes">
                <Input
                  id="targetMinutes"
                  inputMode="numeric"
                  value={values.targetMinutes}
                  onChange={(e) => set({ targetMinutes: e.target.value })}
                />
              </Field>
            </>
          )}
        </div>
      </Card>

      {solution && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card>
            <CardTitle>Effekt mot fart</CardTitle>
            <SpeedPowerChart
              curve={model.curve}
              currentKmh={solution.speedMs * 3.6}
              currentWatts={solution.riderWatts}
              ftp={model.ftp}
            />
            <p className="mt-2 text-[12px] text-text-subtle">
              Kurvan gäller den här sträckans lutning, vind och luftdensitet.
              Att effekten växer med kuben av farten är därför inte en linje –
              det är hela poängen med diagrammet.
            </p>
          </Card>

          <Card>
            <CardTitle>Vart effekten tar vägen</CardTitle>
            <PowerSplitBar
              rollingWatts={solution.breakdown.rollingWatts}
              gravityWatts={solution.breakdown.gravityWatts}
              airWatts={solution.breakdown.airWatts}
            />
            <p className="mt-4 border-t border-line pt-3 text-[12px] text-text-subtle">
              Andelarna är av effekten som når vägen. Drivlinan tar
              ytterligare{" "}
              {Math.round(
                solution.breakdown.riderWatts - solution.breakdown.wheelWatts,
              )}{" "}
              W.
            </p>
          </Card>
        </div>
      )}

      {model.rows.length > 0 && (
        <Card>
          <CardTitle>Vad är varje förbättring värd?</CardTitle>
          <DataTable
            headers={["Förändring", "Tidsvinst", "Ny måltid"]}
            minWidth={480}
            rows={model.rows.map((row) => [
              row.label,
              `${row.secondsSaved >= 0 ? "−" : "+"}${formatDuration(Math.abs(row.secondsSaved))}`,
              solution
                ? formatDuration(solution.seconds - row.secondsSaved)
                : "–",
            ])}
          />
          <p className="mt-3 text-[12px] text-text-subtle">
            Räknat vid samma effekt över {sv(model.distanceKm, 1)} km. På platt
            mark ger aero mest; ju brantare det är, desto mer betyder vikten.
          </p>
        </Card>
      )}

      {model.ftp && (
        <Card>
          <CardTitle>Effektzoner</CardTitle>
          <DataTable
            headers={["Zon", "Namn", "Watt", "Andel av FTP", "Vad den tränar"]}
            minWidth={720}
            rows={powerZones(model.ftp).map((zone) => [
              zone.zone,
              zone.name,
              zone.maxWatts === null
                ? `> ${zone.minWatts}`
                : `${zone.minWatts}–${zone.maxWatts}`,
              zone.max === null
                ? `> ${Math.round(zone.min * 100)} %`
                : `${Math.round(zone.min * 100)}–${Math.round(zone.max * 100)} %`,
              zone.description,
            ])}
          />
        </Card>
      )}

      <Card>
        <CardTitle>Vad modellen inte tar hänsyn till</CardTitle>
        <ul className="space-y-2 text-sm leading-relaxed text-text-muted">
          <li>
            Stigningen slås ut som en <strong className="text-text">jämn
            lutning</strong> över hela sträckan. För ett rent bergslopp stämmer
            det; för en kuperad slinga underskattar det tiden, eftersom du
            förlorar mer i uppförsbackarna än du vinner utför.
          </li>
          <li>
            Farten antas vara <strong className="text-text">konstant</strong>.
            Ett riktigt lopp med accelerationer ger högre normaliserad effekt,
            och därmed högre TSS än vad som står här.
          </li>
          <li>
            Vinden antas ligga <strong className="text-text">rakt framifrån
            eller bakifrån</strong>. Sidvind ökar i praktiken CdA.
          </li>
          <li>
            CdA-värdena är riktvärden för en cyklist runt 75 kg. Har du mätt ditt
            eget värde är det alltid bättre än förvalet.
          </li>
        </ul>
      </Card>
    </div>
  );
}
