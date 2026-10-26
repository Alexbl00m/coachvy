/**
 * Cykelplanerna: en per fokus, skrivna ur Alexanders träningsfilosofi.
 *
 * Alla har samma fyra nivåer efter veckotimmar och samma vecka i grunden:
 * ett eller två kvalitetspass, lugn distans, ett långpass och styrka. Det
 * som skiljer planerna är kvalitetsformaten, progressionen och faserna.
 * Ett utvecklingsblock bygger på ett eller två återkommande format i tre
 * till fyra veckor, och progressionen ändrar en variabel i taget (avsnitt
 * 4.2 och 5). Lugnt ska vara lugnt (avsnitt 19), styrkan byggs i grunden
 * och underhålls sedan (avsnitt 20), och tester ligger där de påverkar
 * nästa beslut (avsnitt 12).
 *
 * Effekten anges i procent av FTP, som passbibliotekets cykelpass. Modulen
 * är ren data; `build.ts` kontrollerar den och gör SQL.
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

// ---------------------------------------------------------------------------
// Nivåer
// ---------------------------------------------------------------------------

const mix = (låg: number, medel: number, hög: number): Mix => ({ låg, medel, hög });

const LEVELS = (intensity: Mix): SeedLevel[] => [
  {
    key: "A",
    name: "Elitnära",
    description: "14–20 timmar i veckan. Flera år av strukturerad träning och god återhämtning.",
    hours: [14, 20],
    sessions: [8, 9],
    intensity,
  },
  {
    key: "B",
    name: "Ambitiös",
    description: "10–14 timmar i veckan. Du tränar regelbundet och tål två hårda pass i veckan.",
    hours: [10, 14],
    sessions: [6, 7],
    intensity,
  },
  {
    key: "C",
    name: "Mellan",
    description: "7–10 timmar i veckan. Jobb och familj sätter ramen, och veckan bygger på fem till sex pass.",
    hours: [7, 10],
    sessions: [5, 6],
    intensity,
  },
  {
    key: "D",
    name: "Grund",
    description: "5–7 timmar i veckan. Få pass, så varje pass har ett tydligt syfte.",
    hours: [5, 7],
    sessions: [4, 5],
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
// Strukturer
// ---------------------------------------------------------------------------

const Z2 = "56-72%";
const WU5 =
  "15 min 50-65% uppvärmning; 3x(30 s 110% uppvärmning + 1 min 50% uppvärmning); 3 min 55% uppvärmning";
const WU4 = "15 min 50-65% uppvärmning; 3 min 80% uppvärmning; 2 min 55% uppvärmning";
const WU3 = "15 min 50-65% uppvärmning";
const CD = "10 min 50% nedvarvning";
const q5 = (main: string) => `${WU5}; ${main}; ${CD}`;
const q4 = (main: string) => `${WU4}; ${main}; ${CD}`;
const q3 = (main: string) => `${WU3}; ${main}; ${CD}`;
const sets = (count: number, block: string, rest = "3 min 50%") =>
  Array.from({ length: count }, () => block).join(`; ${rest} vila; `);

const z2 = (min: number) => `${min} min ${Z2} distans`;
const rec = (min: number) => `${min} min 45-55% distans`;

// ---------------------------------------------------------------------------
// Pass
// ---------------------------------------------------------------------------

type Quality = Omit<SeedSession, "day" | "discipline">;

const session = (day: number, q: Quality): SeedSession => ({
  day,
  discipline: "cykling",
  ...q,
});

const easy = (day: number, minutes: ByLevel<number>, title = "Lugn distans"): SeedSession =>
  session(day, {
    type: "Distans",
    title,
    description: "Lugnt hela vägen, under LT1. Du ska kunna prata i hela meningar.",
    zone: "Lugnt",
    variants: map(minutes, z2),
  });

const recovery = (day: number, minutes: ByLevel<number>): SeedSession =>
  session(day, {
    type: "Återhämtning",
    title: "Återhämtning",
    description: "Mycket lugnt, gärna inne eller på slät väg. Benen ska kännas bättre efteråt.",
    zone: "Återhämtning",
    variants: map(minutes, rec),
  });

const long = (
  day: number,
  minutes: ByLevel<number>,
  description = "Lugnt hela vägen. Ät 60–80 g kolhydrater i timmen från start, så tål du mer kvalitet i veckan.",
): SeedSession =>
  session(day, {
    type: "Långpass",
    title: "Långpass",
    description,
    zone: "Lugnt",
    variants: map(minutes, z2),
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
  "Knäböj eller halvböj, bulgarisk utfallsböj och marklyft, plus bål. Tre set om 10–15 repetitioner med 2–3 minuters vila. Teknik först, tyngd sedan.";
const STRENGTH_HEAVY =
  "Samma övningar, tyngre: tre set om 6–8 repetitioner, 3–4 minuters vila. Sista repetitionen ska vara tung men ren.";
const STRENGTH_MAX =
  "Tre set om 4–6 tunga repetitioner, 3–5 minuters vila. Explosivt uppåt, kontrollerat nedåt.";
const STRENGTH_KEEP =
  "Underhåll: två set om 4–6 tunga repetitioner per övning. Inte dagen före ett nyckelpass.";

// Kvalitetsformat --------------------------------------------------------------

/** 30/15 (Rønnestad): serier om korta drag med kort vila. */
const vo2Short = (reps: ByLevel<number>, nSets: ByLevel<number>, note = ""): Quality => ({
  type: "Kvalitet",
  title: "30/15",
  description:
    "Serier om 30 sekunder hårt och 15 sekunder lätt. Syreupptaget hinner inte sjunka i vilan, så tiden nära VO₂max blir lång. Jämn effekt genom hela serien." +
    note,
  zone: "VO₂max",
  variants: map(reps, (r, k) => q5(sets(nSets[k] ?? 2, `${r}x(30 s 118-125% + 15 s 50%)`))),
});

/** Långa VO2max-intervaller, 4 × 8 min (Seiler). */
const vo2Long = (n: ByLevel<number>, minutes = 8): Quality => ({
  type: "Kvalitet",
  title: `${minutes} min-intervaller`,
  description:
    "Långa drag strax över tröskeln. Mycket tid nära VO₂max till en lägre upplevd kostnad än korta, hårda intervaller. Jämnt från första till sista draget.",
  zone: "VO₂max",
  variants: map(n, (count) => q5(`${count}x(${minutes} min 104-108% + 2 min 50%)`)),
});

const threshold = (n: ByLevel<number>, minutes: number): Quality => ({
  type: "Kvalitet",
  title: `Tröskel ${minutes} min`,
  description:
    "Jämnt strax under tröskeln, en effekt du skulle orka hålla i en timme. Höjer LT2 och hur stor del av VO₂max som går att hålla länge.",
  zone: "Tröskel",
  variants: map(n, (count) => q4(`${count}x(${minutes} min 95-100% + 5 min 55%)`)),
});

const sweetSpot = (n: ByLevel<number>, minutes: number): Quality => ({
  type: "Kvalitet",
  title: `Sweet spot ${minutes} min`,
  description:
    "Strax under tröskeln, lugnare än tröskelpasset. Mycket tid nära LT2 till en måttlig kostnad i återhämtning.",
  zone: "Medel",
  variants: map(n, (count) => q3(`${count}x(${minutes} min 88-93% + 5 min 55%)`)),
});

const overUnder = (nSets: ByLevel<number>, blocks: number): Quality => ({
  type: "Kvalitet",
  title: "Över–under",
  description:
    "Två minuter strax under tröskeln och en minut över, i block. Tränar att tåla ryck och komma tillbaka nära tröskeln.",
  zone: "Tröskel",
  variants: map(nSets, (s) =>
    q4(sets(s, Array.from({ length: blocks }, () => "2 min 92-95% + 1 min 103-107%").join(" + "), "5 min 55%")),
  ),
});

const torque = (n: ByLevel<number>, minutes: number): Quality => ({
  type: "Kraft",
  title: `Kraft på låg kadens ${minutes} min`,
  description:
    "Sittande i 55–65 varv per minut, strax under tröskeln. Kraften i varje tramptag ökar medan pulsen blir måttlig. Mjukt och runt, inga ryck. Hoppa över vid knäbesvär.",
  zone: "Medel",
  variants: map(n, (count) => q3(`${count}x(${minutes} min 85-90% 55-65 rpm + 3 min 55%)`)),
});

const openers: Quality = {
  type: "Aktivering",
  title: "Öppnare",
  description: "Kort och lätt med några korta drag. Benen ska kännas pigga, inte trötta.",
  zone: "Lugnt",
  variants: lv(
    q3("3x(1 min 110% + 2 min 55%)"),
    q3("3x(1 min 110% + 2 min 55%)"),
    q3("3x(1 min 110% + 2 min 55%)"),
    q3("2x(1 min 110% + 2 min 55%)"),
  ),
};

/** CP-test: 5 och 20 minuter helt ut, samma dag. */
const cpTest: Quality = {
  type: "Test",
  title: "Test: 5 och 20 minuter",
  description:
    "Två drag helt ut med jämn effekt: 5 minuter, lugnt en halvtimme, sedan 20 minuter. Ger CP och W′, och med VO₂max utnyttjandegraden som avgör nästa block. Utvilad, väl fylld och samma förhållanden som förra testet.",
  zone: "Test",
  variants: lv(
    q4("5 min 110-130% test; 25 min 50-60% vila; 20 min 95-105% test"),
    q4("5 min 110-130% test; 25 min 50-60% vila; 20 min 95-105% test"),
    q4("5 min 110-130% test; 25 min 50-60% vila; 20 min 95-105% test"),
    q4("5 min 110-130% test; 25 min 50-60% vila; 20 min 95-105% test"),
  ),
};

// ---------------------------------------------------------------------------
// Veckan
// ---------------------------------------------------------------------------

/** Långpassets längd per nivå, som andel av grundlängden. */
const LONG = lv(270, 210, 180, 150);
const scaleLong = (factor: number) =>
  map(LONG, (m) => Math.round((m * factor) / 15) * 15);

type WeekPlan = {
  title: string;
  note?: string;
  /** Tisdagens kvalitetspass. */
  q: Quality;
  /** Söndagens andra kvalitetspass; utan blir söndagen lugn distans. */
  q2?: Quality;
  /** Långpasset, som andel av grundlängden. */
  longFactor?: number;
  /** Ett eget långpass i stället för det lugna. */
  longSession?: SeedSession;
  /** Styrkepass i veckan: 0, 1 eller 2. */
  strength: 0 | 1 | 2;
  strengthText?: string;
};

/**
 * En vanlig vecka: vila måndag (A har återhämtning), kvalitet tisdag, lugn
 * distans onsdag och torsdag, styrka torsdag och fredag, långpass lördag
 * och distans eller kvalitet söndag.
 */
function week(p: WeekPlan): SeedWeek {
  const s: SeedSession[] = [
    recovery(0, lv(60)),
    session(1, p.q),
    easy(2, lv(150, 120, 90)),
    easy(3, lv(120, 90)),
  ];
  if (p.strength >= 1) s.push(strength(3, lv(45, 45, 45, 40), p.strengthText ?? STRENGTH_BUILD));
  if (p.strength >= 2) s.push(strength(4, lv(40, 40, 40, 30), p.strengthText ?? STRENGTH_BUILD));
  s.push(recovery(4, lv(60)));
  s.push(p.longSession ?? long(5, scaleLong(p.longFactor ?? 1)));
  s.push(p.q2 ? session(6, p.q2) : easy(6, lv(180, 150, 120, 90)));
  return { kind: "normal", title: p.title, note: p.note, sessions: s };
}

/** Avlastning: ungefär 60 % av volymen, ett kort kvalitetsinslag. */
function easyWeek(title = "Avlastning", note?: string): SeedWeek {
  return {
    kind: "avlastning",
    title,
    note:
      note ??
      "Lättare vecka så att belastningen hinner bli form. Sov, ät och låt bli att fylla på med extra pass.",
    sessions: [
      session(1, openers),
      easy(2, lv(90, 75, 60)),
      strength(3, lv(30, 30, 30, 30), STRENGTH_KEEP),
      long(5, scaleLong(0.65)),
      easy(6, lv(120, 90, 75, 60)),
    ],
  };
}

/** Testvecka: lugnt före, testet mitt i veckan, distans efter. */
function testWeek(title = "Test", note?: string): SeedWeek {
  return {
    kind: "test",
    title,
    checkpoint: true,
    note:
      note ??
      "Testet visar vad blocket gav och var tröskeln begränsas nu. Lägg in resultatet i Coachvy, så föreslås nästa plan ur det.",
    sessions: [
      easy(1, lv(75, 60, 60, 45)),
      session(2, openers),
      session(3, cpTest),
      easy(5, scaleLong(0.6)),
      easy(6, lv(120, 90, 75, 60)),
    ],
  };
}

const phase = (p: Omit<SeedPhase, "weeks">, weeks: SeedWeek[]): SeedPhase => ({
  ...p,
  weeks,
});

const POLAR = mix(85, 5, 10);
const BUILD_VO2 = mix(80, 5, 15);
const BUILD_T = mix(78, 15, 7);
const SPECIFIC_LONG = mix(75, 20, 5);

// ---------------------------------------------------------------------------
// Planerna
// ---------------------------------------------------------------------------

const grund: PlanSeed = {
  slug: "cykel-grundtraning",
  category: "cykel",
  focus: "grund",
  title: "Grundträning på cykeln (8–12 veckor)",
  summary: "Aerob volym, en utvald hög intensitet i veckan och tung styrka. Slutar med ett test.",
  goal: "En större aerob bas: mer watt vid låg belastning, och en kropp som tål mer kvalitet i nästa block.",
  description:
    "Grundperioden är polariserad: det mesta lugnt, en utvald hög intensitet i veckan och lite mellanintensitet (avsnitt 3 och 19). Långpassen växer, och styrkan byggs från 10–15 repetitioner mot 4–6 (avsnitt 20). Sent i perioden kommer sweet spot in, som förbereder för mer tid nära tröskeln i nästa block.\n\nPlanen slutar med ett test. Resultatet visar var tröskeln begränsas, och Coachvy föreslår nästa plan ur det.",
  prerequisites: "Du cyklar regelbundet och klarar två timmar i lugnt tempo. Ett FTP- eller CP-värde gör effekterna rätt från start.",
  minWeeks: 8,
  levels: LEVELS(POLAR),
  phases: [
    phase(
      { name: "Grund 1", seasonPhase: "grund", purpose: "Etablera volymen och rytmen i veckan.", focus: "Lugn distans, 30/15 i låg dos och styrka med lätta vikter.", specificity: 1, intensity: POLAR, minWeeks: 2, trimOrder: 1 },
      [
        week({ title: "Introduktion", q: vo2Short(lv(10, 10, 10, 8), lv(2, 2, 2, 2)), strength: 2, longFactor: 0.85 }),
        week({ title: "Mer volym", q: vo2Short(lv(11, 11, 10, 9), lv(2, 2, 2, 2)), strength: 2, longFactor: 0.95 }),
        week({ title: "Längre långpass", q: vo2Short(lv(12, 12, 11, 10), lv(2, 2, 2, 2)), strength: 2, longFactor: 1 }),
        easyWeek(),
      ],
    ),
    phase(
      { name: "Grund 2", seasonPhase: "grund", purpose: "Mer volym och tyngre styrka.", focus: "Tre serier 30/15, längre långpass och styrka om 6–8 repetitioner.", specificity: 2, intensity: POLAR, minWeeks: 2, trimOrder: 2 },
      [
        week({ title: "Tre serier", q: vo2Short(lv(10, 10, 10, 9), lv(3, 3, 2, 2)), strength: 2, strengthText: STRENGTH_HEAVY, longFactor: 1 }),
        week({ title: "Längre serier", q: vo2Short(lv(12, 11, 11, 10), lv(3, 3, 2, 2)), strength: 2, strengthText: STRENGTH_HEAVY, longFactor: 1.05 }),
        week({ title: "Volymtopp", q: vo2Short(lv(13, 12, 12, 11), lv(3, 3, 2, 2)), strength: 2, strengthText: STRENGTH_HEAVY, longFactor: 1.1 }),
        easyWeek(),
      ],
    ),
    phase(
      { name: "Grund 3 och test", seasonPhase: "grund", purpose: "Tröskeln får sina första inslag, och perioden avslutas med ett test.", focus: "Sweet spot på söndagen, 30/15 på tisdagen och tung styrka.", specificity: 2, intensity: mix(82, 8, 10), minWeeks: 4, trimOrder: null },
      [
        week({ title: "Sweet spot in", q: vo2Short(lv(13, 12, 12, 11), lv(3, 3, 2, 2)), q2: sweetSpot(lv(3, 3, 2, 2), 12), strength: 2, strengthText: STRENGTH_MAX, longFactor: 1.05 }),
        week({ title: "Längre sweet spot", q: vo2Short(lv(13, 13, 12, 11), lv(3, 3, 2, 2)), q2: sweetSpot(lv(3, 3, 2, 2), 15), strength: 2, strengthText: STRENGTH_MAX, longFactor: 1.1 }),
        easyWeek("Avlastning före testet"),
        testWeek(),
      ],
    ),
  ],
};

const tak: PlanSeed = {
  slug: "cykel-lyft-taket",
  category: "cykel",
  focus: "tak",
  title: "Lyft taket: grund och VO₂max (8–12 veckor)",
  summary: "En grundperiod som leder in i ett VO₂max-block, för den vars tröskel redan ligger nära taket.",
  goal: "Högre VO₂max, så att tröskeln har mer att växa mot.",
  description:
    "När tröskeln utnyttjar en stor del av VO₂max är det taket som begränsar (avsnitt 8). Planen bygger först en grund med volym och 30/15 i låg dos, och går sedan in i ett VO₂max-block på fyra veckor med två återkommande format: 30/15 och långa intervaller om 8 minuter (avsnitt 25). Varje vecka ändras en sak i ett av formaten. Sist ett test som visar vad blocket gav.\n\nKortas planen tas veckor bort ur grundperioden, aldrig ur blocket.",
  prerequisites: "Ett test som visar hög utnyttjandegrad, och att du tål två hårda pass i veckan. Under 8 veckor: välj Boosta VO₂max.",
  minWeeks: 8,
  levels: LEVELS(BUILD_VO2),
  phases: [
    phase(
      { name: "Grund", seasonPhase: "grund", purpose: "Volym och robusthet inför blocket.", focus: "Lugn distans, 30/15 i låg dos och styrka.", specificity: 1, intensity: POLAR, minWeeks: 2, trimOrder: 1 },
      [
        week({ title: "Introduktion", q: vo2Short(lv(10, 10, 10, 8), lv(2, 2, 2, 2)), strength: 2, longFactor: 0.9 }),
        week({ title: "Mer volym", q: vo2Short(lv(12, 11, 11, 10), lv(2, 2, 2, 2)), strength: 2, longFactor: 1 }),
        week({ title: "Volymtopp", q: vo2Short(lv(13, 12, 12, 11), lv(2, 2, 2, 2)), strength: 2, strengthText: STRENGTH_HEAVY, longFactor: 1.05 }),
        easyWeek(),
        week({ title: "Tre serier", q: vo2Short(lv(10, 10, 10, 9), lv(3, 3, 2, 2)), strength: 2, strengthText: STRENGTH_HEAVY, longFactor: 1.05 }),
        week({ title: "Inför blocket", q: vo2Short(lv(12, 11, 11, 10), lv(3, 3, 2, 2)), strength: 1, strengthText: STRENGTH_HEAVY, longFactor: 1 }),
      ],
    ),
    phase(
      { name: "VO₂max-block", seasonPhase: "uppbyggnad", purpose: "Lyfta VO₂max med två återkommande format.", focus: "30/15 på tisdag och 8-minutersintervaller på söndag.", specificity: 3, intensity: BUILD_VO2, minWeeks: 4, trimOrder: null },
      [
        week({ title: "Etablera", note: "Hitta effekten du kan hålla i alla drag. Hellre lite för lågt än att tappa i sista.", q: vo2Short(lv(12, 12, 11, 10), lv(3, 3, 3, 2)), q2: vo2Long(lv(4, 4, 3, 3)), strength: 1, strengthText: STRENGTH_KEEP, longFactor: 0.9 }),
        week({ title: "Fler drag", note: "Ett drag till i 8-minutersintervallerna. 30/15 som förra veckan.", q: vo2Short(lv(12, 12, 11, 10), lv(3, 3, 3, 2)), q2: vo2Long(lv(5, 5, 4, 3)), strength: 1, strengthText: STRENGTH_KEEP, longFactor: 0.9 }),
        week({ title: "Längre serier", note: "Fler repetitioner i 30/15. 8-minutersintervallerna som förra veckan.", q: vo2Short(lv(14, 13, 13, 12), lv(3, 3, 3, 2)), q2: vo2Long(lv(5, 5, 4, 3)), strength: 1, strengthText: STRENGTH_KEEP, longFactor: 0.9 }),
        easyWeek("Avlastning", "Blocket blir form den här veckan. Är benen fortfarande tunga på fredag, ta en vilodag till."),
      ],
    ),
    phase(
      { name: "Konsolidera och testa", seasonPhase: "uppbyggnad", purpose: "Behålla det blocket gav och mäta det.", focus: "En VO₂max-dos, sweet spot och testet.", specificity: 3, intensity: mix(80, 10, 10), minWeeks: 2, trimOrder: null },
      [
        week({ title: "Behåll", q: vo2Long(lv(4, 4, 3, 3)), q2: sweetSpot(lv(3, 2, 2, 2), 15), strength: 1, strengthText: STRENGTH_KEEP, longFactor: 1 }),
        testWeek(),
      ],
    ),
  ],
};

const vo2max: PlanSeed = {
  slug: "cykel-boosta-vo2max",
  category: "cykel",
  focus: "vo2max",
  title: "Boosta VO₂max (4–5 veckor)",
  summary: "Ett koncentrerat VO₂max-block med två återkommande format, för den som redan har grunden.",
  goal: "Högre VO₂max och effekt i 3–8 minuter på fyra veckor.",
  description:
    "Ett VO₂max-block enligt filosofin: två återkommande format i tre veckor, och en variabel i taget (avsnitt 4.2 och 5). 30/15 ger lång tid nära VO₂max till en lägre upplevd kostnad, och 8-minutersintervallerna gav störst utveckling i Seilers jämförelse (avsnitt 26). Fjärde veckan är lätt, och sist kommer ett test.\n\nPlanen förutsätter en grund. Har du inte tränat strukturerat de senaste två månaderna, välj Lyft taket.",
  prerequisites: "En grundperiod bakom dig, och att du tål två hårda pass i veckan med lätta dagar runt.",
  minWeeks: 4,
  levels: LEVELS(BUILD_VO2),
  phases: [
    phase(
      { name: "VO₂max-block", seasonPhase: "uppbyggnad", purpose: "Lyfta VO₂max.", focus: "30/15 på tisdag och 8-minutersintervaller på söndag.", specificity: 3, intensity: BUILD_VO2, minWeeks: 4, trimOrder: null },
      [
        week({ title: "Etablera", note: "Hitta effekten du kan hålla i alla drag.", q: vo2Short(lv(12, 12, 11, 10), lv(3, 3, 3, 2)), q2: vo2Long(lv(4, 4, 3, 3)), strength: 1, strengthText: STRENGTH_KEEP, longFactor: 0.9 }),
        week({ title: "Fler drag", note: "Ett drag till i 8-minutersintervallerna.", q: vo2Short(lv(12, 12, 11, 10), lv(3, 3, 3, 2)), q2: vo2Long(lv(5, 5, 4, 3)), strength: 1, strengthText: STRENGTH_KEEP, longFactor: 0.9 }),
        week({ title: "Längre serier", note: "Fler repetitioner i 30/15.", q: vo2Short(lv(14, 13, 13, 12), lv(3, 3, 3, 2)), q2: vo2Long(lv(5, 5, 4, 3)), strength: 1, strengthText: STRENGTH_KEEP, longFactor: 0.9 }),
        easyWeek(),
      ],
    ),
    phase(
      { name: "Test", seasonPhase: "uppbyggnad", purpose: "Mäta vad blocket gav.", focus: "Testet.", specificity: 3, intensity: mix(85, 5, 10), minWeeks: 0, trimOrder: 1 },
      [testWeek()],
    ),
  ],
};

const troskel: PlanSeed = {
  slug: "cykel-hoj-troskeln",
  category: "cykel",
  focus: "troskel",
  title: "Höj tröskeln (6–10 veckor)",
  summary: "Två tröskelblock med längre drag vecka för vecka, för den vars tröskel ligger långt under taket.",
  goal: "Högre LT2 och en större del av VO₂max som går att hålla länge.",
  description:
    "När tröskeln ligger långt under VO₂max är det utnyttjandet som begränsar (avsnitt 8). Tröskelarbete och lugn volym flyttar det, och sänker en hög VLamax över tid. Första blocket bygger tid strax under tröskeln med längre drag varje vecka. Andra blocket har längre sammanhängande tröskel och över–under, som tränar att tåla ryck nära tröskeln (avsnitt 25). En dos 30/15 håller VO₂max uppe. Sist ett test.",
  prerequisites: "Ett test som visar låg eller medelhög utnyttjandegrad, och att du klarar 2 × 20 minuter i sweet spot.",
  minWeeks: 6,
  levels: LEVELS(BUILD_T),
  phases: [
    phase(
      { name: "Tröskelblock 1", seasonPhase: "uppbyggnad", purpose: "Bygga tid strax under tröskeln.", focus: "Tröskelintervaller på tisdag och sweet spot på söndag. Dragen blir längre varje vecka.", specificity: 3, intensity: BUILD_T, minWeeks: 3, trimOrder: 2 },
      [
        week({ title: "12 minuter", q: threshold(lv(3, 3, 3, 2), 12), q2: sweetSpot(lv(3, 2, 2, 2), 15), strength: 1, strengthText: STRENGTH_HEAVY }),
        week({ title: "15 minuter", q: threshold(lv(3, 3, 3, 2), 15), q2: sweetSpot(lv(3, 2, 2, 2), 15), strength: 1, strengthText: STRENGTH_HEAVY }),
        week({ title: "18 minuter", q: threshold(lv(3, 3, 2, 2), 18), q2: sweetSpot(lv(3, 2, 2, 2), 20), strength: 1, strengthText: STRENGTH_HEAVY }),
        easyWeek(),
      ],
    ),
    phase(
      { name: "Tröskelblock 2", seasonPhase: "uppbyggnad", purpose: "Längre sammanhängande tröskel och förmågan att tåla ryck.", focus: "Långa tröskeldrag på tisdag och över–under på söndag.", specificity: 4, intensity: BUILD_T, minWeeks: 2, trimOrder: 1 },
      [
        week({ title: "20 minuter", q: threshold(lv(2, 2, 2, 2), 20), q2: overUnder(lv(3, 3, 2, 2), 3), strength: 1, strengthText: STRENGTH_KEEP }),
        week({ title: "25 minuter", q: threshold(lv(2, 2, 2, 2), 25), q2: overUnder(lv(3, 3, 2, 2), 3), strength: 1, strengthText: STRENGTH_KEEP }),
        week({ title: "30 minuter", q: threshold(lv(2, 2, 2, 1), 30), q2: overUnder(lv(3, 3, 2, 2), 4), strength: 1, strengthText: STRENGTH_KEEP }),
        easyWeek(),
      ],
    ),
    phase(
      { name: "Behåll och testa", seasonPhase: "uppbyggnad", purpose: "Behålla tröskeln, hålla VO₂max uppe och mäta.", focus: "En tröskeldos, 30/15 och testet.", specificity: 3, intensity: mix(80, 12, 8), minWeeks: 1, trimOrder: 3 },
      [
        week({ title: "Behåll", q: vo2Short(lv(12, 12, 11, 10), lv(3, 2, 2, 2)), q2: threshold(lv(2, 2, 2, 2), 20), strength: 1, strengthText: STRENGTH_KEEP }),
        testWeek(),
      ],
    ),
  ],
};

const styrka: PlanSeed = {
  slug: "cykel-styrka",
  category: "cykel",
  focus: "styrka",
  title: "Styrka på cykeln (6–8 veckor)",
  summary: "Kraft på låg kadens och tung styrka, för tramptaget i backar, i tunga växlar och i tempoposition.",
  goal: "Mer kraft i varje tramptag och en bättre rörelseekonomi.",
  description:
    "Tung styrka ger bättre ekonomi, högre maxeffekt och starkare senor (avsnitt 20). Kraftpassen på låg kadens för över styrkan till cykeln: sittande i 55–65 varv per minut, strax under tröskeln (avsnitt 25). De räknas som medelpass och ersätter inte gymmet. Dragen blir fler i första blocket och längre i andra, och styrkan går från 6–8 mot 4–6 tunga repetitioner. En dos 30/15 håller VO₂max uppe.\n\nPassar bäst i grundperioden, långt från loppet. Undvik kraftpassen vid knäbesvär.",
  prerequisites: "Inga knäbesvär, och vana vid knäböj och marklyft med god teknik.",
  minWeeks: 6,
  levels: LEVELS(mix(80, 12, 8)),
  phases: [
    phase(
      { name: "Kraft 1", seasonPhase: "grund", purpose: "Etablera kraftpassen och bygga styrka.", focus: "Kraft på låg kadens i 5-minutersdrag, fler drag varje vecka, och styrka två gånger i veckan.", specificity: 2, intensity: mix(80, 12, 8), minWeeks: 3, trimOrder: 2 },
      [
        week({ title: "Fyra drag", q: torque(lv(4, 4, 4, 3), 5), q2: vo2Short(lv(10, 10, 10, 9), lv(2, 2, 2, 2)), strength: 2, strengthText: STRENGTH_HEAVY }),
        week({ title: "Fem drag", q: torque(lv(5, 5, 5, 4), 5), q2: vo2Short(lv(10, 10, 10, 9), lv(2, 2, 2, 2)), strength: 2, strengthText: STRENGTH_HEAVY }),
        week({ title: "Sex drag", q: torque(lv(6, 6, 5, 4), 5), q2: vo2Short(lv(11, 11, 10, 10), lv(2, 2, 2, 2)), strength: 2, strengthText: STRENGTH_HEAVY }),
        easyWeek(),
      ],
    ),
    phase(
      { name: "Kraft 2", seasonPhase: "uppbyggnad", purpose: "Längre drag på låg kadens och tyngre styrka.", focus: "8-minutersdrag på låg kadens och styrka om 4–6 repetitioner.", specificity: 3, intensity: mix(78, 14, 8), minWeeks: 3, trimOrder: 1 },
      [
        week({ title: "Längre drag", q: torque(lv(4, 4, 3, 3), 8), q2: vo2Short(lv(12, 11, 11, 10), lv(2, 2, 2, 2)), strength: 2, strengthText: STRENGTH_MAX }),
        week({ title: "Ett drag till", q: torque(lv(5, 5, 4, 3), 8), q2: vo2Short(lv(12, 11, 11, 10), lv(2, 2, 2, 2)), strength: 2, strengthText: STRENGTH_MAX }),
        easyWeek("Avlastning före testet"),
        testWeek(),
      ],
    ),
  ],
};

/** Långpass för ultra: lugnt med block i loppfart. */
const ultraLong = (minutes: ByLevel<number>, blocks: number, blockMin: number): SeedSession =>
  session(5, {
    type: "Långpass",
    title: "Långpass med loppfart",
    description:
      "Lugnt, med block i den fart du tänker hålla i loppet. Öva loppets energiplan: 80–90 g kolhydrater i timmen och vätska efter värmen.",
    zone: "Medel",
    variants: map(minutes, (m) => {
      const work = blocks * (blockMin + 10);
      const pre = Math.max(30, Math.round((m - work) / 2));
      const post = Math.max(20, m - work - pre);
      return `${pre} min ${Z2} distans; ${blocks}x(${blockMin} min 72-80% + 10 min 60%); ${post} min ${Z2} distans`;
    }),
  });

const ultra: PlanSeed = {
  slug: "cykel-ultra",
  category: "cykel",
  focus: "ultra",
  title: "Ultra på cykeln (10–14 veckor)",
  summary: "Från volym till loppfart i långa pass, med energiplanen inövad och en toppning före start.",
  goal: "Genomföra ett ultralopp, 200 km eller mer, i jämn fart med energin intakt hela vägen.",
  description:
    "Ett ultralopp avgörs av tid på cykeln, energi och jämn fart, mer än av tröskeln. Planen bygger först volym, sedan tröskel och sweet spot, och i den specifika perioden långa pass med block i loppfart och helger med två långa pass i rad (avsnitt 6 och 19). Energiplanen övas i varje långpass: 80–90 g kolhydrater i timmen. Hög intensitet ligger kvar som en underhållsdos. De sista två veckorna sjunker volymen men inte intensiteten (avsnitt 13).",
  prerequisites: "Du har cyklat fyra timmar eller mer och klarar tre pass i veckan utöver långpasset.",
  minWeeks: 10,
  levels: LEVELS(SPECIFIC_LONG),
  phases: [
    phase(
      { name: "Volym", seasonPhase: "grund", purpose: "Bygga tid på cykeln.", focus: "Långa lugna pass, 30/15 i låg dos och styrka.", specificity: 1, intensity: POLAR, minWeeks: 2, trimOrder: 1 },
      [
        week({ title: "Introduktion", q: vo2Short(lv(10, 10, 10, 8), lv(2, 2, 2, 2)), strength: 2, longFactor: 1 }),
        week({ title: "Längre långpass", q: vo2Short(lv(11, 11, 10, 9), lv(2, 2, 2, 2)), strength: 2, strengthText: STRENGTH_HEAVY, longFactor: 1.15 }),
        week({ title: "Volymtopp", q: vo2Short(lv(12, 12, 11, 10), lv(2, 2, 2, 2)), strength: 2, strengthText: STRENGTH_HEAVY, longFactor: 1.25 }),
        easyWeek(),
      ],
    ),
    phase(
      { name: "Uppbyggnad", seasonPhase: "uppbyggnad", purpose: "Höja tröskeln och vänja kroppen vid loppfarten.", focus: "Tröskel på tisdag och långpass med block i loppfart.", specificity: 3, intensity: BUILD_T, minWeeks: 3, trimOrder: 2 },
      [
        week({ title: "Loppfart in", q: threshold(lv(3, 3, 2, 2), 12), longSession: ultraLong(scaleLong(1.2), 2, 20), strength: 1, strengthText: STRENGTH_KEEP }),
        week({ title: "Längre block", q: threshold(lv(3, 3, 2, 2), 15), longSession: ultraLong(scaleLong(1.25), 2, 30), strength: 1, strengthText: STRENGTH_KEEP }),
        week({ title: "Längre pass", q: threshold(lv(2, 2, 2, 2), 20), longSession: ultraLong(scaleLong(1.3), 2, 30), strength: 1, strengthText: STRENGTH_KEEP }),
        easyWeek(),
      ],
    ),
    phase(
      { name: "Specifik", seasonPhase: "specifik", purpose: "Loppet i delar: långa pass i loppfart och två långa pass i rad.", focus: "Långpass med långa block i loppfart, söndagens distans på trötta ben och en underhållsdos VO₂max.", specificity: 5, intensity: SPECIFIC_LONG, minWeeks: 3, trimOrder: 3 },
      [
        week({ title: "Två dagar i rad", note: "Söndagens pass görs på trötta ben. Det är poängen.", q: vo2Long(lv(4, 3, 3, 3)), longSession: ultraLong(scaleLong(1.3), 3, 30), strength: 1, strengthText: STRENGTH_KEEP }),
        week({ title: "Längre block", note: "Samma energiplan som i loppet: det du äter här är det du äter då.", q: sweetSpot(lv(3, 2, 2, 2), 15), longSession: ultraLong(scaleLong(1.35), 3, 40), strength: 1, strengthText: STRENGTH_KEEP }),
        week({ title: "Generalrepetition", note: "Det längsta passet: utrustning, mat och fart som i loppet.", q: vo2Long(lv(4, 3, 3, 3)), longSession: ultraLong(scaleLong(1.4), 3, 45), strength: 0 }),
        easyWeek(),
      ],
    ),
    phase(
      { name: "Toppning", seasonPhase: "topp", purpose: "Mindre volym, samma intensitet. Utvilad till start.", focus: "Korta drag i loppfart och VO₂max, öppnare och loppet.", specificity: 5, intensity: mix(70, 20, 10), minWeeks: 2, trimOrder: null },
      [
        {
          kind: "normal",
          title: "Nedtrappning",
          note: "Volymen sjunker med ungefär 40 %, intensiteten ligger kvar. Styrkan är borta.",
          sessions: [
            session(1, vo2Long(lv(3, 3, 3, 2))),
            easy(2, lv(150, 105, 75, 60)),
            easy(3, lv(105, 75, 60)),
            session(5, sweetSpot(lv(4, 3, 2, 2), 15)),
            easy(6, lv(210, 150, 120, 90)),
          ],
        },
        {
          kind: "tävling",
          title: "Loppvecka",
          note: "Fyll på med kolhydrater de sista två dagarna. Börja loppet lugnare än du tror.",
          sessions: [
            easy(1, lv(60, 60, 45, 45)),
            session(2, openers),
            easy(3, lv(45, 45, 45, 30)),
            session(4, openers),
          ],
        },
      ],
    ),
  ],
};

/** Långpass för durability: lugnt först, sedan kvalitet på trötta ben. */
const durabilityLong = (pre: ByLevel<number>, efforts: number, effortMin: number, pct: string): SeedSession =>
  session(5, {
    type: "Långpass",
    title: `Durability: ${efforts} × ${effortMin} min sist`,
    description:
      "Lugnt först, sedan dragen på trötta ben. Effekten i dragen jämförs vecka för vecka: håller den, har durability blivit bättre. Ät 70–90 g kolhydrater i timmen från start.",
    zone: "Medel",
    variants: map(pre, (m) => `${m} min ${Z2} distans; ${efforts}x(${effortMin} min ${pct} + 5 min 55%); 15 min 50% nedvarvning`),
  });

const durability: PlanSeed = {
  slug: "cykel-durability",
  category: "cykel",
  focus: "durability",
  title: "Durability: håll effekten länge (6–8 veckor)",
  summary: "Kvalitet efter timmar av lugnt arbete, för långa lopp där slutet avgör.",
  goal: "Att trösklarna och effekten sjunker mindre efter timmar på cykeln.",
  description:
    "Durability är hur mycket trösklar och effekt sjunker efter timmar av arbete, och en egen prestationsfaktor i långa lopp (avsnitt 26). Planen lägger kvaliteten sist i långpasset. Först blir den lugna delen före dragen längre med samma drag; sedan blir dragen längre med samma lugna del. Det är en variabel i taget, och effekten i dragen visar utvecklingen. En dos 30/15 håller VO₂max uppe, och styrkan underhålls.",
  prerequisites: "Du klarar 2 × 20 minuter vid tröskeln utvilad och har cyklat tre timmar eller mer.",
  minWeeks: 6,
  levels: LEVELS(SPECIFIC_LONG),
  phases: [
    phase(
      { name: "Längre före dragen", seasonPhase: "specifik", purpose: "Samma drag efter allt längre lugn distans.", focus: "Långpass med tröskeldrag sist, och 30/15 på tisdag.", specificity: 4, intensity: SPECIFIC_LONG, minWeeks: 3, trimOrder: 2 },
      [
        week({ title: "Två timmar före", q: vo2Short(lv(12, 11, 11, 10), lv(2, 2, 2, 2)), longSession: durabilityLong(lv(150, 120, 105, 90), 3, 10, "95-100%"), strength: 1, strengthText: STRENGTH_KEEP }),
        week({ title: "Längre före", q: vo2Short(lv(12, 11, 11, 10), lv(2, 2, 2, 2)), longSession: durabilityLong(lv(180, 150, 120, 105), 3, 10, "95-100%"), strength: 1, strengthText: STRENGTH_KEEP }),
        week({ title: "Längst före", q: vo2Short(lv(13, 12, 12, 11), lv(2, 2, 2, 2)), longSession: durabilityLong(lv(210, 165, 135, 120), 3, 10, "95-100%"), strength: 1, strengthText: STRENGTH_KEEP }),
        easyWeek(),
      ],
    ),
    phase(
      { name: "Längre drag", seasonPhase: "specifik", purpose: "Längre drag efter samma lugna del, och ett test på trötta ben.", focus: "Långpass med allt längre sweet spot sist, och tröskel på tisdag.", specificity: 5, intensity: SPECIFIC_LONG, minWeeks: 3, trimOrder: 1 },
      [
        week({ title: "2 × 15 minuter", q: threshold(lv(2, 2, 2, 2), 15), longSession: durabilityLong(lv(210, 165, 135, 120), 2, 15, "90-95%"), strength: 1, strengthText: STRENGTH_KEEP }),
        week({ title: "2 × 20 minuter", q: threshold(lv(2, 2, 2, 2), 15), longSession: durabilityLong(lv(210, 165, 135, 120), 2, 20, "90-95%"), strength: 1, strengthText: STRENGTH_KEEP }),
        easyWeek("Avlastning före testet"),
        {
          kind: "test",
          title: "Test på trötta ben",
          checkpoint: true,
          note: "Jämför 20-minutersdraget efter den lugna delen med ditt 20-minutersvärde utvilad. Ju mindre skillnad, desto bättre durability.",
          sessions: [
            easy(1, lv(75, 60, 60, 45)),
            session(2, openers),
            session(5, {
              type: "Test",
              title: "Test: 20 minuter efter lugn distans",
              description:
                "Lugn distans, sedan 20 minuter helt ut med jämn effekt. Ät och drick som i ett lopp.",
              zone: "Test",
              variants: map(lv(180, 150, 120, 105), (m) => `${m} min ${Z2} distans; 5 min 55%; 20 min 95-105% test; 15 min 50% nedvarvning`),
            }),
            easy(6, lv(120, 90, 75, 60)),
          ],
        },
      ],
    ),
  ],
};

export const CYCLING_PLANS: PlanSeed[] = [grund, tak, vo2max, troskel, styrka, ultra, durability];
