/**
 * Testbatteriet: vilka protokoll som finns, vad de kräver och vad de ger.
 *
 * Ett protokoll är inte bara en etikett – varje har en egen beräkning. Därför
 * bor listan i kod och inte i databasen: ett protokoll utan kod bakom sig
 * skulle bara vara ett namn på en tom knapp.
 */

import type { Sport } from "@/lib/calculators/lactate";

export type ProtocolKey =
  | "laktat-steg"
  | "critical-power"
  | "ftp-20"
  | "critical-speed"
  | "cs-3min"
  | "cs-3-5min"
  | "cs-simning";

/** Vad ett steg i protokollet bär för fält. */
export type EffortShape = {
  intensity: boolean;
  duration: boolean;
  distance: boolean;
  lactate: boolean;
  heartRate: boolean;
};

export type ZoneScheme = "tröskel" | "critical-speed" | "ftp";

export type Protocol = {
  key: ProtocolKey;
  label: string;
  sports: Sport[];
  /** Kort beskrivning av när protokollet passar. */
  purpose: string;
  /** Hur testet genomförs, i en mening. */
  howTo: string;
  /** Kan protokollet genomföras utan att atleten träffar coachen? */
  remote: boolean;
  /** Minsta och största antal steg/ansträngningar. */
  minEfforts: number;
  maxEfforts: number | null;
  shape: EffortShape;
  /** Vilka storheter protokollet räknar fram. */
  produces: string[];
  zoneScheme: ZoneScheme;
};

const STEP_SHAPE: EffortShape = {
  intensity: true,
  duration: false,
  distance: false,
  lactate: true,
  heartRate: true,
};

const EFFORT_SHAPE: EffortShape = {
  intensity: true,
  duration: true,
  distance: false,
  lactate: false,
  heartRate: true,
};

const DISTANCE_SHAPE: EffortShape = {
  intensity: false,
  duration: true,
  distance: true,
  lactate: false,
  heartRate: true,
};

export const PROTOCOLS: Protocol[] = [
  {
    key: "laktat-steg",
    label: "Laktatstegtest",
    sports: ["cykling", "löpning", "simning"],
    purpose:
      "Guldstandarden när atleten kan komma till dig. Ger båda trösklarna och hela kurvan mellan dem.",
    howTo:
      "Stegvis ökande belastning, oftast 3–5 minuter per steg, med laktatprov efter varje steg.",
    remote: false,
    minEfforts: 4,
    maxEfforts: null,
    shape: STEP_SHAPE,
    produces: ["LT1", "LT2", "Zoner"],
    zoneScheme: "tröskel",
  },
  {
    key: "critical-power",
    label: "Critical power",
    sports: ["cykling"],
    purpose:
      "Bästa fjärrtestet på cykel. Två eller tre maxinsatser ger både CP och den anaeroba kapaciteten.",
    howTo:
      "Två till tre maximala insatser på olika längd, till exempel 3, 8 och 12 minuter, med full återhämtning emellan.",
    remote: true,
    minEfforts: 2,
    maxEfforts: 6,
    shape: EFFORT_SHAPE,
    produces: ["CP", "W'", "FTP", "Zoner"],
    zoneScheme: "ftp",
  },
  {
    key: "ftp-20",
    label: "FTP 20 minuter",
    sports: ["cykling"],
    purpose:
      "Snabbaste fjärrtestet. Ett enda intervall, men ger bara ett tal – ingen anaerob kapacitet.",
    howTo:
      "Ett maximalt 20-minutersintervall efter uppvärmning. FTP skattas till 95 % av medeleffekten.",
    remote: true,
    minEfforts: 1,
    maxEfforts: 1,
    shape: EFFORT_SHAPE,
    produces: ["FTP", "Zoner"],
    zoneScheme: "ftp",
  },
  {
    key: "critical-speed",
    label: "Critical speed – tidtagna distanser",
    sports: ["löpning"],
    purpose:
      "Fjärrtest för löpning. Två eller tre tidtagna distanser ger CS och D'.",
    howTo:
      "Två till tre maximala löpningar på olika distans, till exempel 1 200, 2 400 och 3 600 m, på skilda dagar eller med full vila.",
    remote: true,
    minEfforts: 2,
    maxEfforts: 6,
    shape: DISTANCE_SHAPE,
    produces: ["CS", "D'", "Zoner"],
    zoneScheme: "critical-speed",
  },
  {
    key: "cs-3-5min",
    label: "Critical speed – 3 och 5 minuter",
    sports: ["löpning"],
    purpose:
      "Två maxlöpningar på tid i stället för distans. Enkelt att göra på bana.",
    howTo:
      "Spring maximalt i 3 minuter, vila fullt ut, spring maximalt i 5 minuter. Notera sträckan för båda.",
    remote: true,
    minEfforts: 2,
    maxEfforts: 2,
    shape: DISTANCE_SHAPE,
    produces: ["CS", "D'", "Zoner"],
    zoneScheme: "critical-speed",
  },
  {
    key: "cs-3min",
    label: "Critical speed – 3 min all-out",
    sports: ["löpning"],
    purpose:
      "Ett enda pass. Kräver farttavla eller GPS med sekundupplösning för att bli användbart.",
    howTo:
      "Spring maximalt i 3 minuter utan pacing. CS är farten under sista 30 sekunderna; D' är sträckan över den nivån.",
    remote: true,
    minEfforts: 4,
    maxEfforts: null,
    shape: DISTANCE_SHAPE,
    produces: ["CS", "D'", "Zoner"],
    zoneScheme: "critical-speed",
  },
  {
    key: "cs-simning",
    label: "Critical swim speed",
    sports: ["simning"],
    purpose: "Fjärrtest i bassäng. Två tidtagna distanser räcker.",
    howTo:
      "Två maximala simningar på olika distans, till exempel 200 och 400 m, med full vila emellan.",
    remote: true,
    minEfforts: 2,
    maxEfforts: 6,
    shape: DISTANCE_SHAPE,
    produces: ["CS", "D'", "Zoner"],
    zoneScheme: "critical-speed",
  },
];

export function protocolByKey(key: string): Protocol | null {
  return PROTOCOLS.find((p) => p.key === key) ?? null;
}

export function protocolsForSport(sport: Sport): Protocol[] {
  return PROTOCOLS.filter((p) => p.sports.includes(sport));
}

/** Enheten belastningen anges i för en gren. */
export function defaultUnitFor(sport: Sport): "W" | "km/h" | "m/s" {
  if (sport === "cykling") return "W";
  if (sport === "löpning") return "km/h";
  return "m/s";
}
