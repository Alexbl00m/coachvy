/**
 * Referensnivåer för den metabola profilen: grupper som Motionär, Ambitiös
 * och Elit, med typiska värden per mått och kön. Adeptens testvärden läggs
 * mot dem – individ mot referens, aldrig adept mot adept.
 *
 * Det finns ingen publicerad standardtabell för VLamax, FatMax eller
 * utnyttjandegrad på samma sätt som Coggans för effekt. Utgångsvärdena här är
 * därför Coachvys egna, satta ur de spann som brukar anges för
 * uthållighetsidrottare på olika nivå, och märkta så i gränssnittet. Coachen
 * byter dem mot sina egna – till exempel en grupp för svensk elit ur sina
 * labbdata – under Inställningar.
 *
 * Grupperna står i ordning från lägst till högst nivå. Ett mått kan gå åt
 * båda hållen: VLamax är lägre hos uthålliga elitatleter, så där räknas
 * riktningen fram ur grupperna i stället för att antas.
 *
 * Modulen är ren.
 */

import type { Sex } from "./coggan";

export type MetricKey =
  | "vo2max"
  | "mapPerKg"
  | "vlamax"
  | "sprintPerKg"
  | "cpPerKg"
  | "lt2PerKg"
  | "fatmaxPerKg"
  | "lt2Utilisation";

export type MetricDef = {
  key: MetricKey;
  label: string;
  /** Kort etikett för diagrammets kolumner. */
  short: string;
  unit: string;
  digits: number;
  /** Vad måttet säger, för förklaringen. */
  meaning: string;
  /** Måttet mitt i en mening: "tröskeln (LT2)", "VLamax". */
  phrase: string;
};

export const METRICS: MetricDef[] = [
  {
    key: "vo2max",
    label: "VO2max",
    short: "VO2max",
    unit: "ml/kg/min",
    digits: 1,
    meaning: "motorns storlek",
    phrase: "VO2max",
  },
  {
    key: "mapPerKg",
    label: "Effekt vid VO2max",
    short: "P VO2max",
    unit: "W/kg",
    digits: 2,
    meaning: "toppeffekten i stegtestet",
    phrase: "effekten vid VO2max",
  },
  {
    key: "vlamax",
    label: "VLamax",
    short: "VLamax",
    unit: "mmol/l/s",
    digits: 2,
    meaning: "glykolytisk kapacitet",
    phrase: "VLamax",
  },
  {
    key: "sprintPerKg",
    label: "Sprint 20 s",
    short: "Sprint",
    unit: "W/kg",
    digits: 1,
    meaning: "sprintkraft",
    phrase: "sprinten på 20 s",
  },
  {
    key: "cpPerKg",
    label: "Critical power",
    short: "CP",
    unit: "W/kg",
    digits: 2,
    meaning: "gränsen mot det svåra området",
    phrase: "CP",
  },
  {
    key: "lt2PerKg",
    label: "Tröskel (LT2)",
    short: "LT2",
    unit: "W/kg",
    digits: 2,
    meaning: "den anaeroba tröskeln",
    phrase: "tröskeln (LT2)",
  },
  {
    key: "fatmaxPerKg",
    label: "FatMax",
    short: "FatMax",
    unit: "W/kg",
    digits: 2,
    meaning: "högst fettförbränning",
    phrase: "FatMax",
  },
  {
    key: "lt2Utilisation",
    label: "Utnyttjandegrad vid LT2",
    short: "LT2 % VO2",
    unit: "% av VO2max",
    digits: 0,
    meaning: "hur stor del av motorn tröskeln använder",
    phrase: "utnyttjandegraden vid LT2",
  },
];

export const metricByKey = (key: MetricKey) =>
  METRICS.find((m) => m.key === key) as MetricDef;

export type GroupValues = Partial<Record<MetricKey, number>>;

export type ReferenceGroup = {
  id: string;
  name: string;
  values: Record<Sex, GroupValues>;
};

export type ReferenceLevels = {
  groups: ReferenceGroup[];
  /** true när coachen inte satt egna värden. */
  isDefault: boolean;
};

export const MAX_GROUPS = 5;

/** Coachvys utgångsvärden, för uthållighetsinriktade cyklister. */
export const DEFAULT_GROUPS: ReferenceGroup[] = [
  {
    id: "motionar",
    name: "Motionär",
    values: {
      man: {
        vo2max: 48,
        mapPerKg: 3.8,
        vlamax: 0.6,
        sprintPerKg: 9,
        cpPerKg: 3,
        lt2PerKg: 2.7,
        fatmaxPerKg: 1.6,
        lt2Utilisation: 70,
      },
      kvinna: {
        vo2max: 40,
        mapPerKg: 3.2,
        vlamax: 0.5,
        sprintPerKg: 7.5,
        cpPerKg: 2.5,
        lt2PerKg: 2.3,
        fatmaxPerKg: 1.3,
        lt2Utilisation: 70,
      },
    },
  },
  {
    id: "ambitios",
    name: "Ambitiös",
    values: {
      man: {
        vo2max: 60,
        mapPerKg: 4.9,
        vlamax: 0.5,
        sprintPerKg: 11,
        cpPerKg: 4,
        lt2PerKg: 3.7,
        fatmaxPerKg: 2.4,
        lt2Utilisation: 78,
      },
      kvinna: {
        vo2max: 51,
        mapPerKg: 4.2,
        vlamax: 0.42,
        sprintPerKg: 9,
        cpPerKg: 3.4,
        lt2PerKg: 3.1,
        fatmaxPerKg: 2,
        lt2Utilisation: 78,
      },
    },
  },
  {
    id: "elit",
    name: "Elit",
    values: {
      man: {
        vo2max: 72,
        mapPerKg: 6.3,
        vlamax: 0.38,
        sprintPerKg: 13.5,
        cpPerKg: 5.4,
        lt2PerKg: 5,
        fatmaxPerKg: 3.3,
        lt2Utilisation: 85,
      },
      kvinna: {
        vo2max: 62,
        mapPerKg: 5.4,
        vlamax: 0.32,
        sprintPerKg: 11,
        cpPerKg: 4.7,
        lt2PerKg: 4.4,
        fatmaxPerKg: 2.8,
        lt2Utilisation: 85,
      },
    },
  },
];

const KEYS = new Set<string>(METRICS.map((m) => m.key));

function cleanValues(raw: unknown): GroupValues {
  const out: GroupValues = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!KEYS.has(key)) continue;
    const n =
      typeof value === "string" ? Number(value.replace(",", ".")) : value;
    if (typeof n === "number" && Number.isFinite(n) && n > 0 && n < 1000) {
      out[key as MetricKey] = n;
    }
  }
  return out;
}

/**
 * Coachens sparade grupper, kontrollerade, eller utgångsvärdena. Det som
 * kommer ur databasen litas inte på: allt som inte är ett rimligt tal på ett
 * känt mått faller bort.
 */
export function parseReferenceLevels(raw: unknown): ReferenceLevels {
  const groups: ReferenceGroup[] = [];
  const list =
    raw &&
    typeof raw === "object" &&
    Array.isArray((raw as { groups?: unknown }).groups)
      ? (raw as { groups: unknown[] }).groups
      : null;
  if (!list) return { groups: DEFAULT_GROUPS, isDefault: true };

  const seen = new Set<string>();
  for (const item of list.slice(0, MAX_GROUPS)) {
    if (!item || typeof item !== "object") continue;
    const g = item as Record<string, unknown>;
    const name = typeof g.name === "string" ? g.name.trim().slice(0, 30) : "";
    let id =
      typeof g.id === "string" && /^[a-z0-9-]{1,40}$/.test(g.id) ? g.id : "";
    if (!name) continue;
    if (!id || seen.has(id)) id = `grupp-${groups.length + 1}`;
    seen.add(id);
    const values = (g.values ?? {}) as Record<string, unknown>;
    groups.push({
      id,
      name,
      values: {
        man: cleanValues(values.man),
        kvinna: cleanValues(values.kvinna),
      },
    });
  }
  return groups.length > 0
    ? { groups, isDefault: false }
    : { groups: DEFAULT_GROUPS, isDefault: true };
}

/**
 * Var ett värde ligger bland grupperna: 0 är den första gruppen, 1 nästa och
 * så vidare, linjärt mellan dem. Utanför grupperna förlängs närmaste sträcka,
 * högst en halv grupp åt varje håll. Kräver minst två grupper med värde.
 */
export function levelPosition(
  value: number,
  groups: ReferenceGroup[],
  sex: Sex,
  key: MetricKey,
): number | null {
  const points = groups
    .map((g, index) => ({ index, value: g.values[sex][key] }))
    .filter(
      (p): p is { index: number; value: number } => p.value !== undefined,
    );
  if (points.length < 2) return null;

  // Vänd mått som sjunker med nivån, så att högre position alltid är "mer".
  const sign = points[points.length - 1].value >= points[0].value ? 1 : -1;
  const v = value * sign;
  const ps = points.map((p) => ({ index: p.index, value: p.value * sign }));

  const lerp = (a: (typeof ps)[number], b: (typeof ps)[number]) =>
    b.value === a.value
      ? a.index
      : a.index + ((v - a.value) / (b.value - a.value)) * (b.index - a.index);

  const first = ps[0];
  const last = ps[ps.length - 1];
  if (v <= first.value) return Math.max(first.index - 0.5, lerp(first, ps[1]));
  if (v >= last.value)
    return Math.min(last.index + 0.5, lerp(ps[ps.length - 2], last));
  for (let i = 0; i < ps.length - 1; i += 1) {
    if (v <= ps[i + 1].value) return lerp(ps[i], ps[i + 1]);
  }
  return null;
}

/** true när lägre är bättre för måttet, räknat ur grupperna. */
export function lowerIsHigherLevel(
  groups: ReferenceGroup[],
  sex: Sex,
  key: MetricKey,
): boolean {
  const values = groups
    .map((g) => g.values[sex][key])
    .filter((v): v is number => v !== undefined);
  return values.length >= 2 && values[values.length - 1] < values[0];
}
