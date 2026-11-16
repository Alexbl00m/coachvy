/**
 * Konstanter för den metabola modellen (Mader & Heck 1986, Mader 2003, Hauser m.fl. 2014).
 *
 * Konstanterna är kalibrerade mot avlästa kurvor i två INSCYD-rapporter (cykel, 77–78 kg)
 * och kontrollerade mot en tredje, oberoende rapport (85 kg). Avvikelsen mot rapporternas
 * kurvor är 0,1–1 % av kurvornas spann. Se .claude/skills/vlamax-model för hela kalibreringen.
 */

export const MODEL_CONSTANTS = {
  /** ADP-kinetik (Mader & Heck 1986) */
  ks1: 0.0631,
  /** Glykolysens aktivering. Kalibrerad så att Ks2/Ks1^1,5 = 90,1 (standardvärdet 1,331 ger 84,0) */
  ks2: 1.4287,
  /** Basal laktatbildning i vila, mmol/L/min. Förklarar att laktatkurvan stiger igen vid låg effekt */
  basalLactate: 0.0648,
  /** PDH:s affinitet för pyruvat i steady state-laktatet (Mader & Heck 1986 anger 4–9, senare 2) */
  kel: 2.464,
  /** Syrekostnad per watt på cykel, ml O2/min/W, utan vilotillägg (ungefär 23 % bruttoverkningsgrad) */
  o2PerWatt: 12.5,
  /** Syreekvivalent för glykolysens bidrag, ml O2 per mmol laktat */
  o2PerLactate: 5.5,
  /** Oxiderad laktat per ml syre, mmol/ml (17 mol ATP per mol laktat) */
  lactatePerO2: 0.01576,
  /** Glykogenets molvikt, g/mol (1 mol pyruvat motsvarar 0,5 mol glukosenhet) */
  glycogenMolarMass: 162.14,
  /** Energi per gram kolhydrat (glykogen), kcal/g */
  kcalPerGramCho: 4.18,
  /** Energi per gram fett, kcal/g */
  kcalPerGramFat: 9.5,
  /** Kolhydratmängd som definierar CarbMax, g/h */
  carbMaxGramsPerHour: 90,
} as const;

export type ModelConstants = typeof MODEL_CONSTANTS;

/**
 * Hur testerna översätts till markörer i regressionen (VO2max, VLaMax, tröskel).
 * Värdena är kalibrerade mot regressionsdiagrammen i två INSCYD-rapporter och gav
 * samma konstanter oberoende ur båda (18,30 s mot 18,28 s; 11,7 s mot 12,1 s; 0,982 mot 0,978).
 */
export const INVERSION_CONSTANTS = {
  /** Glykolysens bidrag i VO2max-testet (2–5 min), uttryckt som sekunder maximal glykolys */
  glycolyticSecondsInAerobicTest: 18.3,
  /** Aerobt bidrag i sprinten, uttryckt som sekunder på MAP */
  aerobicSecondsInSprint: 11.9,
  /** Tröskelns testvärde som andel av CP */
  thresholdFractionOfCp: 0.98,
  /** Relativ osäkerhet per markör i regressionen (aerob, glykolytisk, tröskel) */
  sigmaRel: { aerobic: 0.077, glycolytic: 0.17, threshold: 0.22 },
  /** Sprintlaktat: sekunder innan glykolysen tar över i sprinten (alaktacid tid) */
  alacticSeconds: 3.5,
  /** Sprintlaktat: vilolaktat när det inte är mätt, mmol/L */
  restingLactate: 1.0,
} as const;

/** Standardvikter i regressionen. Tränaren kan vikta upp det test som är mest pålitligt. */
export const DEFAULT_WEIGHTS = { aerobic: 1, glycolytic: 1, threshold: 1 } as const;

/** Typiska mätfel (1 SD) som används för att räkna fram resultatens osäkerhet */
export const DEFAULT_ERROR_MODEL = {
  /** Wattmätarens kalibrering, gemensam för alla test (relativ) */
  powerMeter: 0.015,
  /** Tempo och dagsform i 2–20-minuterstesterna (relativ, per test) */
  longEffort: 0.02,
  /** Sprintens maximalitet (relativ) */
  sprint: 0.03,
  /** Högsta laktat efter sprinten, mmol/L */
  sprintLactate: 0.5,
  /** Kroppsvikt, kg */
  bodyMass: 0.5,
} as const;

/** Osäkerhet (1 SD, procentenheter) i kroppsfett beroende på mätmetod */
export const BODY_FAT_METHOD_SD = {
  dexa: 1.5,
  caliper: 3,
  scale: 4,
  estimate: 5,
} as const;

export type BodyFatMethod = keyof typeof BODY_FAT_METHOD_SD;
