/**
 * Träningszoner, tre scheman som hålls isär.
 *
 * Vilket schema som gäller avgörs av protokollet, inte av appen: ett laktattest
 * ger en tröskel och zonerna räknas som multiplar av tröskeltempot; ett
 * CS-test ger critical speed och zonerna räknas som fraktioner av den; ett
 * effekttest ger FTP och zonerna följer Coggans indelning.
 *
 * De två första kommer från Alexanders egna kalkylatorer
 * (runner-performance-calculator respektive running-calculators). Den tredje
 * ligger redan i cykelkalkylen.
 */

export type ZoneRow = {
  zone: string;
  /** Undre gräns i belastningens enhet. null = ingen undre gräns. */
  min: number | null;
  /** Övre gräns. null = ingen övre gräns. */
  max: number | null;
  description: string;
};

/**
 * Tröskelschemat: zoner som multiplar av tröskel*tempot*.
 *
 * Eftersom det är tempo och inte fart går skalan åt andra hållet – ett högre
 * tal betyder långsammare. Här räknas de om till fart, så att alla scheman
 * redovisas i samma riktning som resten av appen.
 */
const THRESHOLD_SPEC: {
  zone: string;
  /** [långsammaste, snabbaste] som multipel av tröskeltempot. */
  pace: [number | null, number | null];
  description: string;
}[] = [
  { zone: "Easy", pace: [null, 1.5], description: "Återhämtning och riktigt lugn distans" },
  { zone: "Zon 2", pace: [1.5, 1.2], description: "Grunduthållighet, huvuddelen av volymen" },
  { zone: "Endurance", pace: [1.2, 1.1], description: "Längre distanspass i högre fart" },
  { zone: "Threshold", pace: [1.1, 0.98], description: "Tröskelarbete" },
  { zone: "Suprathreshold", pace: [0.98, 0.95], description: "Strax över tröskeln" },
  { zone: "VO2max", pace: [0.95, 0.85], description: "Syreupptagsintervaller" },
  { zone: "Power", pace: [0.85, null], description: "Korta maximala insatser" },
];

/**
 * Zoner ur ett tröskeltempo.
 *
 * `thresholdSpeed` anges i samma enhet som resultaten redovisas i (km/h eller
 * m/s). En multipel på tempot motsvarar dess invers på farten: 1,5 gånger
 * långsammare tempo är farten delad med 1,5.
 */
export function thresholdZones(thresholdSpeed: number): ZoneRow[] {
  if (!(thresholdSpeed > 0)) return [];

  return THRESHOLD_SPEC.map(({ zone, pace, description }) => {
    const [slowest, fastest] = pace;
    return {
      zone,
      min: slowest === null ? null : thresholdSpeed / slowest,
      max: fastest === null ? null : thresholdSpeed / fastest,
      description,
    };
  });
}

/** Critical speed-schemat: zoner som fraktioner av CS. */
const CS_SPEC: { zone: string; range: [number, number | null]; description: string }[] = [
  { zone: "Recovery", range: [0.6, 0.7], description: "Aktiv återhämtning" },
  { zone: "Easy / aerob", range: [0.7, 0.8], description: "Lugn distans" },
  { zone: "Moderate", range: [0.8, 0.87], description: "Distans i högre fart" },
  { zone: "Threshold", range: [0.87, 0.93], description: "Tröskelarbete" },
  { zone: "Critical speed", range: [0.93, 1.0], description: "Vid critical speed" },
  { zone: "Interval", range: [1.0, 1.1], description: "Intervaller över CS" },
  { zone: "Repetition", range: [1.1, 1.2], description: "Korta hårda repetitioner" },
];

export function criticalSpeedZones(criticalSpeed: number): ZoneRow[] {
  if (!(criticalSpeed > 0)) return [];
  return CS_SPEC.map(({ zone, range, description }) => ({
    zone,
    min: criticalSpeed * range[0],
    max: range[1] === null ? null : criticalSpeed * range[1],
    description,
  }));
}

/** Coggans sjuzonsmodell i procent av FTP. */
const FTP_SPEC: { zone: string; range: [number, number | null]; description: string }[] = [
  { zone: "Z1 – Aktiv återhämtning", range: [0, 0.55], description: "Mycket lätt" },
  { zone: "Z2 – Uthållighet", range: [0.55, 0.75], description: "Långa pass, fettförbränning" },
  { zone: "Z3 – Tempo", range: [0.75, 0.9], description: "Uthålligt hårt" },
  { zone: "Z4 – Tröskel", range: [0.9, 1.05], description: "Höjer laktattröskeln" },
  { zone: "Z5 – VO2max", range: [1.05, 1.2], description: "Höjer syreupptaget" },
  { zone: "Z6 – Anaerob", range: [1.2, 1.5], description: "Anaerob kapacitet" },
  { zone: "Z7 – Neuromuskulär", range: [1.5, null], description: "Spurt och maximal effekt" },
];

export function ftpZones(ftp: number): ZoneRow[] {
  if (!(ftp > 0)) return [];
  return FTP_SPEC.map(({ zone, range, description }) => ({
    zone,
    min: ftp * range[0],
    max: range[1] === null ? null : ftp * range[1],
    description,
  }));
}
