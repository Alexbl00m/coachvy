/**
 * Tider för videosamtal. Coachen bokar i svensk tid; databasen sparar UTC.
 *
 * Omräkningen går via Intl i stället för en fast förskjutning, så att
 * sommartid och vintertid blir rätt även för ett samtal på andra sidan
 * omställningen.
 */

const ZONE = "Europe/Stockholm";

/** Förskjutningen mot UTC i minuter för ett ögonblick i Stockholm. */
function offsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(at);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  const local = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
  );
  return Math.round((local - at.getTime()) / 60_000);
}

/**
 * Datum ("2026-10-28") och klockslag ("18:00") i Stockholm som ISO i UTC,
 * eller null om de inte går att läsa.
 */
export function stockholmToIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time))
    return null;
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  if (h > 23 || min > 59) return null;
  const guess = Date.UTC(y, m - 1, d, h, min);
  if (Number.isNaN(guess)) return null;
  // Två varv: förskjutningen vid gissningen, sedan vid det rättade ögonblicket.
  let at = guess - offsetMinutes(new Date(guess)) * 60_000;
  at = guess - offsetMinutes(new Date(at)) * 60_000;
  return new Date(at).toISOString();
}

/** "tisdag 28 oktober kl. 18:00" i Stockholmstid. */
export function callWhen(iso: string): string {
  const at = new Date(iso);
  const day = new Intl.DateTimeFormat("sv-SE", {
    timeZone: ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(at);
  return `${day} kl. ${callTime(iso)}`;
}

/** "18:00" i Stockholmstid. */
export function callTime(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Dagen samtalet ligger på i Stockholm, "2026-10-28". */
export function callDate(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: ZONE }).format(
    new Date(iso),
  );
}

export type CallState = "kommande" | "snart" | "pågår" | "avslutat" | "avbokat";

/**
 * Var samtalet är just nu. "Snart" är de tio minuterna före, då man brukar
 * gå in; ett samtal räknas som pågående en kvart efter sin tänkta längd.
 */
export function callState(
  call: {
    starts_at: string;
    duration_minutes: number;
    cancelled_at: string | null;
  },
  now: number,
): CallState {
  if (call.cancelled_at) return "avbokat";
  const start = Date.parse(call.starts_at);
  const end = start + (call.duration_minutes + 15) * 60_000;
  if (now > end) return "avslutat";
  if (now >= start) return "pågår";
  if (now >= start - 10 * 60_000) return "snart";
  return "kommande";
}

/** Bara https-länkar, som databasen kräver. */
export function cleanMeetingUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && value.length <= 500
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
