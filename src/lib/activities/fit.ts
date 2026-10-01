/**
 * En FIT-fil till en aktivitet: sekundserien och det klockan själv summerat.
 *
 * Tolken (fit-file-parser, MIT) laddas först när en fil läses. Allt sker i
 * webbläsaren; filen skickas aldrig. Det som sparas är analysen och en
 * nedsamplad serie, inte filen.
 */

import type { ActivitySport, Sample } from "./analysis";

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
  total_ascent?: number;
  threshold_power?: number;
};

type FitLap = {
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

export async function readActivity(
  buffer: ArrayBuffer,
): Promise<ParsedActivity> {
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
  const t0 = new Date(records[0].timestamp as Date | string).getTime();
  const samples: Sample[] = records.map((r) => {
    const lat = num(r.position_lat);
    const lon = num(r.position_long);
    return {
      t: (new Date(r.timestamp as Date | string).getTime() - t0) / 1000,
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

  const session = data.sessions?.[0] ?? {};
  const file = data.file_ids?.[0];
  const device = [
    file?.manufacturer,
    file?.product_name ?? file?.garmin_product,
  ]
    .filter((x): x is string => typeof x === "string" && x.length > 0)
    // "garmin", "edge_840" → "Garmin Edge 840"
    .map((x) =>
      x.replace(/_/g, " ").replace(/\b\p{L}/gu, (c) => c.toUpperCase()),
    )
    .join(" ");

  return {
    sport: sportOf(session.sport),
    deviceSport: session.sport
      ? `${session.sport}${session.sub_sport ? `/${session.sub_sport}` : ""}`
      : null,
    startedAt: new Date(
      (session.start_time as Date | string | undefined) ??
        (records[0].timestamp as Date | string),
    ).toISOString(),
    samples,
    ascentM: num(session.total_ascent),
    thresholdPower: num(session.threshold_power),
    device: device || null,
    laps: (data.laps ?? []).map((l) => ({
      seconds: num(l.total_timer_time) ?? 0,
      distanceM: num(l.total_distance),
      power: num(l.avg_power),
      hr: num(l.avg_heart_rate),
    })),
  };
}
