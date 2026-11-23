/**
 * Simpassen i passbiblioteket: Alexanders simsystem med åtta passfamiljer i
 * tre faser, CSS-testet och passen för avlastning och toppning.
 *
 * Farten står som tillägg till CSS i sekunder per 100 m, och tävlingsfarten
 * som `@IM` (swim-pace.ts). Passet räknas om mot adeptens egen CSS när det
 * ges till en adept. Texterna följer träningsfilosofin, avsnitt 27: en
 * gemensam ram (400 m uppvärmning, 200 m teknik, 200 m förberedelse,
 * huvudserien och 200 m nedvarvning; Smooth Criminal har 300 m teknik),
 * ett tröskelformat per block och tekniken före farten.
 *
 * Nivåerna är A–D som i planerna: A är fyra simpass i veckan (11,5–13 km),
 * B och C tre (9,5–10,5 och 8–9 km) och D två (5–7 km). I simsystemets
 * material heter de nivå 4, 3, 2 och 1. Passets idé är densamma på alla
 * nivåer; huvudserien växer. A simmar inte hårdare än B, bara oftare, så
 * några pass är lika långa eller kortare på A.
 *
 * Race-passen står i Ironmanfart. Mot 70.3 byts `@IM` mot `@703`.
 *
 * Modulen är ren data. `seed.ts` gör SQL av den.
 */

import type { LibraryInput } from "../library";

type Levels = { A: string; B: string; C: string; D: string };

type Atlas = Omit<LibraryInput, "sport" | "basis" | "structure" | "levels"> & {
  levels: Levels | string;
};

const swimming = (pass: Atlas): LibraryInput => ({
  ...pass,
  sport: "simning",
  basis: "CSS",
  structure: typeof pass.levels === "string" ? pass.levels : "",
  levels:
    typeof pass.levels === "string"
      ? []
      : (["A", "B", "C", "D"] as const).map((key) => ({
          key,
          structure: (pass.levels as Levels)[key],
        })),
});

// ---------------------------------------------------------------------------
// Ramen som återkommer
// ---------------------------------------------------------------------------

/** 400 m: 200 m lugnt och 4 × 50 m stegrande. */
const WU =
  "200 m CSS+15-20 uppvärmning; 4x(50 m CSS+10-4 uppvärmning + 10 s vila)";
/** 200 m teknik, 4 × 50 m med ett fokus. */
const tech = (focus: string) => `4x(50 m CSS+15-20 ${focus} + 15 s vila)`;
/** 300 m teknik i Smooth Criminal: 25 m övning och 25 m frisim. */
const TECH6 = "6x(25 m CSS+20 övning + 25 m CSS+12-15 frisim + 15 s vila)";
/** 200 m förberedelse, 4 × 50 m. */
const prep = (focus: string) => `4x(50 m CSS+8-3 ${focus} + 15 s vila)`;
const CD = "200 m CSS+20 nedvarvning";

/** Passet med ramen runt huvudserien. */
const frame = (
  main: string,
  focus = { tech: "teknik", prep: "stegring" },
  technique = tech(focus.tech),
) => [WU, technique, prep(focus.prep), main, CD].join("; ");

/** Serier om flera repetitioner, med extra vila mellan serierna. */
const series = (count: number, block: string, rest: string) =>
  Array.from({ length: count }, () => block).join(`; ${rest}; `);

/** Fyra nivåer ur en huvudserie: A, B, C, D. */
const levels = (
  make: (n: number) => string,
  [a, b, c, d]: [number, number, number, number],
  wrap: (main: string) => string = frame,
): Levels => ({
  A: wrap(make(a)),
  B: wrap(make(b)),
  C: wrap(make(c)),
  D: wrap(make(d)),
});

const BASE = ["grund"];
const BUILD = ["uppbyggnad"];
const RACE = ["specifik"];

const FUEL =
  "Vatten vid bassängkanten räcker. Ät ett vanligt mål inom ett par timmar efteråt.";
const FUEL_LONG =
  "Vatten vid kanten; går passet över en timme passar en sportdryck. Ät ett vanligt mål med kolhydrater och protein inom ett par timmar.";
const FUEL_HARD =
  "Kom till bassängen med fyllda depåer: ett lätt mål två till tre timmar före. Vatten eller sportdryck vid kanten, och mat inom en timme efteråt.";

const RACE_NOTE =
  " Huvudserien står i Ironmanfart (@IM); mot 70.3 byts @IM mot @703. Farten är den inskrivna på adeptens profil, annars prognosen ur det senaste simtestet.";

// ---------------------------------------------------------------------------
// 01 Smooth Criminal – teknik och aerob kontroll
// ---------------------------------------------------------------------------

const SC = {
  kind: "Teknik",
  adaptations:
    "Bättre vattenläge, grepp och rytm, och därmed lägre energikostnad vid samma fart. Aerob grund i lugnt tempo utan trötthet som stör veckans kvalitet.",
  fueling: FUEL,
};
const scFrame = (main: string) =>
  [WU, TECH6, prep("rytm och vattenläge"), main, CD].join("; ");

// ---------------------------------------------------------------------------
// 02–04 CSS Climber, Aerobic Builder, Threshold Tango
// ---------------------------------------------------------------------------

const CSSC = {
  kind: "Kvalitet",
  adaptations:
    "Högre tröskelfart och bättre fartkänsla nära CSS. Förmågan att hålla jämn fart med kort vila, den egenskap som avgör hur ekonomiskt en triathlet simmar strax under tröskeln.",
  fueling: FUEL_HARD,
};
const AB = {
  kind: "Distans",
  adaptations:
    "Aerob kapacitet och distanstålighet: fler mitokondrier och bättre syreupptag i armar och bål, och en teknik som håller över längre sträckor.",
  fueling: FUEL,
};
const TT = {
  kind: "Kvalitet",
  adaptations:
    "Längre sammanhängande arbete nära tröskeln: laktatomsättning, utnyttjandegrad och förmågan att hålla en hög och jämn belastning utan att tekniken faller.",
  fueling: FUEL_HARD,
};

// ---------------------------------------------------------------------------
// 05–08 Red Mist, Power Flow, Long Distance, Open Water Groove
// ---------------------------------------------------------------------------

const RM = {
  kind: "Kvalitet",
  adaptations:
    "Hög aerob belastning som ackumuleras med kort vila: tröskelnära arbete där pulsen inte hinner sjunka mellan repetitionerna, och förmågan att hålla farten när tröttheten växer.",
  fueling: FUEL_HARD,
};
const PF = {
  kind: "Kraft",
  adaptations:
    "Simstyrka och grepp: mer framdrivning per armtag och en stabil bål som överför kraften. Pull buoy flyttar arbetet till armar och rygg.",
  fueling: FUEL,
};
const LD = {
  kind: "Långpass",
  adaptations:
    "Lång aerob uthållighet och durability i vattnet: ekonomisk teknik efter lång tid, jämn rytm och en fart som går att hålla genom en hel tävlingssimning.",
  fueling: FUEL_LONG,
};
const OWG = {
  kind: "Specifikt",
  adaptations:
    "Tävlingsfärdigheter: orientering utan att tappa kroppsläge, fartökningar och förmågan att hitta tillbaka till ett effektivt simtag direkt efteråt.",
  fueling: FUEL,
};

/** 100:or med pull buoy och frisim varannan. */
const pull = (pairs: number, distance: number, target: string, rest: string) =>
  `${pairs}x(${distance} m ${target} pull + ${rest} + ${distance} m ${target} frisim + ${rest})`;

export const SWIMMING_ATLAS: LibraryInput[] = [
  // ------------------------------------------------------------------ Base
  swimming({
    title: "Smooth Criminal – Base",
    ...SC,
    intensity: "Aerob",
    phases: [...BASE, "uppbyggnad"],
    purpose:
      "Teknik och aerob kontroll. Passet bygger vattenläge, grepp och effektivitet utan onödig trötthet – grunden i filosofin att tekniken styr vad en given fart kostar (avsnitt 10 och 27).",
    description:
      "200:or på CSS + 8–15 s, RPE 4–5, med 20 s vila. Samma teknik på sista 200:an som på första. Tappar simmaren vattenläge eller grepp går tekniken före farten: sakta ned eller kortna serien.",
    timing:
      "Grundperioden och in i uppbyggnaden, en gång i veckan. Gärna dagen efter ett hårt cykel- eller löppass.",
    progression:
      "Fler 200:or först, sedan Build-varianten med mindre vila. Farten ligger kvar.",
    levels: levels(
      (n) => `${n}x(200 m CSS+8-15 + 20 s vila)`,
      [11, 11, 10, 8],
      scFrame,
    ),
  }),
  swimming({
    title: "CSS Climber – Base",
    ...CSSC,
    intensity: "Tröskel",
    phases: BASE,
    purpose:
      "Introduktion till tröskel och fartkontroll: 100:or strax långsammare än CSS. Ett av blockets tre tröskelformat – CSS Climber, Threshold Tango eller Red Mist – och det som körs varje vecka i blocket (avsnitt 27).",
    description:
      "100:or på CSS + 3–6 s, RPE 6–7, med 20 s vila. Jämn fart genom hela serien och ingen spurt på slutet. Första tredjedelen ska kännas kontrollerad.",
    timing:
      "Grundperioden, en gång i veckan, tidigt i veckan och inte dagen före ett viktigt löppass.",
    progression:
      "Fler 100:or först, sedan kortare vila, sist farten. Build-varianten flyttar farten mot CSS.",
    levels: levels((n) => `${n}x(100 m CSS+3-6 + 20 s vila)`, [18, 18, 16, 12]),
  }),
  swimming({
    title: "Aerobic Builder – Base",
    ...AB,
    intensity: "Aerob",
    phases: BASE,
    purpose:
      "Aerob uthållighet och ekonomisk simning över 400:or. Passet bär veckans volym utan att kosta återhämtning som kvalitetspasset behöver.",
    description:
      "400:or på CSS + 8–15 s, RPE 4–5, med 25 s vila. Samma ansträngning genom hela serien; målet är stabilitet, inte en snabb avslutning.",
    timing: "Grundperioden, en till två gånger i veckan.",
    progression:
      "Fler 400:or, sedan Build-varianten med negativ split i varje 400:a.",
    levels: levels((n) => `${n}x(400 m CSS+8-15 + 25 s vila)`, [7, 6, 5, 4]),
  }),
  swimming({
    title: "Threshold Tango – Base",
    ...TT,
    intensity: "Tröskel",
    phases: BASE,
    purpose:
      "Kontrollerad tröskeluthållighet över 200:or. Alternativ till CSS Climber som blockets tröskelformat, för den som behöver längre arbetsperioder.",
    description:
      "200:or på CSS + 3–6 s, RPE 6–7, med 20 s vila. Kontrollerat hårt: det ska finnas en liten marginal kvar också i slutet. Inget test och inget maxpass.",
    timing:
      "Grundperioden, en gång i veckan i stället för CSS Climber, aldrig båda samma vecka.",
    progression:
      "Fler 200:or, sedan Build-varianten med 300:or. Farten ligger kvar.",
    levels: levels((n) => `${n}x(200 m CSS+3-6 + 20 s vila)`, [10, 11, 10, 8]),
  }),
  swimming({
    title: "Red Mist – Base",
    ...RM,
    intensity: "Steady",
    phases: BASE,
    purpose:
      "Längre aerob belastning med inslag av tröskel över 300:or. I grunden en mjukare form av Red Mist, som förbereder för de täta blocken i uppbyggnaden.",
    description:
      "300:or på CSS + 4–8 s, RPE 5–6, med 25 s vila. Börja kontrollerat och håll jämna intervalltider. Sista 300:an ska vara tekniskt lika bra som den första.",
    timing:
      "Grundperioden, en gång i veckan som blockets tröskelformat, aldrig ihop med CSS Climber eller Threshold Tango samma vecka.",
    progression: "Fler 300:or, sedan Build-varianten med täta 100:or.",
    levels: levels((n) => `${n}x(300 m CSS+4-8 + 25 s vila)`, [7, 6, 5, 4]),
  }),
  swimming({
    title: "Power Flow – Base",
    ...PF,
    intensity: "Steady",
    phases: BASE,
    purpose:
      "Grepp, simstyrka och kraftöverföring. Pull buoy varannan 100:a flyttar arbetet till armar och bål, och frisimmen efter visar om greppet följer med.",
    description:
      "100:or på CSS + 5–10 s, RPE 5–6, med 20 s vila, varannan med pull buoy. Kraften ska komma ur greppet och en stabil kropp, inte ur högre frekvens. Paddlar är ett tillval för vana simmare och väljs bort vid axelbesvär.",
    timing:
      "Grund och uppbyggnad, som komplement en gång i veckan. Inte ett återhämtningspass.",
    progression: "Fler 100:or, sedan Build-varianten med 150:or.",
    levels: levels(
      (n) => pull(n / 2, 100, "CSS+5-10", "20 s vila"),
      [14, 12, 10, 8],
      (main) => frame(main, { tech: "sculling", prep: "kraftöverföring" }),
    ),
  }),
  swimming({
    title: "Long Distance – Base",
    ...LD,
    intensity: "Aerob",
    phases: BASE,
    purpose:
      "Veckans långpass: distanstålighet och ekonomisk simning över 500:or. Det pass i veckan som liknar tävlingens längd mest.",
    description:
      "500:or på CSS + 10–18 s, RPE 4–5, med 30 s vila. Jämn rytm, avslappnade axlar och samma upplevda ansträngning hela vägen. Inga tider att jaga.",
    timing:
      "Grundperioden, en gång i veckan, gärna i helgen. Från juni kan det simmas i öppet vatten som sammanhängande simning.",
    progression:
      "Fler 500:or, sedan Build-varianten med 600:or och starkare avslutning.",
    levels: levels(
      (n) => `${n}x(500 m CSS+10-18 + 30 s vila)`,
      [6, 5, 4, 3],
      (main) =>
        frame(main, { tech: "långa armtag", prep: "kontrollerad stegring" }),
    ),
  }),
  swimming({
    title: "Open Water Groove – Base",
    ...OWG,
    intensity: "Aerob",
    phases: BASE,
    purpose:
      "Orientering och teknik inför öppet vatten, simulerat i bassäng. Varannan 100:a har en kort fartökning, som i en start eller ett positionsbyte.",
    description:
      "100:or på CSS + 5–12 s, RPE 5–6, med 20 s vila. Lyft blicken kort var sjätte till åttonde armtag utan att tappa kroppsläget. Varannan 100:a börjar med 15 m fartökning; gå sedan direkt tillbaka till normal rytm.",
    timing:
      "Grundperioden, som komplement högst en gång i veckan, och aldrig samma vecka som Power Flow.",
    progression:
      "Fler 100:or, sedan Build-varianten med 25 m fartökning i varje 100:a.",
    levels: levels(
      (n) =>
        `${n / 2}x(100 m CSS+5-12 orientering + 20 s vila + 15 m CSS-2 fartökning + 85 m CSS+5-12 + 20 s vila)`,
      [14, 12, 10, 8],
      (main) => frame(main, { tech: "orientering", prep: "fartväxling" }),
    ),
  }),

  // ----------------------------------------------------------------- Build
  swimming({
    title: "Smooth Criminal – Build",
    ...SC,
    intensity: "Aerob",
    phases: BUILD,
    purpose:
      "Teknik under belastning och aerob fartkontroll. Mer sammanhängande arbete och mindre vila än i grunden, med tekniken som fortsatt prioritet.",
    description:
      "200:or på CSS + 5–10 s, RPE 5–6, med 20 s vila. Udda 200:or stabil och avslappnad frisim, jämna med fokus på grepp och rytm.",
    timing:
      "Uppbyggnaden, en gång i veckan, gärna dagen efter ett hårt cykel- eller löppass.",
    progression:
      "Fler 200:or. Race-varianten flyttar huvudserien till tävlingsfart.",
    levels: levels(
      (n) => `${n}x(200 m CSS+5-10 + 20 s vila)`,
      [14, 12, 12, 10],
      scFrame,
    ),
  }),
  swimming({
    title: "CSS Climber – Build",
    ...CSSC,
    intensity: "Tröskel",
    phases: BUILD,
    purpose:
      "Mer tid nära CSS: 100:or där första delen ligger strax under CSS och sista delen på CSS. Blockets tröskelformat i uppbyggnaden.",
    description:
      "Första två tredjedelarna på CSS + 2–4 s, sista tredjedelen på CSS till CSS + 2 s, RPE 7–8, med 20 s vila. Ingen fart snabbare än CSS krävs; RPE 7–8 gäller bara så länge tekniken håller. Faller farten tydligt sänks intensiteten.",
    timing:
      "Uppbyggnaden, en gång i veckan, tidigt i veckan och inte före ett viktigt löppass.",
    progression:
      "Fler 100:or först, sedan kortare vila. Farten är aldrig det första som ändras.",
    levels: levels(
      (n) => {
        const last = Math.round(n / 3);
        return `${n - last}x(100 m CSS+2-4 + 20 s vila); ${last}x(100 m CSS+0-2 + 20 s vila)`;
      },
      [24, 22, 20, 16],
    ),
  }),
  swimming({
    title: "Aerobic Builder – Build",
    ...AB,
    intensity: "Aerob",
    phases: BUILD,
    purpose:
      "Aerob kapacitet och distansuthållighet med negativ split i varje 400:a: simmaren tränar på att avsluta starkare utan att öppna för hårt.",
    description:
      "Varje 400:a: första 200 m på CSS + 12–15 s, andra 200 m på CSS + 8–12 s, RPE 5–6, med 25 s vila.",
    timing: "Uppbyggnaden, en till två gånger i veckan.",
    progression:
      "Fler 400:or. Race-varianten lägger huvudserien i tävlingsfart.",
    levels: levels(
      (n) => `${n}x(200 m CSS+12-15 + 200 m CSS+8-12 + 25 s vila)`,
      [8, 7, 6, 5],
    ),
  }),
  swimming({
    title: "Threshold Tango – Build",
    ...TT,
    intensity: "Tröskel",
    phases: BUILD,
    purpose:
      "Längre sammanhängande arbete nära tröskeln över 300:or. Alternativ till CSS Climber som blockets tröskelformat.",
    description:
      "Varje 300:a: första halvan på CSS + 3 s, andra halvan på CSS till CSS + 2 s, RPE 7–8, med 20 s vila. Hög och jämn belastning utan att ansträngningen behöver öka mycket mot slutet.",
    timing:
      "Uppbyggnaden, en gång i veckan i stället för CSS Climber, aldrig båda samma vecka.",
    progression: "Fler 300:or, sedan kortare vila. Farten ligger kvar.",
    levels: levels(
      (n) => `${n}x(150 m CSS+3 + 150 m CSS+0-2 + 20 s vila)`,
      [10, 9, 8, 6],
    ),
  }),
  swimming({
    title: "Red Mist – Build",
    ...RM,
    intensity: "Tröskel",
    phases: BUILD,
    purpose:
      "Tätt arbete nära tröskeln: block om 100:or med bara 10 s vila, där belastningen ackumuleras. Skiljer sig från Threshold Tango genom korta repetitioner och kort vila, och är ett alternativ till den.",
    description:
      "100:or på CSS till CSS + 2 s, RPE 7–8, 10 s vila mellan 100:orna och 30 s mellan blocken. Jämn fart inom varje block och ingen för hård första 100:a. Ett krävande kvalitetspass.",
    timing:
      "Uppbyggnaden, en gång i veckan som blockets tröskelformat, aldrig ihop med CSS Climber eller Threshold Tango samma vecka.",
    progression:
      "Fler block först, sedan fler 100:or per block. Vilan ligger kvar.",
    levels: {
      A: frame(series(5, "4x(100 m CSS+0-2 + 10 s vila)", "20 s vila")),
      B: frame(series(4, "5x(100 m CSS+0-2 + 10 s vila)", "20 s vila")),
      C: frame(series(4, "4x(100 m CSS+0-2 + 10 s vila)", "20 s vila")),
      D: frame(series(3, "4x(100 m CSS+0-2 + 10 s vila)", "20 s vila")),
    },
  }),
  swimming({
    title: "Power Flow – Build",
    ...PF,
    intensity: "Steady",
    phases: BUILD,
    purpose:
      "Simstyrka och grepp när belastningen ökar: 150:or med pull buoy och frisim varannan, och större krav på att föra över greppet till vanlig simning.",
    description:
      "150:or på CSS + 4–8 s, RPE 5–7, med 20 s vila. Udda med pull buoy och fokus på grepp och stabilitet, jämna frisim med samma vattenkänsla. Paddlar sparsamt och bara för vana simmare.",
    timing: "Uppbyggnaden, som komplement högst en gång i veckan.",
    progression: "Fler 150:or. Race-varianten simmar dem i tävlingsfart.",
    levels: levels(
      (n) => pull(n / 2, 150, "CSS+4-8", "20 s vila"),
      [16, 14, 12, 10],
      (main) => frame(main, { tech: "sculling", prep: "kraftöverföring" }),
    ),
  }),
  swimming({
    title: "Long Distance – Build",
    ...LD,
    intensity: "Aerob",
    phases: BUILD,
    purpose:
      "Lång uthållighet över 600:or med tydligare fartkontroll: simmaren ska kunna avsluta starkt utan att öka frekvensen okontrollerat.",
    description:
      "Varje 600:a: första 400 m på CSS + 10–14 s, sista 200 m på CSS + 6–10 s, RPE 5–6, med 30 s vila.",
    timing:
      "Uppbyggnaden, en gång i veckan, gärna i helgen. Från juni gärna i öppet vatten.",
    progression: "Fler 600:or. Race-varianten simmar dem i tävlingsfart.",
    levels: levels(
      (n) => `${n}x(400 m CSS+10-14 + 200 m CSS+6-10 + 30 s vila)`,
      [6, 5, 4, 3],
      (main) =>
        frame(main, { tech: "långa armtag", prep: "kontrollerad stegring" }),
    ),
  }),
  swimming({
    title: "Open Water Groove – Build",
    ...OWG,
    intensity: "Steady",
    phases: BUILD,
    purpose:
      "Fartväxlingar och återgång till tävlingsrytm: 75 m kontrollerat med orientering och 25 m fartökning i varje 100:a.",
    description:
      "75 m på CSS + 5–10 s med kort orientering, 25 m fartökning kring CSS, RPE 6–7, med 15 s vila. Gå direkt tillbaka till normal rytm efter ökningen. I öppet vatten kompletteras passet med drafting, gruppstarter och bojpassager.",
    timing:
      "Uppbyggnaden, som komplement högst en gång i veckan, och aldrig samma vecka som Power Flow.",
    progression:
      "Fler 100:or. Race-varianten lägger till starter och position bakom en annan simmare.",
    levels: levels(
      (n) =>
        `${n}x(75 m CSS+5-10 orientering + 25 m CSS fartökning + 15 s vila)`,
      [16, 14, 12, 10],
      (main) => frame(main, { tech: "orientering", prep: "fartväxling" }),
    ),
  }),

  // ------------------------------------------------------------------ Race
  swimming({
    title: "Smooth Criminal – Race",
    ...SC,
    intensity: "Tävlingsfart",
    phases: RACE,
    purpose:
      "Tävlingsfart och teknisk stabilitet: 200:or i tävlingsfart, där simmaren ska kunna hålla farten utan att ansträngningen stiger eller vattenläget tappas.",
    description:
      "200:or i tävlingsfart, RPE 5–6, med 20 s vila. Farten ska kännas kontrollerad." +
      RACE_NOTE,
    timing: "Den specifika perioden, en gång i veckan.",
    progression:
      "Fler 200:or. Inför loppet kortas serien medan farten ligger kvar.",
    levels: levels(
      (n) => `${n}x(200 m @IM + 20 s vila)`,
      [12, 11, 10, 8],
      scFrame,
    ),
  }),
  swimming({
    title: "CSS Climber – Race",
    ...CSSC,
    intensity: "Tävlingsfart",
    phases: RACE,
    purpose:
      "Tävlingsfart med korta accelerationer: 75 m i tävlingsfart och 25 m kring CSS, som när simmaren behöver byta position eller passera, och sedan tillbaka till rytmen.",
    description:
      "Varje 100:a: 75 m i tävlingsfart, 25 m kring CSS, RPE 5–7, med 15 s vila. Ökningen är tekniskt kontrollerad, inte en sprint." +
      RACE_NOTE,
    timing:
      "Den specifika perioden, en gång i veckan som blockets tröskelformat. Mot 70.3 är det passet som får mer utrymme.",
    progression: "Fler 100:or. Vilan och farten ligger kvar.",
    levels: levels(
      (n) => `${n}x(75 m @IM + 25 m CSS + 15 s vila)`,
      [20, 18, 16, 12],
    ),
  }),
  swimming({
    title: "Aerobic Builder – Race",
    ...AB,
    intensity: "Tävlingsfart",
    phases: RACE,
    purpose:
      "Tävlingsfart över längre intervaller: en stabil tävlingsrytm över 400:or, med de sista 100 m för tekniken under lätt ökad ansträngning.",
    description:
      "Varje 400:a: 300 m i tävlingsfart och 100 m en sekund snabbare med bibehållen teknik, RPE 5–6, med 25 s vila. Ingen onödig fartökning de första 100 m." +
      RACE_NOTE,
    timing: "Den specifika perioden, en gång i veckan.",
    progression:
      "Fler 400:or i tävlingsfart. Farten ligger kvar; inför loppet kortas serien.",
    levels: levels(
      (n) => `${n}x(300 m @IM + 100 m @IM-1 + 25 s vila)`,
      [7, 6, 5, 4],
    ),
  }),
  swimming({
    title: "Threshold Tango – Race",
    ...TT,
    intensity: "Tävlingsfart",
    phases: RACE,
    purpose:
      "Växla mellan tävlingsfart och högre fart: 150 m i tävlingsfart och 50 m på CSS i varje 200:a, och tillbaka till en ekonomisk rytm.",
    description:
      "Varje 200:a: 150 m i tävlingsfart, 50 m på CSS, RPE 6–7, med 20 s vila. Ett kontrollerat kvalitetspass, inte ett tröskeltest." +
      RACE_NOTE,
    timing:
      "Den specifika perioden, en gång i veckan i stället för CSS Climber.",
    progression:
      "Fler 200:or. Andelen på CSS ligger kvar, och vilan ändras inte.",
    levels: levels(
      (n) => `${n}x(150 m @IM + 50 m CSS + 20 s vila)`,
      [10, 9, 8, 6],
    ),
  }),
  swimming({
    title: "Red Mist – Race",
    ...RM,
    intensity: "Tävlingsfart",
    phases: RACE,
    purpose:
      "Upprepade fartökningar under tävlingslika förhållanden: block där den tredje 100:an går något snabbare och den fjärde tillbaka i tävlingsfart.",
    description:
      "Varje block: 100 m i tävlingsfart, 100 m i tävlingsfart, 100 m två sekunder snabbare, 100 m tillbaka i tävlingsfart. RPE 6–7, 10 s vila mellan 100:orna och 30 s mellan blocken. Sista 100:an är ingen spurt." +
      RACE_NOTE,
    timing:
      "Den specifika perioden, en gång i veckan som blockets tröskelformat.",
    progression:
      "Fler block. Vilan och fartökningen ligger kvar genom blocket.",
    levels: (() => {
      const block =
        "2x(100 m @IM + 10 s vila); 100 m @IM-2 + 10 s vila; 100 m @IM + 10 s vila";
      const make = (n: number) => frame(series(n, block, "20 s vila"));
      return { A: make(6), B: make(5), C: make(4), D: make(3) };
    })(),
  }),
  swimming({
    title: "Power Flow – Race",
    ...PF,
    intensity: "Tävlingsfart",
    phases: RACE,
    purpose:
      "Effektiv kraftöverföring och teknik under trötthet: 50 m med fokus på grepp och 100 m i tävlingsfart i varje 150:a.",
    description:
      "Varje 150:a: 50 m på CSS + 4–8 s med fokus på grepp, 100 m i tävlingsfart, RPE 5–6, med 20 s vila. Kraften ska inte komma ur att pressa armarna hårdare." +
      RACE_NOTE,
    timing: "Den specifika perioden, som komplement högst en gång i veckan.",
    progression:
      "Fler 150:or. Pull buoy kan bytas mot paddlar för vana simmare, inte samtidigt.",
    levels: levels(
      (n) => `${n}x(50 m CSS+4-8 grepp + 100 m @IM + 20 s vila)`,
      [14, 12, 10, 8],
      (main) => frame(main, { tech: "sculling", prep: "kraftöverföring" }),
    ),
  }),
  swimming({
    title: "Long Distance – Race",
    ...LD,
    intensity: "Tävlingsfart",
    phases: RACE,
    purpose:
      "Längre sammanhängande arbete i tävlingsrytm: 600:or i tävlingsfart. Ett av de viktigaste passen inför långdistans.",
    description:
      "600:or i tävlingsfart, RPE 5–6, med 30 s vila. Håll farten utan att jaga varje intervalltid. I öppet vatten simmas huvudserien som en sammanhängande simning med orientering." +
      RACE_NOTE,
    timing:
      "Den specifika perioden, en gång i veckan, gärna i helgen och gärna i öppet vatten.",
    progression:
      "Fler 600:or. Inför loppet kortas serien medan farten ligger kvar.",
    levels: levels(
      (n) => `${n}x(600 m @IM + 30 s vila)`,
      [5, 4, 3, 2],
      (main) =>
        frame(main, { tech: "långa armtag", prep: "kontrollerad stegring" }),
    ),
  }),
  swimming({
    title: "Open Water Groove – Race",
    ...OWG,
    intensity: "Tävlingsfart",
    phases: RACE,
    purpose:
      "Starter, orientering och position: varje 100:a börjar med en kort hård start och fortsätter i tävlingsfart, gärna bakom en annan simmare.",
    description:
      "Varje 100:a: 15 m start över CSS, sedan 85 m i tävlingsfart med orientering var sjätte till åttonde armtag. RPE 5–7, 20 s vila. Öva på att hitta en position bakom en annan simmare. Drafting och bojpassager kräver öppet vatten eller en bana som delas." +
      RACE_NOTE,
    timing:
      "Den specifika perioden, som komplement en gång i veckan, gärna i öppet vatten från juni. Mot 70.3 får starter och positionsbyten mer utrymme.",
    progression: "Fler 100:or, sedan fler simmare i banan och i öppet vatten.",
    levels: levels(
      (n) => `${n}x(15 m CSS-2 start + 85 m @IM + 20 s vila)`,
      [14, 12, 10, 8],
      (main) => frame(main, { tech: "orientering", prep: "fartväxling" }),
    ),
  }),

  // ----------------------------------------------- Test, avlastning, toppning
  swimming({
    title: "CSS-test 400 + 200 m",
    kind: "Test",
    intensity: "Test",
    phases: ["grund", "uppbyggnad", "specifik"],
    purpose:
      "CSS-testet som filosofin bygger simfarten på: 400 m och 200 m maximalt, jämnt disponerat. Ur tiderna räknas CSS, och appen räknar också D′ och simprofilen. Testet placeras där det påverkar beslut: före första blocket och i avlastningsveckan i slutet av uppbyggnaden.",
    description:
      "Uppvärmning och två 50:or teknik. Sedan 400 m maximalt med jämn fart, 200 m mycket lugnt och 6 minuters vila, och 200 m maximalt. Skriv ned båda tiderna. CSS (s/100 m) = (tid 400 m − tid 200 m) / 2. Farterna i passraden är bara riktmärken för förhandsvisningen.",
    adaptations:
      "Inga – testet mäter. Det ersätter veckans kvalitetspass och läggs aldrig dagen efter ett hårt cykel- eller löppass.",
    fueling: FUEL_HARD,
    timing:
      "Före första blocket, i avlastningsveckan i slutet av uppbyggnaden och vid fasbyten. Kör protokollet Critical swim speed när tiderna läggs in.",
    progression:
      "Samma protokoll varje gång, samma bassäng och samma tid på dagen, så att testen går att jämföra.",
    levels:
      "200 m CSS+15-20 uppvärmning; 4x(50 m CSS+10-4 uppvärmning + 15 s vila); 2x(50 m CSS+15 teknik + 15 s vila); 400 m CSS-5 test; 200 m CSS+25 lugnt; 6 min vila; 200 m CSS-10 test; 200 m CSS+20 nedvarvning",
  }),
  swimming({
    title: "Teknik och flyt – återhämtning",
    kind: "Återhämtning",
    intensity: "Återhämtning",
    phases: ["grund", "uppbyggnad", "specifik", "topp", "vila"],
    purpose:
      "Avlastningsveckans simpass: teknik och lugn simning som håller vattenkänslan utan att lägga till trötthet. Volymen sjunker, tekniken och frekvensen ligger kvar (avsnitt 27).",
    description:
      "Lätt simning på CSS + 15–25 s, RPE 2–3, med 25 s vila. Ingen fartpress; kvalitet och avslappning går före farten.",
    adaptations:
      "Blodflöde och vattenkänsla utan belastning. Håller tekniken levande när volymen är nere.",
    fueling: FUEL,
    timing:
      "Avlastningsveckan och dagar då livet tar mer än vanligt. Ersätter ett vanligt pass, läggs inte ovanpå.",
    progression: "Ingen. Passet ska vara lika lätt varje gång.",
    levels: levels(
      (n) => `${n}x(200 m CSS+15-25 + 25 s vila)`,
      [7, 6, 5, 4],
      (main) => frame(main, { tech: "teknik", prep: "lugn" }),
    ),
  }),
  swimming({
    title: "Tävlingsfart – aktivering",
    kind: "Aktivering",
    intensity: "Tävlingsfart",
    phases: ["topp"],
    purpose:
      "Toppningens simpass: kort tid i tävlingsfart som väcker tävlingskänslan utan att bygga trötthet (avsnitt 13).",
    description:
      "4 × 200 m i tävlingsfart, RPE 4–6, med 30 s vila. Fokus på simkänsla och rytm, inte på tider." +
      RACE_NOTE,
    adaptations:
      "Ingen ny kapacitet – passet håller farten och rytmen tillgängliga när volymen sjunker inför loppet.",
    fueling: FUEL,
    timing: "Tävlingsveckan, två till fyra dagar före start.",
    progression:
      "Ingen. Samma pass inför varje lopp, så att känslan går att känna igen.",
    levels: frame("4x(200 m @IM + 30 s vila)"),
  }),
  swimming({
    title: "Teknikaktivering",
    kind: "Aktivering",
    intensity: "Återhämtning",
    phases: ["topp"],
    purpose:
      "Kort, lätt simning dagen före eller två dagar före loppet. Simmaren ska lämna bassängen med pigga armar.",
    description:
      "Lugn uppvärmning, teknik och 4 × 50 m avslappnat och effektivt, RPE 2–4.",
    adaptations: "Inga – passet håller vattenkänslan utan trötthet.",
    fueling: FUEL,
    timing: "Tävlingsveckan, en till två dagar före start.",
    progression: "Ingen. Passet ska vara lika kort och lätt inför varje lopp.",
    levels: frame("4x(50 m CSS+8-12 avslappnat + 20 s vila)", {
      tech: "teknik",
      prep: "lätt",
    }),
  }),
];
