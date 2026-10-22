/**
 * Mallarna för en bikefit per gren och bedömningen av mätvärdena.
 *
 * Bara knäböjningen i nedre dödläget bedöms mot ett band som är väl belagt
 * (30–40°). Bålens lutning och armbågens böjning bedöms mot erfarenhetsvärden
 * ur praktiken, inte mot en belagd norm, och det står vid värdet. Axel- och
 * höftvinkel mäts och visas men bedöms inte: studien som brukar citeras (112°
 * i axeln, 77° i höften) och bike-fit-guidernas 80–95° och 85–110° definierar
 * ledpunkten olika, och en posemodell sätter den på ett tredje sätt. En färg
 * där vore ett påstående, inte en mätning.
 *
 * Färgen och texten använder samma gränser. Ett handyvideo löser upp ungefär
 * två till tre grader; ett värde inom 2,5° utanför bandet är därför ett
 * gränsfall som inte ger någon rekommendation. Först utanför det röd färg –
 * och först då ett förslag att flytta sadeln.
 *
 * Coachen kan ändra banden på varje fit; mallens band är utgångsläget.
 */

import { saddleChange } from "./geometry";

export type Discipline = "landsväg" | "gravel" | "tempo" | "mtb";

export const DISCIPLINES: Discipline[] = ["landsväg", "gravel", "tempo", "mtb"];

export type Band = { min: number; max: number };

export type Bands = {
  /** Knäböjning i nedre dödläget, grader (180° minus knävinkeln). */
  knee: Band;
  /** Bålens lutning mot vågrätt, grader. */
  trunk: Band;
  /** Armbågens böjning, grader (180° minus armbågsvinkeln). */
  elbow: Band;
};

/** Var på cykeln ett mått hör hemma, för att gruppera formuläret. */
export type MeasureGroup = "sadel" | "styre" | "aero" | "vev" | "ram";

export const MEASURE_GROUPS: Record<MeasureGroup, string> = {
  sadel: "Sadel",
  styre: "Styre",
  aero: "Aerobåge",
  vev: "Vev, pedaler och skor",
  ram: "Läget mot vevlagret",
};

/** Ett mått coachen fyller i om cykeln, före och efter fiten. */
export type BikeMeasure = {
  key: string;
  label: string;
  unit: "mm" | "°" | "text";
  group: MeasureGroup;
  hint?: string;
};

export type Template = {
  discipline: Discipline;
  label: string;
  /** Vad grenen kräver av positionen, en mening. */
  focus: string;
  bands: Bands;
  measures: BikeMeasure[];
  /** Saker att titta efter som en sidovideo inte mäter. */
  checklist: string[];
};

const SADDLE: BikeMeasure[] = [
  {
    key: "saddle_height",
    label: "Sadelhöjd",
    unit: "mm",
    group: "sadel",
    hint: "Vevlagrets mitt till sadelns ovansida, längs sadelröret.",
  },
  {
    key: "saddle_setback",
    label: "Sadelns setback",
    unit: "mm",
    group: "sadel",
    hint: "Sadelnosen bakom vevlagret, vågrätt. Negativt framför.",
  },
  {
    key: "saddle_tilt",
    label: "Sadelns lutning",
    unit: "°",
    group: "sadel",
    hint: "Nosen nedåt negativt.",
  },
  {
    key: "saddle_model",
    label: "Sadel",
    unit: "text",
    group: "sadel",
    hint: "Modell och bredd.",
  },
  {
    key: "seatpost_offset",
    label: "Sadelstolpens offset",
    unit: "mm",
    group: "sadel",
  },
];

const DRIVE: BikeMeasure[] = [
  { key: "crank_length", label: "Vevlängd", unit: "mm", group: "vev" },
  { key: "chainrings", label: "Klinga", unit: "text", group: "vev" },
  { key: "pedals", label: "Pedaler", unit: "text", group: "vev" },
  {
    key: "shoes",
    label: "Skor",
    unit: "text",
    group: "vev",
    hint: "Märke, modell och storlek.",
  },
  {
    key: "cleats",
    label: "Klossar",
    unit: "text",
    group: "vev",
    hint: "Läge, vinkel, kilar, distanser och inlägg.",
  },
];

/** Sadelns och greppets läge mot vevlagret: följer med till en ny ram. */
const FRAME: BikeMeasure[] = [
  {
    key: "saddle_x",
    label: "Sadel X",
    unit: "mm",
    group: "ram",
    hint: "Vågrätt från vevlagret till sadelns mätpunkt.",
  },
  {
    key: "saddle_y",
    label: "Sadel Y",
    unit: "mm",
    group: "ram",
    hint: "Lodrätt från vevlagret till sadelns ovansida.",
  },
  {
    key: "frame_size",
    label: "Ram",
    unit: "text",
    group: "ram",
    hint: "Modell och storlek, stack och reach.",
  },
];

const ROAD_COCKPIT: BikeMeasure[] = [
  {
    key: "saddle_to_bar_reach",
    label: "Sadelnos till styrets mitt",
    unit: "mm",
    group: "styre",
  },
  {
    key: "saddle_to_hoods",
    label: "Sadelnos till bromsgrepp",
    unit: "mm",
    group: "styre",
  },
  {
    key: "saddle_to_bar_drop",
    label: "Fall sadel till styre",
    unit: "mm",
    group: "styre",
    hint: "Sadelns ovansida ned till styrets ovansida.",
  },
  {
    key: "stem",
    label: "Styrstam",
    unit: "text",
    group: "styre",
    hint: "Längd och vinkel, t.ex. 110 / −6°.",
  },
  {
    key: "spacers",
    label: "Distanser under stammen",
    unit: "mm",
    group: "styre",
  },
  {
    key: "bar_model",
    label: "Styre",
    unit: "text",
    group: "styre",
    hint: "Modell, reach och drop.",
  },
  {
    key: "bar_width",
    label: "Styrbredd",
    unit: "mm",
    group: "styre",
    hint: "Mitt till mitt i ovankant.",
  },
  { key: "bar_angle", label: "Styrets vinkel", unit: "°", group: "styre" },
  { key: "hoods", label: "Bromsgreppens läge", unit: "text", group: "styre" },
];

const AERO: BikeMeasure[] = [
  {
    key: "pad_stack",
    label: "Fall sadel till armstöd",
    unit: "mm",
    group: "aero",
    hint: "Sadelns ovansida ned till armstödens ovansida.",
  },
  {
    key: "pad_reach",
    label: "Sadelnos till armstöd",
    unit: "mm",
    group: "aero",
    hint: "Sadelnosen fram till armstödens mitt.",
  },
  {
    key: "pad_x",
    label: "Armstöd, reach från vevlagret",
    unit: "mm",
    group: "ram",
    hint: "Vågrätt från vevlagret till armstödens mitt.",
  },
  {
    key: "pad_y",
    label: "Armstöd, stack från vevlagret",
    unit: "mm",
    group: "ram",
    hint: "Lodrätt från vevlagret till armstödens ovansida.",
  },
  {
    key: "pad_width",
    label: "Armstöd, bredd",
    unit: "mm",
    group: "aero",
    hint: "Mitt till mitt.",
  },
  {
    key: "pad_to_grip",
    label: "Armstöd till grepp",
    unit: "mm",
    group: "aero",
    hint: "Armstödens mitt fram till växelreglaget.",
  },
  {
    key: "extension",
    label: "Förlängare",
    unit: "text",
    group: "aero",
    hint: "Modell och form.",
  },
  {
    key: "extension_angle",
    label: "Förlängarnas vinkel",
    unit: "°",
    group: "aero",
  },
  {
    key: "extension_width",
    label: "Förlängarnas bredd",
    unit: "mm",
    group: "aero",
    hint: "Mitt till mitt.",
  },
  {
    key: "saddle_to_basebar_drop",
    label: "Fall sadel till basbåge",
    unit: "mm",
    group: "aero",
  },
  { key: "basebar_width", label: "Basbågens bredd", unit: "mm", group: "aero" },
  {
    key: "stem",
    label: "Styrstam",
    unit: "text",
    group: "aero",
    hint: "Längd och vinkel.",
  },
  {
    key: "spacers",
    label: "Distanser",
    unit: "mm",
    group: "aero",
    hint: "Under stammen och under armstöden.",
  },
];

const MTB_COCKPIT: BikeMeasure[] = [
  { key: "bar_width", label: "Styrbredd", unit: "mm", group: "styre" },
  {
    key: "bar_model",
    label: "Styre",
    unit: "text",
    group: "styre",
    hint: "Rise och backsweep.",
  },
  { key: "stem", label: "Styrstam", unit: "text", group: "styre" },
  {
    key: "saddle_to_grips_drop",
    label: "Fall sadel till grepp",
    unit: "mm",
    group: "styre",
  },
  {
    key: "saddle_to_grips_reach",
    label: "Sadelnos till grepp",
    unit: "mm",
    group: "styre",
  },
  { key: "levers", label: "Bromsgreppens läge", unit: "text", group: "styre" },
  {
    key: "dropper",
    label: "Sadelstolpe",
    unit: "text",
    group: "sadel",
    hint: "Dropper och slaglängd.",
  },
];

export const TEMPLATES: Record<Discipline, Template> = {
  landsväg: {
    discipline: "landsväg",
    label: "Landsväg",
    focus:
      "Effektiv och hållbar i timmar: sträckt men inte låst knä, bålen runt 45° och avspända armar.",
    bands: {
      knee: { min: 30, max: 40 },
      trunk: { min: 40, max: 50 },
      elbow: { min: 15, max: 30 },
    },
    measures: [...SADDLE, ...ROAD_COCKPIT, ...DRIVE, ...FRAME],
    checklist: [
      "Bäckenet stilla på sadeln – ingen gungning i sidled.",
      "Hälen faller inte under pedalen i nedre dödläget.",
      "Axlar avspända, inte uppdragna mot öronen.",
    ],
  },
  gravel: {
    discipline: "gravel",
    label: "Gravel",
    focus:
      "Kontroll och komfort på ojämnt underlag: lite mer upprätt än landsväg, gott om rörelse i armarna.",
    bands: {
      knee: { min: 30, max: 40 },
      trunk: { min: 45, max: 55 },
      elbow: { min: 15, max: 30 },
    },
    measures: [
      ...SADDLE,
      ...ROAD_COCKPIT,
      ...DRIVE,
      { key: "tyre_width", label: "Däckbredd", unit: "mm", group: "vev" },
      ...FRAME,
    ],
    checklist: [
      "Händerna når bromsarna i nedre greppet utan att sträcka armarna.",
      "Tyngden går att flytta bakåt i utförsåkning.",
      "Bäckenet stilla på sadeln.",
    ],
  },
  tempo: {
    discipline: "tempo",
    label: "Tempo / triathlon",
    focus:
      "Låg och smal mot vinden men hållbar hela loppet – och i triathlon att kunna springa efteråt.",
    bands: {
      knee: { min: 30, max: 40 },
      trunk: { min: 5, max: 20 },
      // På aerobågarna: överarm mot underarm runt 90°.
      elbow: { min: 75, max: 105 },
    },
    measures: [...SADDLE, ...AERO, ...DRIVE, ...FRAME],
    checklist: [
      "Huvudet går att hålla framåtriktat utan att nacken värker.",
      "Höften öppen nog att trampa med full kraft i positionen.",
      "Positionen hålls hela loppets längd, inte bara i ett test.",
    ],
  },
  mtb: {
    discipline: "mtb",
    label: "Mountainbike",
    focus:
      "Rörlighet och kontroll: mer upprätt, bredare grepp, och en sadelhöjd som gäller sittande trampande.",
    bands: {
      knee: { min: 30, max: 40 },
      trunk: { min: 45, max: 60 },
      elbow: { min: 15, max: 35 },
    },
    measures: [...SADDLE, ...MTB_COCKPIT, ...DRIVE, ...FRAME],
    checklist: [
      "Sadelhöjden gäller med droppern helt uppe.",
      "Bromsgreppen nås med ett finger utan att vrida handleden.",
      "Positionen tillåter att flytta vikten fritt i stående.",
    ],
  },
};

// ---------------------------------------------------------------------------
// Bedömningen
// ---------------------------------------------------------------------------

/** Så noggrant ett mobilvideo löser upp en vinkel, grader. */
export const TOLERANCE = 2.5;

/** Standardben när varken video eller coachen gett egna, mm. */
export const DEFAULT_THIGH_MM = 430;
export const DEFAULT_SHANK_MM = 440;

export type Verdict = "grön" | "gul" | "röd";

export type Assessed = {
  value: number | null;
  band: Band | null;
  verdict: Verdict | null;
  /** "bra", "gränsfall", "för låg sadel" … eller "ingen bedömning". */
  label: string;
  /** Vad bandet bygger på. */
  basis: "belagt" | "erfarenhetsvärde" | "ingen bedömning";
};

export function verdictFor(value: number, band: Band): Verdict {
  if (value >= band.min && value <= band.max) return "grön";
  if (value >= band.min - TOLERANCE && value <= band.max + TOLERANCE)
    return "gul";
  return "röd";
}

export type FitValues = {
  knee: number | null;
  trunk: number | null;
  elbow: number | null;
  shoulder: number | null;
  hip: number | null;
};

export type Assessment = {
  knee: Assessed;
  trunk: Assessed;
  elbow: Assessed;
  shoulder: Assessed;
  hip: Assessed;
  /** Sadelflytt i mm (positivt uppåt) när knät är rött; annars null. */
  saddleMm: number | null;
  /** Millimeter per grad med de ben som användes. */
  mmPerDegree: number | null;
  /** Varifrån benlängderna kom. */
  legSource: "video" | "coach" | "standard";
  /** Resultatet i en mening. */
  sentence: string;
};

const sv = (v: number, d = 1) => v.toFixed(d).replace(".", ",");

export function assessFit(
  values: FitValues,
  bands: Bands,
  legs: {
    thighMm: number | null;
    shankMm: number | null;
    source?: "video" | "coach";
  },
): Assessment {
  const thigh = legs.thighMm ?? DEFAULT_THIGH_MM;
  const shank = legs.shankMm ?? DEFAULT_SHANK_MM;
  const legSource =
    legs.thighMm && legs.shankMm ? (legs.source ?? "video") : "standard";

  const judge = (
    value: number | null,
    band: Band,
    basis: Assessed["basis"],
    labels: { low: string; high: string },
  ): Assessed => {
    if (value === null)
      return { value, band, verdict: null, label: "inte mätbart", basis };
    const verdict = verdictFor(value, band);
    const label =
      verdict === "grön"
        ? "inom bandet"
        : verdict === "gul"
          ? "gränsfall"
          : value > band.max
            ? labels.high
            : labels.low;
    return { value, band, verdict, label, basis };
  };
  const unjudged = (value: number | null): Assessed => ({
    value,
    band: null,
    verdict: null,
    label: value === null ? "inte mätbart" : "ingen bedömning",
    basis: "ingen bedömning",
  });

  const knee = judge(values.knee, bands.knee, "belagt", {
    low: "sadeln för hög",
    high: "sadeln för låg",
  });
  const trunk = judge(values.trunk, bands.trunk, "erfarenhetsvärde", {
    low: "lägre än bandet",
    high: "mer upprätt än bandet",
  });
  const elbow = judge(values.elbow, bands.elbow, "erfarenhetsvärde", {
    low: "rakare än bandet",
    high: "mer böjd än bandet",
  });

  const center = (bands.knee.min + bands.knee.max) / 2;
  let saddleMm: number | null = null;
  let sentence: string;
  const perDegree =
    values.knee !== null
      ? (saddleChange(thigh, shank, values.knee, values.knee - 1) +
          saddleChange(thigh, shank, values.knee + 1, values.knee)) /
        2
      : null;

  if (values.knee === null) {
    sentence =
      "Knäböjningen i nedre dödläget gick inte att mäta säkert – ingen rekommendation för sadelhöjden.";
  } else if (knee.verdict === "röd") {
    // Till mitten av bandet; minst till närmaste kant.
    saddleMm = saddleChange(thigh, shank, values.knee, center);
    const edge = values.knee > bands.knee.max ? bands.knee.max : bands.knee.min;
    const least = Math.abs(saddleChange(thigh, shank, values.knee, edge));
    const mm = Math.round(Math.abs(saddleMm));
    sentence = `${saddleMm > 0 ? "Höj" : "Sänk"} sadeln cirka ${mm} mm: knäböjningen är ${sv(values.knee)}° mot målbandet ${bands.knee.min}–${bands.knee.max}°. ${mm} mm tar den till mitten av bandet (${sv(center, 0)}°); minst ${Math.round(least)} mm behövs för att nå in i det.`;
  } else if (knee.verdict === "gul") {
    sentence = `Knäböjningen ${sv(values.knee)}° ligger inom mätnoggrannheten (±${sv(TOLERANCE)}°) från målbandet ${bands.knee.min}–${bands.knee.max}° – ändra inte sadelhöjden på det här underlaget.`;
  } else {
    sentence = `Sadelhöjden passar: knäböjningen ${sv(values.knee)}° ligger inom målbandet ${bands.knee.min}–${bands.knee.max}°. Ingen ändring.`;
  }

  return {
    knee,
    trunk,
    elbow,
    shoulder: unjudged(values.shoulder),
    hip: unjudged(values.hip),
    saddleMm,
    mmPerDegree: perDegree,
    legSource,
    sentence,
  };
}
