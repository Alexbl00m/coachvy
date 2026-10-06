/**
 * Utvecklingen ur träningen, i text: mängd och kontinuitet, formen ur
 * bästa-kurvorna, tävlingarna, den aeroba hållbarheten och hur intensiteten
 * fördelas.
 *
 * Regelbaserad som trendanalysen av testerna: varje mening vilar på tal ur
 * passen och samma data ger samma text. Den ersätter inte coachens öga men
 * pekar ut var det har hänt något.
 *
 * Modulen är ren – inga anrop – och körs på servern när sidan ritas.
 */

import type { BestEffort, Curve, ZoneTime } from "./analysis";
import { bestCurve, fitCritical, type CurveKind } from "./profile";

export type DevelopmentActivity = {
  id: string;
  name: string;
  sport: string;
  performed_on: string;
  duration_s: number | null;
  moving_s: number | null;
  tss: number | null;
  decoupling: number | null;
  hr_zones: ZoneTime[] | null;
  curve: Curve | null;
  best: BestEffort[] | null;
  is_race: boolean;
  race_id: string | null;
};

export type DevelopmentSection = { title: string; lines: string[] };

export type DevelopmentReading = {
  sections: DevelopmentSection[];
  /** Dagen analysen räknar bakåt från: i dag, eller senaste passet. */
  anchor: string;
  /** Satt när historiken slutar innan i dag och analysen räknar från den. */
  anchoredOnLast: boolean;
  activities: number;
};

const DAY = 86_400_000;
const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const sv = (v: number, digits = 0) =>
  v.toFixed(digits).replace(".", ",").replace("-", "−");
const signed = (v: number, digits = 0) =>
  `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(digits).replace(".", ",")}`;
const pct = (now: number, before: number) => ((now - before) / before) * 100;
const pace = (ms: number) => {
  const s = Math.round(1000 / ms);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}/km`;
};
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const SPORT_NAME: Record<string, string> = {
  cykling: "cykel",
  löpning: "löpning",
  simning: "simning",
  annat: "annat",
};

/** Passen mellan två dagar, båda med. */
const between = (acts: DevelopmentActivity[], from: number, to: number) =>
  acts.filter((a) => {
    const d = day(a.performed_on);
    return d >= from && d <= to;
  });

const hoursOf = (acts: DevelopmentActivity[]) =>
  acts.reduce((s, a) => s + (a.moving_s ?? a.duration_s ?? 0), 0) / 3600;

function volume(
  acts: DevelopmentActivity[],
  anchor: number,
): DevelopmentSection | null {
  const now = between(acts, anchor - 27 * DAY, anchor);
  const before = between(acts, anchor - 55 * DAY, anchor - 28 * DAY);
  if (now.length === 0 && before.length === 0) return null;
  const lines: string[] = [];

  const h = hoursOf(now) / 4;
  const hBefore = hoursOf(before) / 4;
  // Jämför bara när båda perioderna har något att säga: ett enda pass före
  // gör varje ökning till flera hundra procent.
  const comparable = now.length >= 4 && before.length >= 4 && hBefore > 0.5;
  const change = comparable
    ? ` – ${signed(pct(h, hBefore))} % mot de fyra veckorna före`
    : "";
  lines.push(
    `Senaste fyra veckorna: ${sv(h, 1)} timmar och ${sv(now.length / 4, 1)} pass per vecka i snitt${change}.`,
  );

  const bySport = new Map<string, number>();
  for (const a of now)
    bySport.set(
      a.sport,
      (bySport.get(a.sport) ?? 0) +
        (a.moving_s ?? a.duration_s ?? 0) / 3600 / 4,
    );
  if (bySport.size > 1) {
    lines.push(
      `Fördelat per vecka: ${[...bySport.entries()]
        .sort((x, y) => y[1] - x[1])
        .map(([s, v]) => `${SPORT_NAME[s] ?? s} ${sv(v, 1)} h`)
        .join(", ")}.`,
    );
  }

  const withTss = now.filter((a) => a.tss !== null);
  if (withTss.length >= Math.max(3, now.length / 2)) {
    const tss = withTss.reduce((s, a) => s + (a.tss ?? 0), 0) / 4;
    lines.push(
      `Belastningen ur passen med effekt: omkring ${sv(Math.round(tss / 10) * 10)} TSS per vecka${withTss.length < now.length ? " (pass utan effektmätare räknas inte)" : ""}.`,
    );
  }

  if (comparable) {
    const p = pct(h, hBefore);
    if (p > 30) {
      lines.push(
        "Ökningen är brant. Mer än 30 % på en månad är ofta mer än senor och leder hinner med – håll ögonen på återhämtning och incheckningar.",
      );
    } else if (p < -30) {
      lines.push(
        "Mängden har gått ned tydligt. En planerad nedtrappning, eller sjukdom, resor och vardag? Jämför med säsongsplanen.",
      );
    }
  }

  // Kontinuitet: veckor (sju dagar bakåt från ankaret) med minst ett pass.
  let weeks = 0;
  for (let w = 0; w < 8; w += 1) {
    if (
      between(acts, anchor - (w * 7 + 6) * DAY, anchor - w * 7 * DAY).length > 0
    )
      weeks += 1;
  }
  lines.push(
    weeks >= 7
      ? `Tränat ${weeks} av de senaste 8 veckorna – jämn kontinuitet.`
      : weeks >= 5
        ? `Tränat ${weeks} av de senaste 8 veckorna.`
        : `Pass registrerade bara ${weeks} av de senaste 8 veckorna – antingen glapp i träningen eller pass som inte laddats upp.`,
  );
  return { title: "Mängd och kontinuitet", lines };
}

function form(
  acts: DevelopmentActivity[],
  anchor: number,
  tests: { cp: number | null; cs: number | null },
): DevelopmentSection | null {
  const lines: string[] = [];
  for (const kind of ["power", "speed"] as CurveKind[]) {
    const sport = kind === "power" ? "cykling" : "löpning";
    const has = (a: DevelopmentActivity) =>
      a.sport === sport && (a.curve?.[kind]?.length ?? 0) > 0;
    const sources = (from: number, to: number) =>
      between(acts, from, to)
        .filter(has)
        .map((a) => ({
          id: a.id,
          name: a.name,
          sport: a.sport,
          performed_on: a.performed_on,
          curve: a.curve,
          best: null,
        }));
    const now = sources(anchor - 41 * DAY, anchor);
    const before = sources(anchor - 83 * DAY, anchor - 42 * DAY);
    if (now.length === 0) continue;

    const cNow = bestCurve(now, kind);
    const cBefore = bestCurve(before, kind);
    const spans = kind === "power" ? [60, 300, 1200] : [300, 1200];
    const parts = spans
      .map((span) => {
        const p = cNow.find((x) => x.span === span);
        if (!p) return null;
        const b = cBefore.find((x) => x.span === span);
        const label = span < 60 ? `${span} s` : `${span / 60} min`;
        const value = kind === "power" ? `${sv(p.value)} W` : pace(p.value);
        return `${label} ${value}${b ? ` (${signed(pct(p.value, b.value))} %)` : ""}`;
      })
      .filter(Boolean);
    if (parts.length > 0) {
      lines.push(
        `Bästa på ${SPORT_NAME[sport]} de senaste sex veckorna: ${parts.join(", ")}${cBefore.length > 0 ? ", jämfört med sex veckor före" : ""}.`,
      );
    }

    // CP eller CS ur 90 dagar, mot senaste testet.
    const fit = fitCritical(
      bestCurve(sources(anchor - 89 * DAY, anchor), kind),
      kind,
    );
    const test = kind === "power" ? tests.cp : tests.cs;
    if (fit && !fit.doubtful && test) {
      const diff = pct(fit.critical, test);
      const name = kind === "power" ? "CP" : "CS";
      const show = (v: number) => (kind === "power" ? `${sv(v)} W` : pace(v));
      if (diff >= 3) {
        lines.push(
          `${name} ur de senaste 90 dagarnas pass, ${show(fit.critical)}, ligger ${sv(diff)} % över senaste testet (${show(test)}). Formen har troligen gått framåt – ett nytt test sätter zonerna rätt.`,
        );
      } else if (diff > -3) {
        lines.push(
          `${name} ur passen, ${show(fit.critical)}, stämmer med senaste testet (${show(test)}).`,
        );
      }
    }
  }
  return lines.length > 0 ? { title: "Formen ur träningen", lines } : null;
}

function races(
  acts: DevelopmentActivity[],
  anchor: number,
): DevelopmentSection | null {
  const year = between(acts, anchor - 364 * DAY, anchor).filter(
    (a) => a.is_race || a.race_id,
  );
  if (year.length === 0) return null;
  const planned = year.filter((a) => a.race_id).length;
  const lines: string[] = [];
  lines.push(
    year.length === 1
      ? `1 tävling det senaste året, ${planned === 1 ? "ur säsongsplanen" : "som inte var planerad i säsongsplanen"}.`
      : `${year.length} tävlingar det senaste året${
          planned === year.length
            ? ", alla ur säsongsplanen"
            : planned === 0
              ? ", ingen av dem planerad i säsongsplanen"
              : `, ${planned} planerade och ${year.length - planned} oplanerade`
        }.`,
  );
  const latest = [...year].sort((a, b) =>
    b.performed_on.localeCompare(a.performed_on),
  )[0];
  lines.push(`Senast: ${latest.name}, ${latest.performed_on}.`);

  // Slog loppet modellen ur testet? Då underskattar testet formen.
  const running = latest.sport === "löpning";
  const beats = (latest.best ?? [])
    .filter((b) => b.model !== null && b.model > 0)
    .map((b) => ({
      label: b.label,
      diff: running
        ? (((b.model as number) - b.value) / (b.model as number)) * 100
        : ((b.value - (b.model as number)) / (b.model as number)) * 100,
    }))
    .sort((a, b) => b.diff - a.diff)[0];
  if (beats && beats.diff >= 3) {
    lines.push(
      `I loppet var ${beats.label} ${sv(beats.diff)} % bättre än vad testet förutsäger – testet underskattar formen.`,
    );
  }
  return { title: "Tävlingar", lines };
}

function durability(
  acts: DevelopmentActivity[],
  anchor: number,
): DevelopmentSection | null {
  const lines: string[] = [];
  const long = (from: number, to: number) =>
    between(acts, from, to)
      .filter(
        (a) =>
          a.decoupling !== null &&
          (a.moving_s ?? 0) >= 75 * 60 &&
          !a.is_race &&
          Math.abs(a.decoupling) < 30,
      )
      .map((a) => a.decoupling as number);
  const now = long(anchor - 41 * DAY, anchor);
  const before = long(anchor - 83 * DAY, anchor - 42 * DAY);
  if (now.length >= 2) {
    const m = median(now);
    const trend =
      before.length >= 2
        ? `, ${median(before) > m ? "ned" : "upp"} från ${sv(median(before), 1)} %`
        : "";
    lines.push(
      `Frikopplingen på långpassen (över 75 minuter): median ${sv(m, 1)} % av ${now.length} pass de senaste sex veckorna${trend}. ${
        m < 5
          ? "Under 5 % brukar räknas som god aerob hållbarhet."
          : m > 8
            ? "Pulsen driver uppåt mot slutet av passen – mer lugn distans, eller vätska och energi under passet."
            : "Mellan 5 och 8 % finns det mer att hämta i grundträningen."
      }`,
    );
  }

  // Tid i pulszon, senaste fyra veckorna.
  const zones = new Map<string, number>();
  for (const a of between(acts, anchor - 27 * DAY, anchor))
    for (const z of a.hr_zones ?? [])
      zones.set(z.zone, (zones.get(z.zone) ?? 0) + z.seconds);
  const total = [...zones.values()].reduce((s, v) => s + v, 0);
  if (total >= 2 * 3600) {
    const share = (names: string[]) =>
      (names.reduce((s, n) => s + (zones.get(n) ?? 0), 0) / total) * 100;
    const low = share(["Z1", "Z2"]);
    const mid = share(["Z3"]);
    const high = share(["Z4", "Z5"]);
    lines.push(
      `Tid i pulszon de senaste fyra veckorna: ${sv(low)} % låg (Z1–2), ${sv(mid)} % mellan (Z3), ${sv(high)} % hög (Z4–5).${
        mid > 25
          ? " Mycket tid i mellanzonen – ett vanligt mönster när de lugna passen blir för hårda och de hårda för lätta."
          : low >= 75 && high >= 5
            ? " En polariserad fördelning, som de flesta uthållighetsidrottare tjänar på."
            : high < 3 && low > 90
              ? " Nästan ingen hög intensitet – ett intervallpass i veckan behövs om formen ska upp."
              : ""
      }`,
    );
  }
  return lines.length > 0
    ? { title: "Hållbarhet och intensitet", lines }
    : null;
}

/**
 * Hela analysen. Slutar historiken mer än en vecka före i dag räknas den från
 * senaste passet, så att en importerad historik ändå säger något.
 */
export function analyseTraining(
  activities: DevelopmentActivity[],
  today: string,
  tests: { cp: number | null; cs: number | null } = { cp: null, cs: null },
): DevelopmentReading | null {
  if (activities.length === 0) return null;
  const latest = activities.reduce(
    (m, a) => (a.performed_on > m ? a.performed_on : m),
    activities[0].performed_on,
  );
  const anchoredOnLast = day(today) - day(latest) > 7 * DAY;
  const anchor = anchoredOnLast ? day(latest) : day(today);
  const sections = [
    volume(activities, anchor),
    form(activities, anchor, tests),
    races(activities, anchor),
    durability(activities, anchor),
  ].filter((s): s is DevelopmentSection => s !== null);
  if (sections.length === 0) return null;
  return {
    sections,
    anchor: iso(anchor),
    anchoredOnLast,
    activities: activities.length,
  };
}
