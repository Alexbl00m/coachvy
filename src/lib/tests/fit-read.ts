/**
 * Läser cykeldatorns filer i webbläsaren.
 *
 * FIT är formatet Garmin, Wahoo, Hammerhead, Zwift och de flesta andra sparar
 * pass i. Tolkaren (fit-file-parser, MIT) laddas först när en fil väljs, så
 * att den inte följer med till sidor som aldrig läser någon fil.
 *
 * Inget skickas någonstans. Av filen används bara tid, effekt och puls.
 */

import { toRide, type Ride } from "./fit-efforts";

export type ReadResult = { rides: Ride[]; problems: string[] };

type FitRecord = { timestamp?: Date | string; power?: number; heart_rate?: number };

export async function readRides(files: File[]): Promise<ReadResult> {
  const { default: FitParser } = await import("fit-file-parser");
  const parser = new FitParser({ force: true, mode: "list", elapsedRecordField: false });

  const rides: Ride[] = [];
  const problems: string[] = [];

  for (const file of files) {
    if (!/\.fit$/i.test(file.name)) {
      problems.push(`${file.name}: bara .fit-filer går att läsa.`);
      continue;
    }
    try {
      const data = await parser.parseAsync(await file.arrayBuffer());
      const records = ((data as { records?: FitRecord[] }).records ?? [])
        .filter((r) => r.timestamp)
        .map((r) => ({
          timestamp: new Date(r.timestamp as Date | string),
          power: typeof r.power === "number" ? r.power : null,
          heartRate: typeof r.heart_rate === "number" ? r.heart_rate : null,
        }));
      const ride = toRide(records, file.name);
      if (ride) rides.push(ride);
      else problems.push(`${file.name}: passet har ingen effekt. Kördes det med effektmätare?`);
    } catch {
      problems.push(`${file.name}: filen gick inte att läsa som FIT.`);
    }
  }

  rides.sort((a, b) => a.startedAt - b.startedAt);
  return { rides, problems };
}
