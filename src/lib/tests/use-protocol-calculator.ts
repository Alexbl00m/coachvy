"use client";

import { useMemo, useState } from "react";

import type { IntensityUnit, Sport } from "@/lib/calculators/lactate";
import { analyseSession, type Effort, type SessionAnalysis } from "./analysis";
import {
  defaultUnitFor,
  protocolByKey,
  protocolsForSport,
  type Protocol,
  type ProtocolKey,
} from "./protocols";

export type EffortRow = {
  id: number;
  intensity: string;
  duration: string;
  distance: string;
  lactate: string;
  heartRate: string;
};

const decimal = (raw: string) => Number(raw.replace(",", "."));

/** "3:30" eller "210" till sekunder. */
export function parseDuration(raw: string): number | null {
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

/** Sekunder till "0:20" eller "12:00" – samma form som fältet läser in. */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds - minutes * 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

const emptyRow = (id: number, seconds?: number): EffortRow => ({
  id,
  intensity: "",
  duration: seconds !== undefined ? formatDuration(seconds) : "",
  distance: "",
  lactate: "",
  heartRate: "",
});

/** Rader med innehåll. En förifylld längd utan värde räknas inte. */
function hasContent(e: Effort): boolean {
  return e.intensity !== null || e.distanceM !== null || e.lactate !== null;
}

export type Sex = "man" | "kvinna";

export type BodyComposition = {
  bodyFat: string;
  sex: Sex | "";
};

export type ProtocolCalculator = {
  sport: Sport;
  setSport: (next: Sport) => void;
  protocol: ProtocolKey;
  setProtocol: (next: ProtocolKey) => void;
  unit: IntensityUnit;
  setUnit: (next: IntensityUnit) => void;
  weight: string;
  setWeight: (next: string) => void;
  /** Bara för protokoll som kräver det – se `needsBodyComposition`. */
  bodyFat: string;
  setBodyFat: (next: string) => void;
  sex: Sex | "";
  setSex: (next: Sex | "") => void;

  rows: EffortRow[];
  setRow: (id: number, patch: Partial<EffortRow>) => void;
  addRow: () => void;
  removeRow: (id: number) => void;

  spec: Protocol | null;
  available: Protocol[];
  /** Raderna som faktiskt innehåller något. */
  filled: Effort[];
  analysis: SessionAnalysis;
};

/**
 * All logik som testberäkningen behöver, oberoende av var den visas.
 *
 * Både den inloggade vyn (som sparar på en adept) och den publika (som inte
 * sparar något) kör exakt samma protokoll och samma beräkning. Ligger den i
 * en delad hook kan de inte glida isär – en rättning i modellen når båda.
 */
export function useProtocolCalculator(
  initialSport: Sport = "cykling",
  initialWeight = "",
  initialBody: BodyComposition = { bodyFat: "", sex: "" },
): ProtocolCalculator {
  const [sport, setSportState] = useState<Sport>(initialSport);
  const [protocol, setProtocolState] = useState<ProtocolKey>(
    protocolsForSport(initialSport)[0]?.key ?? "laktat-steg",
  );
  const [unit, setUnit] = useState<IntensityUnit>(defaultUnitFor(initialSport));
  const [weight, setWeight] = useState(initialWeight);
  const [bodyFat, setBodyFat] = useState(initialBody.bodyFat);
  const [sex, setSex] = useState<Sex | "">(initialBody.sex);
  const [rows, setRows] = useState<EffortRow[]>([0, 1, 2].map((id) => emptyRow(id)));
  const [nextId, setNextId] = useState(3);

  /**
   * Byte av protokoll trimmar raderna till det nya protokollets gränser.
   *
   * Utan det låg gamla rader kvar: fyllde man i ett CP-test med tre insatser
   * och bytte till FTP 20 minuter, som bara har en, räknades visserligen bara
   * den första – men alla tre stod kvar i tabellen och följde med ut i
   * utskriften. Ett enintervallstest såg då ut som ett tretest.
   */
  const setProtocol = (next: ProtocolKey) => {
    setProtocolState(next);
    const spec = protocolByKey(next);
    if (!spec) return;

    setRows((current) => {
      let trimmed =
        spec.maxEfforts !== null && current.length > spec.maxEfforts
          ? current.slice(0, spec.maxEfforts)
          : current;

      // Och fyll på om det nya protokollet kräver fler rader än som finns.
      const wanted = Math.max(spec.minEfforts, spec.template?.length ?? 0);
      if (trimmed.length < wanted) {
        const extra = wanted - trimmed.length;
        trimmed = [
          ...trimmed,
          ...Array.from({ length: extra }, (_, i) => emptyRow(nextId + i)),
        ];
        setNextId((n) => n + extra);
      }

      // Protokoll med givna längder får dem ifyllda där fältet är tomt. Det
      // coachen redan skrivit rörs inte.
      const template = spec.template;
      if (template) {
        trimmed = trimmed.map((row, i) =>
          i < template.length && !row.duration.trim()
            ? { ...row, duration: formatDuration(template[i]) }
            : row,
        );
      }
      return trimmed;
    });
  };

  const setSport = (next: Sport) => {
    setSportState(next);
    setUnit(defaultUnitFor(next));
    // Protokollen är grenspecifika, så valet måste följa med.
    const forNext = protocolsForSport(next);
    if (!forNext.some((p) => p.key === protocol)) {
      setProtocol(forNext[0].key);
    }
  };

  const setRow = (id: number, patch: Partial<EffortRow>) =>
    setRows((current) =>
      current.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );

  const addRow = () => {
    const spec = protocolByKey(protocol);
    setRows((current) =>
      spec?.maxEfforts !== null && spec !== null && current.length >= spec.maxEfforts
        ? current
        : [...current, emptyRow(nextId)],
    );
    setNextId((n) => n + 1);
  };

  const removeRow = (id: number) =>
    setRows((current) =>
      current.length > 1 ? current.filter((r) => r.id !== id) : current,
    );

  const filled = useMemo(() => {
    const parsed: Effort[] = rows.map((row, index) => {
      const intensity = decimal(row.intensity);
      const distance = decimal(row.distance);
      const lactate = decimal(row.lactate);
      const heartRate = decimal(row.heartRate);
      return {
        ordinal: index,
        intensity:
          row.intensity.trim() && Number.isFinite(intensity) ? intensity : null,
        durationSeconds: parseDuration(row.duration),
        distanceM:
          row.distance.trim() && Number.isFinite(distance) ? distance : null,
        lactate: row.lactate.trim() && Number.isFinite(lactate) ? lactate : null,
        heartRate:
          row.heartRate.trim() && Number.isFinite(heartRate) ? heartRate : null,
      };
    });

    return parsed.filter(hasContent);
  }, [rows]);

  const analysis = useMemo(
    () =>
      analyseSession({
        protocol,
        sport,
        unit,
        efforts: filled,
        weightKg: weight.trim() ? decimal(weight) : null,
        bodyFatPct: bodyFat.trim() ? decimal(bodyFat) : null,
        sex: sex || null,
      }),
    [protocol, sport, unit, filled, weight, bodyFat, sex],
  );

  return {
    sport,
    setSport,
    protocol,
    setProtocol,
    unit,
    setUnit,
    weight,
    setWeight,
    bodyFat,
    setBodyFat,
    sex,
    setSex,
    rows,
    setRow,
    addRow,
    removeRow,
    spec: protocolByKey(protocol),
    available: protocolsForSport(sport),
    filled,
    analysis,
  };
}
