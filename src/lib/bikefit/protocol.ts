/**
 * Det som hör till en hel bikefit utöver vinklarna: samtalet före, kroppens
 * mått, funktionstesterna av cykeln, och vad som hittades och gjordes per
 * område. Upplägget följer hur en fit faktiskt går till – intervju, mätning
 * och tester av cykeln, sedan på cykeln – och samma uppgifter som en
 * fitrapport från en etablerad fitter brukar innehålla. Ren modul: listorna
 * och tvätten av indata.
 */

// ---------------------------------------------------------------------------
// Samtalet
// ---------------------------------------------------------------------------

export const INTAKE = [
  {
    key: "purpose",
    label: "Syfte med fiten",
    hint: "Ny cykel, besvär, ett lopp, första gången på aerobåge …",
  },
  { key: "goals", label: "Mål och tävlingar", hint: "Säsongens viktiga lopp." },
  {
    key: "background",
    label: "Cykelbakgrund",
    hint: "År på cykeln, pass och timmar i veckan, trainer eller ute.",
  },
  {
    key: "other_sports",
    label: "Annan träning",
    hint: "Löpning, simning, styrka, rörlighet.",
  },
  {
    key: "discomfort",
    label: "Besvär på cykeln",
    hint: "Var, när i passet och hur länge.",
  },
  { key: "injuries", label: "Skador, tidigare och nu" },
] as const;
export type IntakeKey = (typeof INTAKE)[number]["key"];
export type Intake = Partial<Record<IntakeKey, string>>;

// ---------------------------------------------------------------------------
// Kroppens mått
// ---------------------------------------------------------------------------

export type BodyMeasure = {
  key: string;
  label: string;
  unit: "mm" | "kg" | "cm";
  /** Mäts på båda sidor: nycklarna blir key_l och key_r. */
  sides?: boolean;
  hint?: string;
  min: number;
  max: number;
};

export const BODY: BodyMeasure[] = [
  { key: "height", label: "Längd", unit: "cm", min: 100, max: 230 },
  { key: "weight", label: "Vikt", unit: "kg", min: 25, max: 200 },
  {
    key: "inseam",
    label: "Innerbenslängd",
    unit: "mm",
    hint: "Golvet upp till grenen, barfota.",
    min: 500,
    max: 1200,
  },
  {
    key: "thigh",
    label: "Lårben",
    unit: "mm",
    sides: true,
    hint: "Höftleden (trochanter) till knäleden. Ger millimeter per grad.",
    min: 200,
    max: 700,
  },
  {
    key: "shank",
    label: "Underben",
    unit: "mm",
    sides: true,
    hint: "Knäleden till fotleden (malleolen).",
    min: 200,
    max: 700,
  },
  {
    key: "torso",
    label: "Bål",
    unit: "mm",
    hint: "Grenen till fossa jugularis.",
    min: 300,
    max: 1000,
  },
  {
    key: "arm",
    label: "Arm",
    unit: "mm",
    sides: true,
    hint: "Axelleden till knogarna.",
    min: 400,
    max: 900,
  },
  {
    key: "shoulder_width",
    label: "Axelbredd",
    unit: "mm",
    hint: "Mellan axelknölarna (acromion).",
    min: 250,
    max: 600,
  },
  {
    key: "sit_bones",
    label: "Sittbensbredd",
    unit: "mm",
    hint: "Mitt till mitt mellan sittbenen. Styr sadelns bredd.",
    min: 70,
    max: 200,
  },
  {
    key: "foot",
    label: "Fot",
    unit: "mm",
    sides: true,
    hint: "Hälen till stortån.",
    min: 180,
    max: 340,
  },
];

export type Body = Record<string, number>;

/** Alla nycklar ett kroppsmått sparas under. */
export const bodyKeys = (m: BodyMeasure) =>
  m.sides ? [`${m.key}_l`, `${m.key}_r`] : [m.key];

/**
 * Benlängderna att räkna sadelflytten med: den filmade sidans om den finns,
 * annars medelvärdet av de sidor som är mätta.
 */
export function legsFromBody(
  body: Body,
  side: "left" | "right" | null = null,
): { thighMm: number; shankMm: number } | null {
  const pick = (key: string) => {
    const l = body[`${key}_l`];
    const r = body[`${key}_r`];
    if (side === "left" && l) return l;
    if (side === "right" && r) return r;
    const both = [l, r].filter((v): v is number => Boolean(v));
    return both.length ? both.reduce((a, b) => a + b, 0) / both.length : null;
  };
  const thighMm = pick("thigh");
  const shankMm = pick("shank");
  return thighMm && shankMm
    ? { thighMm: Math.round(thighMm), shankMm: Math.round(shankMm) }
    : null;
}

/** Skillnaden mellan sidorna, när båda är mätta. */
export function sideDifference(body: Body, key: string): number | null {
  const l = body[`${key}_l`];
  const r = body[`${key}_r`];
  return l && r ? l - r : null;
}

// ---------------------------------------------------------------------------
// Funktionstester av cykeln
// ---------------------------------------------------------------------------

export type ScreeningTest = {
  key: string;
  label: string;
  /** Vad testet säger något om, kort. */
  about: string;
  unit: "°" | "s" | "mm" | null;
  sides: boolean;
  hint?: string;
};

export const SCREENING: ScreeningTest[] = [
  {
    key: "thomas",
    label: "Thomas test",
    about: "Höftböjare och raka lårmuskeln",
    unit: "°",
    sides: true,
    hint: "Knävinkeln i vila; skriv om låret ligger plant.",
  },
  {
    key: "leg_extension",
    label: "Aktiv knäextension, höften i 90°",
    about: "Baksida lår och vader",
    unit: "°",
    sides: true,
  },
  {
    key: "hip_flexion",
    label: "Max höftflexion",
    about: "Hur stängd höften kan vara i nedre läget",
    unit: "°",
    sides: true,
  },
  {
    key: "sit_reach",
    label: "Sittande framåtfällning",
    about: "Bäckenets rotation framåt – hur lågt fram positionen kan vara",
    unit: "°",
    sides: false,
  },
  {
    key: "single_leg_squat",
    label: "Enbensknäböj",
    about: "Knäts och höftens kontroll",
    unit: null,
    sides: true,
    hint: "Kommentera knäts spår och höften.",
  },
  {
    key: "single_leg_bridge",
    label: "Enbensbrygga",
    about: "Sätesmuskler och bäckenets stabilitet",
    unit: "s",
    sides: true,
  },
  {
    key: "plank",
    label: "Planka",
    about: "Bålens uthållighet",
    unit: "s",
    sides: false,
  },
  {
    key: "shoulder_mobility",
    label: "Axelrörlighet",
    about: "Bröst, skulderblad, att nå framåt avspänt",
    unit: null,
    sides: false,
  },
  {
    key: "foot_rotation",
    label: "Fotens rotation, stående",
    about: "Klossarnas vinkel",
    unit: "°",
    sides: true,
    hint: "Utåt positivt.",
  },
  {
    key: "leg_length",
    label: "Benlängdsskillnad",
    about: "Kilar eller distans under klossen",
    unit: "mm",
    sides: false,
    hint: "Längre vänster positivt.",
  },
];

export type ScreeningValue = {
  l?: number;
  r?: number;
  value?: number;
  note?: string;
};
export type Screening = Record<string, ScreeningValue>;

// ---------------------------------------------------------------------------
// Fynd och åtgärder per område
// ---------------------------------------------------------------------------

export const AREAS = [
  {
    key: "cleats",
    label: "Klossar och fötter",
    hint: "Läge, vinkel, kilar, inlägg.",
  },
  { key: "saddle", label: "Sadel", hint: "Höjd, setback, lutning, modell." },
  {
    key: "cockpit",
    label: "Styre och armstöd",
    hint: "Reach, drop, bredd, vinklar.",
  },
  {
    key: "technique",
    label: "Teknik",
    hint: "Trampteknik, hållning, att vänja sig.",
  },
  {
    key: "exercises",
    label: "Övningar att arbeta med",
    hint: "Rörlighet och styrka som låter positionen utvecklas.",
  },
] as const;
export type AreaKey = (typeof AREAS)[number]["key"];
export type Findings = Partial<Record<AreaKey, string>>;

// ---------------------------------------------------------------------------
// Tvätt av indata
// ---------------------------------------------------------------------------

const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

const text = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

export function cleanIntake(input: Record<string, unknown>): Intake {
  const out: Intake = {};
  for (const f of INTAKE) {
    const v = text(input[f.key], 2000);
    if (v) out[f.key] = v;
  }
  return out;
}

export function cleanFindings(input: Record<string, unknown>): Findings {
  const out: Findings = {};
  for (const a of AREAS) {
    const v = text(input[a.key], 2000);
    if (v) out[a.key] = v;
  }
  return out;
}

/** Kroppsmåtten, eller felet för det första som ligger utanför rimligt. */
export function cleanBody(
  input: Record<string, unknown>,
): { ok: true; body: Body } | { ok: false; error: string } {
  const body: Body = {};
  for (const m of BODY)
    for (const key of bodyKeys(m)) {
      const v = input[key];
      if (v === null || v === undefined || v === "") continue;
      if (!finite(v) || v < m.min || v > m.max)
        return {
          ok: false,
          error: `${m.label} ska ligga mellan ${m.min} och ${m.max} ${m.unit}.`,
        };
      body[key] = Math.round(v * 10) / 10;
    }
  return { ok: true, body };
}

export function cleanScreening(input: Record<string, unknown>): Screening {
  const out: Screening = {};
  for (const t of SCREENING) {
    const raw = input[t.key];
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const v: ScreeningValue = {};
    if (t.unit) {
      for (const k of t.sides ? (["l", "r"] as const) : (["value"] as const)) {
        const n = r[k];
        if (finite(n) && Math.abs(n) <= 1000) v[k] = Math.round(n * 10) / 10;
      }
    }
    const note = text(r.note, 500);
    if (note) v.note = note;
    if (Object.keys(v).length) out[t.key] = v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Uppföljningen inom fiten
// ---------------------------------------------------------------------------

/**
 * När vinklarna mättes före ändringarna och sadeln sedan flyttades: hur
 * flytten förhåller sig till förslaget, så att rapporten inte föreslår det
 * som redan är gjort. Null när det inte finns något att säga.
 */
export function saddleFollowUp(input: {
  anglesAt: "före" | "efter";
  suggestedMm: number | null;
  before: unknown;
  after: unknown;
}): string | null {
  if (input.anglesAt !== "före") return null;
  const moved =
    typeof input.before === "number" && typeof input.after === "number"
      ? Math.round(input.after - input.before)
      : null;
  if (moved === null || moved === 0)
    return input.suggestedMm === null
      ? null
      : "Vinklarna mättes före ändringarna, och sadelhöjden ändrades inte vid fiten.";
  const dir = moved > 0 ? "höjdes" : "sänktes";
  const suggestion =
    input.suggestedMm === null
      ? ""
      : Math.sign(input.suggestedMm) === Math.sign(moved)
        ? ` av föreslagna ${Math.abs(Math.round(input.suggestedMm))} mm`
        : `, åt andra hållet än förslaget`;
  return `Vinklarna mättes före ändringarna. Sadeln ${dir} sedan ${Math.abs(moved)} mm${suggestion} – filma igen för att se var knät hamnade.`;
}
