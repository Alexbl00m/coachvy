/**
 * En FIT-fil till en aktivitet: sekundserien och det klockan själv summerat.
 *
 * Tolken (fit-file-parser, MIT) laddas först när en fil läses. Allt sker i
 * webbläsaren; filen skickas aldrig. Det som sparas är analysen och en
 * nedsamplad serie, inte filen.
 */

import type { ActivitySport, Sample } from "./analysis";
import { kindOf, type MultisportSummary } from "./multisport";

export type ParsedActivity = {
  sport: ActivitySport;
  /** Klockans egen sportbeteckning, "cycling/road". */
  deviceSport: string | null;
  startedAt: string;
  samples: Sample[];
  ascentM: number | null;
  /** FTP som cykeldatorn har inställd, när den finns. */
  thresholdPower: number | null;
  device: string | null;
  laps: {
    seconds: number;
    distanceM: number | null;
    power: number | null;
    hr: number | null;
  }[];
};

type FitRecord = {
  timestamp?: Date | string;
  position_lat?: number;
  position_long?: number;
  altitude?: number;
  enhanced_altitude?: number;
  power?: number;
  heart_rate?: number;
  speed?: number;
  enhanced_speed?: number;
  cadence?: number;
  distance?: number;
};

type FitSession = {
  sport?: string;
  sub_sport?: string;
  start_time?: Date | string;
  total_elapsed_time?: number;
  total_timer_time?: number;
  total_distance?: number;
  total_ascent?: number;
  threshold_power?: number;
};

type FitLap = {
  start_time?: Date | string;
  total_timer_time?: number;
  total_distance?: number;
  avg_power?: number;
  avg_heart_rate?: number;
};

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

function sportOf(raw: string | undefined): ActivitySport {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("cycl") || s.includes("bik")) return "cykling";
  if (s.includes("run") || s.includes("walk") || s.includes("hik"))
    return "löpning";
  if (s.includes("swim")) return "simning";
  return "annat";
}

/** Filen: en aktivitet, eller en per gren i en multisportfil. */
export type ParsedFile = {
  legs: ParsedActivity[];
  /** Loppets delar med växlingarna, när filen har flera grenar. */
  multisport: MultisportSummary | null;
};

const timeOf = (v: Date | string | undefined) =>
  v === undefined ? NaN : new Date(v).getTime();

function samplesOf(records: FitRecord[]): Sample[] {
  const t0 = timeOf(records[0].timestamp);
  return records.map((r) => {
    const lat = num(r.position_lat);
    const lon = num(r.position_long);
    return {
      t: (timeOf(r.timestamp) - t0) / 1000,
      // Nollpunkten är ett känt fel när klockan saknar fix.
      lat:
        lat !== null && lon !== null && !(lat === 0 && lon === 0) ? lat : null,
      lon:
        lat !== null && lon !== null && !(lat === 0 && lon === 0) ? lon : null,
      alt: num(r.enhanced_altitude) ?? num(r.altitude),
      power: num(r.power),
      hr: num(r.heart_rate),
      speed: num(r.enhanced_speed) ?? num(r.speed),
      cadence: num(r.cadence),
      distance: num(r.distance),
    };
  });
}

/**
 * Sträckan räknas från grenens början. I en multisportfil fortsätter
 * klockans sträcka genom hela loppet, så cykeln skulle annars börja på
 * två kilometer.
 */
function fromZero(samples: Sample[]): Sample[] {
  const first = samples.find((s) => s.distance !== null)?.distance ?? null;
  if (first === null || first === 0) return samples;
  return samples.map((s) =>
    s.distance === null ? s : { ...s, distance: Math.max(0, s.distance - first) },
  );
}

const isTransition = (s: FitSession) =>
  (s.sport ?? "").toLowerCase() === "transition";

export async function readActivities(buffer: ArrayBuffer): Promise<ParsedFile> {
  const { default: FitParser } = await import("fit-file-parser");
  const parser = new FitParser({
    force: true,
    mode: "list",
    elapsedRecordField: false,
    speedUnit: "m/s",
    lengthUnit: "m",
  });
  const data = (await parser.parseAsync(buffer)) as {
    records?: FitRecord[];
    sessions?: FitSession[];
    laps?: FitLap[];
    file_ids?: {
      manufacturer?: string;
      product_name?: string;
      garmin_product?: string;
    }[];
  };

  const records = (data.records ?? []).filter((r) => r.timestamp);
  if (records.length < 60) {
    throw new Error("Filen har för lite data för att analysera.");
  }
  const file = data.file_ids?.[0];
  const device =
    [file?.manufacturer, file?.product_name ?? file?.garmin_product]
      .filter((x): x is string => typeof x === "string" && x.length > 0)
      // "garmin", "edge_840" → "Garmin Edge 840"
      .map((x) =>
        x.replace(/_/g, " ").replace(/\b\p{L}/gu, (c) => c.toUpperCase()),
      )
      .join(" ") || null;
  const laps = data.laps ?? [];
  const lapOf = (l: FitLap) => ({
    seconds: num(l.total_timer_time) ?? 0,
    distanceM: num(l.total_distance),
    power: num(l.avg_power),
    hr: num(l.avg_heart_rate),
  });

  const activityOf = (
    session: FitSession,
    subset: FitRecord[],
    lapList: FitLap[],
  ): ParsedActivity => ({
    sport: sportOf(session.sport),
    deviceSport: session.sport
      ? `${session.sport}${session.sub_sport ? `/${session.sub_sport}` : ""}`
      : null,
    startedAt: new Date(
      (session.start_time as Date | string | undefined) ??
        (subset[0].timestamp as Date | string),
    ).toISOString(),
    samples: fromZero(samplesOf(subset)),
    ascentM: num(session.total_ascent),
    thresholdPower: num(session.threshold_power),
    device,
    laps: lapList.map(lapOf),
  });

  // En multisportfil: flera sessioner med olika grenar. Varje gren blir en
  // egen aktivitet; växlingarna blir tider i sammanfattningen.
  const sessions = (data.sessions ?? []).filter(
    (s) => !Number.isNaN(timeOf(s.start_time)),
  );
  const multi =
    sessions.length > 1 &&
    new Set(sessions.map((s) => (s.sport ?? "").toLowerCase())).size > 1;
  if (!multi) {
    return {
      legs: [activityOf(sessions[0] ?? data.sessions?.[0] ?? {}, records, laps)],
      multisport: null,
    };
  }

  const windowOf = (s: FitSession) => {
    const from = timeOf(s.start_time);
    const seconds = num(s.total_elapsed_time) ?? num(s.total_timer_time) ?? 0;
    return { from, to: from + seconds * 1000, seconds };
  };
  const legs: ParsedActivity[] = [];
  const parts: MultisportSummary["parts"] = [];
  for (const s of sessions) {
    const w = windowOf(s);
    const startedAt = new Date(w.from).toISOString();
    if (isTransition(s)) {
      parts.push({
        kind: "växling",
        sport: null,
        startedAt,
        seconds: w.seconds,
        distanceM: num(s.total_distance),
      });
      continue;
    }
    const subset = records.filter((r) => {
      const t = timeOf(r.timestamp);
      return t >= w.from && t <= w.to;
    });
    if (subset.length < 60) continue;
    const lapList = laps.filter((l) => {
      const t = timeOf(l.start_time);
      return t >= w.from && t < w.to;
    });
    legs.push(activityOf(s, subset, lapList));
    parts.push({
      kind: "gren",
      sport: sportOf(s.sport),
      startedAt,
      seconds: w.seconds,
      distanceM: num(s.total_distance),
    });
  }
  if (legs.length === 0) {
    throw new Error("Filen har för lite data för att analysera.");
  }
  if (legs.length === 1) return { legs, multisport: null };

  return {
    legs,
    multisport: {
      id: globalThis.crypto.randomUUID(),
      kind: kindOf(legs.map((l) => l.sport)),
      leg: 0,
      parts,
      totalS: parts.reduce((sum, p) => sum + p.seconds, 0),
      distanceM: parts.reduce((sum, p) => sum + (p.distanceM ?? 0), 0),
    },
  };
}

/** Första grenen – för den som bara vill ha en aktivitet ur filen. */
export async function readActivity(
  buffer: ArrayBuffer,
): Promise<ParsedActivity> {
  return (await readActivities(buffer)).legs[0];
}
