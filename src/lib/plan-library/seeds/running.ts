/**
 * Löpplanerna per fas: grund, uppbyggnad (tröskel och VO₂max), specifik
 * mot 5–10 km, halvmaraton, maraton och trail/ultra, toppning och
 * övergång. Varje plan är en fas som coachen lägger i adeptens kö i så
 * många veckor planen tillåter, och planerna efter varandra blir säsongen.
 *
 * Planerna är byggda av cykler på fyra veckor: tre veckor där en variabel
 * ökas och en lättare (avsnitt 4.2, 5 och 11). Kortas en plan tas veckor
 * bort ur de första cyklerna, så att det som ligger närmast nästa fas står
 * kvar. Grunden är polariserad, i uppbyggnaden styr blockets egenskap och
 * i den specifika perioden flyttas kvaliteten mot den intensitet loppet
 * avgörs i (avsnitt 19). Lugnt ska vara lugnt.
 *
 * Tempona är namngivna zoner som andel av maratonfarten (zones.ts) och
 * räknas ur löparens formuppskattning eller måltid. Modulen är ren data.
 */

import type {
  LevelKey,
  Mix,
  PlanSeed,
  SeedLevel,
  SeedPhase,
  SeedSession,
  SeedWeek,
} from "./build";

const mix = (låg: number, medel: number, hög: number): Mix => ({ låg, medel, hög });

const LEVELS = (intensity: Mix): SeedLevel[] => [
  {
    key: "A",
    name: "Elitnära",
    description: "7–10 timmar löpning i veckan, sex till åtta pass. Flera år av strukturerad träning.",
    hours: [7, 10],
    sessions: [7, 8],
    intensity,
  },
  {
    key: "B",
    name: "Ambitiös",
    description: "5–7 timmar i veckan, fem till sex pass. Du tål två kvalitetspass i veckan.",
    hours: [5, 7],
    sessions: [5, 6],
    intensity,
  },
  {
    key: "C",
    name: "Mellan",
    description: "3,5–5 timmar i veckan, fyra till fem pass. Jobb och familj sätter ramen.",
    hours: [3.5, 5],
    sessions: [4, 5],
    intensity,
  },
  {
    key: "D",
    name: "Grund",
    description: "2,5–3,5 timmar i veckan, tre till fyra pass. Varje pass har ett tydligt syfte.",
    hours: [2.5, 3.5],
    sessions: [3, 4],
    intensity,
  },
];

type ByLevel<T> = Partial<Record<LevelKey, T>>;
const lv = <T>(A?: T, B?: T, C?: T, D?: T): ByLevel<T> => {
  const out: ByLevel<T> = {};
  if (A !== undefined) out.A = A;
  if (B !== undefined) out.B = B;
  if (C !== undefined) out.C = C;
  if (D !== undefined) out.D = D;
  return out;
};
const map = <T, U>(by: ByLevel<T>, f: (v: T, key: LevelKey) => U): ByLevel<U> =>
  Object.fromEntries(
    Object.entries(by).map(([k, v]) => [k, f(v as T, k as LevelKey)]),
  ) as ByLevel<U>;

// ---------------------------------------------------------------------------
// Pass
// ---------------------------------------------------------------------------

const WU = "15 min @LO uppvärmning";
const CD = "10 min @LO nedvarvning";
const q = (main: string) => `${WU}; ${main}; ${CD}`;
const sets = (count: number, block: string, rest = "3 min @RK") =>
  Array.from({ length: count }, () => block).join(`; ${rest} vila; `);

type Quality = Omit<SeedSession, "day" | "discipline">;

const run = (day: number, s: Quality): SeedSession => ({ day, discipline: "löpning", ...s });

const easy = (day: number, minutes: ByLevel<number>, title = "Lugn löpning"): SeedSession =>
  run(day, {
    type: "Distans",
    title,
    description: "Lugnt, i samtalsfart. Du ska kunna prata i hela meningar.",
    zone: "Lugnt",
    variants: map(minutes, (m) => `${m} min @LO distans`),
  });

const recovery = (day: number, minutes: ByLevel<number>): SeedSession =>
  run(day, {
    type: "Återhämtning",
    title: "Återhämtningsjogg",
    description: "Mycket lugnt och kort. Benen ska kännas bättre efteråt.",
    zone: "Återhämtning",
    variants: map(minutes, (m) => `${m} min @RK distans`),
  });

const strides = (day: number, minutes: ByLevel<number>): SeedSession =>
  run(day, {
    type: "Distans",
    title: "Lugn löpning med stegringar",
    description:
      "Lugn löpning och sist sex stegringar om 20 sekunder mot snabbt men avslappnat, med full vila. Håller steget kvickt utan att trötta.",
    zone: "Lugnt",
    variants: map(minutes, (m) => `${m} min @LO distans; 6x(20 s @5K stegring + 1 min @RK)`),
  });

const long = (
  day: number,
  minutes: ByLevel<number>,
  description = "Lugnt hela vägen. Tiden på benen är poängen. Ta med energi när passet går över 90 minuter.",
): SeedSession =>
  run(day, {
    type: "Långpass",
    title: "Långpass",
    description,
    zone: "Lugnt",
    variants: map(minutes, (m) => `${m} min @LO distans`),
  });

const strength = (day: number, minutes: ByLevel<number>, description: string): SeedSession => ({
  day,
  discipline: "styrka",
  type: "Styrka",
  title: "Styrka",
  description,
  zone: "Styrka",
  variants: map(minutes, (m) => ({ minutes: m })),
});

const STRENGTH_BUILD =
  "Knäböj, bulgarisk utfallsböj, marklyft på ett ben och vadpress, plus bål. Tre set om 10–15 repetitioner. Teknik först, tyngd sedan.";
const STRENGTH_HEAVY =
  "Samma övningar, tyngre: tre set om 5–8 repetitioner med 2–4 minuters vila. Explosivt uppåt, kontrollerat nedåt.";
const STRENGTH_KEEP =
  "Underhåll: två set om 4–6 tunga repetitioner per övning. Inte dagen före ett nyckelpass.";

// Kvalitetsformat --------------------------------------------------------------

const hills = (reps: ByLevel<number>): Quality => ({
  type: "Fart",
  title: "Backsprinter",
  description:
    "Korta, explosiva backar om 10 sekunder med full vila. Bygger kraft i steget och starkare senor utan att trötta.",
  zone: "Fart",
  variants: map(reps, (r) => q(`20 min @LO distans; ${r}x(10 s @5K backsprint + 2 min @RK)`)),
});

const fartlek = (reps: ByLevel<number>): Quality => ({
  type: "Fart",
  title: "Fartlek",
  description:
    "Lugn löpning med korta drag i 10 km-fart, en minut åt gången. Löst och lekfullt, inte ett intervallpass.",
  zone: "Fart",
  variants: map(reps, (r) => q(`${r}x(1 min @10K + 2 min @LO)`)),
});

const cruise = (reps: ByLevel<number>, minutes: number): Quality => ({
  type: "Kvalitet",
  title: `Tröskel ${minutes} min`,
  description:
    "Jämnt i tröskelfart, det du ungefär klarar i en timme, med kort jogg mellan. Höjer LT2 och hur länge en hög fart går att hålla.",
  zone: "Tröskel",
  variants: map(reps, (r) => q(`${r}x(${minutes} min @S + 2 min @RK)`)),
});

const tempo = (minutes: ByLevel<number>): Quality => ({
  type: "Kvalitet",
  title: "Tröskel i ett stycke",
  description: "Sammanhängande i tröskelfart. Börja kontrollerat och håll farten jämn till slutet.",
  zone: "Tröskel",
  variants: map(minutes, (m) => q(`${m} min @S`)),
});

const intervals = (reps: ByLevel<number>, minutes: number): Quality => ({
  type: "Kvalitet",
  title: `Intervaller ${minutes} min`,
  description:
    "Hårt men jämnt, i intervallfart. Efter tre till fem minuter vill du sluta. Lika fart i sista draget som i första.",
  zone: "VO₂max",
  variants: map(reps, (r) => q(`${r}x(${minutes} min @I + ${minutes === 3 ? 2 : 3} min @RK)`)),
});

const short30 = (reps: ByLevel<number>, nSets: ByLevel<number>): Quality => ({
  type: "Kvalitet",
  title: "30/15",
  description:
    "Serier om 30 sekunder hårt och 15 sekunder lugn jogg. Lång tid nära VO₂max till en lägre upplevd kostnad än långa intervaller.",
  zone: "VO₂max",
  variants: map(reps, (r, k) => q(sets(nSets[k] ?? 2, `${r}x(30 s @I + 15 s @RK)`))),
});

const racePace = (
  title: string,
  zone: string,
  description: string,
  build: (k: LevelKey) => string,
  levels: LevelKey[] = ["A", "B", "C", "D"],
): Quality => ({
  type: "Specifikt",
  title,
  description,
  zone,
  variants: Object.fromEntries(levels.map((k) => [k, q(build(k))])) as ByLevel<string>,
});

/** Långpass med fart sist eller i block. */
const longWith = (
  title: string,
  description: string,
  build: ByLevel<string>,
): SeedSession =>
  run(6, { type: "Långpass", title, description, zone: "Medel", variants: build });

// ---------------------------------------------------------------------------
// Veckan
// ---------------------------------------------------------------------------

const LONG = lv(110, 95, 75, 65);
const scaleLong = (factor: number) => map(LONG, (m) => Math.round((m * factor) / 5) * 5);

type WeekPlan = {
  title: string;
  note?: string;
  /** Tisdagens kvalitetspass. */
  q: Quality;
  /** Lördagens andra kvalitetspass; utan blir lördagen lugn löpning. */
  q2?: Quality;
  longFactor?: number;
  longSession?: SeedSession;
  strength: 0 | 1 | 2;
  strengthText?: string;
};

/**
 * En vanlig vecka: återhämtningsjogg måndag (A), kvalitet tisdag, lugnt
 * onsdag, stegringar och styrka torsdag, lugnt fredag (A), kvalitet eller
 * lugnt lördag och långpass söndag.
 */
function week(p: WeekPlan): SeedWeek {
  const s: SeedSession[] = [
    recovery(0, lv(35)),
    run(1, p.q),
    easy(2, lv(60, 50, 40)),
    strides(3, lv(45, 40, 35, 30)),
  ];
  if (p.strength >= 1) s.push(strength(3, lv(40, 35, 30, 30), p.strengthText ?? STRENGTH_BUILD));
  if (p.strength >= 2) s.push(strength(5, lv(30, 30), p.strengthText ?? STRENGTH_BUILD));
  s.push(easy(4, lv(40)));
  s.push(p.q2 ? run(5, p.q2) : easy(5, lv(50, 45, 30)));
  s.push(p.longSession ?? long(6, scaleLong(p.longFactor ?? 1)));
  return { kind: "normal", title: p.title, note: p.note, sessions: s };
}

function easyWeek(title = "Avlastning", note?: string): SeedWeek {
  return {
    kind: "avlastning",
    title,
    note:
      note ??
      "Lättare vecka så att belastningen hinner bli form. Kortare pass, samma lugna fart.",
    sessions: [
      strides(1, lv(40, 35, 30, 25)),
      easy(2, lv(45, 40, 30)),
      strength(3, lv(30, 25, 25, 20), STRENGTH_KEEP),
      easy(4, lv(35)),
      long(6, scaleLong(0.7)),
    ],
  };
}

/** Testvecka: ett 5 km-test som ger formuppskattningen nästa fas räknar med. */
function testWeek(title = "Test"): SeedWeek {
  return {
    kind: "test",
    title,
    checkpoint: true,
    note: "Lägg in tiden som formuppskattning, så räknas nästa fas tempon ur den.",
    sessions: [
      easy(1, lv(45, 40, 35, 30)),
      strides(2, lv(35, 30, 30, 25)),
      run(4, {
        type: "Test",
        title: "Test: 5 km",
        description:
          "5 km så fort det går med jämn fart, på bana eller platt väg. Utvilad och samma förhållanden som förra testet.",
        zone: "Test",
        variants: lv(
          q("5 km @5K test"),
          q("5 km @5K test"),
          q("5 km @5K test"),
          q("5 km @5K test"),
        ),
      }),
      long(6, scaleLong(0.8)),
    ],
  };
}

const phase = (p: Omit<SeedPhase, "weeks">, weeks: SeedWeek[]): SeedPhase => ({ ...p, weeks });

const POLAR = mix(85, 5, 10);
const T_BLOCK = mix(78, 15, 7);
const V_BLOCK = mix(80, 5, 15);
const SPEC_LONG = mix(75, 20, 5);
const SPEC_SHORT = mix(75, 10, 15);

/** En cykel om fyra veckor: tre veckor uppåt och en lätt. */
const cycle = (weeks: [WeekPlan, WeekPlan, WeekPlan], last: SeedWeek = easyWeek()): SeedWeek[] => [
  ...weeks.map(week),
  last,
];

// ---------------------------------------------------------------------------
// Grund
// ---------------------------------------------------------------------------

const grund: PlanSeed = {
  slug: "lop-grund",
  category: "lopning",
  focus: "grund",
  basis: "MP",
  title: "Grundperiod löpning (4–16 veckor)",
  summary: "Lugn volym, stegringar, backsprinter och styrka, i så många veckor du vill. Slutar med ett 5 km-test.",
  goal: "En större aerob bas och en kropp som tål mer kvalitet i nästa fas.",
  description:
    "Grunden är polariserad: det mesta lugnt, korta snabba inslag för steget och lite mellanintensitet (avsnitt 3 och 19). Planen är fyra cykler om fyra veckor. Varje cykel ökar långpasset och byter tisdagens inslag ett steg: backsprinter, fartlek, sedan tröskel i små doser, som förbereder nästa fas. Styrkan byggs från 10–15 mot 5–8 repetitioner (avsnitt 20).\n\nVälj längden när fasen läggs på. Kortas planen tas de första cyklerna bort, och testet sist står alltid kvar.",
  prerequisites: "Du springer minst tre gånger i veckan och klarar 45 minuter i lugn fart.",
  minWeeks: 4,
  levels: LEVELS(POLAR),
  phases: [
    phase(
      { name: "Cykel 1", seasonPhase: "grund", purpose: "Etablera rytmen och volymen.", focus: "Backsprinter, stegringar och styrka med lätta vikter.", specificity: 1, intensity: POLAR, minWeeks: 0, trimOrder: 1 },
      cycle([
        { title: "Introduktion", q: hills(lv(8, 8, 6, 6)), strength: 2, longFactor: 0.85 },
        { title: "Mer volym", q: hills(lv(10, 8, 8, 6)), strength: 2, longFactor: 0.95 },
        { title: "Längre långpass", q: hills(lv(10, 10, 8, 8)), strength: 2, longFactor: 1 },
      ]),
    ),
    phase(
      { name: "Cykel 2", seasonPhase: "grund", purpose: "Mer volym och kvickare steg.", focus: "Fartlek, stegringar och tyngre styrka.", specificity: 1, intensity: POLAR, minWeeks: 0, trimOrder: 2 },
      cycle([
        { title: "Fartlek in", q: fartlek(lv(8, 8, 6, 6)), strength: 2, strengthText: STRENGTH_HEAVY, longFactor: 1 },
        { title: "Fler drag", q: fartlek(lv(10, 10, 8, 6)), strength: 2, strengthText: STRENGTH_HEAVY, longFactor: 1.05 },
        { title: "Längre långpass", q: fartlek(lv(12, 10, 8, 8)), strength: 2, strengthText: STRENGTH_HEAVY, longFactor: 1.1 },
      ]),
    ),
    phase(
      { name: "Cykel 3", seasonPhase: "grund", purpose: "Tröskeln får sina första doser.", focus: "Korta tröskeldrag, långpass och styrka.", specificity: 2, intensity: mix(82, 8, 10), minWeeks: 0, trimOrder: 3 },
      cycle([
        { title: "Tröskel in", q: cruise(lv(4, 3, 3, 2), 6), strength: 2, strengthText: STRENGTH_HEAVY, longFactor: 1.05 },
        { title: "Fler drag", q: cruise(lv(5, 4, 3, 3), 6), strength: 2, strengthText: STRENGTH_HEAVY, longFactor: 1.1 },
        { title: "Längre långpass", q: cruise(lv(5, 4, 4, 3), 6), strength: 2, strengthText: STRENGTH_HEAVY, longFactor: 1.15 },
      ]),
    ),
    phase(
      { name: "Cykel 4 och test", seasonPhase: "grund", purpose: "Befästa grunden och mäta den.", focus: "Tröskel i längre drag, backsprinter och testet.", specificity: 2, intensity: mix(82, 8, 10), minWeeks: 4, trimOrder: null },
      [
        week({ title: "Längre drag", q: cruise(lv(4, 3, 3, 2), 8), q2: hills(lv(8, 8)), strength: 1, strengthText: STRENGTH_HEAVY, longFactor: 1.1 }),
        week({ title: "Volymtopp", q: cruise(lv(4, 4, 3, 3), 8), q2: hills(lv(10, 8)), strength: 1, strengthText: STRENGTH_HEAVY, longFactor: 1.15 }),
        easyWeek("Avlastning före testet"),
        testWeek(),
      ],
    ),
  ],
};

// ---------------------------------------------------------------------------
// Uppbyggnad
// ---------------------------------------------------------------------------

const troskel: PlanSeed = {
  slug: "lop-troskel",
  category: "lopning",
  focus: "troskel",
  basis: "MP",
  title: "Höj tröskeln, löpning (4–8 veckor)",
  summary: "Tröskeldrag som blir längre vecka för vecka, och ett långpass med tröskel sist.",
  goal: "Högre tröskelfart och en större del av VO₂max som går att hålla länge.",
  description:
    "Ett tröskelblock: ett återkommande format, tröskelintervaller med kort jogg, där dragen blir längre medan farten står still (avsnitt 4.2 och 5). Lördagens pass är lugnt och söndagens långpass får tröskel sist i andra cykeln. Stegringarna håller steget kvickt och styrkan underhålls.\n\nKortas planen tas den första cykeln bort.",
  prerequisites: "En grundperiod bakom dig och en formuppskattning, så att tröskelfarten blir rätt.",
  minWeeks: 4,
  levels: LEVELS(T_BLOCK),
  phases: [
    phase(
      { name: "Tröskel 1", seasonPhase: "uppbyggnad", purpose: "Bygga tid i tröskelfart.", focus: "Tröskelintervaller, längre drag varje vecka.", specificity: 3, intensity: T_BLOCK, minWeeks: 0, trimOrder: 1 },
      cycle([
        { title: "8 minuter", q: cruise(lv(4, 4, 3, 3), 8), strength: 1, strengthText: STRENGTH_KEEP },
        { title: "10 minuter", q: cruise(lv(4, 3, 3, 2), 10), strength: 1, strengthText: STRENGTH_KEEP },
        { title: "12 minuter", q: cruise(lv(4, 3, 3, 2), 12), strength: 1, strengthText: STRENGTH_KEEP },
      ]),
    ),
    phase(
      { name: "Tröskel 2", seasonPhase: "uppbyggnad", purpose: "Längre sammanhängande tröskel.", focus: "Längre drag på tisdag och tröskel sist i långpasset.", specificity: 3, intensity: T_BLOCK, minWeeks: 4, trimOrder: null },
      cycle([
        { title: "15 minuter", q: cruise(lv(3, 2, 2, 2), 15), longSession: longWith("Långpass med tröskel sist", "Lugnt, och sist ett stycke i tröskelfart på trötta ben.", lv("85 min @LO distans; 15 min @S", "70 min @LO distans; 12 min @S", "55 min @LO distans; 10 min @S", "45 min @LO distans; 10 min @S")), strength: 1, strengthText: STRENGTH_KEEP },
        { title: "20 minuter", q: cruise(lv(3, 2, 2, 2), 20), longSession: longWith("Långpass med tröskel sist", "Lugnt, och sist ett stycke i tröskelfart på trötta ben.", lv("90 min @LO distans; 20 min @S", "75 min @LO distans; 15 min @S", "60 min @LO distans; 12 min @S", "50 min @LO distans; 10 min @S")), strength: 1, strengthText: STRENGTH_KEEP },
        { title: "I ett stycke", q: tempo(lv(40, 35, 30, 25)), strength: 1, strengthText: STRENGTH_KEEP, longFactor: 1.1 },
      ]),
    ),
  ],
};

const vo2max: PlanSeed = {
  slug: "lop-vo2max",
  category: "lopning",
  focus: "vo2max",
  basis: "MP",
  title: "Lyft VO₂max, löpning (4–8 veckor)",
  summary: "Två återkommande format, 30/15 och intervaller om 3–4 minuter, i två cykler.",
  goal: "Högre VO₂max och fart i 3–8 minuter.",
  description:
    "Ett VO₂max-block med två format: 30/15 på tisdag och intervaller i intervallfart på lördag (avsnitt 25). Varje vecka ändras en sak i ett av formaten. Långpasset är lugnt, och styrkan underhålls. Med två hårda pass i veckan ska resten vara lugnt på riktigt.\n\nKortas planen tas den första cykeln bort.",
  prerequisites: "En grundperiod bakom dig och att du tål två hårda pass i veckan.",
  minWeeks: 4,
  levels: LEVELS(V_BLOCK),
  phases: [
    phase(
      { name: "VO₂max 1", seasonPhase: "uppbyggnad", purpose: "Etablera formaten.", focus: "30/15 och 3-minutersintervaller.", specificity: 3, intensity: V_BLOCK, minWeeks: 0, trimOrder: 1 },
      cycle([
        { title: "Etablera", q: short30(lv(10, 10, 8, 8), lv(3, 2, 2, 2)), q2: intervals(lv(5, 5, 4), 3), strength: 1, strengthText: STRENGTH_KEEP, longFactor: 0.95 },
        { title: "Fler drag", q: short30(lv(10, 10, 8, 8), lv(3, 2, 2, 2)), q2: intervals(lv(6, 5, 5), 3), strength: 1, strengthText: STRENGTH_KEEP, longFactor: 0.95 },
        { title: "Längre serier", q: short30(lv(12, 12, 10, 10), lv(3, 2, 2, 2)), q2: intervals(lv(6, 6, 5), 3), strength: 1, strengthText: STRENGTH_KEEP, longFactor: 0.95 },
      ]),
    ),
    phase(
      { name: "VO₂max 2", seasonPhase: "uppbyggnad", purpose: "Längre drag nära VO₂max.", focus: "30/15 och 4-minutersintervaller.", specificity: 3, intensity: V_BLOCK, minWeeks: 4, trimOrder: null },
      cycle([
        { title: "4 minuter", q: short30(lv(12, 12, 10, 10), lv(3, 3, 2, 2)), q2: intervals(lv(5, 4, 4), 4), strength: 1, strengthText: STRENGTH_KEEP, longFactor: 0.95 },
        { title: "Ett drag till", q: short30(lv(12, 12, 10, 10), lv(3, 3, 2, 2)), q2: intervals(lv(6, 5, 4), 4), strength: 1, strengthText: STRENGTH_KEEP, longFactor: 0.95 },
        { title: "Längre serier", q: short30(lv(14, 13, 12, 10), lv(3, 3, 2, 2)), q2: intervals(lv(6, 5, 5), 4), strength: 1, strengthText: STRENGTH_KEEP, longFactor: 0.95 },
      ], testWeek("Lätt vecka och test")),
    ),
  ],
};

// ---------------------------------------------------------------------------
// Specifik
// ---------------------------------------------------------------------------

const spec10k: PlanSeed = {
  slug: "lop-specifik-5-10-km",
  category: "10-km",
  focus: null,
  basis: "MP",
  raceMetres: 10000,
  title: "Specifik 5–10 km (4–8 veckor)",
  summary: "Loppfart över tröskeln: intervaller i milfart och 5 km-fart, och tröskel som underhåll.",
  goal: "Att kunna hålla loppfarten hela vägen på 5 eller 10 km.",
  description:
    "Ett kort lopp avgörs över tröskeln, så andelen hög intensitet växer i den specifika perioden (avsnitt 19). Tisdagen är loppfart i allt längre drag, lördagen intervaller i 5 km-fart. Tröskeln ligger kvar i långpasset. Farterna räknas ur din formuppskattning eller måltid för 10 km.\n\nKortas planen tas den första cykeln bort. Lägg en toppning för kort lopp efter.",
  prerequisites: "En grund och en uppbyggnad bakom dig, och en formuppskattning eller måltid.",
  minWeeks: 4,
  levels: LEVELS(SPEC_SHORT),
  phases: [
    phase(
      { name: "Specifik 1", seasonPhase: "specifik", purpose: "Vänja kroppen vid loppfarten.", focus: "Milfart i drag om 5 minuter och 5 km-fart i korta drag.", specificity: 4, intensity: SPEC_SHORT, minWeeks: 0, trimOrder: 1 },
      cycle([
        { title: "Milfart", q: racePace("Milfart 5 min", "Lopp", "Drag i milfart med kort jogg. Jämnt, som i loppet.", (k) => `${{ A: 6, B: 5, C: 4, D: 4 }[k]}x(5 min @10K + 2 min @RK)`), q2: intervals(lv(6, 5, 4), 3), strength: 1, strengthText: STRENGTH_KEEP },
        { title: "Längre drag", q: racePace("Milfart 6 min", "Lopp", "Drag i milfart med kort jogg. Jämnt, som i loppet.", (k) => `${{ A: 5, B: 5, C: 4, D: 3 }[k]}x(6 min @10K + 2 min @RK)`), q2: intervals(lv(6, 6, 5), 3), strength: 1, strengthText: STRENGTH_KEEP },
        { title: "Kortare vila", q: racePace("Milfart 6 min", "Lopp", "Samma drag med kortare jogg emellan.", (k) => `${{ A: 5, B: 5, C: 4, D: 3 }[k]}x(6 min @10K + 90 s @RK)`), q2: intervals(lv(6, 6, 5), 3), strength: 1, strengthText: STRENGTH_KEEP },
      ]),
    ),
    phase(
      { name: "Specifik 2", seasonPhase: "specifik", purpose: "Loppet i delar.", focus: "Långa drag i milfart och 5 km-fart.", specificity: 5, intensity: SPEC_SHORT, minWeeks: 4, trimOrder: null },
      cycle([
        { title: "Loppet i delar", q: racePace("Milfart 2 km-drag", "Lopp", "Loppet i delar: långa drag i milfart.", (k) => `${{ A: 4, B: 4, C: 3, D: 3 }[k]}x(8 min @10K + 2 min @RK)`), q2: racePace("5 km-fart", "Lopp", "Korta drag i 5 km-fart med lika lång jogg.", (k) => `${{ A: 8, B: 7, C: 6, D: 5 }[k]}x(2 min @5K + 2 min @RK)`, ["A", "B", "C"]), strength: 1, strengthText: STRENGTH_KEEP },
        { title: "Längre drag", q: racePace("Milfart 10 min", "Lopp", "Två till tre långa drag i milfart.", (k) => `${{ A: 3, B: 3, C: 2, D: 2 }[k]}x(10 min @10K + 3 min @RK)`), q2: racePace("5 km-fart", "Lopp", "Drag i 5 km-fart.", (k) => `${{ A: 6, B: 5, C: 5, D: 4 }[k]}x(3 min @5K + 2 min @RK)`, ["A", "B", "C"]), strength: 1, strengthText: STRENGTH_KEEP },
        { title: "Generalrepetition", note: "Mittveckans pass är ett lopp i miniatyr: samma uppvärmning, samma fart.", q: racePace("Milfart 15 min", "Lopp", "Ett långt drag i milfart och ett kortare.", (k) => `${{ A: "15 min @10K + 4 min @RK; 8 min @10K", B: "15 min @10K + 4 min @RK; 6 min @10K", C: "12 min @10K + 4 min @RK; 6 min @10K", D: "10 min @10K + 4 min @RK; 5 min @10K" }[k]}`), strength: 0 },
      ]),
    ),
  ],
};

const specHm: PlanSeed = {
  slug: "lop-specifik-halvmaraton",
  category: "halvmaraton",
  focus: null,
  basis: "MP",
  raceMetres: 21097.5,
  title: "Specifik halvmaraton (4–10 veckor)",
  summary: "Halvmaratonfart i allt längre block, tröskel och långpass med fart sist.",
  goal: "Att hålla halvmaratonfarten hela loppet, med energin intakt.",
  description:
    "Halvmaratonet går nära tröskeln, så kvaliteten delas mellan tröskel och loppfart (avsnitt 19). Tisdagen är halvmaratonfart i block som blir längre, lördagen tröskel eller 10 km-fart, och söndagens långpass får loppfart sist. Farterna räknas ur din formuppskattning eller måltid.\n\nKortas planen tas de första veckorna bort. Lägg en toppning efter.",
  prerequisites: "En grund och gärna ett tröskelblock bakom dig, och en formuppskattning eller måltid.",
  minWeeks: 4,
  levels: LEVELS(SPEC_LONG),
  phases: [
    phase(
      { name: "Specifik 1", seasonPhase: "specifik", purpose: "Vänja kroppen vid halvmaratonfarten.", focus: "Halvmaratonfart i block och tröskel.", specificity: 4, intensity: SPEC_LONG, minWeeks: 0, trimOrder: 1 },
      cycle([
        { title: "Loppfart in", q: racePace("Halvmaratonfart 8 min", "Lopp", "Block i halvmaratonfart med kort jogg.", (k) => `${{ A: 4, B: 4, C: 3, D: 3 }[k]}x(8 min @HM + 2 min @RK)`), q2: cruise(lv(3, 3), 10), strength: 1, strengthText: STRENGTH_KEEP },
        { title: "Längre block", q: racePace("Halvmaratonfart 10 min", "Lopp", "Längre block i halvmaratonfart.", (k) => `${{ A: 4, B: 3, C: 3, D: 2 }[k]}x(10 min @HM + 2 min @RK)`), q2: cruise(lv(3, 3), 12), strength: 1, strengthText: STRENGTH_KEEP, longFactor: 1.05 },
        { title: "Längre långpass", q: racePace("Halvmaratonfart 12 min", "Lopp", "Block i halvmaratonfart.", (k) => `${{ A: 3, B: 3, C: 2, D: 2 }[k]}x(12 min @HM + 3 min @RK)`), q2: intervals(lv(5, 5), 3), strength: 1, strengthText: STRENGTH_KEEP, longFactor: 1.1 },
      ]),
    ),
    phase(
      { name: "Specifik 2", seasonPhase: "specifik", purpose: "Loppfart på trötta ben.", focus: "Långa block och långpass med loppfart sist.", specificity: 5, intensity: SPEC_LONG, minWeeks: 2, trimOrder: 2 },
      cycle([
        { title: "15 minuter", q: racePace("Halvmaratonfart 15 min", "Lopp", "Två långa block i halvmaratonfart.", (k) => `${{ A: 3, B: 2, C: 2, D: 2 }[k]}x(15 min @HM + 3 min @RK)`), longSession: longWith("Långpass med loppfart sist", "Lugnt, och sist halvmaratonfart på trötta ben.", lv("80 min @LO distans; 20 min @HM", "70 min @LO distans; 15 min @HM", "55 min @LO distans; 12 min @HM", "45 min @LO distans; 10 min @HM")), strength: 1, strengthText: STRENGTH_KEEP },
        { title: "20 minuter", q: racePace("Halvmaratonfart 20 min", "Lopp", "Två långa block i halvmaratonfart.", (k) => `2x(${{ A: 20, B: 18, C: 15, D: 12 }[k]} min @HM + 4 min @RK)`), longSession: longWith("Långpass med loppfart sist", "Lugnt, och sist halvmaratonfart på trötta ben.", lv("80 min @LO distans; 25 min @HM", "70 min @LO distans; 20 min @HM", "55 min @LO distans; 15 min @HM", "45 min @LO distans; 12 min @HM")), strength: 1, strengthText: STRENGTH_KEEP },
        { title: "Generalrepetition", note: "Söndagens pass är loppet i delar: samma frukost, samma skor, samma energi.", q: cruise(lv(3, 3, 2, 2), 10), longSession: longWith("Generalrepetition", "Lugnt, sedan ett långt block i halvmaratonfart med loppets energiplan.", lv("50 min @LO distans; 40 min @HM", "45 min @LO distans; 35 min @HM", "40 min @LO distans; 25 min @HM", "35 min @LO distans; 20 min @HM")), strength: 0 },
      ]),
    ),
    phase(
      { name: "Skärpning", seasonPhase: "specifik", purpose: "Behålla loppfarten in mot toppningen.", focus: "Kortare block i loppfart och lugn volym.", specificity: 5, intensity: SPEC_LONG, minWeeks: 2, trimOrder: null },
      [
        week({ title: "Skärpning", q: racePace("Halvmaratonfart 10 min", "Lopp", "Kortare block i halvmaratonfart.", (k) => `${{ A: 3, B: 3, C: 2, D: 2 }[k]}x(10 min @HM + 2 min @RK)`), q2: intervals(lv(5, 4), 3), strength: 1, strengthText: STRENGTH_KEEP }),
        easyWeek("Lättare vecka", "Volymen ned inför toppningen. Farten ligger kvar i stegringarna."),
      ],
    ),
  ],
};

const specM: PlanSeed = {
  slug: "lop-specifik-maraton",
  category: "maraton",
  focus: null,
  basis: "MP",
  raceMetres: 42195,
  title: "Specifik maraton (6–10 veckor)",
  summary: "Maratonfart i allt längre avsnitt, i långpassen och på trötta ben, med energiplanen inövad.",
  goal: "Att springa maratonet i jämn fart med energin intakt till slutet.",
  description:
    "Maratonet går mellan trösklarna, så medelzonen växer i den specifika perioden: maratonfart i långa block, gärna i långpasset och med loppets energiplan (avsnitt 19). Tröskeln ligger kvar som stöd och hög intensitet som underhåll. Långpassen är veckans nyckelpass. Ät 60–90 g kolhydrater i timmen i dem, som i loppet.\n\nKortas planen tas de första veckorna bort. Lägg en toppning för långt lopp efter.",
  prerequisites: "En grund och gärna ett tröskelblock bakom dig, långpass på minst 90 minuter, och en formuppskattning eller måltid.",
  minWeeks: 6,
  levels: LEVELS(SPEC_LONG),
  phases: [
    phase(
      { name: "Specifik 1", seasonPhase: "specifik", purpose: "Vänja kroppen vid maratonfarten.", focus: "Maratonfart i block och tröskel.", specificity: 4, intensity: SPEC_LONG, minWeeks: 0, trimOrder: 1 },
      cycle([
        { title: "Maratonfart in", q: cruise(lv(4, 3, 3, 2), 10), longSession: longWith("Långpass med maratonfart", "Lugnt med block i maratonfart. Öva energiplanen.", lv("40 min @LO distans; 3x(12 min @WK + 3 min @LO)", "35 min @LO distans; 3x(10 min @WK + 3 min @LO)", "30 min @LO distans; 2x(10 min @WK + 3 min @LO)", "25 min @LO distans; 2x(8 min @WK + 3 min @LO)")), strength: 1, strengthText: STRENGTH_KEEP },
        { title: "Längre block", q: cruise(lv(3, 3, 2, 2), 12), longSession: longWith("Långpass med maratonfart", "Lugnt med längre block i maratonfart.", lv("40 min @LO distans; 3x(15 min @WK + 3 min @LO)", "35 min @LO distans; 3x(12 min @WK + 3 min @LO)", "30 min @LO distans; 2x(12 min @WK + 3 min @LO)", "25 min @LO distans; 2x(10 min @WK + 3 min @LO)")), strength: 1, strengthText: STRENGTH_KEEP },
        { title: "Längre pass", q: intervals(lv(5, 5, 4, 4), 3), longSession: longWith("Långt långpass", "Lugnt hela vägen, det längsta hittills. Energiplanen som i loppet.", lv("150 min @LO distans", "130 min @LO distans", "100 min @LO distans", "85 min @LO distans")), strength: 1, strengthText: STRENGTH_KEEP },
      ]),
    ),
    phase(
      { name: "Specifik 2", seasonPhase: "specifik", purpose: "Maratonfart på trötta ben.", focus: "Långa block i maratonfart i långpasset.", specificity: 5, intensity: SPEC_LONG, minWeeks: 4, trimOrder: null },
      cycle([
        { title: "Maratonfart sist", q: cruise(lv(3, 3, 2, 2), 15), longSession: longWith("Långpass med maratonfart sist", "Lugnt, och sist ett långt block i maratonfart på trötta ben.", lv("90 min @LO distans; 30 min @WK", "75 min @LO distans; 25 min @WK", "60 min @LO distans; 20 min @WK", "50 min @LO distans; 15 min @WK")), strength: 1, strengthText: STRENGTH_KEEP },
        { title: "Längre sist", q: cruise(lv(3, 2, 2, 2), 15), longSession: longWith("Långpass med maratonfart sist", "Lugnt, och sist ett längre block i maratonfart.", lv("90 min @LO distans; 40 min @WK", "75 min @LO distans; 35 min @WK", "60 min @LO distans; 25 min @WK", "50 min @LO distans; 20 min @WK")), strength: 1, strengthText: STRENGTH_KEEP },
        { title: "Generalrepetition", note: "Söndagens pass är loppet i delar: samma frukost, skor och energi som på loppdagen.", q: intervals(lv(4, 4, 4, 3), 3), longSession: longWith("Generalrepetition", "Lugn start och ett långt block i maratonfart, med loppets energiplan.", lv("40 min @LO distans; 60 min @WK; 10 min @LO", "35 min @LO distans; 50 min @WK; 10 min @LO", "30 min @LO distans; 40 min @WK; 10 min @LO", "25 min @LO distans; 30 min @WK; 10 min @LO")), strength: 0 },
      ]),
    ),
    phase(
      { name: "Skärpning", seasonPhase: "specifik", purpose: "Behålla maratonfarten in mot toppningen.", focus: "Kortare block i maratonfart.", specificity: 5, intensity: SPEC_LONG, minWeeks: 2, trimOrder: null },
      [
        week({ title: "Skärpning", q: cruise(lv(3, 2, 2, 2), 10), longSession: longWith("Långpass med maratonfart", "Lugnt med två block i maratonfart.", lv("50 min @LO distans; 2x(20 min @WK + 5 min @LO)", "45 min @LO distans; 2x(15 min @WK + 5 min @LO)", "35 min @LO distans; 2x(12 min @WK + 5 min @LO)", "30 min @LO distans; 2x(10 min @WK + 5 min @LO)")), strength: 1, strengthText: STRENGTH_KEEP }),
        easyWeek("Lättare vecka", "Volymen ned inför toppningen. Farten ligger kvar i stegringarna."),
      ],
    ),
  ],
};

/** Backintervaller för trail: uppför i tröskelansträngning. */
const uphill = (reps: ByLevel<number>, minutes: number): Quality => ({
  type: "Kvalitet",
  title: `Backintervaller ${minutes} min`,
  description:
    "Uppför i tröskelansträngning, jogga eller gå ned. Ansträngningen styr, inte farten. Bygger kraft och tröskel för långa stigningar.",
  zone: "Tröskel",
  variants: map(reps, (r) => q(`${r}x(${minutes} min @S uppför + ${minutes} min @RK nedför)`)),
});

const specTrail: PlanSeed = {
  slug: "lop-specifik-trail-ultra",
  category: "trail-ultra",
  focus: "ultra",
  basis: "MP",
  title: "Specifik trail och ultra (4–10 veckor)",
  summary: "Tid på fötterna, backar och två långa pass i rad, med energiplanen inövad.",
  goal: "Att genomföra ett trail- eller ultralopp i jämn ansträngning, med energin och benen intakta.",
  description:
    "Ett trail- eller ultralopp avgörs av tid på fötterna, energi och hur benen tål backar, mer än av tröskeln. Planen bygger backintervaller, långa pass i terräng och helger med två långa pass i rad (avsnitt 6 och 19). Ansträngningen styr i terrängen, inte farten. Energiplanen övas i varje långpass: 60–90 g kolhydrater i timmen. Styrkan med enbensövningar och vadpress skyddar i nedförsbackarna.\n\nKortas planen tas de första veckorna bort. Lägg en toppning för långt lopp efter.",
  prerequisites: "En grund bakom dig och långpass på minst två timmar.",
  minWeeks: 4,
  levels: LEVELS(SPEC_LONG),
  phases: [
    phase(
      { name: "Backar och tid", seasonPhase: "specifik", purpose: "Bygga backstyrka och tid på fötterna.", focus: "Backintervaller och längre långpass i terräng.", specificity: 4, intensity: SPEC_LONG, minWeeks: 0, trimOrder: 1 },
      cycle([
        { title: "Backar in", q: uphill(lv(6, 5, 5, 4), 3), strength: 2, strengthText: STRENGTH_HEAVY, longFactor: 1.1 },
        { title: "Längre backar", q: uphill(lv(5, 5, 4, 3), 4), strength: 2, strengthText: STRENGTH_HEAVY, longFactor: 1.2 },
        { title: "Tid på fötterna", q: uphill(lv(6, 5, 5, 4), 4), strength: 1, strengthText: STRENGTH_HEAVY, longFactor: 1.3 },
      ]),
    ),
    phase(
      { name: "Två dagar i rad", seasonPhase: "specifik", purpose: "Loppet i delar: långt på trötta ben.", focus: "Långa pass lördag och söndag, och backar.", specificity: 5, intensity: SPEC_LONG, minWeeks: 4, trimOrder: null },
      [
        week({ title: "Två dagar i rad", note: "Söndagens pass görs på trötta ben. Det är poängen.", q: uphill(lv(5, 4, 4, 3), 5), q2: { type: "Långpass", title: "Långpass i terräng", description: "Lugnt i terräng, gå i branta backar som i loppet. Öva energiplanen.", zone: "Lugnt", variants: lv("90 min @LO distans", "75 min @LO distans", "55 min @LO distans") }, strength: 1, strengthText: STRENGTH_KEEP, longFactor: 1.2 }),
        week({ title: "Längre helg", note: "Samma energiplan som i loppet: det du äter här är det du äter då.", q: uphill(lv(6, 5, 4, 3), 5), q2: { type: "Långpass", title: "Långpass i terräng", description: "Lugnt i terräng, gå i branta backar som i loppet.", zone: "Lugnt", variants: lv("100 min @LO distans", "80 min @LO distans", "45 min @LO distans") }, strength: 1, strengthText: STRENGTH_KEEP, longFactor: 1.25 }),
        week({ title: "Generalrepetition", note: "Det längsta passet: utrustning, mat och tempo som i loppet.", q: cruise(lv(3, 3, 2, 2), 10), longSession: long(6, lv(210, 170, 140, 110), "Det längsta passet, i terräng och med loppets utrustning och energiplan. Ansträngningen styr."), strength: 0 }),
        easyWeek("Lättare vecka", "Volymen ned inför toppningen. Benen ska hinna läka efter helgerna."),
      ],
    ),
  ],
};

// ---------------------------------------------------------------------------
// Toppning och övergång
// ---------------------------------------------------------------------------

const raceWeek = (
  title: string,
  note: string,
  opener: Quality,
  raceMinutes: ByLevel<number>,
): SeedWeek => ({
  kind: "tävling",
  title,
  note,
  sessions: [
    easy(1, lv(40, 35, 30, 30)),
    run(2, opener),
    easy(3, lv(30, 30, 25)),
    run(4, {
      type: "Aktivering",
      title: "Kort aktivering",
      description: "Dagen före: lite fart i benen, inget mer.",
      zone: "Lugnt",
      variants: lv("20 min @LO distans; 4x(20 s @5K + 1 min @RK)", "20 min @LO distans; 4x(20 s @5K + 1 min @RK)", "15 min @LO distans; 4x(20 s @5K + 1 min @RK)", "15 min @LO distans; 3x(20 s @5K + 1 min @RK)"),
    }),
    run(5, {
      type: "Tävling",
      title: "Loppet",
      description:
        "Börja kontrollerat i loppfart. Ät och drick enligt planen du övat. Längden är ungefärlig och beror på loppet.",
      zone: "Lopp",
      variants: map(raceMinutes, (m) => ({ minutes: m })),
    }),
  ],
});

const toppKort: PlanSeed = {
  slug: "lop-toppning-kort",
  category: "lopning",
  focus: null,
  basis: "MP",
  title: "Toppning kort lopp (1–2 veckor)",
  summary: "Mindre volym och samma fart, inför 5 km, 10 km eller halvmaraton.",
  goal: "Utvilad till start med farten kvar i benen.",
  description:
    "Toppningen sänker volymen med 40–60 % och behåller intensiteten och frekvensen (avsnitt 13 och 26). Korta drag i loppfart påminner benen om farten. Styrkan tas bort först. Loppet ligger sist i loppveckan; flytta det till rätt dag i planen.",
  prerequisites: "Läggs efter en specifik fas.",
  minWeeks: 1,
  levels: LEVELS(mix(70, 15, 15)),
  phases: [
    phase(
      { name: "Nedtrappning", seasonPhase: "topp", purpose: "Mindre volym, samma intensitet.", focus: "Korta drag i loppfart.", specificity: 5, intensity: mix(70, 15, 15), minWeeks: 0, trimOrder: 1 },
      [
        {
          kind: "normal",
          title: "Nedtrappning",
          note: "Volymen ned ungefär 40 %. Farten ligger kvar.",
          sessions: [
            run(1, racePace("Loppfart i korta drag", "Lopp", "Korta drag i milfart med full jogg emellan.", (k) => `${{ A: 5, B: 4, C: 4, D: 3 }[k]}x(3 min @10K + 2 min @RK)`)),
            easy(2, lv(45, 40, 30)),
            strides(3, lv(35, 30, 30, 25)),
            easy(4, lv(30)),
            long(6, scaleLong(0.65)),
          ],
        },
      ],
    ),
    phase(
      { name: "Loppvecka", seasonPhase: "topp", purpose: "Utvilad till start.", focus: "Öppnare, aktivering och loppet.", specificity: 5, intensity: mix(70, 15, 15), minWeeks: 1, trimOrder: null },
      [
        raceWeek(
          "Loppvecka",
          "Sov, ät normalt och fyll på med kolhydrater dagen före. Börja loppet kontrollerat.",
          racePace("Öppnare", "Lopp", "Kort och lätt med några drag i loppfart.", (k) => `${{ A: 4, B: 4, C: 3, D: 3 }[k]}x(1 min @10K + 2 min @RK)`),
          lv(45, 50, 55, 60),
        ),
      ],
    ),
  ],
};

const toppLang: PlanSeed = {
  slug: "lop-toppning-lang",
  category: "lopning",
  focus: null,
  basis: "MP",
  title: "Toppning långt lopp (2–3 veckor)",
  summary: "Nedtrappning i två steg inför maraton, trail eller ultra, med farten kvar.",
  goal: "Utvilad till start, med maratonfarten och energiplanen kvar.",
  description:
    "Längre lopp tål en längre toppning: volymen sänks i två steg medan maratonfarten ligger kvar i kortare block (avsnitt 13 och 26). Det sista långpasset ligger två veckor före. Kolhydratladdning de sista två dagarna. Loppet ligger sist i loppveckan; flytta det till rätt dag i planen.",
  prerequisites: "Läggs efter en specifik fas mot maraton, trail eller ultra.",
  minWeeks: 2,
  levels: LEVELS(mix(75, 20, 5)),
  phases: [
    phase(
      { name: "Nedtrappning", seasonPhase: "topp", purpose: "Mindre volym, samma fart.", focus: "Kortare långpass och block i maratonfart.", specificity: 5, intensity: mix(75, 20, 5), minWeeks: 1, trimOrder: 1 },
      [
        {
          kind: "normal",
          title: "Första steget",
          note: "Volymen ned ungefär 25 %. Sista längre långpasset.",
          sessions: [
            run(1, cruise(lv(3, 3, 2, 2), 10)),
            easy(2, lv(50, 45, 35)),
            strides(3, lv(40, 35, 30, 25)),
            easy(4, lv(35)),
            longWith("Långpass med maratonfart", "Lugnt med ett block i maratonfart.", lv("60 min @LO distans; 25 min @WK", "50 min @LO distans; 20 min @WK", "40 min @LO distans; 15 min @WK", "35 min @LO distans; 12 min @WK")),
          ],
        },
        {
          kind: "normal",
          title: "Andra steget",
          note: "Volymen ned ungefär 40 %. Farten ligger kvar i kortare block.",
          sessions: [
            run(1, racePace("Maratonfart", "Lopp", "Kortare block i maratonfart.", (k) => `${{ A: 3, B: 3, C: 2, D: 2 }[k]}x(8 min @WK + 2 min @RK)`)),
            easy(2, lv(40, 35, 30)),
            strides(3, lv(35, 30, 25, 25)),
            long(6, scaleLong(0.6)),
          ],
        },
      ],
    ),
    phase(
      { name: "Loppvecka", seasonPhase: "topp", purpose: "Utvilad till start.", focus: "Öppnare, aktivering och loppet.", specificity: 5, intensity: mix(75, 20, 5), minWeeks: 1, trimOrder: null },
      [
        raceWeek(
          "Loppvecka",
          "Ladda med kolhydrater de sista två dagarna. Börja lugnare än du tror.",
          racePace("Öppnare", "Lopp", "Kort och lätt med några minuter i maratonfart.", (k) => `${{ A: 3, B: 3, C: 2, D: 2 }[k]}x(3 min @WK + 2 min @RK)`),
          lv(180, 210, 240, 270),
        ),
      ],
    ),
  ],
};

const overgang: PlanSeed = {
  slug: "lop-overgang",
  category: "lopning",
  focus: null,
  basis: "MP",
  title: "Övergång och återhämtning (1–4 veckor)",
  summary: "Lugn löpning och vila efter ett lopp eller en säsong, innan nästa grund.",
  goal: "Att kroppen och huvudet återhämtar sig, så att nästa grundperiod börjar utvilad.",
  description:
    "Efter ett huvudlopp eller en säsong behöver kroppen vila innan nästa period. Planen är nästan bara lugn löpning i korta pass, med alternativ träning som cykling eller simning när det lockar mer. Ingen kvalitet. Ökar volymen sista veckan inför grunden.",
  prerequisites: "Läggs efter ett lopp eller i slutet av säsongen.",
  minWeeks: 1,
  levels: LEVELS(mix(100, 0, 0)),
  phases: [
    phase(
      { name: "Vila", seasonPhase: "vila", purpose: "Återhämtning.", focus: "Korta lugna pass och vila.", specificity: 1, intensity: mix(100, 0, 0), minWeeks: 0, trimOrder: 1 },
      [1, 2, 3].map((n) => ({
        kind: "avlastning" as const,
        title: n === 1 ? "Vila" : `Lugn vecka ${n}`,
        note: n === 1 ? "Den första veckan efter loppet: vila eller korta joggar, bara om benen vill." : "Korta lugna pass. Byt mot cykel eller simning när det lockar mer.",
        sessions: [
          easy(1, lv(30 + n * 5, 25 + n * 5, 20 + n * 5, 20 + n * 5)),
          easy(3, lv(30 + n * 5, 25 + n * 5, 20 + n * 5)),
          strength(4, lv(25, 25, 20, 20), "Lätt styrka och rörlighet, inga tunga set."),
          easy(6, lv(40 + n * 10, 35 + n * 10, 30 + n * 5, 25 + n * 5)),
        ],
      })),
    ),
    phase(
      { name: "In mot grunden", seasonPhase: "vila", purpose: "Mjuk väg in i nästa grundperiod.", focus: "Lugn volym och stegringar.", specificity: 1, intensity: mix(95, 0, 5), minWeeks: 1, trimOrder: null },
      [
        {
          kind: "avlastning",
          title: "In mot grunden",
          note: "Volymen upp mot en vanlig vecka. Stegringarna kommer tillbaka.",
          sessions: [
            strides(1, lv(45, 40, 35, 30)),
            easy(2, lv(50, 45, 35)),
            strength(3, lv(30, 30, 25, 25), STRENGTH_BUILD),
            easy(4, lv(40)),
            long(6, scaleLong(0.8)),
          ],
        },
      ],
    ),
  ],
};

export const RUNNING_PLANS: PlanSeed[] = [
  grund,
  troskel,
  vo2max,
  spec10k,
  specHm,
  specM,
  specTrail,
  toppKort,
  toppLang,
  overgang,
];
