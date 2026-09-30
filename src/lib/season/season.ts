/**
 * Säsongen: tävlingarna och perioderna i planen.
 *
 * Rena funktioner utan databas, så att översikten, kalendern, planen och
 * AI-underlaget räknar likadant och går att pröva för sig.
 *
 * Datum är ISO-dagar, YYYY-MM-DD, och räknas som hela dagar. "I dag" är
 * svensk tid: en coach som öppnar appen tjugo över tolv ska se dagens datum,
 * inte gårdagens.
 */

import type {
  AdeptRaceRow,
  RacePriority,
  RaceSport,
  TrainingBlockRow,
} from "@/lib/types/database";
import { phaseLabel } from "@/lib/tests/phases";

const DAY = 86_400_000;

export const RACE_PRIORITIES: {
  key: RacePriority;
  label: string;
  hint: string;
}[] = [
  { key: "A", label: "A-lopp", hint: "Säsongens mål – planen byggs mot det" },
  { key: "B", label: "B-lopp", hint: "Viktigt, men utan full toppning" },
  { key: "C", label: "C-lopp", hint: "Träning med nummerlapp" },
];

export const RACE_SPORTS: { key: RaceSport; label: string }[] = [
  { key: "löpning", label: "Löpning" },
  { key: "cykling", label: "Cykling" },
  { key: "simning", label: "Simning" },
  { key: "triathlon", label: "Triathlon" },
  { key: "annat", label: "Annat" },
];

export const raceSportLabel = (sport: string | null) =>
  RACE_SPORTS.find((s) => s.key === sport)?.label ?? null;

const MONTHS = [
  "januari",
  "februari",
  "mars",
  "april",
  "maj",
  "juni",
  "juli",
  "augusti",
  "september",
  "oktober",
  "november",
  "december",
];
const WEEKDAYS = [
  "måndag",
  "tisdag",
  "onsdag",
  "torsdag",
  "fredag",
  "lördag",
  "söndag",
];

/** Dagens datum i svensk tid, som ISO-dag. */
export function todayIso(now = new Date()): string {
  // sv-SE skriver datum som ISO: 2026-09-30.
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Dagnummer sedan epoken, för att räkna hela dagar utan tidszoner. */
export const dayNumber = (iso: string) =>
  Math.round(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / DAY);

export const addDays = (iso: string, days: number) =>
  new Date((dayNumber(iso) + days) * DAY).toISOString().slice(0, 10);

/** Dagar från `from` till `to`. Negativt när `to` redan passerat. */
export const daysBetween = (from: string, to: string) =>
  dayNumber(to) - dayNumber(from);

/** Veckodag 0–6 med måndag som 0, som i en svensk kalender. */
export const weekdayIndex = (iso: string) => (dayNumber(iso) + 3) % 7;

/** Måndagen i veckan datumet ligger i. */
export const mondayOf = (iso: string) => addDays(iso, -weekdayIndex(iso));

export const monthName = (month: number) => MONTHS[month] ?? "";
export const weekdayName = (iso: string) => WEEKDAYS[weekdayIndex(iso)];

/** "3 juli 2027", eller "3 juli" när året är detsamma som `sameYearAs`. */
export function longDate(iso: string, sameYearAs?: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const year =
    sameYearAs && sameYearAs.slice(0, 4) === String(y) ? "" : ` ${y}`;
  return `${d} ${monthName(m - 1)}${year}`;
}

/**
 * Ett datumintervall så kort det går utan att bli otydligt: året skrivs en
 * gång när båda datumen ligger samma år, och inte alls när det är i år.
 */
export function dateRange(start: string, end: string, today?: string): string {
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  if (!sameYear) return `${longDate(start)} – ${longDate(end)}`;
  return `${longDate(start, start)} – ${longDate(end, today)}`;
}

/** Kortare: "3 jul" – för tidslinjer och listor. */
export function shortDate(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${monthName(m - 1).slice(0, 3)}`;
}

/** ISO-veckonummer. */
export function isoWeek(iso: string): number {
  const thursday = addDays(iso, 3 - weekdayIndex(iso));
  const yearStart = `${thursday.slice(0, 4)}-01-01`;
  return Math.floor(daysBetween(yearStart, thursday) / 7) + 1;
}

/** Nedräkningen i ord. */
export function countdownText(days: number): string {
  if (days < 0) return days === -1 ? "i går" : `för ${-days} dagar sedan`;
  if (days === 0) return "i dag";
  if (days === 1) return "i morgon";
  if (days < 21) return `om ${days} dagar`;
  const weeks = Math.floor(days / 7);
  const rest = days % 7;
  // Långt fram räcker veckorna; dagarna är brus.
  return rest === 0 || weeks >= 8
    ? `om ${weeks} veckor`
    : `om ${weeks} veckor och ${rest} ${rest === 1 ? "dag" : "dagar"}`;
}

/** Kommande tävlingar, närmast först. Dagens räknas som kommande. */
export function upcomingRaces<T extends Pick<AdeptRaceRow, "race_date">>(
  races: T[],
  today: string,
): T[] {
  return races
    .filter((r) => r.race_date >= today)
    .sort((a, b) => a.race_date.localeCompare(b.race_date));
}

/**
 * Loppet nedräkningen gäller: närmaste A-lopp, annars närmaste lopp.
 *
 * Ett C-lopp på lördag ska inte skymma säsongens mål om tio veckor – men
 * finns inget A-lopp inlagt är nästa start det närmaste man har.
 */
export function mainRace<
  T extends Pick<AdeptRaceRow, "race_date" | "priority">,
>(races: T[], today: string): T | null {
  const upcoming = upcomingRaces(races, today);
  return upcoming.find((r) => r.priority === "A") ?? upcoming[0] ?? null;
}

type BlockLike = Pick<TrainingBlockRow, "starts_on" | "ends_on" | "phase">;

/** Perioden ett datum ligger i. Vid överlapp den som började senast. */
export function blockOn<T extends BlockLike>(
  blocks: T[],
  date: string,
): T | null {
  let found: T | null = null;
  for (const block of blocks) {
    if (block.starts_on <= date && date <= block.ends_on) {
      if (!found || block.starts_on > found.starts_on) found = block;
    }
  }
  return found;
}

/** Nästa period som börjar efter `date`. */
export function nextBlock<T extends BlockLike>(
  blocks: T[],
  date: string,
): T | null {
  return (
    [...blocks]
      .filter((b) => b.starts_on > date)
      .sort((a, b) => a.starts_on.localeCompare(b.starts_on))[0] ?? null
  );
}

/** En befintlig period som krockar med `candidate`, utom den som ändras. */
export function overlapping<T extends BlockLike & { id: string }>(
  blocks: T[],
  candidate: { id?: string | null; starts_on: string; ends_on: string },
): T | null {
  return (
    blocks.find(
      (b) =>
        b.id !== candidate.id &&
        b.starts_on <= candidate.ends_on &&
        candidate.starts_on <= b.ends_on,
    ) ?? null
  );
}

/**
 * Toppningens längd inför ett A-lopp, i dagar.
 *
 * Bosquet m.fl. (2007) fann i en metaanalys störst effekt av 8–14 dagars
 * nedtrappning, med volymen sänkt 41–60 % och intensiteten behållen. Här
 * används spannet för att se om planen har en toppning där den hör hemma.
 */
export const TAPER_DAYS = { min: 8, max: 14 } as const;

/**
 * Anmärkningar på planen: det som ser ut som en lucka eller ett förbiseende.
 *
 * Beskrivande, inte föreskrivande. Att ett A-lopp saknar toppning kan vara
 * ett medvetet val; planen säger bara vad den ser.
 */
export function planNotes(
  blocks: (BlockLike & { id: string })[],
  races: Pick<AdeptRaceRow, "name" | "race_date" | "priority">[],
  today: string,
): string[] {
  const notes: string[] = [];
  const sorted = [...blocks].sort((a, b) =>
    a.starts_on.localeCompare(b.starts_on),
  );

  for (const race of upcomingRaces(races, today)) {
    if (race.priority !== "A") continue;
    // En toppning som slutar inom tre veckor före loppet, eller på dagen.
    const windowStart = addDays(race.race_date, -21);
    const tapered = sorted.some(
      (b) =>
        b.phase === "topp" &&
        b.ends_on >= windowStart &&
        b.starts_on <= race.race_date,
    );
    if (!tapered && sorted.length > 0) {
      notes.push(
        `Ingen toppning inlagd före ${race.name} (${longDate(race.race_date, today)}). ` +
          `${TAPER_DAYS.min}–${TAPER_DAYS.max} dagars nedtrappning skulle ligga ungefär ` +
          `${shortDate(addDays(race.race_date, -TAPER_DAYS.max))}–${shortDate(addDays(race.race_date, -1))}.`,
      );
    }
  }

  // Glapp mellan perioder som ligger framför oss.
  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    if (current.ends_on < today) continue;
    const gap = daysBetween(previous.ends_on, current.starts_on) - 1;
    if (gap >= 3) {
      notes.push(
        `${gap} dagar utan period mellan ${phaseLabel(previous.phase)?.toLowerCase()} och ` +
          `${phaseLabel(current.phase)?.toLowerCase()} (${shortDate(addDays(previous.ends_on, 1))}–` +
          `${shortDate(addDays(current.starts_on, -1))}).`,
      );
    }
  }
  return notes;
}

/**
 * Säsongen som text, för AI-coachen och passbyggaren.
 *
 * Utan den vet modellen inte om atleten är mitt i en grundperiod eller tio
 * dagar från säsongens mål – och ett bra pass i det ena läget är ett dåligt
 * i det andra.
 */
export function seasonToPrompt(
  races: Pick<
    AdeptRaceRow,
    "name" | "race_date" | "priority" | "distance" | "target" | "sport"
  >[],
  blocks: (BlockLike & { focus: string | null })[],
  today: string,
): string | null {
  const lines: string[] = [];

  const current = blockOn(blocks, today);
  if (current) {
    const left = daysBetween(today, current.ends_on);
    lines.push(
      `- Nu: ${phaseLabel(current.phase)?.toLowerCase()} ${current.starts_on}–${current.ends_on}` +
        ` (${left === 0 ? "sista dagen" : `${left} dagar kvar`})` +
        `${current.focus ? `, fokus: ${current.focus}` : ""}.`,
    );
  }
  const next = nextBlock(blocks, today);
  if (next) {
    lines.push(
      `- Därefter: ${phaseLabel(next.phase)?.toLowerCase()} från ${next.starts_on}` +
        `${next.focus ? `, fokus: ${next.focus}` : ""}.`,
    );
  }

  const upcoming = upcomingRaces(races, today).slice(0, 5);
  for (const race of upcoming) {
    const details = [
      `${race.priority}-lopp`,
      countdownText(daysBetween(today, race.race_date)),
      race.distance,
      race.target ? `mål: ${race.target}` : null,
    ].filter(Boolean);
    lines.push(
      `- Tävling: ${race.name} ${race.race_date} (${details.join(", ")}).`,
    );
  }

  return lines.length > 0 ? `Säsongen:\n${lines.join("\n")}` : null;
}
