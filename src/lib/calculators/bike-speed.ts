/**
 * Fart på cykeln ur effekt – på plan väg, utan vind.
 *
 * Portad från Bike-Power-Speed-Calculator-App. Effekten vid hjulet går åt
 * till rullmotstånd och luftmotstånd:
 *
 *   P·η = v · (m·g·Crr + ½·ρ·CdA·v²)
 *
 * och farten är den positiva roten, som här hittas med bisektion precis som i
 * originalet. En rättelse: originalet räknade lufttätheten som
 * 1,225 · 273/(273 + T), men 1,225 kg/m³ gäller vid 15 °C, inte vid 0 °C.
 * Vid 20 °C blev luften 5 % för tunn (1,14 i stället för 1,20) och farten
 * därmed något för hög.
 *
 * Farten är en översättning av watten till något atleten känner igen, inte
 * ett mått på formen: position och däck avgör mer än några procent effekt.
 */

export const GRAVITY = 9.81;

export type BikeSetup = {
  /** Atletens vikt, kg. */
  riderKg: number;
  /** Cykel och utrustning, kg. */
  bikeKg: number;
  /** Luftmotstånd gånger frontarea, m². */
  cda: number;
  /** Rullmotståndskoefficient. */
  crr: number;
  /** Lufttäthet, kg/m³. */
  airDensity: number;
  /** Andel av effekten som når hjulet. */
  drivetrain: number;
};

/** Positionerna ur originalet, med dess CdA. */
export const BIKE_POSITIONS = [
  { key: "hoods-relaxed", label: "Bromsgrepp, upprätt", cda: 0.4 },
  { key: "hoods", label: "Bromsgrepp", cda: 0.35 },
  { key: "drops", label: "Nedre styret", cda: 0.32 },
  { key: "drops-tucked", label: "Nedre styret, ihopkrupen", cda: 0.3 },
  { key: "aero-bars", label: "Aerobyggel", cda: 0.27 },
  { key: "tt", label: "Tempocykel", cda: 0.23 },
] as const;

export const BIKE_TIRES = [
  { key: "tt", label: "Snabba tempodäck", crr: 0.0025 },
  { key: "race", label: "Tävlingsdäck", crr: 0.0033 },
  { key: "training", label: "Träningsdäck", crr: 0.004 },
  { key: "gravel", label: "Gravel", crr: 0.005 },
  { key: "mtb", label: "MTB", crr: 0.007 },
] as const;

export type BikePositionKey = (typeof BIKE_POSITIONS)[number]["key"];
export type BikeTireKey = (typeof BIKE_TIRES)[number]["key"];

/**
 * Lufttätheten vid en temperatur och höjd: 1,225 kg/m³ vid 15 °C och
 * havsnivå, omräknad efter temperaturen och en skalhöjd på 8 000 m.
 */
export function airDensity(temperatureC = 20, altitudeM = 100): number {
  return (
    1.225 * (288.15 / (273.15 + temperatureC)) * Math.exp(-altitudeM / 8000)
  );
}

export function bikeSetup(
  riderKg: number,
  position: BikePositionKey = "drops",
  tire: BikeTireKey = "race",
  bikeKg = 8,
): BikeSetup {
  return {
    riderKg,
    bikeKg,
    cda: BIKE_POSITIONS.find((p) => p.key === position)?.cda ?? 0.32,
    crr: BIKE_TIRES.find((t) => t.key === tire)?.crr ?? 0.0033,
    airDensity: airDensity(),
    drivetrain: 0.975,
  };
}

/** Effekten som krävs för farten `metresPerSecond` på plan väg. */
export function powerForSpeed(metresPerSecond: number, s: BikeSetup): number {
  const v = metresPerSecond;
  const mass = s.riderKg + s.bikeKg;
  const rolling = mass * GRAVITY * s.crr;
  const air = 0.5 * s.airDensity * s.cda * v * v;
  return (v * (rolling + air)) / s.drivetrain;
}

/** Farten i m/s som effekten `watts` ger på plan väg. null utan effekt. */
export function speedForPower(watts: number, s: BikeSetup): number | null {
  if (!(watts > 0) || !(s.riderKg + s.bikeKg > 0) || !(s.cda > 0)) return null;
  let low = 0;
  let high = 30;
  for (let i = 0; i < 60; i += 1) {
    const mid = (low + high) / 2;
    if (powerForSpeed(mid, s) > watts) high = mid;
    else low = mid;
  }
  return (low + high) / 2;
}

/** Trösklarna i watt som ska översättas till fart, i visningsordning. */
const BIKE_KEYS: [string, string][] = [
  ["LT1", "LT1"],
  ["LT2", "LT2"],
  ["FTP", "FTP"],
  ["CP", "CP"],
];

export function bikeThresholds(
  metrics: { key: string; value: number | string; unit: string }[],
): { label: string; watts: number }[] {
  return BIKE_KEYS.flatMap(([key, label]) => {
    const m = metrics.find((x) => x.key === key && x.unit === "W");
    return m && Number(m.value) > 0 ? [{ label, watts: Number(m.value) }] : [];
  });
}
