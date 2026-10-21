/**
 * Durability: hur mycket av förmågan som finns kvar när arbetet redan har
 * gjorts.
 *
 * Bästa-kurvan säger vad adepten klarar utvilad. Men långa lopp avgörs efter
 * timmar av arbete, och trösklar och effekt sjunker olika mycket hos olika
 * idrottare (Maunder m.fl. 2021). Här räknas därför bästa medel över 1, 5 och
 * 20 minuter för insatser som *börjar* efter att en viss mängd arbete gjorts:
 * kJ för cykling med effekt, minuter i rörelse för löpning. Över en period
 * blir det en kurva – bästa 20 min utvilad, efter 20 kJ/kg, efter 40 kJ/kg –
 * och tappet mot utvilad är durability.
 *
 * Som bästa-kurvan visar den vad adepten *minst* klarar: ett pass utan hårda
 * insatser sent ger låga värden. Den blir bra först med lopp och långa pass
 * med avslutande kvalitet, och därför räknas hur många pass som bär varje
 * nivå.
 *
 * Modulen är ren, utan anrop, och tål både sekundserien vid uppladdningen och
 * den sparade, nedsamplade serien.
 */

export type DurabilityAxis = "kJ" | "min";

export type Durability = {
  axis: DurabilityAxis;
  /**
   * [efter, längd, värde]: bästa medel över `längd` sekunder (W, eller m/s)
   * för insatser som börjar efter att `efter` kJ (minuter) gjorts.
   */
  points: [number, number, number][];
};

/** Längderna som räknas: kort, VO₂max-nära och tröskelnära. */
export const DURABILITY_SPANS = [60, 300, 1200];

/** Stegen arbetet räknas i: var 250:e kJ, var 15:e minut. */
const STEP: Record<DurabilityAxis, number> = { kJ: 250, min: 15 };
const MAX_STEP: Record<DurabilityAxis, number> = { kJ: 8000, min: 360 };

/** Under det här räknas löpningen som stillastående, m/s. */
const MOVING_MS = 0.5;

/**
 * Durability ur en serie: tider i sekunder och värden (W för `kJ`, m/s för
 * `min`). Saknade värden räknas som noll – frirullning och stopp.
 */
export function durabilityFromSeries(
  t: number[],
  values: (number | null)[],
  axis: DurabilityAxis,
): Durability | null {
  const n = Math.min(t.length, values.length);
  if (n < 2) return null;
  const v = values.slice(0, n).map((x) => (x !== null && x > 0 ? x : 0));

  // Integralen av värdet och arbetsaxeln vid varje punkt.
  const integral = new Float64Array(n);
  const done = new Float64Array(n);
  for (let k = 0; k < n - 1; k += 1) {
    const dt = Math.max(t[k + 1] - t[k], 0);
    integral[k + 1] = integral[k] + v[k] * dt;
    done[k + 1] =
      done[k] +
      (axis === "kJ" ? (v[k] * dt) / 1000 : v[k] > MOVING_MS ? dt / 60 : 0);
  }

  const points: [number, number, number][] = [];
  for (const span of DURABILITY_SPANS) {
    // Bästa medel för varje start, och det bästa från varje start och framåt.
    const fromStart = new Float64Array(n).fill(-1);
    let e = 0;
    for (let i = 0; i < n; i += 1) {
      if (e < i) e = i;
      while (e < n && t[e] - t[i] < span) e += 1;
      if (e >= n) break;
      fromStart[i] = (integral[e] - integral[i]) / (t[e] - t[i]);
    }
    const bestFrom = new Float64Array(n).fill(-1);
    for (let i = n - 1; i >= 0; i -= 1) {
      bestFrom[i] = Math.max(fromStart[i], i + 1 < n ? bestFrom[i + 1] : -1);
    }

    let i0 = 0;
    for (let after = 0; after <= MAX_STEP[axis]; after += STEP[axis]) {
      while (i0 < n && done[i0] < after) i0 += 1;
      if (i0 >= n || bestFrom[i0] <= 0) break;
      const value = bestFrom[i0];
      points.push([
        after,
        span,
        axis === "kJ"
          ? Math.round(value * 10) / 10
          : Math.round(value * 1000) / 1000,
      ]);
    }
  }
  return points.length > 0 ? { axis, points } : null;
}

/** Ett pass med sin durability, för perioden. */
export type DurabilitySource = {
  id: string;
  performed_on: string;
  durability: Durability | null;
  /** Räknad ur den sparade, nedsamplade serien. */
  estimated?: boolean;
};

export type DurabilityLevel = {
  /** Nivån som den visas: kJ/kg, kJ eller minuter. */
  level: number;
  /** Steget i arbetsaxeln nivån läses ur. */
  after: number;
  /** Bästa per längd, med passet det kom ur. */
  best: Record<number, { value: number; id: string; date: string } | null>;
  /** Hur många pass som nådde nivån. */
  support: number;
};

export type DurabilityProfile = {
  axis: DurabilityAxis;
  /** "kJ/kg", "kJ" eller "min". */
  unit: string;
  levels: DurabilityLevel[];
};

/** Nivåerna som visas. kJ/kg när vikten finns, annars kJ. */
export function levelsFor(
  axis: DurabilityAxis,
  weightKg: number | null,
): { unit: string; levels: { level: number; after: number }[] } {
  if (axis === "min") {
    return {
      unit: "min",
      levels: [0, 30, 60, 90, 120, 150, 180].map((m) => ({
        level: m,
        after: m,
      })),
    };
  }
  if (weightKg && weightKg > 0) {
    return {
      unit: "kJ/kg",
      levels: [0, 10, 20, 30, 40, 50].map((l) => ({
        level: l,
        // Steget på eller över nivån: värdet är då inte bättre än det är.
        after: Math.ceil((l * weightKg) / STEP.kJ) * STEP.kJ,
      })),
    };
  }
  return {
    unit: "kJ",
    levels: [0, 1000, 2000, 3000, 4000].map((k) => ({ level: k, after: k })),
  };
}

/** Det bästa på varje nivå ur passen i perioden. */
export function durabilityProfile(
  sources: DurabilitySource[],
  axis: DurabilityAxis,
  weightKg: number | null,
): DurabilityProfile {
  const { unit, levels } = levelsFor(axis, weightKg);
  return {
    axis,
    unit,
    levels: levels.map(({ level, after }) => {
      const best: DurabilityLevel["best"] = {};
      for (const span of DURABILITY_SPANS) best[span] = null;
      let support = 0;
      for (const s of sources) {
        const d = s.durability;
        if (!d || d.axis !== axis) continue;
        const here = d.points.filter((p) => p[0] === after);
        if (here.length === 0) continue;
        support += 1;
        for (const [, span, value] of here) {
          const current = best[span];
          if (!current || value > current.value)
            best[span] = { value, id: s.id, date: s.performed_on };
        }
      }
      return { level, after, best, support };
    }),
  };
}

const sv = (v: number, digits = 0) => v.toFixed(digits).replace(".", ",");

/**
 * Vad profilen säger, i ord: tappet mot utvilad på 5 och 20 minuter, var det
 * passerar 5 %, och hur det ändrats mot perioden före. Bara nivåer som minst
 * ett pass nått räknas.
 */
export function durabilityReading(
  now: DurabilityProfile,
  before: DurabilityProfile | null,
  show: (value: number) => string,
): string[] {
  const lines: string[] = [];
  const at = (p: DurabilityProfile, span: number) =>
    p.levels
      .filter((l) => l.level > 0 && l.best[span])
      .map((l) => ({
        level: l.level,
        value: (l.best[span] as { value: number }).value,
        support: l.support,
      }));
  const label = (level: number) => `${sv(level)} ${now.unit}`;

  for (const span of [1200, 300]) {
    const fresh = now.levels[0]?.best[span]?.value;
    const deeper = at(now, span);
    if (!fresh || deeper.length === 0) continue;
    const name = span === 1200 ? "20 min" : "5 min";
    const deepest = deeper[deeper.length - 1];
    const pct = (deepest.value / fresh) * 100;
    const drop = deeper.find((d) => d.value / fresh < 0.95);
    lines.push(
      `Bästa ${name}: ${show(fresh)} utvilad, ${show(deepest.value)} efter ${label(deepest.level)} (${sv(pct)} %)${
        drop
          ? ` – tappet passerar 5 % efter ${label(drop.level)}.`
          : " – inom 5 % hela vägen."
      }${deepest.support < 3 ? ` Bara ${deepest.support === 1 ? "ett pass" : `${deepest.support} pass`} nådde ${label(deepest.level)}.` : ""}`,
    );

    if (before) {
      const freshBefore = before.levels[0]?.best[span]?.value;
      const then = at(before, span).find((d) => d.level === deepest.level);
      if (freshBefore && then) {
        const pctBefore = (then.value / freshBefore) * 100;
        const diff = pct - pctBefore;
        if (Math.abs(diff) >= 2) {
          lines.push(
            `Efter ${label(deepest.level)} ${diff > 0 ? "håller" : "tappar"} ${name} ${diff > 0 ? "bättre" : "mer"} än perioden före: ${sv(pct)} % mot ${sv(pctBefore)} % av utvilad.`,
          );
        }
      }
    }
  }
  return lines;
}
