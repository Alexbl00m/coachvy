"use client";

import { useId, useState, useSyncExternalStore } from "react";

import { DataTable } from "@/components/calculators/result-grid";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import {
  BIKE_POSITIONS,
  BIKE_TIRES,
  bikeSetup,
  speedForPower,
  type BikePositionKey,
  type BikeTireKey,
} from "@/lib/calculators/bike-speed";
import type { Sport } from "@/lib/calculators/lactate";
import { digitsForUnit } from "@/lib/format";
import { formatDuration } from "@/lib/calculators/time";
import { showsPace, toMetresPerSecond } from "@/lib/tests/pace";
import type { ZoneRow } from "@/lib/tests/zones";

const sv = (value: number, digits: number) =>
  value.toFixed(digits).replace(".", ",");

/** Ett spann som text: "< a", "a–b" eller "> b". */
function span(
  min: string | null,
  max: string | null,
  lower = "<",
  upper = ">",
): string {
  if (min === null && max === null) return "–";
  if (min === null && max !== null) return `${lower} ${max}`;
  if (max === null && min !== null) return `${upper} ${min}`;
  return `${min}–${max}`;
}

type BikeChoice = {
  position: BikePositionKey;
  tire: BikeTireKey;
  bikeKg: string;
  riderKg: string;
};

const STORAGE_KEY = "coachvy:bike-setup";

const readSaved = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};
const noSubscription = () => () => {};

/** Positionen och däcken minns per webbläsare – de ändras sällan. */
function useBikeChoice(defaultRiderKg: number | null) {
  // Det sparade valet läses efter hydreringen, så att servern och klienten
  // börjar likadant; ändringar i den här vyn ligger ovanpå.
  const saved = useSyncExternalStore(noSubscription, readSaved, () => null);
  const [override, setOverride] = useState<Partial<BikeChoice>>({});

  let stored: Partial<BikeChoice> = {};
  try {
    const parsed = JSON.parse(saved ?? "null");
    if (parsed && typeof parsed === "object") {
      // Bara kända val – ett gammalt sparat värde ska inte hamna i listan.
      stored = {
        position: BIKE_POSITIONS.some((p) => p.key === parsed.position)
          ? parsed.position
          : undefined,
        tire: BIKE_TIRES.some((t) => t.key === parsed.tire)
          ? parsed.tire
          : undefined,
        bikeKg: typeof parsed.bikeKg === "string" ? parsed.bikeKg : undefined,
      };
    }
  } catch {
    // Trasigt värde: förvalen gäller.
  }
  // Vikten hör till atleten och sparas inte.
  const choice: BikeChoice = {
    position: override.position ?? stored.position ?? "drops",
    tire: override.tire ?? stored.tire ?? "race",
    bikeKg: override.bikeKg ?? stored.bikeKg ?? "8",
    riderKg: override.riderKg ?? (defaultRiderKg ? String(defaultRiderKg) : ""),
  };

  const update = (patch: Partial<BikeChoice>) => {
    const next = { ...choice, ...patch };
    setOverride((o) => ({ ...o, ...patch }));
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          position: next.position,
          tire: next.tire,
          bikeKg: next.bikeKg,
        }),
      );
    } catch {
      // Går det inte att spara gäller valet bara nu.
    }
  };
  return [choice, update] as const;
}

/**
 * Zonerna med det atleten känner igen bredvid: tempo i löpning och simning,
 * fart på plan väg på cykeln. Cykelns fart beror på position och däck, så de
 * går att välja – och trösklarna visas som fart överst.
 */
export function ZonesCard({
  zones,
  zoneUnit,
  sport,
  weightKg,
  thresholds = [],
  heartRates,
  fuel,
  note,
}: {
  zones: ZoneRow[];
  zoneUnit: string;
  sport: Sport;
  weightKg: number | null;
  /** Nyckelvärden i watt att översätta till fart, t.ex. LT2 och FTP. */
  thresholds?: { label: string; watts: number }[];
  /**
   * Pulsen vid zonernas gränser, ur testets egen pulskurva. Samma ordning som
   * zonerna; null där kurvan inte räcker.
   */
  heartRates?: [number | null, number | null][];
  /** Fett och kolhydrat i g/h vid zonens mitt, ur Mader-modellen. */
  fuel?: ({ fat: number; carbs: number } | null)[];
  note?: string;
}) {
  const ids = useId();
  const [choice, update] = useBikeChoice(weightKg);
  const bike = sport === "cykling" && zoneUnit === "W";
  const pace = showsPace(sport, zoneUnit);

  if (zones.length === 0 && !(bike && thresholds.length > 0)) return null;

  const riderKg = Number(choice.riderKg.replace(",", "."));
  const setup =
    riderKg > 0
      ? {
          ...bikeSetup(riderKg, choice.position, choice.tire),
          bikeKg: Number(choice.bikeKg.replace(",", ".")) || 0,
        }
      : null;
  const kmh = (watts: number | null) => {
    if (watts === null || !setup) return null;
    const v = speedForPower(watts, setup);
    return v === null ? null : sv(v * 3.6, 1);
  };

  const digits = digitsForUnit(zoneUnit);
  const value = (v: number | null) => (v === null ? null : sv(v, digits));
  const swim = sport === "simning";
  /** Tiden för `metres` meter i farten v. */
  const paceOf = (v: number | null, metres: number) => {
    if (v === null) return null;
    const mps = toMetresPerSecond(v, zoneUnit);
    if (mps === null || !(mps > 0)) return null;
    const seconds = metres / mps;
    // Korta längder i sekunder med en decimal, t.ex. "22,5".
    return seconds < 60 && metres < 100
      ? seconds.toFixed(1).replace(".", ",")
      : formatDuration(seconds);
  };

  const baseHeaders = bike
    ? ["Zon", "Watt", "Fart på plan väg (km/h)", "Vad den gör"]
    : pace
      ? [
          "Zon",
          `Tempo per ${swim ? "100 m" : "km"}`,
          // Simmare räknar i 50 och 25 m också – bassängens längder.
          ...(swim ? ["Per 50 m", "Per 25 m"] : []),
          `Fart (${zoneUnit})`,
          "Vad den gör",
        ]
      : ["Zon", `Spann (${zoneUnit})`, "Vad den gör"];

  const baseRows = zones.map((z) => {
    const range = span(value(z.min), value(z.max));
    if (bike) {
      return [
        z.zone,
        range,
        setup ? span(kmh(z.min), kmh(z.max)) : "–",
        z.description,
      ];
    }
    if (pace) {
      // Lägre fart är långsammare tempo: spannet skrivs långsamt–snabbt.
      const paces = (metres: number) =>
        span(
          paceOf(z.min, metres),
          paceOf(z.max, metres),
          "långsammare än",
          "snabbare än",
        );
      return [
        z.zone,
        paces(swim ? 100 : 1000),
        ...(swim ? [paces(50), paces(25)] : []),
        range,
        z.description,
      ];
    }
    return [z.zone, range, z.description];
  });

  // Puls och bränsle läggs före beskrivningen, som sista kolumnerna med tal.
  const hasHr = heartRates?.some(([a, b]) => a !== null || b !== null) ?? false;
  const hasFuel = fuel?.some((f) => f !== null) ?? false;
  const extraHeaders = [
    ...(hasHr ? ["Puls"] : []),
    ...(hasFuel ? ["Fett g/h", "Kolhydrat g/h"] : []),
  ];
  const headers = [
    ...baseHeaders.slice(0, -1),
    ...extraHeaders,
    baseHeaders[baseHeaders.length - 1],
  ];
  const rows = baseRows.map((row, i) => {
    const hr = heartRates?.[i];
    const f = fuel?.[i];
    const extra = [
      ...(hasHr
        ? [
            hr
              ? span(
                  hr[0] === null ? null : String(Math.round(hr[0])),
                  hr[1] === null ? null : String(Math.round(hr[1])),
                )
              : "–",
          ]
        : []),
      ...(hasFuel
        ? f
          ? [String(Math.round(f.fat)), String(Math.round(f.carbs))]
          : ["–", "–"]
        : []),
    ];
    return [...row.slice(0, -1), ...extra, row[row.length - 1]];
  });

  return (
    <Card className="min-w-0">
      <CardTitle>{bike ? "Zoner och fart" : "Zoner"}</CardTitle>

      {bike && (
        <div className="mb-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <label
              className="space-y-1 text-[12px] text-text-muted"
              htmlFor={`${ids}-pos`}
            >
              <span>Position</span>
              <Select
                id={`${ids}-pos`}
                value={choice.position}
                onChange={(e) =>
                  update({ position: e.target.value as BikePositionKey })
                }
              >
                {BIKE_POSITIONS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label} (CdA {sv(p.cda, 2)})
                  </option>
                ))}
              </Select>
            </label>
            <label
              className="space-y-1 text-[12px] text-text-muted"
              htmlFor={`${ids}-tire`}
            >
              <span>Däck</span>
              <Select
                id={`${ids}-tire`}
                value={choice.tire}
                onChange={(e) =>
                  update({ tire: e.target.value as BikeTireKey })
                }
              >
                {BIKE_TIRES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label} (Crr {sv(t.crr, 4)})
                  </option>
                ))}
              </Select>
            </label>
            <label
              className="space-y-1 text-[12px] text-text-muted"
              htmlFor={`${ids}-rider`}
            >
              <span>Atletens vikt (kg)</span>
              <Input
                id={`${ids}-rider`}
                inputMode="decimal"
                value={choice.riderKg}
                placeholder="75"
                onChange={(e) => update({ riderKg: e.target.value })}
              />
            </label>
            <label
              className="space-y-1 text-[12px] text-text-muted"
              htmlFor={`${ids}-bike`}
            >
              <span>Cykel och utrustning (kg)</span>
              <Input
                id={`${ids}-bike`}
                inputMode="decimal"
                value={choice.bikeKg}
                onChange={(e) => update({ bikeKg: e.target.value })}
              />
            </label>
          </div>

          {setup && thresholds.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {thresholds.map((t) => (
                <li
                  key={t.label}
                  className="rounded-md border border-line bg-surface px-3 py-2 text-[13px] text-text-muted tabular-nums"
                >
                  <span className="font-medium text-text">{t.label}</span>{" "}
                  {Math.round(t.watts)} W ·{" "}
                  <span className="font-medium text-text">
                    {kmh(t.watts)} km/h
                  </span>
                </li>
              ))}
            </ul>
          )}
          {!setup && (
            <p className="text-[12px] text-text-subtle">
              Fyll i atletens vikt för att se farten.
            </p>
          )}
        </div>
      )}

      {zones.length > 0 && (
        <DataTable
          headers={headers}
          minWidth={(bike || pace ? 600 : 520) + extraHeaders.length * 90}
          rows={rows}
        />
      )}

      <p className="mt-3 text-[12px] leading-relaxed text-text-subtle">
        {hasHr &&
          "Pulsen är den testet gav vid zonens gränser – ur atletens egen pulskurva, inte ur procent av maxpuls. "}
        {hasFuel &&
          "Fett och kolhydrat gäller zonens mitt, ur Mader-modellen. "}
        {bike &&
          "Farten gäller plan väg utan vind vid 20 °C. Position och däck avgör mer än några procent effekt – se farten som en översättning av watten, inte som ett mål. "}
        {note}
      </p>
    </Card>
  );
}
