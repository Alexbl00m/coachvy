/**
 * Maxinsatser ur en cykeldators fil.
 *
 * Coachen ska slippa skriva in "3:00, 574 W, puls 174" från Garmin Connect för
 * hand. Filen (FIT, från Garmin, Wahoo, Hammerhead, Zwift …) läses i
 * webbläsaren, och för varje längd protokollet vill ha letas den insats upp
 * som atleten faktiskt körde.
 *
 * "Faktiskt körde" är poängen. Det bästa 6-minutersfönstret i ett pass med en
 * 12-minutersinsats ligger mitt i 12-minuten – 426 W i stället för en riktig
 * 6-minut – och ett CP-test byggt på det fönstret blir fel utan att något
 * syns. Därför räknas bara avgränsade insatser: fönster där effekten precis
 * före och efter är klart lägre än i fönstret, och där fönstrets egna kanter
 * ligger på insatsens nivå. Det är en insats med början och slut.
 *
 * Ingen fil lämnar webbläsaren. GPS-spår och allt annat i filen läses aldrig
 * av; det enda som används är effekt och puls per sekund.
 */

export type Ride = {
  /** Lokalt datum då passet startade, YYYY-MM-DD. */
  date: string;
  startedAt: number;
  /** Effekt per sekund, W. Uppehåll över några sekunder är 0. */
  power: Float64Array;
  /** Puls per sekund; NaN där den saknas. */
  heartRate: Float64Array;
  label: string;
};

/** En längd protokollet vill ha, och spannet en insats får ligga i. */
export type Slot = {
  label: string;
  /** Den längd raden förifylls med, sekunder. */
  target: number;
  min: number;
  max: number;
};

export type FoundEffort = {
  slot: Slot;
  seconds: number;
  watts: number;
  heartRateAvg: number | null;
  heartRateMax: number | null;
  date: string;
  /** Sekunder från passets start. */
  startsAt: number;
  rideLabel: string;
  /**
   * Avgränsad insats (true) eller bara det bästa fönstret i passet (false).
   * Det senare används bara när ingen riktig insats finns, och visas med en
   * varning – det kan vara en del av en längre insats.
   */
  isolated: boolean;
};

/** Längderna per protokoll. Protokoll utan effektinsatser saknas här. */
export const FIT_SLOTS: Partial<Record<string, Slot[]>> = {
  "metabol-profil": [
    { label: "Sprint 20 s", target: 20, min: 10, max: 30 },
    { label: "3 min", target: 180, min: 150, max: 240 },
    { label: "6 min", target: 360, min: 270, max: 420 },
    { label: "12 min", target: 720, min: 600, max: 840 },
  ],
  "critical-power": [
    { label: "3 min", target: 180, min: 150, max: 240 },
    { label: "5–6 min", target: 330, min: 270, max: 420 },
    { label: "12 min", target: 720, min: 600, max: 840 },
    { label: "20 min", target: 1200, min: 1080, max: 1320 },
  ],
  "cp-5min": [{ label: "5 min", target: 300, min: 270, max: 330 }],
  "cp-6min": [{ label: "6 min", target: 360, min: 330, max: 390 }],
  "ftp-20": [{ label: "20 min", target: 1200, min: 1080, max: 1320 }],
};

/**
 * Posterna ur filen till en serie per sekund.
 *
 * Luckor på upp till fem sekunder – ett tappat paket från effektmätaren – fylls
 * med föregående värde. Längre luckor är pauser och blir 0 W, så att en
 * insats aldrig räknas över ett stopp vid ett rödljus.
 */
export function toRide(
  records: { timestamp: Date; power?: number | null; heartRate?: number | null }[],
  label: string,
): Ride | null {
  const valid = records.filter((r) => r.timestamp instanceof Date);
  if (valid.length < 2 || !valid.some((r) => (r.power ?? 0) > 0)) return null;

  const t0 = valid[0].timestamp.getTime();
  const n = Math.round((valid[valid.length - 1].timestamp.getTime() - t0) / 1000) + 1;
  if (!(n > 1) || n > 24 * 3600) return null;

  const power = new Float64Array(n);
  const heartRate = new Float64Array(n).fill(Number.NaN);
  let last = -1;
  for (const r of valid) {
    const i = Math.round((r.timestamp.getTime() - t0) / 1000);
    if (i < 0 || i >= n) continue;
    if (last >= 0 && i - last > 1 && i - last <= 5) {
      for (let k = last + 1; k < i; k += 1) {
        power[k] = power[last];
        heartRate[k] = heartRate[last];
      }
    }
    power[i] = r.power ?? 0;
    heartRate[i] = r.heartRate ?? Number.NaN;
    last = i;
  }

  const d = new Date(t0);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { date, startedAt: t0, power, heartRate, label };
}

/** Snittet i [from, from + length) ur en kumulativ summa. */
const meanOf = (cum: Float64Array, from: number, length: number) => {
  const a = Math.max(0, from);
  const b = Math.min(cum.length - 1, from + length);
  return b > a ? (cum[b] - cum[a]) / (b - a) : null;
};

function heartRateIn(ride: Ride, from: number, length: number) {
  let sum = 0;
  let count = 0;
  let max = 0;
  for (let k = from; k < from + length; k += 1) {
    const hr = ride.heartRate[k];
    if (Number.isFinite(hr) && hr > 0) {
      sum += hr;
      count += 1;
      if (hr > max) max = hr;
    }
  }
  return count === 0
    ? { avg: null, max: null }
    : { avg: Math.round(sum / count), max: Math.round(max) };
}

/**
 * Den bästa insatsen i ett spann, ur ett pass.
 *
 * Först letas insatserna upp. Ett fönster i spannet räknas som en insats när
 *   - snittet precis före och precis efter är under 80 % av fönstrets, och
 *   - fönstrets första och sista sekunder ligger på minst 70 % av snittet.
 * Fönstren som täcker den starkaste insatsen ringar tillsammans in var den
 * började och slutade. Ur den tas sedan protokollets längd: de bästa 180
 * sekunderna ur en insats på 184, hela insatsen om den är kortare.
 *
 * Insatsen ska vara jämn – ingen minut under 75 % av snittet – och ligga nära
 * det bästa passet har på samma längd –
 * annars är den en uppvärmningsdel med vila runt, inte ett test.
 */
export function findEffort(ride: Ride, slot: Slot): FoundEffort | null {
  const { power } = ride;
  const n = power.length;
  if (n < slot.min) return null;

  const cum = new Float64Array(n + 1);
  for (let i = 0; i < n; i += 1) cum[i + 1] = cum[i] + power[i];

  const step = slot.max <= 60 ? 1 : 5;
  const edge = Math.max(3, Math.min(15, Math.round(slot.min / 4)));
  const outside = Math.max(5, Math.min(30, slot.min));

  type Window = { start: number; seconds: number; watts: number };

  /** Bästa fönstret av en viss längd mellan två tidpunkter. */
  const bestWindow = (length: number, from = 0, to = n): Window | null => {
    let top: Window | null = null;
    for (let i = from; i + length <= to; i += 1) {
      const watts = (cum[i + length] - cum[i]) / length;
      if (!top || watts > top.watts) top = { start: i, seconds: length, watts };
    }
    return top;
  };

  const bounded: Window[] = [];
  for (let d = slot.min; d <= Math.min(slot.max, n); d += step) {
    for (let i = 0; i + d <= n; i += 1) {
      const watts = (cum[i + d] - cum[i]) / d;
      if (!(watts > 0)) continue;
      const head = meanOf(cum, i, edge) ?? 0;
      const tail = meanOf(cum, i + d - edge, edge) ?? 0;
      if (head < 0.7 * watts || tail < 0.7 * watts) continue;
      const before = meanOf(cum, i - outside, outside);
      const after = meanOf(cum, i + d, outside);
      if ((before ?? 0) >= 0.8 * watts || (after ?? 0) >= 0.8 * watts) continue;
      bounded.push({ start: i, seconds: d, watts });
    }
  }

  // Jämnhet: ingen minut i insatsen får ligga under 75 % av snittet. Utan det
  // blev 12 minuter hårt plus 8 minuter lugnt en "20-minutersinsats".
  // Sprintar tappar mer mot slutet och prövas inte.
  const steadyWidth = Math.min(60, Math.round(slot.min / 3));
  const steady = (w: Window) => {
    if (slot.max <= 60) return true;
    for (let i = w.start; i + steadyWidth <= w.start + w.seconds; i += 5) {
      if ((cum[i + steadyWidth] - cum[i]) / steadyWidth < 0.75 * w.watts) return false;
    }
    return true;
  };

  let best: Window | null = null;
  const top = [...bounded].sort((x, y) => y.watts - x.watts).find(steady);
  if (top) {
    const overlap = (w: Window) =>
      Math.min(w.start + w.seconds, top.start + top.seconds) - Math.max(w.start, top.start);
    const cluster = bounded.filter(
      (w) => overlap(w) >= 0.8 * Math.min(w.seconds, top.seconds),
    );
    const from = Math.min(...cluster.map((w) => w.start));
    const to = Math.max(...cluster.map((w) => w.start + w.seconds));

    const length = Math.min(slot.target, to - from);
    const inside = bestWindow(length, from, to);
    const anywhere = bestWindow(length);
    if (inside && anywhere && inside.watts >= 0.9 * anywhere.watts) best = inside;
  }

  // Ingen riktig insats: det bästa fönstret med protokollets längd, så att
  // coachen ser vad passet har – men markerat som osäkert.
  const fallback = best || slot.target > n ? null : bestWindow(slot.target);

  const chosen = best ?? fallback;
  if (!chosen) return null;
  const hr = heartRateIn(ride, chosen.start, chosen.seconds);
  return {
    slot,
    seconds: chosen.seconds,
    watts: Math.round(chosen.watts),
    heartRateAvg: hr.avg,
    heartRateMax: hr.max,
    date: ride.date,
    startsAt: chosen.start,
    rideLabel: ride.label,
    isolated: best !== null,
  };
}

/**
 * Bästa insatsen per längd över alla filer. En avgränsad insats går alltid
 * före ett bästa fönster; bland likvärdiga vinner högst effekt.
 */
export function bestEfforts(rides: Ride[], slots: Slot[]): (FoundEffort | null)[] {
  return slots.map((slot) => {
    const found = rides
      .map((ride) => findEffort(ride, slot))
      .filter((f): f is FoundEffort => f !== null);
    if (found.length === 0) return null;
    return found.reduce((a, b) =>
      a.isolated !== b.isolated ? (a.isolated ? a : b) : b.watts > a.watts ? b : a,
    );
  });
}
