/**
 * Cykelns effektbalans: vid konstant fart går all effekt åt till att övervinna
 * rullmotstånd, tyngdkraft och luftmotstånd.
 *
 *   P_hjul = (F_rull + F_lut + F_luft) · v
 *   P_cyklist = P_hjul / verkningsgrad
 *
 * Portad från Bike-Power-Speed-Calculator-App (`streamlit_app.py`). Fysiken
 * är densamma; tre saker är rättade och kommenterade där de sitter:
 * luftdensiteten, luftmotståndets tecken i medvind och lösarens gränsfall.
 */

/** Tyngdaccelerationen. */
const GRAVITY = 9.80665;

/** Specifik gaskonstant för torr luft, J/(kg·K). */
const GAS_CONSTANT_DRY_AIR = 287.058;

/** Lufttrycket vid havsytan i standardatmosfären, Pa. */
const SEA_LEVEL_PRESSURE = 101325;

export type Position = {
  id: string;
  label: string;
  cda: number;
};

/**
 * CdA efter position. Riktvärden för en cyklist runt 75 kg – CdA skalar med
 * kroppsstorlek, så för en riktigt stor eller liten atlet är de här bara en
 * startpunkt. Har du mätt CdA i vindtunnel eller med fältprotokoll: skriv in
 * det i stället.
 */
export const POSITIONS: Position[] = [
  { id: "hoods-relaxed", label: "Bromshandtag, upprätt", cda: 0.4 },
  { id: "hoods", label: "Bromshandtag, normal", cda: 0.35 },
  { id: "drops", label: "Underdel, normal", cda: 0.32 },
  { id: "drops-tucked", label: "Underdel, hoptryckt", cda: 0.3 },
  { id: "aerobars", label: "Aerobygel", cda: 0.27 },
  { id: "tt", label: "Tempoposition", cda: 0.23 },
  { id: "tt-pro", label: "Tempoposition, optimerad", cda: 0.19 },
];

export type Tire = {
  id: string;
  label: string;
  crr: number;
};

/** Rullmotstånd efter däcktyp, på asfalt. */
export const TIRES: Tire[] = [
  { id: "tt", label: "Tempodäck", crr: 0.0025 },
  { id: "race", label: "Tävlingsdäck", crr: 0.0033 },
  { id: "training", label: "Träningsdäck", crr: 0.004 },
  { id: "gravel", label: "Grusdäck", crr: 0.005 },
  { id: "mtb", label: "MTB-däck", crr: 0.007 },
];

export type EventType = {
  id: string;
  label: string;
  /** Andel av FTP som brukar hållas över loppet. */
  ftpFraction: number;
};

/**
 * Hur stor del av FTP som normalt hålls i olika lopp. Tumregler: ett tempolopp
 * körs nära tröskeln, ett linjelopp lägre eftersom farten varierar och du
 * ligger i klunga stora delar av tiden.
 */
export const EVENT_TYPES: EventType[] = [
  { id: "tt", label: "Tempolopp", ftpFraction: 0.95 },
  { id: "criterium", label: "Kriterium", ftpFraction: 0.9 },
  { id: "road", label: "Linjelopp", ftpFraction: 0.85 },
  { id: "fondo", label: "Långlopp", ftpFraction: 0.8 },
];

/**
 * Luftdensitet ur standardatmosfären och allmänna gaslagen.
 *
 * Originalet räknade `1.225 · exp(−h/8000) · 273/(273+T)`, vilket dubbelräknar
 * temperaturen: 1,225 kg/m³ gäller redan vid 15 °C, så formeln gav 1,161 vid
 * havsytan och 15 °C i stället för 1,225. Felet är ungefär 5 % på
 * luftmotståndet, alltså flera watt.
 */
export function airDensity(altitudeM: number, temperatureC: number): number {
  const altitude = Number.isFinite(altitudeM) ? altitudeM : 0;
  const temperature = Number.isFinite(temperatureC) ? temperatureC : 15;

  const pressure =
    SEA_LEVEL_PRESSURE * (1 - 2.25577e-5 * altitude) ** 5.25588;
  const kelvin = temperature + 273.15;

  return pressure / (GAS_CONSTANT_DRY_AIR * kelvin);
}

export type RideParams = {
  /** Total systemvikt: cyklist + kläder + cykel, kg. */
  totalWeightKg: number;
  /** Genomsnittlig lutning i procent. */
  gradePercent: number;
  cda: number;
  crr: number;
  /** Vind längs färdriktningen i m/s. Positivt = motvind. */
  windMs: number;
  airDensityKgM3: number;
  /** Drivlinans verkningsgrad, 0–1. */
  drivetrainEfficiency: number;
};

export type PowerBreakdown = {
  /** Effekt cyklisten trampar, W. */
  riderWatts: number;
  /** Effekt som når vägen, W. */
  wheelWatts: number;
  rollingWatts: number;
  gravityWatts: number;
  airWatts: number;
};

/** Effekten som krävs för att hålla en fart. */
export function powerForSpeed(
  speedMs: number,
  params: RideParams,
): PowerBreakdown {
  const angle = Math.atan(params.gradePercent / 100);
  const normalForce = params.totalWeightKg * GRAVITY;

  const rolling = normalForce * params.crr * Math.cos(angle);
  const gravity = normalForce * Math.sin(angle);

  // Luftmotståndet verkar mot den relativa vinden. Originalet kvadrerade den
  // relativa farten, vilket tappar tecknet: i medvind starkare än cyklistens
  // egen fart blåser luften på bakifrån och ska hjälpa, men modellen bromsade
  // ändå. `v · |v|` behåller riktningen.
  const relative = speedMs + params.windMs;
  const air = 0.5 * params.cda * params.airDensityKgM3 * relative * Math.abs(relative);

  const wheelWatts = (rolling + gravity + air) * speedMs;

  return {
    riderWatts: wheelWatts / params.drivetrainEfficiency,
    wheelWatts,
    rollingWatts: rolling * speedMs,
    gravityWatts: gravity * speedMs,
    airWatts: air * speedMs,
  };
}

/** Den fart som modellen inte söker över, m/s (≈ 180 km/h). */
const MAX_SPEED_MS = 50;

/**
 * Farten en given effekt räcker till. Löses numeriskt eftersom luftmotståndet
 * är kvadratiskt – ingen sluten formel finns.
 *
 * Returnerar null när effekten inte räcker för att röra sig alls (brant
 * uppförsbacke) eller överstiger vad modellen söker över.
 */
export function speedForPower(
  riderWatts: number,
  params: RideParams,
): number | null {
  if (!(riderWatts > 0)) return null;

  // I riktigt kraftig medvind är P(v) inte växande nära noll – man rullar
  // framåt utan att trampa. Effekten växer ändå monotont över den punkten, så
  // en enda rot finns för varje positiv måleffekt.
  if (powerForSpeed(MAX_SPEED_MS, params).riderWatts < riderWatts) return null;

  let low = 0;
  let high = MAX_SPEED_MS;

  // 60 halveringar ger långt under en tusendels m/s.
  for (let i = 0; i < 60; i += 1) {
    const mid = (low + high) / 2;
    if (powerForSpeed(mid, params).riderWatts > riderWatts) {
      high = mid;
    } else {
      low = mid;
    }
  }

  const solution = (low + high) / 2;
  return solution > 0.01 ? solution : null;
}

/** Genomsnittlig lutning i procent från stigning och distans. */
export function averageGrade(climbM: number, distanceKm: number): number {
  if (!(distanceKm > 0)) return 0;
  return (100 * climbM) / (distanceKm * 1000);
}

export type Zone = {
  zone: string;
  name: string;
  /** Andelar av FTP: [min, max]. max = null för den översta zonen. */
  min: number;
  max: number | null;
  description: string;
};

/**
 * Coggans sjuzonsmodell i procent av FTP. Samma indelning som kalkylatorn i
 * originalrepot, och den som ligger bakom IF- och TSS-talen nedan.
 */
const ZONE_SPEC: Zone[] = [
  { zone: "Z1", name: "Aktiv återhämtning", min: 0, max: 0.55, description: "Mycket lätt, återhämtning" },
  { zone: "Z2", name: "Uthållighet", min: 0.55, max: 0.75, description: "Långa pass, fettförbränning" },
  { zone: "Z3", name: "Tempo", min: 0.75, max: 0.9, description: "Uthålligt hårt, förbättrad effektivitet" },
  { zone: "Z4", name: "Tröskel", min: 0.9, max: 1.05, description: "Höjer laktattröskeln" },
  { zone: "Z5", name: "VO2max", min: 1.05, max: 1.2, description: "Höjer syreupptaget" },
  { zone: "Z6", name: "Anaerob", min: 1.2, max: 1.5, description: "Anaerob kapacitet, laktattolerans" },
  { zone: "Z7", name: "Neuromuskulär", min: 1.5, max: null, description: "Spurt och maximal effekt" },
];

/** Zonerna i watt för en given FTP. */
export function powerZones(ftp: number): (Zone & { minWatts: number; maxWatts: number | null })[] {
  return ZONE_SPEC.map((zone) => ({
    ...zone,
    minWatts: Math.round(zone.min * ftp),
    maxWatts: zone.max === null ? null : Math.round(zone.max * ftp),
  }));
}

/** Vilken zon en intensitet hamnar i. */
export function zoneForIntensity(intensityFactor: number): Zone {
  return (
    ZONE_SPEC.find(
      (zone) =>
        intensityFactor > zone.min &&
        (zone.max === null || intensityFactor <= zone.max),
    ) ?? ZONE_SPEC[0]
  );
}

/**
 * Training Stress Score för ett pass i konstant effekt.
 *
 * TSS = timmar · IF² · 100. Vid jämn effekt är normaliserad effekt lika med
 * medeleffekten, så IF = P/FTP rakt av. På ett lopp med varierande fart blir
 * det verkliga TSS-värdet högre än modellens.
 */
export function trainingStressScore(
  seconds: number,
  intensityFactor: number,
): number {
  if (!(seconds > 0) || !(intensityFactor > 0)) return 0;
  return (seconds / 3600) * intensityFactor ** 2 * 100;
}

export type RideSolution = {
  riderWatts: number;
  speedMs: number;
  seconds: number;
  breakdown: PowerBreakdown;
  intensityFactor: number | null;
  tss: number | null;
  wattsPerKg: number | null;
  zone: Zone | null;
};

export type Target =
  | { kind: "power"; watts: number }
  | { kind: "speed"; kmh: number }
  | { kind: "time"; seconds: number };

export type SolveInput = {
  params: RideParams;
  distanceKm: number;
  target: Target;
  /** Cyklistens vikt utan cykel och utrustning, för W/kg. */
  riderWeightKg: number | null;
  ftp: number | null;
};

/**
 * Löser hela ritten. Vilken av effekt, fart och tid som är given avgörs av
 * målet; de andra två faller ut ur modellen.
 */
export function solveRide(input: SolveInput): RideSolution | null {
  const { params, distanceKm, target, riderWeightKg, ftp } = input;
  if (!(distanceKm > 0)) return null;

  let speedMs: number | null;

  if (target.kind === "power") {
    speedMs = speedForPower(target.watts, params);
  } else if (target.kind === "speed") {
    speedMs = target.kmh > 0 ? target.kmh / 3.6 : null;
  } else {
    speedMs =
      target.seconds > 0 ? (distanceKm * 1000) / target.seconds : null;
  }

  if (speedMs === null || !(speedMs > 0)) return null;

  const breakdown = powerForSpeed(speedMs, params);
  const riderWatts =
    target.kind === "power" ? target.watts : breakdown.riderWatts;

  // I kraftig medvind eller utför kan modellen kräva negativ effekt: farten
  // håller sig utan att man trampar. Det är ett riktigt svar, inte ett fel,
  // men IF och TSS blir meningslösa där.
  const seconds = (distanceKm * 1000) / speedMs;
  const intensityFactor = ftp && ftp > 0 && riderWatts > 0 ? riderWatts / ftp : null;

  return {
    riderWatts,
    speedMs,
    seconds,
    breakdown,
    intensityFactor,
    tss: intensityFactor === null ? null : trainingStressScore(seconds, intensityFactor),
    wattsPerKg:
      riderWeightKg && riderWeightKg > 0 && riderWatts > 0
        ? riderWatts / riderWeightKg
        : null,
    zone: intensityFactor === null ? null : zoneForIntensity(intensityFactor),
  };
}

export type SensitivityRow = {
  label: string;
  /** Sekunder sparade jämfört med utgångsläget. Negativt = långsammare. */
  secondsSaved: number;
};

/**
 * Vad varje förbättring är värd i tid, räknat vid samma effekt. Det är den
 * fråga en aerokalkyl faktiskt ska svara på: lönar sig en tempohjälm mer än
 * ett kilo mindre på cykeln?
 */
export function sensitivity(
  riderWatts: number,
  params: RideParams,
  distanceKm: number,
): SensitivityRow[] {
  const baseSpeed = speedForPower(riderWatts, params);
  if (baseSpeed === null || !(distanceKm > 0)) return [];

  const baseSeconds = (distanceKm * 1000) / baseSpeed;

  const variants: { label: string; params: RideParams; watts: number }[] = [
    {
      label: "CdA −0,010 (bättre position eller hjälm)",
      params: { ...params, cda: Math.max(params.cda - 0.01, 0.05) },
      watts: riderWatts,
    },
    {
      label: "Crr −0,0005 (snabbare däck)",
      params: { ...params, crr: Math.max(params.crr - 0.0005, 0.0005) },
      watts: riderWatts,
    },
    {
      label: "1 kg lättare",
      params: {
        ...params,
        totalWeightKg: Math.max(params.totalWeightKg - 1, 1),
      },
      watts: riderWatts,
    },
    {
      label: "10 W mer i effekt",
      params,
      watts: riderWatts + 10,
    },
  ];

  return variants.flatMap(({ label, params: variantParams, watts }) => {
    const speed = speedForPower(watts, variantParams);
    if (speed === null) return [];
    return [{ label, secondsSaved: baseSeconds - (distanceKm * 1000) / speed }];
  });
}

/** Punkter för fart–effektkurvan. */
export function speedPowerCurve(
  params: RideParams,
  fromKmh = 10,
  toKmh = 60,
  steps = 51,
): { kmh: number; watts: number }[] {
  const points: { kmh: number; watts: number }[] = [];
  for (let i = 0; i < steps; i += 1) {
    const kmh = fromKmh + ((toKmh - fromKmh) * i) / (steps - 1);
    const watts = powerForSpeed(kmh / 3.6, params).riderWatts;
    if (watts > 0) points.push({ kmh, watts });
  }
  return points;
}
