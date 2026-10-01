/**
 * Analys av ett genomfört pass eller lopp ur klockans eller cykeldatorns fil.
 *
 * Allt räknas på sekundserien, i webbläsaren, innan något sparas: normaliserad
 * effekt, bästa insatser, W′bal och frikoppling behöver varje sekund, medan
 * det som visas – kartan och graferna – klarar sig med ett par tusen punkter.
 * Därför sparas analysen färdig tillsammans med en nedsamplad serie, och med
 * de tröskelvärden den räknades mot, som ett pass sparas med sin referens.
 *
 * Modulen är ren – inga anrop, ingen databas – så att den går att pröva mot en
 * riktig fil utan app.
 */

export type Sample = {
  /** Sekunder från start, klocktid. */
  t: number;
  lat: number | null;
  lon: number | null;
  alt: number | null;
  power: number | null;
  hr: number | null;
  /** m/s */
  speed: number | null;
  cadence: number | null;
  /** Meter från start. */
  distance: number | null;
};

export type ActivitySport = "cykling" | "löpning" | "simning" | "annat";

/** Tröskelvärdena analysen räknas mot, och var de kommer ifrån. */
export type Reference = {
  /** Effekt att räkna IF, TSS och zoner mot, W. */
  ftp: number | null;
  ftpSource: string | null;
  /** CP och W′ för W′bal och modellens bästa insatser. */
  cp: number | null;
  wPrime: number | null;
  /** CS (m/s) och D′ (m), för löpning. */
  cs: number | null;
  dPrime: number | null;
  /** Tröskelpuls, för pulszonerna. */
  lthr: number | null;
  /** Testet värdena kom ur, när de gör det. */
  testedOn: string | null;
};

export type Streams = {
  /** Sekunder från start. */
  t: number[];
  /** Kilometer från start. */
  km: number[];
  lat: (number | null)[];
  lon: (number | null)[];
  alt: (number | null)[];
  power: (number | null)[];
  hr: (number | null)[];
  /** km/h */
  speed: (number | null)[];
  cadence: (number | null)[];
  /** W′bal eller D′bal som andel av full reserv, 0–1. */
  balance: (number | null)[] | null;
};

export type BestEffort = {
  /** Sekunder, eller meter för löpningens distanser. */
  span: number;
  label: string;
  /** W, eller sekunder för en distans. */
  value: number;
  /** Var insatsen började, sekunder från start. */
  at: number;
  /** Vad modellen säger att atleten klarar på samma tid eller sträcka. */
  model: number | null;
};

export type ZoneTime = { zone: string; seconds: number };

export type Split = {
  label: string;
  seconds: number;
  distanceM: number;
  /** km/h */
  speed: number | null;
  power: number | null;
  hr: number | null;
  ascent: number | null;
};

export type Summary = {
  elapsedS: number;
  movingS: number;
  distanceM: number | null;
  ascentM: number | null;
  /** km/h, rörlig tid. */
  avgSpeed: number | null;
  maxSpeed: number | null;
  avgPower: number | null;
  maxPower: number | null;
  normalizedPower: number | null;
  workKj: number | null;
  variabilityIndex: number | null;
  intensityFactor: number | null;
  tss: number | null;
  avgHr: number | null;
  maxHr: number | null;
  avgCadence: number | null;
  /** Frikoppling: hur mycket effekt (fart) per slag som tappades mellan halvorna, %. */
  decouplingPct: number | null;
  /** Andra halvan mot första, effekt (cykel) eller fart, %. */
  halvesPct: number | null;
  /** Lägsta W′bal/D′bal som andel, när, och hur långt in. */
  balanceMin: { fraction: number; at: number; km: number | null } | null;
  /** Tid över CP (CS), sekunder. */
  aboveCriticalS: number | null;
  best: BestEffort[];
  powerZones: ZoneTime[] | null;
  hrZones: ZoneTime[] | null;
  splits: Split[];
  insights: string[];
};

const POWER_SPANS: [number, string][] = [
  [5, "5 s"],
  [30, "30 s"],
  [60, "1 min"],
  [180, "3 min"],
  [300, "5 min"],
  [600, "10 min"],
  [1200, "20 min"],
  [1800, "30 min"],
  [3600, "60 min"],
];

const RUN_DISTANCES: [number, string][] = [
  [400, "400 m"],
  [1000, "1 km"],
  [1609, "1 mile"],
  [3000, "3 km"],
  [5000, "5 km"],
  [10000, "10 km"],
  [21097, "Halvmaraton"],
  [42195, "Maraton"],
];

/** Coggans effektzoner mot FTP, samma som zonkortet. */
const POWER_ZONES: [string, number, number | null][] = [
  ["Z1 Återhämtning", 0, 0.55],
  ["Z2 Uthållighet", 0.55, 0.75],
  ["Z3 Tempo", 0.75, 0.9],
  ["Z4 Tröskel", 0.9, 1.05],
  ["Z5 VO2max", 1.05, 1.2],
  ["Z6 Anaerob", 1.2, 1.5],
  ["Z7 Neuromuskulär", 1.5, null],
];

/** Friels pulszoner mot tröskelpulsen, cykel respektive löpning. */
const HR_ZONES: Record<
  "cykling" | "löpning",
  [string, number, number | null][]
> = {
  cykling: [
    ["Z1", 0, 0.81],
    ["Z2", 0.81, 0.9],
    ["Z3", 0.9, 0.94],
    ["Z4", 0.94, 1.0],
    ["Z5", 1.0, null],
  ],
  löpning: [
    ["Z1", 0, 0.85],
    ["Z2", 0.85, 0.9],
    ["Z3", 0.9, 0.95],
    ["Z4", 0.95, 1.0],
    ["Z5", 1.0, null],
  ],
};

/** Längsta glapp som fylls med föregående värde. Längre räknas som stopp. */
const MAX_GAP_S = 5;
/** Så här många punkter sparas för kartan och graferna. */
export const DISPLAY_POINTS = 2000;

const sv = (v: number, digits = 0) =>
  v.toFixed(digits).replace(".", ",").replace("-", "−");

export function formatClock(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Tempo per km (löpning) som "4:12". */
export const paceOf = (metresPerSecond: number) =>
  metresPerSecond > 0 ? formatClock(1000 / metresPerSecond) : "–";

type Second = {
  power: number;
  hr: number | null;
  speed: number;
  moving: boolean;
  distance: number | null;
  alt: number | null;
  lat: number | null;
  lon: number | null;
  cadence: number | null;
};

/**
 * Serien sekund för sekund. Korta glapp – klockan loggar ibland varannan
 * sekund – fylls med föregående värde. Längre glapp är ett stopp: effekt och
 * fart noll, puls okänd.
 */
export function perSecond(samples: Sample[]): Second[] {
  const sorted = [...samples].sort((a, b) => a.t - b.t);
  if (sorted.length === 0) return [];
  const start = sorted[0].t;
  const end = Math.round(sorted[sorted.length - 1].t - start);
  const out: Second[] = new Array(end + 1);
  let j = 0;
  for (let s = 0; s <= end; s += 1) {
    while (j + 1 < sorted.length && sorted[j + 1].t - start <= s) j += 1;
    const sample = sorted[j];
    const age = s - (sample.t - start);
    const stale = age > MAX_GAP_S;
    const speed = stale ? 0 : (sample.speed ?? 0);
    const power = stale ? 0 : (sample.power ?? 0);
    out[s] = {
      power,
      hr: stale ? null : sample.hr,
      speed,
      moving: !stale && (speed > 0.5 || power > 0),
      distance: sample.distance,
      alt: sample.alt,
      lat: sample.lat,
      lon: sample.lon,
      cadence: stale ? null : sample.cadence,
    };
  }
  return out;
}

/** Bästa medelvärdet över `span` sekunder, och var det började. */
function bestMean(
  values: number[],
  span: number,
): { value: number; at: number } | null {
  if (values.length < span || span <= 0) return null;
  let sum = 0;
  for (let i = 0; i < span; i += 1) sum += values[i];
  let best = sum;
  let at = 0;
  for (let i = span; i < values.length; i += 1) {
    sum += values[i] - values[i - span];
    if (sum > best) {
      best = sum;
      at = i - span + 1;
    }
  }
  return { value: best / span, at };
}

/** Snabbaste tid över en sträcka, ur den kumulativa distansen. */
function fastestOver(
  seconds: Second[],
  metres: number,
): { value: number; at: number } | null {
  let best: { value: number; at: number } | null = null;
  let i = 0;
  for (let j = 0; j < seconds.length; j += 1) {
    const dj = seconds[j].distance;
    if (dj === null) continue;
    while (i < j) {
      const di = seconds[i + 1]?.distance;
      if (di === null || di === undefined || dj - di < metres) break;
      i += 1;
    }
    const di = seconds[i].distance;
    if (di !== null && dj - di >= metres) {
      const time = j - i;
      if (!best || time < best.value) best = { value: time, at: i };
    }
  }
  return best;
}

/** Normaliserad effekt: 30 sekunders glidande medel, fjärde potens. */
export function normalizedPower(power: number[]): number | null {
  if (power.length < 30) return null;
  let sum = 0;
  let acc = 0;
  let n = 0;
  for (let i = 0; i < power.length; i += 1) {
    sum += power[i];
    if (i >= 30) sum -= power[i - 30];
    if (i >= 29) {
      acc += (sum / 30) ** 4;
      n += 1;
    }
  }
  return n > 0 ? (acc / n) ** 0.25 : null;
}

/**
 * W′bal sekund för sekund, differentialformen (Skiba m.fl. 2014) – samma
 * ekvationer som passbyggaren. Fungerar lika för fart: CS och D′.
 */
export function balanceSeries(
  values: number[],
  critical: number,
  reserve: number,
): number[] {
  const out = new Array<number>(values.length);
  let balance = reserve;
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (v > critical) balance -= v - critical;
    else balance += ((critical - v) * (reserve - balance)) / reserve;
    balance = Math.min(balance, reserve);
    out[i] = balance;
  }
  return out;
}

function zonesTime(
  values: (number | null)[],
  threshold: number,
  spec: [string, number, number | null][],
): ZoneTime[] {
  const times = spec.map(([zone]) => ({ zone, seconds: 0 }));
  for (const v of values) {
    if (v === null || !(v > 0)) continue;
    const ratio = v / threshold;
    const index = spec.findIndex(
      ([, lo, hi]) => ratio >= lo && (hi === null || ratio < hi),
    );
    if (index >= 0) times[index].seconds += 1;
  }
  return times;
}

const avg = (values: number[]) =>
  values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : null;

/** Stigning i meter ur höjden, med glättning och en tröskel mot brus. */
function ascentOf(alts: (number | null)[]): number | null {
  const known = alts.filter((a): a is number => a !== null);
  if (known.length < 10) return null;
  let total = 0;
  let base = known[0];
  for (const a of known) {
    if (a - base >= 2) {
      total += a - base;
      base = a;
    } else if (a < base) {
      base = a;
    }
  }
  return total;
}

/**
 * Nedsampla till högst `points` punkter för kartan och graferna. Effekt,
 * puls, fart och kadens medelvärdesbildas i varje hink – en enstaka sekund
 * är brus i en graf över fyra timmar – medan läget tas mitt i hinken.
 */
export function downsample(
  seconds: Second[],
  balance: number[] | null,
  reserve: number | null,
  points = DISPLAY_POINTS,
): Streams {
  const size = Math.max(1, Math.ceil(seconds.length / points));
  const streams: Streams = {
    t: [],
    km: [],
    lat: [],
    lon: [],
    alt: [],
    power: [],
    hr: [],
    speed: [],
    cadence: [],
    balance: balance ? [] : null,
  };
  const round = (v: number | null, d: number) =>
    v === null || !Number.isFinite(v)
      ? null
      : Math.round(v * 10 ** d) / 10 ** d;
  const mean = (xs: (number | null)[]) => {
    const known = xs.filter((x): x is number => x !== null);
    return known.length > 0
      ? known.reduce((s, x) => s + x, 0) / known.length
      : null;
  };

  let lastKm = 0;
  for (let i = 0; i < seconds.length; i += size) {
    const bucket = seconds.slice(i, i + size);
    const middle = bucket[Math.floor(bucket.length / 2)];
    const last = bucket[bucket.length - 1];
    const km = last.distance !== null ? last.distance / 1000 : lastKm;
    lastKm = km;
    streams.t.push(i);
    streams.km.push(Math.round(km * 1000) / 1000);
    streams.lat.push(round(middle.lat, 6));
    streams.lon.push(round(middle.lon, 6));
    streams.alt.push(round(mean(bucket.map((s) => s.alt)), 1));
    streams.power.push(
      round(mean(bucket.map((s) => (s.moving ? s.power : null))), 0),
    );
    streams.hr.push(round(mean(bucket.map((s) => s.hr)), 0));
    streams.speed.push(
      round(mean(bucket.map((s) => (s.moving ? s.speed * 3.6 : null))), 1),
    );
    streams.cadence.push(round(mean(bucket.map((s) => s.cadence)), 0));
    if (balance && streams.balance && reserve) {
      // Den lägsta punkten i hinken, så att en dipp inte jämnas ut.
      const slice = balance.slice(i, i + size);
      streams.balance.push(round(Math.min(...slice) / reserve, 3));
    }
  }
  return streams;
}

/** Sträckor: varje kilometer för löpning, var tionde för cykling. */
function splitsOf(seconds: Second[], sport: ActivitySport): Split[] {
  const every = sport === "cykling" ? 10000 : sport === "löpning" ? 1000 : 0;
  if (!every) return [];
  const splits: Split[] = [];
  let startIndex = 0;
  let next = every;
  const close = (endIndex: number, label: string) => {
    const part = seconds.slice(startIndex, endIndex + 1);
    const d0 = seconds[startIndex].distance ?? 0;
    const d1 = seconds[endIndex].distance ?? d0;
    const moving = part.filter((s) => s.moving);
    const hrs = part.map((s) => s.hr).filter((h): h is number => h !== null);
    splits.push({
      label,
      seconds: endIndex - startIndex,
      distanceM: d1 - d0,
      speed:
        endIndex > startIndex
          ? ((d1 - d0) / (endIndex - startIndex)) * 3.6
          : null,
      power: moving.some((s) => s.power > 0)
        ? avg(moving.map((s) => s.power))
        : null,
      hr: avg(hrs),
      ascent: ascentOf(part.map((s) => s.alt)),
    });
    startIndex = endIndex;
  };
  for (let i = 0; i < seconds.length; i += 1) {
    const d = seconds[i].distance;
    if (d !== null && d >= next) {
      close(i, `${Math.round(next / 1000)} km`);
      next += every;
    }
  }
  const lastD = seconds[seconds.length - 1]?.distance ?? 0;
  const startD = seconds[startIndex]?.distance ?? 0;
  if (lastD - startD > every * 0.2) {
    close(seconds.length - 1, `${sv(lastD / 1000, 1)} km`);
  }
  return splits;
}

/**
 * Hela analysen. `deviceTotals` är det klockan själv summerat – stigningen
 * räknar enheten bättre än vi, med barometer och egen filtrering.
 */
export function analyse(
  samples: Sample[],
  sport: ActivitySport,
  reference: Reference,
  deviceTotals: {
    ascentM?: number | null;
    thresholdPower?: number | null;
  } = {},
): { summary: Summary; streams: Streams } {
  const seconds = perSecond(samples);
  const moving = seconds.filter((s) => s.moving);
  const elapsedS = Math.max(seconds.length - 1, 0);
  const movingS = Math.min(moving.length, elapsedS);
  const firstD = seconds.find((s) => s.distance !== null)?.distance ?? null;
  const lastD =
    [...seconds].reverse().find((s) => s.distance !== null)?.distance ?? null;
  const distanceM = lastD !== null && firstD !== null ? lastD - firstD : null;

  const power = seconds.map((s) => s.power);
  const hasPower = seconds.some((s) => s.power > 0);
  const hrs = seconds.map((s) => s.hr).filter((h): h is number => h !== null);
  const cadences = moving
    .map((s) => s.cadence)
    .filter((c): c is number => c !== null && c > 0);

  const np = hasPower ? normalizedPower(power) : null;
  const avgPower = hasPower ? avg(moving.map((s) => s.power)) : null;
  const ftp = reference.ftp ?? deviceTotals.thresholdPower ?? null;
  const ifactor = np !== null && ftp ? np / ftp : null;
  const tss =
    np !== null && ftp && ifactor !== null
      ? ((movingS * np * ifactor) / (ftp * 3600)) * 100
      : null;

  // W′bal för cykling med effekt, D′bal för löpning med fart.
  let balance: number[] | null = null;
  let reserve: number | null = null;
  let critical: number | null = null;
  if (sport === "cykling" && hasPower && reference.cp && reference.wPrime) {
    critical = reference.cp;
    reserve = reference.wPrime;
    balance = balanceSeries(power, critical, reserve);
  } else if (sport === "löpning" && reference.cs && reference.dPrime) {
    critical = reference.cs;
    reserve = reference.dPrime;
    balance = balanceSeries(
      seconds.map((s) => s.speed),
      critical,
      reserve,
    );
  }
  let balanceMin: Summary["balanceMin"] = null;
  let aboveCriticalS: number | null = null;
  if (balance && reserve && critical) {
    let minIndex = 0;
    for (let i = 1; i < balance.length; i += 1)
      if (balance[i] < balance[minIndex]) minIndex = i;
    const d = seconds[minIndex].distance;
    balanceMin = {
      fraction: balance[minIndex] / reserve,
      at: minIndex,
      km: d !== null && firstD !== null ? (d - firstD) / 1000 : null,
    };
    const series = sport === "cykling" ? power : seconds.map((s) => s.speed);
    aboveCriticalS = series.filter((v) => v > (critical as number)).length;
  }

  // Bästa insatser: effekt över tid på cykeln, tid över distans i löpning.
  const best: BestEffort[] = [];
  if (hasPower) {
    for (const [span, label] of POWER_SPANS) {
      const found = bestMean(power, span);
      if (!found) continue;
      best.push({
        span,
        label,
        value: found.value,
        at: found.at,
        model:
          reference.cp && reference.wPrime && span >= 60
            ? reference.cp + reference.wPrime / span
            : null,
      });
    }
  } else if (sport === "löpning") {
    for (const [metres, label] of RUN_DISTANCES) {
      if (distanceM === null || distanceM < metres) continue;
      const found = fastestOver(seconds, metres);
      if (!found) continue;
      // CS-modellen: t = (d − D′)/CS, giltig för insatser på 2–20 minuter
      // men visad längre också, som referens.
      const model =
        reference.cs && reference.dPrime && metres > reference.dPrime
          ? (metres - reference.dPrime) / reference.cs
          : null;
      best.push({
        span: metres,
        label,
        value: found.value,
        at: found.at,
        model,
      });
    }
  }

  // Halvorna och frikopplingen, på rörlig tid.
  let halvesPct: number | null = null;
  let decouplingPct: number | null = null;
  if (moving.length > 600) {
    const mid = Math.floor(moving.length / 2);
    const first = moving.slice(0, mid);
    const second = moving.slice(mid);
    const load = (part: Second[]) =>
      hasPower ? avg(part.map((s) => s.power)) : avg(part.map((s) => s.speed));
    const l1 = load(first);
    const l2 = load(second);
    if (l1 && l2) halvesPct = ((l2 - l1) / l1) * 100;
    const hr1 = avg(
      first.map((s) => s.hr).filter((h): h is number => h !== null),
    );
    const hr2 = avg(
      second.map((s) => s.hr).filter((h): h is number => h !== null),
    );
    if (l1 && l2 && hr1 && hr2) {
      const r1 = l1 / hr1;
      const r2 = l2 / hr2;
      decouplingPct = ((r1 - r2) / r1) * 100;
    }
  }

  const powerZones =
    hasPower && ftp
      ? zonesTime(
          moving.map((s) => s.power),
          ftp,
          POWER_ZONES,
        )
      : null;
  const hrZones =
    reference.lthr &&
    hrs.length > 0 &&
    (sport === "cykling" || sport === "löpning")
      ? zonesTime(
          seconds.map((s) => s.hr),
          reference.lthr,
          HR_ZONES[sport],
        )
      : null;

  const avgSpeedMs =
    distanceM !== null && movingS > 0 ? distanceM / movingS : null;
  const summary: Summary = {
    elapsedS,
    movingS,
    distanceM,
    ascentM: deviceTotals.ascentM ?? ascentOf(seconds.map((s) => s.alt)),
    avgSpeed: avgSpeedMs !== null ? avgSpeedMs * 3.6 : null,
    maxSpeed:
      moving.length > 0
        ? (bestMean(
            seconds.map((s) => s.speed),
            5,
          )?.value ?? 0) * 3.6
        : null,
    avgPower,
    maxPower: hasPower ? Math.max(...power) : null,
    normalizedPower: np,
    workKj: hasPower ? power.reduce((s, p) => s + p, 0) / 1000 : null,
    variabilityIndex: np !== null && avgPower ? np / avgPower : null,
    intensityFactor: ifactor,
    tss,
    avgHr: avg(hrs),
    maxHr: hrs.length > 0 ? Math.max(...hrs) : null,
    avgCadence: avg(cadences),
    decouplingPct,
    halvesPct,
    balanceMin,
    aboveCriticalS,
    best,
    powerZones,
    hrZones,
    splits: splitsOf(seconds, sport),
    insights: [],
  };
  summary.insights = insightsFor(summary, sport, reference, ftp);
  return { summary, streams: downsample(seconds, balance, reserve) };
}

/**
 * Den korta analysen, som text. Regelbaserad som trendanalysen: varje mening
 * vilar på ett tal i sammanfattningen, och samma fil ger samma text.
 */
export function insightsFor(
  s: Summary,
  sport: ActivitySport,
  reference: Reference,
  ftp: number | null,
): string[] {
  const out: string[] = [];
  const hours = s.movingS / 3600;
  const duration = formatClock(s.movingS);

  if (s.intensityFactor !== null && ftp) {
    const source = reference.ftp ? reference.ftpSource : "cykeldatorn";
    out.push(
      `Normaliserad effekt ${sv(s.normalizedPower ?? 0)} W är ${sv(s.intensityFactor * 100)} % av FTP ${sv(ftp)} W (${source}) över ${duration}.`,
    );
    if (s.intensityFactor >= 0.97 && hours >= 1) {
      out.push(
        "Så nära eller över FTP i mer än en timme säger att tröskeln sannolikt ligger högre än värdet analysen räknar mot – ett nytt test visar var.",
      );
    }
  }

  // Bästa insatser mot modellen.
  const beats = s.best.filter(
    (b) =>
      b.model !== null &&
      (sport === "löpning"
        ? b.value < b.model * 0.98
        : b.value > b.model * 1.02),
  );
  if (beats.length > 0) {
    const top = beats[beats.length - 1];
    out.push(
      sport === "löpning"
        ? `${top.label} på ${formatClock(top.value)} är snabbare än modellen ur testet (${formatClock(top.model as number)}). CS eller D′ har flyttat sig uppåt.`
        : `Bästa ${top.label} ${sv(top.value)} W ligger ${sv(((top.value - (top.model as number)) / (top.model as number)) * 100)} % över vad CP-modellen ur testet säger (${sv(top.model as number)} W). Loppet är ett bättre underlag än testet för den durationen.`,
    );
  }

  if (s.balanceMin) {
    const where =
      s.balanceMin.km !== null ? ` vid km ${sv(s.balanceMin.km, 1)}` : "";
    const reserveName = sport === "löpning" ? "D′" : "W′";
    out.push(
      s.balanceMin.fraction < -0.05
        ? `${reserveName} gick under noll${where}, till ${sv(s.balanceMin.fraction * 100)} % – atleten gav mer än modellen ur testet tillåter. ${sport === "löpning" ? "CS eller D′" : "CP eller W′"} är sannolikt för lågt satta; loppet är ett bättre mått än testet.`
        : s.balanceMin.fraction <= 0.05
          ? `${reserveName} tömdes helt${where} – modellen säger att det inte fanns mer att ge där. Ligger det i en avgörande backe eller spurt var reserven rätt använd.`
          : `${reserveName} gick som lägst ned till ${sv(s.balanceMin.fraction * 100)} %${where}.`,
    );
  }

  if (s.variabilityIndex !== null && s.variabilityIndex >= 1.1) {
    out.push(
      `Ojämn belastning: VI ${sv(s.variabilityIndex, 2)}. Typiskt för linjelopp med backar och ryck – det kostar mer än samma snitteffekt jämnt.`,
    );
  }

  if (s.halvesPct !== null && Math.abs(s.halvesPct) >= 3) {
    out.push(
      s.halvesPct < 0
        ? `Andra halvan ${sv(Math.abs(s.halvesPct))} % lägre ${sport === "cykling" ? "effekt" : "fart"} än första.`
        : `Andra halvan ${sv(s.halvesPct)} % starkare än första – negativ split.`,
    );
  }

  if (s.decouplingPct !== null && hours >= 1) {
    out.push(
      s.decouplingPct >= 5
        ? `${sport === "cykling" ? "Effekten" : "Farten"} per pulsslag sjönk ${sv(s.decouplingPct, 1)} % mellan halvorna. Över 5 % brukar läsas som att uthålligheten inte räckte hela vägen – i ett lopp med taktik och backar är talet osäkrare.`
        : `Frikopplingen mellan puls och ${sport === "cykling" ? "effekt" : "fart"} var ${sv(s.decouplingPct, 1)} % – pulsen höll sig i takt med belastningen hela vägen.`,
    );
  }
  return out;
}
