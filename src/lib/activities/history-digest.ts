/**
 * Hela träningshistoriken, sammanfattad för AI-coachen: månad för månad,
 * varje tävling med veckorna före och efter, och passen som satte nya bästa.
 *
 * Utvecklingskortet tittar på de senaste veckorna. Frågor som ”vad gjorde hon
 * före sitt bästa lopp?” eller ”när är hon i bäst form på året?” kräver hela
 * historiken – men inte varje pass. Sammanfattningen ger modellen talen den
 * behöver för att jämföra perioder, i några hundra rader i stället för
 * tusentals pass.
 *
 * Modulen är ren – inga anrop.
 */

import type { BestEffort, Curve, ZoneTime } from "./analysis";

export type DigestActivity = {
  name: string;
  sport: string;
  performed_on: string;
  duration_s: number | null;
  moving_s: number | null;
  distance_m: number | null;
  ascent_m: number | null;
  normalized_power: number | null;
  intensity_factor: number | null;
  /** km/h */
  avg_speed: number | null;
  avg_power: number | null;
  avg_hr: number | null;
  tss: number | null;
  decoupling: number | null;
  halves: number | null;
  hr_zones: ZoneTime[] | null;
  curve: Curve | null;
  best: BestEffort[] | null;
  is_race: boolean;
  race_id: string | null;
};

export type DigestRace = { id: string; name: string; priority: string };

/** Hoopers frågor, 1–5 där 5 är bäst. */
export type DigestCheckin = {
  performed_on: string;
  sleep: number | null;
  fatigue: number | null;
  soreness: number | null;
  stress: number | null;
};

const DAY = 86_400_000;
const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const sv = (v: number, digits = 0) =>
  v.toFixed(digits).replace(".", ",").replace("-", "−");
const signed = (v: number, digits = 0) =>
  `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(digits).replace(".", ",")}`;
const pace = (ms: number) => {
  const s = Math.round(1000 / ms);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}/km`;
};
const clock = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = Math.round(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`
    : `${m}:${String(r).padStart(2, "0")}`;
};
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
const SPORT: Record<string, string> = {
  cykling: "cykel",
  löpning: "löpning",
  simning: "simning",
  annat: "annat",
};

const secondsOf = (a: DigestActivity) => a.moving_s ?? a.duration_s ?? 0;
const hoursOf = (acts: DigestActivity[]) =>
  acts.reduce((s, a) => s + secondsOf(a), 0) / 3600;
const between = (acts: DigestActivity[], from: number, to: number) =>
  acts.filter((a) => {
    const d = day(a.performed_on);
    return d >= from && d <= to;
  });

/** Bästa medelvärdet över en längd ur kurvan. */
const curveAt = (a: DigestActivity, kind: "power" | "speed", span: number) =>
  a.curve?.[kind]?.find(([s]) => s === span)?.[1] ?? null;

const bestOf = (
  acts: DigestActivity[],
  kind: "power" | "speed",
  span: number,
) => {
  let best: number | null = null;
  for (const a of acts) {
    const v = curveAt(a, kind, span);
    if (v !== null && (best === null || v > best)) best = v;
  }
  return best;
};

/** Ett hårt pass: IF minst 0,85, eller en kvart i Z4–5. */
const isHard = (a: DigestActivity) =>
  (a.intensity_factor !== null && a.intensity_factor >= 0.85) ||
  (a.hr_zones ?? [])
    .filter((z) => /^Z[45]/.test(z.zone))
    .reduce((s, z) => s + z.seconds, 0) >=
    15 * 60;

/**
 * Effektivitet: effekt (cykel) eller fart (löpning) per hjärtslag, på lugna
 * pass. Stiger den har atleten blivit aerobt starkare – samma fart på lägre
 * puls.
 */
const efficiency = (a: DigestActivity): number | null => {
  if (a.is_race || a.avg_hr === null || a.avg_hr < 80) return null;
  if (secondsOf(a) < 40 * 60) return null;
  if (a.intensity_factor !== null && a.intensity_factor > 0.8) return null;
  if (a.sport === "cykling") {
    const p = a.normalized_power ?? a.avg_power;
    return p ? p / a.avg_hr : null;
  }
  if (a.sport === "löpning" && a.avg_speed) {
    // Meter per minut och slag.
    return ((a.avg_speed / 3.6) * 60) / a.avg_hr;
  }
  return null;
};

function powerAndPace(acts: DigestActivity[]): string[] {
  const parts: string[] = [];
  const bike = acts.filter((a) => a.sport === "cykling");
  const run = acts.filter((a) => a.sport === "löpning");
  const p5 = bestOf(bike, "power", 300);
  const p20 = bestOf(bike, "power", 1200);
  if (p5 || p20)
    parts.push(
      `cykel bäst ${[p5 && `5 min ${sv(p5)} W`, p20 && `20 min ${sv(p20)} W`].filter(Boolean).join(", ")}`,
    );
  const s5 = bestOf(run, "speed", 300);
  const s20 = bestOf(run, "speed", 1200);
  if (s5 || s20)
    parts.push(
      `löpning bäst ${[s5 && `5 min ${pace(s5)}`, s20 && `20 min ${pace(s20)}`].filter(Boolean).join(", ")}`,
    );
  return parts;
}

function efficiencyParts(acts: DigestActivity[]): string[] {
  const parts: string[] = [];
  for (const sport of ["cykling", "löpning"]) {
    const ef = acts
      .filter((a) => a.sport === sport)
      .map(efficiency)
      .filter((v): v is number => v !== null);
    if (ef.length >= 2)
      parts.push(
        sport === "cykling"
          ? `EF cykel ${sv(median(ef), 2)} W/slag`
          : `EF löpning ${sv(median(ef), 2)} m/min per slag`,
      );
  }
  const dec = acts
    .filter(
      (a) =>
        a.decoupling !== null &&
        !a.is_race &&
        secondsOf(a) >= 75 * 60 &&
        Math.abs(a.decoupling) < 30,
    )
    .map((a) => a.decoupling as number);
  if (dec.length >= 2)
    parts.push(`frikoppling långpass ${sv(median(dec), 1)} %`);
  return parts;
}

function checkinParts(checkins: DigestCheckin[]): string | null {
  const avg = (key: keyof Omit<DigestCheckin, "performed_on">) => {
    const xs = checkins
      .map((c) => c[key])
      .filter((v): v is number => v !== null);
    return xs.length >= 3 ? mean(xs) : null;
  };
  const parts = (
    [
      ["sömn", avg("sleep")],
      ["trötthet", avg("fatigue")],
      ["ömhet", avg("soreness")],
      ["stress", avg("stress")],
    ] as const
  )
    .filter(([, v]) => v !== null)
    .map(([label, v]) => `${label} ${sv(v as number, 1)}`);
  return parts.length > 0 ? parts.join(", ") : null;
}

/** En period som en rad: mängd, belastning, hårda pass och längsta pass. */
function periodLine(acts: DigestActivity[], weeks: number): string {
  if (acts.length === 0) return "inga pass";
  const tss = acts.filter((a) => a.tss !== null);
  const longest = Math.max(...acts.map(secondsOf));
  const hard = acts.filter(isHard).length;
  return [
    `${sv(hoursOf(acts) / weeks, 1)} h och ${sv(acts.length / weeks, 1)} pass per vecka`,
    tss.length > 0
      ? `${sv(tss.reduce((s, a) => s + (a.tss ?? 0), 0) / weeks)} TSS per vecka${tss.length < acts.length ? " (pass med effekt)" : ""}`
      : null,
    `${sv(hard / weeks, 1)} hårda pass per vecka`,
    `längsta ${clock(longest)}`,
  ]
    .filter(Boolean)
    .join(", ");
}

function raceResult(a: DigestActivity): string {
  const parts: string[] = [SPORT[a.sport] ?? a.sport];
  if (a.distance_m) parts.push(`${sv(a.distance_m / 1000, 1)} km`);
  if (secondsOf(a)) parts.push(clock(secondsOf(a)));
  if (a.ascent_m) parts.push(`${sv(a.ascent_m)} hm`);
  if (a.normalized_power) parts.push(`NP ${sv(a.normalized_power)} W`);
  if (a.intensity_factor) parts.push(`IF ${sv(a.intensity_factor, 2)}`);
  if (a.sport !== "cykling" && a.avg_speed)
    parts.push(`snitt ${pace(a.avg_speed / 3.6)}`);
  if (a.avg_hr) parts.push(`snittpuls ${sv(a.avg_hr)}`);
  if (a.decoupling !== null) parts.push(`frikoppling ${sv(a.decoupling, 1)} %`);
  if (a.halves !== null) parts.push(`andra halvan ${signed(a.halves, 1)} %`);
  const beat = (a.best ?? []).filter(
    (b) => b.model !== null && b.model > 0 && b.value > 0,
  );
  const overModel = beat
    .map((b) => {
      // Effekt: högre är bättre. Löpdistans i sekunder: lägre är bättre.
      const gain =
        a.sport === "cykling"
          ? (b.value / (b.model as number) - 1) * 100
          : ((b.model as number) / b.value - 1) * 100;
      return { label: b.label, gain };
    })
    .filter((b) => b.gain >= 3);
  if (overModel.length > 0)
    parts.push(
      `slog testmodellen på ${overModel.map((b) => `${b.label} (${signed(b.gain)} %)`).join(", ")}`,
    );
  return parts.join(", ");
}

/** De sista tio dagarna före en tävling, dag för dag. */
function taper(acts: DigestActivity[], raceDay: number): string {
  const days: string[] = [];
  for (let d = 10; d >= 1; d -= 1) {
    const that = between(acts, raceDay - d * DAY, raceDay - d * DAY);
    if (that.length === 0) {
      days.push(`−${d} inget pass`);
      continue;
    }
    days.push(
      `−${d} ${that
        .map(
          (a) =>
            `${SPORT[a.sport] ?? a.sport} ${clock(secondsOf(a))}${a.intensity_factor ? ` IF ${sv(a.intensity_factor, 2)}` : ""}${isHard(a) ? " hårt" : ""}`,
        )
        .join(" + ")}`,
    );
  }
  return days.join("; ");
}

/** Pass som satte ett nytt 90-dagarsbästa på 5 eller 20 minuter. */
function breakthroughs(acts: DigestActivity[]): string[] {
  const asc = [...acts].sort((a, b) =>
    a.performed_on.localeCompare(b.performed_on),
  );
  const found: { date: string; text: string; gain: number }[] = [];
  for (const a of asc) {
    const kind =
      a.sport === "cykling" ? "power" : a.sport === "löpning" ? "speed" : null;
    if (!kind) continue;
    const d = day(a.performed_on);
    const before = between(
      asc.filter((x) => x.sport === a.sport),
      d - 90 * DAY,
      d - DAY,
    );
    if (before.length < 5) continue;
    for (const [span, label] of [
      [300, "5 min"],
      [1200, "20 min"],
    ] as const) {
      const v = curveAt(a, kind, span);
      const prev = bestOf(before, kind, span);
      if (v === null || prev === null) continue;
      const gain = (v / prev - 1) * 100;
      if (gain >= 2)
        found.push({
          date: a.performed_on,
          gain,
          text: `${a.performed_on} ${a.name}${a.is_race ? " (tävling)" : ""}: ${label} ${kind === "power" ? `${sv(v)} W` : pace(v)}, ${signed(gain, 1)} % mot 90-dagarsbästa`,
        });
    }
  }
  return found
    .sort((x, y) => y.gain - x.gain)
    .slice(0, 12)
    .sort((x, y) => x.date.localeCompare(y.date))
    .map((f) => f.text);
}

/**
 * Hela historiken som text för AI-coachen. `null` utan pass.
 */
export function historyDigest(
  activities: DigestActivity[],
  races: DigestRace[],
  checkins: DigestCheckin[],
): string | null {
  if (activities.length === 0) return null;
  const acts = [...activities].sort((a, b) =>
    a.performed_on.localeCompare(b.performed_on),
  );
  const first = acts[0].performed_on;
  const last = acts[acts.length - 1].performed_on;
  const lines: string[] = [
    `Träningshistorik ur uppladdade pass: ${acts.length} pass från ${first} till ${last}. Månader eller veckor utan pass kan betyda att passen inte laddats upp, inte att adepten vilade.`,
  ];

  // Per månad.
  const months = new Map<string, DigestActivity[]>();
  for (const a of acts) {
    const m = a.performed_on.slice(0, 7);
    months.set(m, [...(months.get(m) ?? []), a]);
  }
  const checkinMonths = new Map<string, DigestCheckin[]>();
  for (const c of checkins) {
    const m = c.performed_on.slice(0, 7);
    checkinMonths.set(m, [...(checkinMonths.get(m) ?? []), c]);
  }
  lines.push(
    "",
    "Per månad (EF = effekt eller fart per hjärtslag på lugna pass, högre är bättre; incheckningar 1–5 där 5 är bäst):",
  );
  const monthKeys: string[] = [];
  for (
    let y = Number(first.slice(0, 4)), mo = Number(first.slice(5, 7));
    `${y}-${String(mo).padStart(2, "0")}` <= last.slice(0, 7);
    mo === 12 ? ((y += 1), (mo = 1)) : (mo += 1)
  )
    monthKeys.push(`${y}-${String(mo).padStart(2, "0")}`);
  for (const m of monthKeys) {
    const list = months.get(m);
    if (!list) {
      lines.push(`- ${m}: inga uppladdade pass`);
      continue;
    }
    const bySport = new Map<string, number>();
    for (const a of list)
      bySport.set(a.sport, (bySport.get(a.sport) ?? 0) + secondsOf(a) / 3600);
    const tss = list.filter((a) => a.tss !== null);
    const check = checkinParts(checkinMonths.get(m) ?? []);
    lines.push(
      `- ${m}: ${[
        `${list.length} pass, ${sv(hoursOf(list), 1)} h (${[
          ...bySport.entries(),
        ]
          .sort((x, y) => y[1] - x[1])
          .map(([s, h]) => `${SPORT[s] ?? s} ${sv(h, 1)}`)
          .join(", ")})`,
        tss.length > 0
          ? `${sv(tss.reduce((s, a) => s + (a.tss ?? 0), 0))} TSS`
          : null,
        `hårda pass ${list.filter(isHard).length}`,
        ...powerAndPace(list),
        ...efficiencyParts(list),
        check ? `incheckningar ${check}` : null,
      ]
        .filter(Boolean)
        .join("; ")}`,
    );
  }

  // Tävlingarna, med uppladdningen före och veckorna efter.
  const raceById = new Map(races.map((r) => [r.id, r]));
  const competitions = acts.filter((a) => a.is_race || a.race_id);
  if (competitions.length > 0) {
    lines.push("", "Tävlingar:");
    for (const r of competitions) {
      const d = day(r.performed_on);
      const planned = r.race_id ? raceById.get(r.race_id) : undefined;
      const others = acts.filter((a) => a !== r);
      const after = between(others, d + DAY, d + 28 * DAY);
      const afterCheck = checkinParts(
        checkins.filter((c) => {
          const cd = day(c.performed_on);
          return cd > d && cd <= d + 14 * DAY;
        }),
      );
      const beforeCheck = checkinParts(
        checkins.filter((c) => {
          const cd = day(c.performed_on);
          return cd >= d - 14 * DAY && cd < d;
        }),
      );
      const build = between(others, d - 56 * DAY, d - DAY);
      lines.push(
        `- ${r.performed_on} ${r.name} (${planned ? `planerad, ${planned.priority}-lopp` : r.race_id ? "planerad" : "oplanerad"}): ${raceResult(r)}`,
        ...(build.length === 0
          ? [
              "  Inga uppladdade pass de åtta veckorna före – underlaget saknas.",
            ]
          : [
              `  8 veckor före: ${periodLine(build, 8)}`,
              `  Veckorna 8–5 före mot 4–1 före: ${sv(hoursOf(between(others, d - 56 * DAY, d - 29 * DAY)) / 4, 1)} h mot ${sv(hoursOf(between(others, d - 28 * DAY, d - DAY)) / 4, 1)} h per vecka`,
              `  Sista tio dagarna: ${taper(others, d)}`,
            ]),
        after.length > 0
          ? `  4 veckor efter: ${periodLine(after, 4)}`
          : "  Inga uppladdade pass de fyra veckorna efter.",
        ...(beforeCheck
          ? [`  Incheckningar två veckor före: ${beforeCheck}`]
          : []),
        ...(afterCheck
          ? [`  Incheckningar två veckor efter: ${afterCheck}`]
          : []),
      );
    }
  }

  const breaks = breakthroughs(acts);
  if (breaks.length > 0) {
    lines.push(
      "",
      "Genombrottspass (minst 2 % över bästa 5 eller 20 min de 90 dagarna före):",
      ...breaks.map((b) => `- ${b}`),
    );
  }

  return lines.join("\n");
}
