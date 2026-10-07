/**
 * Effektprofilens rader: bästa effekt per kilo över 5 s, 1 min, 5 min och
 * 20 min ur träningen i en period, plus tröskeln, placerade i Coggans tabell.
 *
 * Tröskeln (FT) är det högsta av FTP ur ett test i perioden, bästa timmen och
 * 95 % av bästa 20 minuterna: en kurva ur träning visar vad adepten minst
 * klarar, och ett test är maximalt.
 *
 * Modulen är ren och körs både på servern (för AI-coachen) och i webbläsaren
 * när perioden byts.
 */

import {
  bestCurve,
  inPeriod,
  type ProfileSource,
} from "@/lib/activities/profile";
import {
  cogganPosition,
  DURATION_LABEL,
  type CogganDuration,
  type ProfilePoint,
  type Sex,
} from "./coggan";

export type ProfileRow = ProfilePoint & {
  source: string;
  date: string | null;
  /** Pass i perioden som bär längden. Ett test räknas som fullt underlag. */
  support: number;
};

/** Färre pass än så bär inte en längd – kurvan är troligen inte maximal där. */
export const THIN_SUPPORT = 3;

export const PROFILE_SPANS: {
  duration: CogganDuration;
  span: number;
  sub: string;
}[] = [
  { duration: "5s", span: 5, sub: "sprint" },
  { duration: "1min", span: 60, sub: "anaerob" },
  { duration: "5min", span: 300, sub: "VO2max" },
  { duration: "20min", span: 1200, sub: "tröskel" },
];

export function powerProfileRows(input: {
  sources: ProfileSource[];
  weightKg: number;
  sex: Sex;
  testFtp: { watts: number; date: string } | null;
  from: string | null;
  to: string;
}): ProfileRow[] {
  const { weightKg, sex } = input;
  const now = inPeriod(input.sources, "power", input.from, input.to);
  const curve = bestCurve(now, "power");
  const at = (span: number) => curve.find((p) => p.span === span) ?? null;

  const rows: ProfileRow[] = [];
  for (const { duration, span } of PROFILE_SPANS) {
    const p = at(span);
    if (!p) continue;
    rows.push({
      duration,
      watts: p.value,
      wattsPerKg: p.value / weightKg,
      position: cogganPosition(p.value / weightKg, sex, duration),
      source: p.name,
      date: p.date,
      support: p.support,
    });
  }

  const candidates: {
    watts: number;
    source: string;
    date: string | null;
    support: number;
  }[] = [];
  const hour = at(3600);
  if (hour)
    candidates.push({
      watts: hour.value,
      source: "bästa timmen",
      date: hour.date,
      support: hour.support,
    });
  const twenty = at(1200);
  if (twenty)
    candidates.push({
      watts: twenty.value * 0.95,
      source: "95 % av bästa 20 min",
      date: twenty.date,
      support: twenty.support,
    });
  const ftp = input.testFtp;
  if (
    ftp &&
    (input.from === null || ftp.date >= input.from) &&
    ftp.date <= input.to
  )
    candidates.push({
      watts: ftp.watts,
      source: "FTP ur test",
      date: ftp.date,
      support: Number.POSITIVE_INFINITY,
    });

  const best = candidates.sort((a, b) => b.watts - a.watts)[0];
  if (best) {
    rows.push({
      duration: "ft",
      watts: best.watts,
      wattsPerKg: best.watts / weightKg,
      position: cogganPosition(best.watts / weightKg, sex, "ft"),
      source: best.source,
      date: best.date,
      support: best.support,
    });
  }
  return rows;
}

/**
 * Förbehållen för en profil, och om formen alls går att läsa.
 *
 * Två saker gör en profil ur träning opålitlig: längder som bara några få
 * pass bär, och en träningskurva som ligger långt under ett test i samma
 * period – då har passen inte varit maximala, och formen mellan de korta
 * längderna (ur träningen) och tröskeln (ur testet) finns inte på riktigt.
 */
export function profileCaveats(rows: ProfileRow[]): {
  lines: string[];
  readable: boolean;
} {
  const lines: string[] = [];
  let readable = true;

  const thin = rows.filter((r) => r.support < THIN_SUPPORT);
  if (thin.length > 0) {
    lines.push(
      `Tunt underlag: ${thin.map((r) => DURATION_LABEL[r.duration]).join(", ")} ${thin.length === 1 ? "bärs" : "bärs var för sig"} av färre än ${THIN_SUPPORT} pass i perioden och är troligen inte maximala.`,
    );
  }

  const ft = rows.find((r) => r.duration === "ft");
  const twenty = rows.find((r) => r.duration === "20min");
  if (
    ft?.source === "FTP ur test" &&
    twenty &&
    twenty.wattsPerKg * 0.95 < ft.wattsPerKg * 0.8
  ) {
    readable = false;
    lines.push(
      `Bästa 20 minuter ur träningen (${twenty.wattsPerKg.toFixed(2).replace(".", ",")} W/kg) ligger långt under FTP ur testet – passen i perioden har inte varit maximala. Längderna ur träningen visar därför mindre än adepten klarar, och profilens form går inte att läsa. Välj en period med lopp eller hårda intervaller, eller ladda upp fler pass.`,
    );
  }
  return { lines, readable };
}
