/**
 * En FIT-fil till en färdig analys: läst, räknad mot rätt test och klar att
 * sparas. Används både när ett pass laddas upp för sig och när en hel
 * historik importeras, så att de räknas likadant.
 *
 * Körs i webbläsaren; filen lämnar aldrig datorn.
 */

import {
  analyse,
  DISPLAY_POINTS,
  type Reference,
  type Streams,
  type Summary,
} from "./analysis";
import type { ParsedActivity } from "./fit";
import { pickReference, type ReferenceCandidate } from "./reference";

export type PreparedActivity = {
  parsed: ParsedActivity;
  /** Dagen i svensk tid, ÅÅÅÅ-MM-DD. */
  date: string;
  summary: Summary;
  streams: Streams;
  reference: Reference;
};

/** Så många pass skickas i varje anrop under en import – långt under 1 MB. */
export const IMPORT_BATCH = 10;

/**
 * Punkter i serien för ett importerat pass. Kartan och graferna blir grövre,
 * men en historik på hundratals pass tar en tiondel av utrymmet.
 */
export const IMPORT_POINTS = 300;

export const SPORT_NAME: Record<string, string> = {
  cykling: "Cykelpass",
  löpning: "Löppass",
  simning: "Simpass",
  annat: "Pass",
};

export const stockholmDate = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));

/** Läser filen ur bufferten. Kastar om den inte går att tolka. */
export async function parseFit(buffer: ArrayBuffer): Promise<ParsedActivity> {
  const { readActivity } = await import("./fit");
  return readActivity(buffer);
}

/**
 * Analysen av ett läst pass, mot testet närmast före – eller FTP:n som är
 * inställd i cykeldatorn när det inte finns något test.
 */
export function prepareParsed(
  parsed: ParsedActivity,
  candidates: ReferenceCandidate[],
  points = DISPLAY_POINTS,
): PreparedActivity {
  const date = stockholmDate(parsed.startedAt);
  const reference = pickReference(candidates, date, parsed.sport);
  if (
    reference.ftp === null &&
    parsed.sport === "cykling" &&
    parsed.thresholdPower
  ) {
    reference.ftp = parsed.thresholdPower;
    reference.ftpSource = "cykeldatorns inställning";
  }
  const { summary, streams } = analyse(
    parsed.samples,
    parsed.sport,
    reference,
    { ascentM: parsed.ascentM, thresholdPower: parsed.thresholdPower },
    points,
  );
  return { parsed, date, summary, streams, reference };
}
