/**
 * Träningszoner förankrade i modellens markörer: FatMax, CarbMax, 2 mmol, AT och MAP.
 */
import { EngineResult, valueAtPower } from "./engine";

export interface MetabolicZone {
  id: number;
  name: string;
  description: string;
  lower: number;
  /** null för den öppna översta zonen */
  upper: number | null;
  /** Bränsle och energi mitt i zonen */
  choGh: number | null;
  fatGh: number | null;
  energyKcalH: number | null;
}

export const metabolicZones = (engine: EngineResult): MetabolicZone[] => {
  const fm = engine.fatMax?.power;
  const at = engine.at?.power;
  if (!fm || !at) return [];
  const raw = [0, 0.8 * fm, engine.carbMax ?? 1.1 * fm, engine.lt2 ?? 0.88 * at, at, engine.map];
  // Gränserna måste stiga även för ovanliga profiler
  const b = [...raw];
  for (let i = 1; i < b.length; i++) b[i] = Math.max(b[i], b[i - 1] + 5);

  const defs = [
    ["Återhämtning", "Lätt, nästan bara fett"],
    ["Grund", "Fettförbränningen nära max, kolhydrater under 90 g/h"],
    ["Tempo", "Kolhydraterna tar över, laktat under 2 mmol/L"],
    ["Tröskel", "Från 2 mmol/L upp till MLSS"],
    ["VO2max", "Över tröskeln, laktatet stiger"],
    ["Anaerob", "Över aerob maxeffekt"],
  ];
  return defs.map(([name, description], i) => {
    const lower = b[i];
    const upper = i + 1 < b.length ? b[i + 1] : null;
    const mid = upper !== null ? (lower + upper) / 2 : null;
    const fuelAt = (key: "choGh" | "fatGh" | "energyKcalH") =>
      mid !== null ? valueAtPower(engine, Math.max(mid, engine.points[0].power), key) : null;
    return {
      id: i + 1,
      name,
      description,
      lower: Math.round(lower),
      upper: upper !== null ? Math.round(upper) : null,
      choGh: fuelAt("choGh"),
      fatGh: fuelAt("fatGh"),
      energyKcalH: fuelAt("energyKcalH"),
    };
  });
};
