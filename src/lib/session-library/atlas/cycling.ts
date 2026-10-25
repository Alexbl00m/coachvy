/**
 * Cykelpassen i passbiblioteket: atlasen över de fem zonerna, Z1–Z5, och
 * kraftpasset på låg kadens.
 *
 * Formaten är de vedertagna – Seiler, Rønnestad, Billat, Helgerud, Tabata –
 * och följer Coggans effektzoner mot FTP. Texterna är skrivna ur Alexanders
 * träningsfilosofi: varje pass säger vilken egenskap det utvecklar, vilken
 * begränsning det påverkar och hur det bidrar i loppet, och progressionen
 * ändrar en variabel i taget.
 *
 * Varje pass har tre nivåer, som planmallarna: B är formatet som det heter,
 * A mer och C mindre: samma format, mer eller mindre av det.
 *
 * Modulen är ren data. `seed.ts` gör SQL av den.
 */

import type { LibraryInput } from "../library";

type Levels = { A: string; B: string; C: string };

type Atlas = Omit<
  LibraryInput,
  "sport" | "basis" | "structure" | "levels"
> & { levels: Levels };

const cycling = (pass: Atlas): LibraryInput => ({
  ...pass,
  sport: "cykling",
  basis: "FTP",
  structure: "",
  levels: (["A", "B", "C"] as const).map((key) => ({
    key,
    structure: pass.levels[key],
  })),
});

// ---------------------------------------------------------------------------
// Delar som återkommer
// ---------------------------------------------------------------------------

/** Uppvärmning före VO₂max: lugnt, tre korta öppnare, lugnt. */
const WU5 =
  "15 min 50-65%; 3x(30 s 110% uppvärmning + 1 min 50% uppvärmning); 3 min 55% uppvärmning";
/** Uppvärmning före tröskel: lugnt och ett kort tempoinslag. */
const WU4 = "15 min 50-65%; 3 min 80% uppvärmning; 2 min 55% uppvärmning";
const WU3 = "15 min 50-65%";
const CD = "10 min 50%";

const q5 = (main: string) => `${WU5}; ${main}; ${CD}`;
const q4 = (main: string) => `${WU4}; ${main}; ${CD}`;
const q3 = (main: string) => `${WU3}; ${main}; ${CD}`;

/** Set med lätt vila emellan: "13x(…); 3 min 50% vila; 13x(…)". */
const sets = (count: number, block: string, rest: string) =>
  Array.from({ length: count }, () => block).join(`; ${rest} vila; `);

const ALL_PHASES = ["grund", "uppbyggnad", "specifik", "topp", "vila"];

const Z1 = {
  kind: "Återhämtning",
  intensity: "Z1 Återhämtning",
  phases: ALL_PHASES,
  adaptations:
    "Ökat blodflöde till musklerna, som hjälper återhämtningen. Underhåller trampteknik och rörelsemönster. En liten aerob stimulans till nästan ingen kostnad i trötthet.",
  fueling:
    "Vatten räcker. Ett vanligt mål med kolhydrater och protein efteråt gör mer för återhämtningen än något du äter på cykeln.",
  timing:
    "Dagen efter ett hårt pass eller en tävling, i återhämtningsveckor och under toppning. Passar i alla faser. Inne eller på slät väg utan backar som lockar upp effekten.",
};

const Z2_ADAPT =
  "Fler och effektivare mitokondrier, tätare kapillärnät och bättre förmåga att använda fett och kolhydrater vid en given effekt. Över tid flyttas LT1 uppåt: mer watt med låg metabol belastning. Passen gör det också möjligt att tåla mer kvalitet.";

const Z3_ADAPT =
  "Höjer den effekt som går att hålla länge med måttlig kolhydratförbrukning, förbättrar muskulär uthållighet och trötthetsresistens, och vänjer kroppen vid att arbeta nära tävlingsintensiteten i långa lopp.";
const Z3_FUEL =
  "40–60 g kolhydrater per timme och 500–750 ml vätska. Kom till passet med fyllda förråd – ett kolhydratrikt mål 2–3 timmar innan.";
const Z3_TIMING =
  "Uppbyggnad och tävlingsspecifik period, särskilt inför 70.3, Ironman och långa lopp, en gång i veckan. I grundperioden sparsamt: där är fördelningen polariserad, och mellanintensitet får inte äta upp volymen.";

const Z4_ADAPT =
  "Höjer LT2 och den effekt som går att hålla runt en timme, förbättrar laktatomsättningen – förmågan att ta hand om laktat vid hög belastning – och ökar andelen av VO₂max som går att utnyttja länge.";
const Z4_FUEL =
  "Kom väl fylld: ett kolhydratrikt mål 2–3 timmar innan. Under passet 40–60 g kolhydrater per timme och 500–750 ml vätska. Tröskelarbete går på kolhydrater – för lite energi syns som fallande kvalitet i sista draget.";
const Z4_TIMING =
  "Uppbyggnad och tävlingsspecifik period, 1–2 gånger i veckan i ett tröskelblock på 3–4 veckor. Inne på trainer eller i en lång, jämn stigning där effekten går att hålla stilla.";

const Z5 = { kind: "Kvalitet", intensity: "Z5 VO₂max" };
const Z5_FUEL =
  "Kom väl fylld: ett kolhydratrikt mål 2–4 timmar innan, aldrig fastande. Under passet 30–60 g kolhydrater per timme eller sportdryck, och 500–750 ml vätska. Hög intensitet går på kolhydrater.";
const A5_SHORT =
  "Höjer VO₂max: större slagvolym, högre syretransport och bättre syreupptag i musklerna. De korta dragen ger lång tid nära VO₂max med lägre muskulär och mental kostnad än långa drag, och tränar återhämtningen mellan hårda insatser.";
const A5_LONG =
  "Höjer VO₂max och den effekt som går att hålla i 3–8 minuter: större slagvolym, högre maximal syretransport och bättre syreupptag i musklerna. Ökar toleransen för hög belastning.";
const A5_THRESHOLD =
  "Höjer VO₂max och LT2: förmågan att ta upp mycket syre och att utnyttja en stor andel av det länge. Förbättrar laktatomsättningen och den muskulära uthålligheten vid hög belastning.";
const T5_BASE =
  "I grundperioden som veckans utvalda höga intensitet, en gång i veckan. I ett VO₂max-block i uppbyggnaden 1–2 gånger i veckan i 3–4 veckor, med lätta dagar runt. Inne på trainer eller i en jämn stigning.";
const T5_BUILD =
  "Ett VO₂max-block i uppbyggnaden, 1–2 gånger i veckan i 3–4 veckor, med lätta dagar runt passen. I tävlingsspecifik period som underhåll. Inne på trainer eller i en jämn stigning.";
const T5_LONG =
  "Uppbyggnad och tävlingsspecifik period, i ett block på 3–4 veckor, 1–2 gånger i veckan. Inne på trainer eller i en lång, jämn stigning.";
const P5_BASE = ["grund", "uppbyggnad", "specifik"];
const P5_BUILD = ["uppbyggnad", "specifik"];

/**
 * LSCT: tre pulsstyrda steg och 90 sekunder stilla. Effekten är bara ett
 * riktvärde – testet styrs på puls, och det är effekten vid pulsen som mäts.
 */
const LSCT =
  "6 min 45-55% steg 1 · 60 % av maxpuls; 6 min 68-78% steg 2 · 80 % av maxpuls; 3 min 84-89% steg 3 · 90 % av maxpuls; 90 s 20% vila";

// ---------------------------------------------------------------------------
// Passen, i atlasens ordning
// ---------------------------------------------------------------------------

export const CYCLING_ATLAS: LibraryInput[] = [
  // Z1 – återhämtning ------------------------------------------------------
  cycling({
    ...Z1,
    title: "30 min lätt snurr",
    purpose:
      "Håller frekvensen uppe utan att lägga till belastning. Ett kort, lätt pass gör det lättare att genomföra nästa kvalitetspass med rätt kvalitet – det är där utvecklingen sker. Värdet ligger i vad passet möjliggör, inte i vad det tränar.",
    description:
      "Under 55 % av FTP hela vägen, RPE 1–2. Lätt växel och hög, avslappnad kadens, 90–100 rpm. Du ska kunna prata obehindrat. Känns benen sämre efter tio minuter än när du började: avsluta. Ett återhämtningspass som blir ett distanspass gör ingen nytta.",
    progression:
      "Byggs inte på. Ett återhämtningspass ska vara lika lätt i vecka fyra som i vecka ett. Det enda som kan ändras är längden.",
    levels: {
      A: "40 min 45-55% 90-100 rpm",
      B: "30 min 45-55% 90-100 rpm",
      C: "20 min 45-55% 90-100 rpm",
    },
  }),
  cycling({
    ...Z1,
    title: "45 min återhämtning",
    purpose:
      "Ett aktivt vilopass dagen efter en hård belastning. Poängen är att ta upp träningen som redan är gjord: blodflöde utan ny trötthet, och en rutin som håller kontinuiteten i veckan. Planen är en hypotes, och hur du återhämtar dig är en del av svaret på om den håller.",
    description:
      "Lugn start och lugnt slut, däremellan jämnt under 55 % av FTP, RPE 1–2. Sitt kvar i sadeln, hög kadens och lätt tryck. Puls och känsla går före watt: är pulsen ovanligt hög för den låga effekten är kroppen inte återhämtad – skriv det i kommentaren till passet.",
    progression:
      "Byggs inte på. Följ i stället pulsen vid samma låga effekt från vecka till vecka – lägre puls vid samma watt är ett av de enklaste tecknen på att den aeroba grunden växer.",
    levels: {
      A: "5 min 40-50%; 45 min 45-55% 90-100 rpm; 5 min 40-50%",
      B: "5 min 40-50%; 35 min 45-55% 90-100 rpm; 5 min 40-50%",
      C: "5 min 40-50%; 25 min 45-55% 90-100 rpm; 5 min 40-50%",
    },
  }),
  cycling({
    ...Z1,
    title: "60 min återhämtningstur",
    purpose:
      "Återhämtning med lite mer tid i sadeln, för återhämtningsveckor och dagar mellan två kvalitetspass. Distansvolymen har en dubbel funktion: den underhåller aeroba egenskaper och gör det möjligt att samla volym utan att varje dag kostar mycket återhämtning.",
    description:
      "Ute på en runda utan branta backar, eller inne. Under 55 % av FTP även uppför – växla ned i stället för att trycka. RPE 1–2. Öka inte farten för att hänga med någon. Det enda som ska vara ansträngande med passet är disciplinen att hålla det lätt.",
    progression:
      "Byggs inte på i intensitet. I en återhämtningsvecka kan längden vara det enda som skiljer veckorna åt.",
    levels: {
      A: "10 min 40-50%; 60 min 45-55% under 55 % även i backar; 5 min 40-50%",
      B: "10 min 40-50%; 45 min 45-55% under 55 % även i backar; 5 min 40-50%",
      C: "10 min 40-50%; 30 min 45-55% under 55 % även i backar; 5 min 40-50%",
    },
  }),

  // Z2 – uthållighet -------------------------------------------------------
  cycling({
    title: "90 min jämn uthållighet",
    kind: "Distans",
    intensity: "Z2 Uthållighet",
    phases: ["grund", "uppbyggnad", "specifik"],
    purpose:
      "Grundpelaren i filosofin: en stor och hållbar aerob grund. Passet höjer effekten vid låg metabol belastning (LT1) och bygger den robusthet som gör att kvalitetspassen går att genomföra och upprepa. I grundperioden är det här huvuddelen av träningen, tillsammans med utvald hög intensitet.",
    description:
      "Jämnt i Z2, 65–75 % av FTP, RPE 3–4. Du ska kunna prata i hela meningar. Inga rusningar uppför och ingen frihjulning nedför. Kadens 85–95 rpm. Stiger pulsen mot slutet vid samma effekt – en frikoppling över cirka 5 % – är passet längre än grunden bär just nu. Det är information, inte ett misslyckande.",
    adaptations: Z2_ADAPT,
    fueling:
      "30–60 g kolhydrater per timme och 500–750 ml vätska. Ett bra tillfälle att träna magen på det du ska äta i tävling. Att köra på låga kolhydrater för att maximera fettförbränningen är inte målet – maximal fettförbränning och maximal prestation är inte samma sak.",
    timing:
      "Grundperioden 2–4 gånger i veckan, och som underhåll i alla senare faser. Ute på slät eller lätt kuperad väg, eller inne.",
    progression:
      "Längden först: 10–15 minuter mer per vecka i tre veckor, sedan en lättare vecka. Effekten ligger kvar. När frikopplingen är låg genom hela passet kan effekten flyttas mot övre delen av Z2.",
    levels: {
      A: "10 min 55-60%; 100 min 65-75%; 5 min 50-55%",
      B: "10 min 55-60%; 75 min 65-75%; 5 min 50-55%",
      C: "10 min 55-60%; 50 min 65-75%; 5 min 50-55%",
    },
  }),
  cycling({
    title: "3 × 20 min aerob",
    kind: "Distans",
    intensity: "Z2 Uthållighet",
    phases: ["grund", "uppbyggnad"],
    purpose:
      "Strukturerad övre Z2: långa block strax under LT1, med korta lätta pauser som håller kvaliteten jämn. Passet utvecklar den lågintensiva kapaciteten med en tydlig och upprepbar belastning – samma block vecka efter vecka gör det lätt att se om samma watt kostar mindre puls.",
    description:
      "Blocken på 70–75 % av FTP, RPE 4. Fortfarande samtalsfart, men med fokus. Pauserna lätta men inte stillastående. Passar bra på trainer, där effekten går att hålla exakt. Skriv upp snittpulsen per block. Stiger den från första till sista blocket, behåll effekten längre innan du höjer.",
    adaptations: Z2_ADAPT,
    fueling:
      "30–60 g kolhydrater per timme och 500–750 ml vätska. Inne svettas du mer – drick efter törst och lite till.",
    timing:
      "Grundperioden och tidig uppbyggnad, 1–2 gånger i veckan. Inne eller på slät väg där effekten går att hålla jämn.",
    progression:
      "Antalet block först: två, tre, fyra. När fyra block går med stabil puls kan pauserna kortas till tre minuter. Effekten ändras sist.",
    levels: {
      A: "10 min 55-60%; 4x(20 min 70-75% + 5 min 55%); 5 min 50%",
      B: "10 min 55-60%; 3x(20 min 70-75% + 5 min 55%); 5 min 50%",
      C: "10 min 55-60%; 2x(20 min 70-75% + 5 min 55%); 5 min 50%",
    },
  }),
  cycling({
    title: "2 h uthållighetstur",
    kind: "Distans",
    intensity: "Z2 Uthållighet",
    phases: ["grund", "uppbyggnad", "specifik"],
    purpose:
      "Långpasset bygger aerob kapacitet och trötthetsresistens: förmågan att hålla effekt och teknik när timmarna går. För långdistans är det också här energiplanen tränas. Värdet syns inte i ett enskilt pass utan över veckor – det är kontinuiteten som bygger grunden.",
    description:
      "Z2 hela vägen, 60–75 % av FTP, RPE 3–4. Låt effekten följa terrängen men inte lämna zonen – växla tidigt i backarna. Kadens 85–95 rpm. Ät och drick enligt planen från start, inte när du blir hungrig. Sista halvtimmen ska kännas kontrollerad; faller effekten mycket var intensiteten för hög tidigt eller energin för liten.",
    adaptations: `${Z2_ADAPT} Det långa passet tränar dessutom trötthetsresistensen.`,
    fueling:
      "60–90 g kolhydrater per timme från första halvtimmen och 500–750 ml vätska per timme, mer i värme. Långa pass är rätt plats att öva tävlingens energiplan.",
    timing:
      "Alla faser, en gång i veckan. Ute, gärna kuperat. Det viktigaste passet i grundperioden för den som tränar mot långa lopp.",
    progression:
      "Längden, 15–20 minuter i taget, sedan en lättare vecka. När långpasset är tillräckligt långt för målet kan de sista 20–30 minuterna läggas i övre Z2 eller tempo – men först när grunden bär.",
    levels: {
      A: "10 min 55-60%; 130 min 60-75% kuperat, Z2 även i backarna; 10 min 50-55%",
      B: "10 min 55-60%; 100 min 60-75% kuperat, Z2 även i backarna; 10 min 50-55%",
      C: "10 min 55-60%; 70 min 60-75% kuperat, Z2 även i backarna; 10 min 50-55%",
    },
  }),

  // Z3 – tempo -------------------------------------------------------------
  cycling({
    title: "2 × 20 min tempo",
    kind: "Kvalitet",
    intensity: "Z3 Tempo",
    phases: ["uppbyggnad", "specifik"],
    purpose:
      "Långa block i tävlingsnära intensitet för långdistans: 70.3 cyklas ofta runt 75–85 % av FTP och Ironman något lägre. När specificiteten ökar blir fördelningen mer pyramidal, och tempo är då den mellanintensitet som gör nytta – den lär kroppen hålla tävlingsfart länge till en kontrollerad kostnad.",
    description:
      "76–85 % av FTP, RPE 5–6. Du kan prata i korta meningar. Tävlingsposition om du kör tempocykel. Jämnt tryck, kadens 85–95 rpm. Ät under blocken som i tävling. Målet är att andra blocket ska se ut som det första: samma effekt och likartad puls.",
    adaptations: Z3_ADAPT,
    fueling: Z3_FUEL,
    timing: Z3_TIMING,
    progression:
      "Blocklängden: 2 × 15, 2 × 20, 2 × 25, 2 × 30 min över några veckor. Ändra inte effekten samtidigt. I tävlingsspecifik period kan triathleter lägga 15–20 min löpning direkt efter.",
    levels: {
      A: q3("2x(30 min 76-85% + 5 min 55%)"),
      B: q3("2x(20 min 76-85% + 5 min 55%)"),
      C: q3("2x(15 min 76-85% + 5 min 55%)"),
    },
  }),
  cycling({
    title: "3 × 12 min tempo",
    kind: "Kvalitet",
    intensity: "Z3 Tempo",
    phases: ["uppbyggnad", "specifik"],
    purpose:
      "Övre tempo i hanterbara bitar, en brygga mellan den aeroba grunden och tröskelarbetet. Passet höjer den hållbara effekten och den muskulära uthålligheten utan den återhämtningskostnad ett tröskelpass har, och passar för att förbereda ett tröskelblock.",
    description:
      "82–88 % av FTP, RPE 6. Ansträngt men stabilt, andningen djup men kontrollerad. Pauserna lätta. Håll samma effekt i alla block. Kräver sista blocket mycket mer än det första, lägg dig i nedre delen av spannet nästa gång.",
    adaptations: Z3_ADAPT,
    fueling: Z3_FUEL,
    timing: Z3_TIMING,
    progression:
      "Antalet block: två, tre, fyra. Sedan längden till 15 minuter. Effekten ändras inte inom blocket.",
    levels: {
      A: q3("4x(12 min 82-88% + 4 min 55%)"),
      B: q3("3x(12 min 82-88% + 4 min 55%)"),
      C: q3("2x(12 min 82-88% + 4 min 55%)"),
    },
  }),
  cycling({
    title: "4 × 10 min tempo",
    kind: "Kvalitet",
    intensity: "Z3 Tempo",
    phases: ["uppbyggnad", "specifik"],
    purpose:
      "Tempo i övre delen av zonen, strax under tröskeln. Många block med korta pauser samlar mycket tid nära den hållbara gränsen och utvecklar muskulär uthållighet och förmågan att hålla hög aerob belastning. För tempocyklister och triathleter en specifik förberedelse inför tröskelblocket.",
    description:
      "85–90 % av FTP, RPE 6–7. Hårt men jämnt – avsluta varje block med lite kvar. Tre minuter lätt mellan. Sitt still, jämnt tryck, kadens 85–95 rpm.",
    adaptations: Z3_ADAPT,
    fueling: Z3_FUEL,
    timing: Z3_TIMING,
    progression:
      "Ett block till per vecka (3, 4, 5), sedan kortare pauser. Höj inte effekten förrän fem block går med stabil kvalitet.",
    levels: {
      A: q3("5x(10 min 85-90% + 3 min 55%)"),
      B: q3("4x(10 min 85-90% + 3 min 55%)"),
      C: q3("3x(10 min 85-90% + 3 min 55%)"),
    },
  }),

  // Z4 – tröskel -----------------------------------------------------------
  cycling({
    title: "4 × 16 min · Seiler",
    kind: "Kvalitet",
    intensity: "Z4 Tröskel",
    phases: ["uppbyggnad", "specifik"],
    purpose:
      "Ur Seilers studie från 2013, där 4 × 16 min med två minuters vila jämfördes med 4 × 8 och 4 × 4. Långa block på hög, hållbar intensitet samlar mycket tid nära tröskeln och utvecklar förmågan att hålla en stor andel av kapaciteten länge – det som skiljer två idrottare med samma VO₂max åt i långa lopp.",
    description:
      "90–95 % av FTP, RPE 7. Högsta effekt du kan hålla jämnt genom alla blocken – inte i det första. Två minuter lätt mellan. Kadens 85–95 rpm, sitt still. Faller effekten i sista blocket var starten för hård; börja i nedre delen av spannet nästa gång.",
    adaptations: Z4_ADAPT,
    fueling: Z4_FUEL,
    timing: Z4_TIMING,
    progression:
      "Behåll formatet hela blocket och låt effekten följa responsen: samma effekt i två veckor, sedan 2–3 % upp om puls och känsla sjunkit. Nivå A lägger 20 min Z2 efteråt – mer volym utan mer tröskeldos.",
    levels: {
      A: `${WU4}; 4x(16 min 90-95% + 2 min 55%); 20 min 65-72% distans; ${CD}`,
      B: q4("4x(16 min 90-95% + 2 min 55%)"),
      C: q4("3x(16 min 90-95% + 2 min 55%)"),
    },
  }),
  cycling({
    title: "3 × 12 min tröskel",
    kind: "Kvalitet",
    intensity: "Z4 Tröskel",
    phases: ["uppbyggnad", "specifik"],
    purpose:
      "Ett klassiskt tröskelpass: tid på LT2 i block som går att genomföra med god kvalitet. Det höjer den hållbara effekten och laktatomsättningen och passar som återkommande format i ett tröskelblock – samma pass i tre till fyra veckor gör utvecklingen mätbar.",
    description:
      "95–100 % av FTP, RPE 7–8. Hårt och jämnt, andningen tung men rytmisk. Fyra minuter lätt mellan blocken. Hitta effekten under de första 30 sekunderna i stället för att börja med en topp. Sista blocket ska gå på samma effekt.",
    adaptations: Z4_ADAPT,
    fueling: Z4_FUEL,
    timing: Z4_TIMING,
    progression:
      "Ett block till (2, 3, 4) innan blocken förlängs till 15 minuter. Effekten höjs först efter ett nytt test eller när pulsen tydligt sjunkit vid samma effekt.",
    levels: {
      A: q4("4x(12 min 95-100% + 4 min 55%)"),
      B: q4("3x(12 min 95-100% + 4 min 55%)"),
      C: q4("2x(12 min 95-100% + 4 min 55%)"),
    },
  }),
  cycling({
    title: "2 × 20 min tröskel",
    kind: "Kvalitet",
    intensity: "Z4 Tröskel",
    phases: ["uppbyggnad", "specifik"],
    purpose:
      "Två långa block nära tröskeln – det format som ligger närmast ett tempolopp eller ett långt, hårt parti i loppet. Passet höjer den hållbara effekten och tränar koncentrationen och pacingen som krävs för att hålla den, inte bara fysiologin.",
    description:
      "91–97 % av FTP, RPE 7–8. Lägg dig i nedre delen av spannet de första fem minuterna och avsluta i den övre. Fem minuter lätt mellan blocken. Tävlingsposition om det är målet. Jämnt tryck, lugn överkropp.",
    adaptations: Z4_ADAPT,
    fueling: Z4_FUEL,
    timing: Z4_TIMING,
    progression:
      "Blocklängden: 2 × 15, 2 × 20, 2 × 25 min. Effekten ligger kvar medan längden ökar; först när 2 × 25 går stabilt höjs effekten.",
    levels: {
      A: q4("2x(25 min 91-97% + 5 min 55%)"),
      B: q4("2x(20 min 91-97% + 5 min 55%)"),
      C: q4("2x(15 min 91-97% + 5 min 55%)"),
    },
  }),
  cycling({
    title: "5 × 8 min tröskel",
    kind: "Kvalitet",
    intensity: "Z4 Tröskel",
    phases: ["uppbyggnad", "specifik"],
    purpose:
      "Tröskel i kortare block, med effekt runt och strax över FTP. Fler och kortare drag gör det möjligt att samla mycket tid på LT2 med god kvalitet – särskilt för den som tappar fokus i långa block, eller tidigt i ett tröskelblock.",
    description:
      "97–103 % av FTP, RPE 8. Hårt men kontrollerat – varje drag ska avslutas på samma effekt som det började. Tre minuter lätt mellan. Kadens 85–95 rpm.",
    adaptations: Z4_ADAPT,
    fueling: Z4_FUEL,
    timing: Z4_TIMING,
    progression:
      "Antalet drag: 4, 5, 6. När sex drag går med jämn effekt kan vilan kortas till två minuter. En variabel i taget.",
    levels: {
      A: q4("6x(8 min 97-103% + 3 min 55%)"),
      B: q4("5x(8 min 97-103% + 3 min 55%)"),
      C: q4("4x(8 min 97-103% + 3 min 55%)"),
    },
  }),

  // Z5 – VO₂max och över ---------------------------------------------------
  cycling({
    ...Z5,
    title: "15/15",
    phases: P5_BASE,
    purpose:
      "Mycket korta intervaller som håller syreupptaget högt utan att mjölksyran hinner ta över: lång tid nära VO₂max till låg muskulär och mental kostnad. Ett bra första VO₂max-format, och en bra utvald hög intensitet i en polariserad grundperiod.",
    description:
      "15 s på 125–135 % av FTP, 15 s lätt. Dragen ska kännas snabba men inte maximala – det är summan som räknas. RPE 8 mot slutet av setet. Hög kadens, 95–105 rpm, och stanna inte helt i vilan. Sjunker effekten i dragen mer än 5–10 % i sista setet, avsluta där.",
    adaptations: A5_SHORT,
    fueling: Z5_FUEL,
    timing: T5_BASE,
    progression:
      "Vecka 1 två set om 12 drag, vecka 2 om 16, vecka 3 om 20 – sedan ett tredje set i nästa block. Effekten ligger kvar; det är tiden nära VO₂max som byggs på, en variabel i taget.",
    levels: {
      A: q5(sets(3, "16x(15 s 125-135% + 15 s 50%)", "4 min 50%")),
      B: q5(sets(2, "16x(15 s 125-135% + 15 s 50%)", "4 min 50%")),
      C: q5(sets(2, "12x(15 s 125-135% + 15 s 50%)", "4 min 50%")),
    },
  }),
  cycling({
    ...Z5,
    title: "5 × 50 % Tlim",
    phases: P5_BUILD,
    purpose:
      "Billats metod: drag på effekten vid VO₂max (MAP), lika långa som hälften av den tid du orkar hålla den effekten (Tlim). Med vila lika lång som draget ger formatet mycket tid nära VO₂max – och längden är individuell i stället för gissad.",
    description:
      "Effekten är din MAP, för de flesta 118–122 % av FTP. Tlim är ofta 4–6 minuter, så halva blir 2–3 minuter; här 2:30. Har du testat Tlim, sätt draget till hälften av den. Vila lika länge, lätt. RPE 9 i slutet av varje drag. Går effekten inte att hålla i draget är MAP satt för högt.",
    adaptations: A5_LONG,
    fueling: Z5_FUEL,
    timing: T5_BUILD,
    progression:
      "Antalet drag: 4, 5, 6. Testa Tlim igen efter blocket – blir den längre har kapaciteten ökat, och dragen förlängs därefter.",
    levels: {
      A: q5("6x(2:30 118-122% + 2:30 50%)"),
      B: q5("5x(2:30 118-122% + 2:30 50%)"),
      C: q5("4x(2:30 118-122% + 2:30 50%)"),
    },
  }),
  cycling({
    ...Z5,
    title: "10 × 1/1",
    phases: P5_BASE,
    purpose:
      "Minutdrag med lika lång vila – enkelt, upprepbart och lätt att följa över ett block. Syreupptaget stiger mot VO₂max under seriens gång. Formatet utvecklar aerob kapacitet och förmågan att återhämta sig mellan hårda insatser, som i ett lopp med upprepade ryck.",
    description:
      "115–120 % av FTP i en minut, en minut lätt. RPE 8–9 i de sista dragen. Starta inte första draget hårdare än det sista ska bli – hitta en effekt du kan hålla i alla tio. Kadens 90–100 rpm.",
    adaptations: A5_SHORT,
    fueling: Z5_FUEL,
    timing: T5_BASE,
    progression:
      "Antalet drag först: 8, 10, 12 över tre veckor. Effekten höjs ett par procent först när tolv drag går med jämn effekt och RPE under 9 – annars ligger den kvar.",
    levels: {
      A: q5("12x(1 min 115-120% + 1 min 50%)"),
      B: q5("10x(1 min 115-120% + 1 min 50%)"),
      C: q5("8x(1 min 115-120% + 1 min 50%)"),
    },
  }),
  cycling({
    ...Z5,
    title: "4 × 5 min",
    phases: P5_BUILD,
    purpose:
      "Det klassiska långa VO₂max-draget. Fem minuter räcker för att syreupptaget når toppen och stannar där en stund, och fyra minuters vila gör att kvaliteten håller i alla drag. Ett bra referenspass: samma format före och efter ett block visar vad som hänt.",
    description:
      "108–114 % av FTP, RPE 9 i sista minuten av varje drag. Jämn effekt – inte en hård första minut. Fyra minuter lätt. Når du inte upp i spannet i sista draget, ligg i nedre delen nästa gång i stället för att lägga till ett drag.",
    adaptations: A5_LONG,
    fueling: Z5_FUEL,
    timing: T5_BUILD,
    progression:
      "Antalet drag (3, 4, 5), sedan effekten. Rønnestads jämförelse mellan 4 × 5 min och 30/15-serier är ett skäl att låta två format avlösa varandra mellan blocken.",
    levels: {
      A: q5("5x(5 min 108-114% + 4 min 50%)"),
      B: q5("4x(5 min 108-114% + 4 min 50%)"),
      C: q5("3x(5 min 108-114% + 4 min 50%)"),
    },
  }),
  cycling({
    ...Z5,
    title: "5 × 5 min snabb start",
    phases: P5_BUILD,
    purpose:
      "En hård första minut drar upp syreupptaget snabbare, och resten av draget hålls på en effekt du klarar. Resultatet är mer tid nära VO₂max i varje drag än med jämn effekt, för samma eller lägre upplevd ansträngning. Studier av drag med fallande effekt pekar åt samma håll.",
    description:
      "Första minuten 125–130 % av FTP, sedan direkt ned till 105–110 % i fyra minuter. Övergången är det svåra: sänk effekten men behåll kadensen. RPE 9 mot slutet. Tre minuter lätt mellan. Sitt i sadeln.",
    adaptations: A5_LONG,
    fueling: Z5_FUEL,
    timing: T5_BUILD,
    progression:
      "Antalet drag (4, 5, 6). Startminutens effekt ändras inte; när sex drag går kan resten av draget flyttas mot 110 %.",
    levels: {
      A: q5(
        "6x(1 min 125-130% intervall + 4 min 105-110% intervall + 3 min 50%)",
      ),
      B: q5(
        "5x(1 min 125-130% intervall + 4 min 105-110% intervall + 3 min 50%)",
      ),
      C: q5(
        "4x(1 min 125-130% intervall + 4 min 105-110% intervall + 3 min 50%)",
      ),
    },
  }),
  cycling({
    ...Z5,
    title: "5 × 5 min med fartväxlingar",
    phases: P5_BUILD,
    purpose:
      "Fem minuter med tre korta toppar. Topparna håller syreupptaget högt, och partierna däremellan, strax över FTP, tränar förmågan att återhämta sig medan belastningen fortfarande är hög – som efter ett ryck i ett lopp. För landsvägscyklister och den som tappar när farten växlar.",
    description:
      "Toppar på 120–130 % av FTP i 30 sekunder, mellan dem 100–105 % i 70 sekunder. Gå upp i kadens i topparna i stället för att resa dig. RPE 9 i sista minuten. Tre minuter lätt mellan dragen.",
    adaptations: A5_LONG,
    fueling: Z5_FUEL,
    timing: T5_BUILD,
    progression:
      "Antalet drag (4, 5, 6). Därefter partierna mellan topparna mot 105 %. Topparna ändras sist.",
    levels: (() => {
      const rep =
        "30 s 120-130% intervall + 1:10 100-105% intervall + 30 s 120-130% intervall + 1:10 100-105% intervall + 30 s 120-130% intervall + 1:10 100-105% intervall + 3 min 50%";
      return {
        A: q5(`6x(${rep})`),
        B: q5(`5x(${rep})`),
        C: q5(`4x(${rep})`),
      };
    })(),
  }),
  cycling({
    ...Z5,
    title: "30/30",
    phases: P5_BASE,
    purpose:
      "En sammanhängande serie halvminuter. Lika lång vila gör formatet förlåtande – bra för att lära sig hålla jämn kvalitet i korta drag och för att samla tid nära VO₂max, innan formatet görs tätare (30/15) eller hårdare (2 × 10 × 30/30).",
    description:
      "30 s på 115–125 % av FTP, 30 s lätt, utan paus. RPE 8 mot slutet. Samma effekt i alla drag – det är sista tredjedelen som ger mest. Kadens 95–105 rpm.",
    adaptations: A5_SHORT,
    fueling: Z5_FUEL,
    timing: T5_BASE,
    progression:
      "Antalet drag (12, 16, 20). När 20 går jämnt är nästa steg 2 × 10 × 30/30 med högre effekt, eller 30/15.",
    levels: {
      A: q5("20x(30 s 115-125% + 30 s 50%)"),
      B: q5("16x(30 s 115-125% + 30 s 50%)"),
      C: q5("12x(30 s 115-125% + 30 s 50%)"),
    },
  }),
  cycling({
    ...Z5,
    title: "30/15",
    phases: P5_BASE,
    purpose:
      "Ingången till 30/15: 30 sekunder arbete och 15 sekunders vila håller syreupptaget högt genom hela setet, tätare än 30/30. Här i två set, som förberedelse för Rønnestads 3 × 13 × 30/15.",
    description:
      "30 s på 115–125 % av FTP, 15 s lätt men inte stillastående. RPE 8–9 i slutet av setet. Fyra minuter lätt mellan seten. Effekten ska vara densamma i sista och första draget.",
    adaptations: A5_SHORT,
    fueling: Z5_FUEL,
    timing: T5_BASE,
    progression:
      "Antalet drag per set (8, 10, 13), sedan ett tredje set. Därefter är 3 × 13 × 30/15 nästa format.",
    levels: {
      A: q5(sets(3, "10x(30 s 115-125% + 15 s 50%)", "4 min 50%")),
      B: q5(sets(2, "10x(30 s 115-125% + 15 s 50%)", "4 min 50%")),
      C: q5(sets(2, "8x(30 s 115-125% + 15 s 50%)", "4 min 50%")),
    },
  }),
  cycling({
    ...Z5,
    title: "8 × 20/10 · Tabata",
    phases: P5_BUILD,
    purpose:
      "Tabatas protokoll från 1996: åtta drag på 20 sekunder nära maximalt med tio sekunders vila. Det belastar den aeroba och den anaeroba kapaciteten på kort tid. Kort men mycket krävande – och fel pass för att bygga aerob grund. Det hör hemma där specificiteten är hög och loppet kräver upprepade maximala insatser.",
    description:
      "Så hårt som går att hålla i 20 sekunder och upprepa. Originalet låg på 170 % av effekten vid VO₂max, långt över Z5; här 150–170 % av FTP. Räkna med att effekten faller drag för drag – det är meningen. RPE 10 mot slutet. Ordentlig uppvärmning och lång nedvarvning. Hoppa över passet om du inte är utvilad.",
    adaptations:
      "Ökar den anaeroba kapaciteten och buffringsförmågan och ger en stark stimulans för VO₂max på kort tid. Förbättrar toleransen för mycket hög belastning.",
    fueling:
      "Ett kolhydratrikt mål 2–3 timmar innan. Passet är kort; vatten eller sportdryck räcker.",
    timing:
      "Uppbyggnad och tävlingsspecifik period, högst en gång i veckan och i korta perioder. För landsvägslopp, cykelcross, MTB och korta tävlingar. Inte i grundperioden och inte under toppning.",
    progression:
      "Antalet set – ett, sedan två – inte antalet drag. Effekten är maximal. Använd formatet i korta perioder, inte som stående kvalitetspass.",
    levels: {
      A: q5(sets(2, "8x(20 s 150-170% maximalt + 10 s 40%)", "6 min 50%")),
      B: q5("8x(20 s 150-170% maximalt + 10 s 40%)"),
      C: q5("6x(20 s 150-170% maximalt + 10 s 40%)"),
    },
  }),
  cycling({
    ...Z5,
    title: "4 × 4 min",
    phases: P5_BUILD,
    purpose:
      "Helgeruds 4 × 4: fyra minuter hårt, tre minuter aktiv vila. Ett av de mest studerade VO₂max-formaten, och lätt att upprepa och jämföra över ett block. Passar när profilen visar god tröskel men en begränsad maximal aerob kapacitet.",
    description:
      "108–115 % av FTP, motsvarande 90–95 % av maxpuls mot slutet av draget. RPE 9. Tre minuter aktiv vila, lätt. Pulsen kommer efter effekten – styr på watt i början och låt pulsen bekräfta i slutet.",
    adaptations: A5_LONG,
    fueling: Z5_FUEL,
    timing: T5_BUILD,
    progression:
      "Antalet drag (3, 4, 5), därefter effekten. Samma pass före och efter blocket ger ett bra mått på förändringen.",
    levels: {
      A: q5("5x(4 min 108-115% + 3 min 50-60%)"),
      B: q5("4x(4 min 108-115% + 3 min 50-60%)"),
      C: q5("3x(4 min 108-115% + 3 min 50-60%)"),
    },
  }),
  cycling({
    ...Z5,
    title: "3 × 13 × 30/15",
    phases: P5_BASE,
    purpose:
      "Rønnestads protokoll: tre serier om 13 × 30/15 med tre minuters vila. I hans jämförelse med 4 × 5 min gav de korta intervallerna större förbättringar hos vältränade cyklister. Formatet samlar mycket tid nära VO₂max med hög medeleffekt.",
    description:
      "30 s på 120–130 % av FTP, 15 s lätt. Sikta på samma effekt i alla 39 dragen; första serien ska kännas kontrollerad. RPE 9 i slutet av varje serie. Tre minuter lätt mellan serierna. Kadens 95–105 rpm.",
    adaptations: A5_SHORT,
    fueling: Z5_FUEL,
    timing: T5_BASE,
    progression:
      "Antalet drag per serie: 10, 13, 15 över blocket. Effekten höjs först när alla tre serierna håller jämn effekt till sista draget. Jämför snittet per serie från vecka till vecka – det är måttet på utvecklingen.",
    levels: {
      A: q5(sets(3, "15x(30 s 120-130% + 15 s 50%)", "3 min 50%")),
      B: q5(sets(3, "13x(30 s 120-130% + 15 s 50%)", "3 min 50%")),
      C: q5(sets(3, "10x(30 s 120-130% + 15 s 50%)", "3 min 50%")),
    },
  }),
  cycling({
    ...Z5,
    title: "3 × 10 × 40/20",
    phases: P5_BASE,
    purpose:
      "Samma idé som 30/15 men med längre drag: 40 sekunder arbete, 20 sekunder vila. Mer tid per drag på hög belastning, med vila som håller syreupptaget uppe. Ett naturligt nästa steg efter 30/15, eller ett andra format att växla till i nästa block.",
    description:
      "40 s på 115–125 % av FTP, 20 s lätt. RPE 9 i slutet av varje set. Fyra minuter lätt mellan seten. Hitta en effekt du klarar i alla tre seten – det är sista setet som avgör passet.",
    adaptations: A5_SHORT,
    fueling: Z5_FUEL,
    timing: T5_BASE,
    progression:
      "Antalet drag per set: 8, 10, 12 över blocket. Effekten höjs först när tre set om tolv går med jämn effekt. Formatet passar som andra block efter ett block med 30/15.",
    levels: {
      A: q5(sets(3, "12x(40 s 115-125% + 20 s 50%)", "4 min 50%")),
      B: q5(sets(3, "10x(40 s 115-125% + 20 s 50%)", "4 min 50%")),
      C: q5(sets(3, "8x(40 s 115-125% + 20 s 50%)", "4 min 50%")),
    },
  }),
  cycling({
    ...Z5,
    title: "10 × 3 min",
    phases: P5_BUILD,
    purpose:
      "Många treminutersdrag strax över FTP med kort vila. Summan blir lång tid med högt syreupptag – mer än i de flesta VO₂max-pass – på en effekt som går att hålla. Ett volymformat i gränslandet mellan tröskel och VO₂max.",
    description:
      "103–108 % av FTP, RPE 8. Kort vila, 90 sekunder lätt – det är vilan som gör passet. Början ska kännas för lätt. Går effekten inte att hålla efter halva passet, sänk till nedre delen av spannet och genomför antalet.",
    adaptations: A5_THRESHOLD,
    fueling: Z5_FUEL,
    timing: T5_LONG,
    progression:
      "Antalet drag först: 7, 10, 12. När tolv drag går, korta vilan till 1:15 i stället för att höja effekten. Effekten ändras sist, och helst efter ett nytt test.",
    levels: {
      A: q5("12x(3 min 103-108% + 1:30 50%)"),
      B: q5("10x(3 min 103-108% + 1:30 50%)"),
      C: q5("7x(3 min 103-108% + 1:30 50%)"),
    },
  }),
  cycling({
    ...Z5,
    title: "6 × 6 min",
    phases: P5_BUILD,
    purpose:
      "Volym för VO₂max och tröskel på en gång: sex drag på sex minuter, runt och strax över FTP. Formatet utvecklar förmågan att arbeta nära kapaciteten länge och passar idrottare med god VO₂max men svagare tröskelutnyttjande.",
    description:
      "100–106 % av FTP, RPE 8. Jämnt, och lika i sista draget som i första. Tre minuter lätt mellan. Kadens 85–95 rpm. Mycket total tid på hög belastning – kom utvilad.",
    adaptations: A5_THRESHOLD,
    fueling: Z5_FUEL,
    timing: T5_LONG,
    progression:
      "Antalet drag: 4, 5, 6 över tre veckor, sedan en lättare vecka. Effekten höjs efter ett nytt test, inte för att passet kändes lätt en dag.",
    levels: {
      A: q5("7x(6 min 100-106% + 3 min 50%)"),
      B: q5("6x(6 min 100-106% + 3 min 50%)"),
      C: q5("4x(6 min 100-106% + 3 min 50%)"),
    },
  }),
  cycling({
    ...Z5,
    title: "3 × 2 min + 8 × 30/15",
    phases: P5_BUILD,
    purpose:
      "Två format i ett: tvåminutersdragen driver upp syreupptaget, och 30/15-serien samlar sedan tid nära VO₂max när systemet redan är igång. Passet tränar också att hålla kvaliteten när tröttheten byggts upp – en del av den trötthetsresistens som avgör slutet av ett lopp.",
    description:
      "Två minuter på 115–120 % av FTP med två minuter lätt. Fyra minuter lätt. Sedan 30 s på 120–130 % och 15 s lätt. RPE 9 i slutet. Serien efter tvåminutersdragen ska fortfarande hålla effekten – den visar hur väl du återhämtar dig.",
    adaptations: A5_SHORT,
    fueling: Z5_FUEL,
    timing: T5_BUILD,
    progression:
      "En variabel i taget: först antalet 30/15 (6, 8, 10) över blocket, sedan ett tvåminutersdrag till. Effekterna ligger kvar så länge serien efter tvåminutersdragen tappar.",
    levels: {
      A: q5(
        "4x(2 min 115-120% + 2 min 50%); 4 min 50% vila; 10x(30 s 120-130% + 15 s 50%)",
      ),
      B: q5(
        "3x(2 min 115-120% + 2 min 50%); 4 min 50% vila; 8x(30 s 120-130% + 15 s 50%)",
      ),
      C: q5(
        "2x(2 min 115-120% + 2 min 50%); 4 min 50% vila; 6x(30 s 120-130% + 15 s 50%)",
      ),
    },
  }),
  cycling({
    ...Z5,
    title: "4 × 8 min",
    phases: P5_BUILD,
    purpose:
      "Mittengruppen i Seilers studie från 2013: 4 × 8 min med två minuters vila gav större förbättringar än 4 × 4 och 4 × 16. Formatet ligger mellan tröskel och VO₂max: högt nog för att belasta syreupptaget, långt nog för att samla mycket arbete.",
    description:
      "98–104 % av FTP, RPE 8–9. Högsta effekt du kan hålla i alla fyra; beroende på pacing glider formatet mellan Z4 och Z5. Två minuter lätt mellan. Styr på watt, följ pulsen.",
    adaptations: A5_THRESHOLD,
    fueling: Z5_FUEL,
    timing: T5_LONG,
    progression:
      "Effekten inom spannet först, sedan ett femte drag. Samma pass i 3–4 veckor gör förändringen tydlig.",
    levels: {
      A: q5("5x(8 min 98-104% + 2 min 50%)"),
      B: q5("4x(8 min 98-104% + 2 min 50%)"),
      C: q5("3x(8 min 98-104% + 2 min 50%)"),
    },
  }),
  cycling({
    ...Z5,
    title: "Fallande stege 3 min → 30 s",
    phases: P5_BUILD,
    purpose:
      "En stege där dragen blir kortare och effekten högre. Syreupptaget drivs upp i de långa dragen och hålls kvar när dragen kortas och effekten stiger. Tröttheten möts med kortare drag, så kvaliteten håller – varierat men fortfarande ett tydligt VO₂max-pass.",
    description:
      "3 min på 106–110 % av FTP, sedan varje drag 30 sekunder kortare och några procent hårdare, sist 30 s på 125–135 %. Vila 1:30–2 min lätt. RPE 9 i slutet av stegen. Spara lite i de första dragen – det sista ska vara det hårdaste.",
    adaptations: A5_LONG,
    fueling: Z5_FUEL,
    timing: T5_BUILD,
    progression:
      "Mängden: en stege, en och en halv, två över blocket. Effekterna ligger kvar. När två stegar går med ett hårdare sista drag än det första kan hela stegen flyttas upp ett par procent.",
    levels: (() => {
      const steps: [string, string][] = [
        ["3 min", "106-110%"],
        ["2:30", "108-112%"],
        ["2 min", "110-115%"],
        ["1:30", "113-118%"],
        ["1 min", "115-120%"],
        ["30 s", "125-135%"],
      ];
      // Vilan är två minuter efter de långa dragen och 1:30 efter de korta.
      const ladder = (from: number) =>
        steps
          .slice(from)
          .map(
            ([time, target], i, all) =>
              `${time} ${target} intervall` +
              (i < all.length - 1
                ? `; ${from + i < 3 ? "2 min" : "1:30"} 50% vila`
                : ""),
          )
          .join("; ");
      return {
        A: q5(`${ladder(0)}; 4 min 50% vila; ${ladder(0)}`),
        B: q5(`${ladder(0)}; 4 min 50% vila; ${ladder(2)}`),
        C: q5(ladder(1)),
      };
    })(),
  }),
  cycling({
    ...Z5,
    title: "6 × 5 min",
    phases: P5_BUILD,
    purpose:
      "Fler femminutersdrag med kortare vila än 4 × 5, och därför något lägre effekt. Mer total tid nära VO₂max och tröskel – ett volymformat för andra och tredje veckan i ett block, eller för idrottare som tål mycket arbete.",
    description:
      "104–108 % av FTP, RPE 8–9. Två och en halv minut lätt mellan. Jämnt tryck, 85–95 rpm. Sista draget ska gå på samma effekt som det första.",
    adaptations: A5_LONG,
    fueling: Z5_FUEL,
    timing: T5_BUILD,
    progression:
      "Antalet drag: 5, 6, 7 över blocket. Vilan kortas inte samtidigt som drag läggs till – en variabel i taget. När sju drag håller effekten kan vilan kortas till två minuter i nästa block.",
    levels: {
      A: q5("7x(5 min 104-108% + 2:30 50%)"),
      B: q5("6x(5 min 104-108% + 2:30 50%)"),
      C: q5("5x(5 min 104-108% + 2:30 50%)"),
    },
  }),
  cycling({
    ...Z5,
    title: "12 × 1/1",
    phases: P5_BUILD,
    purpose:
      "Minutdrag i två set med högre effekt än 10 × 1/1. Den högre effekten ger ett större anaerobt bidrag och tränar toleransen för de hårdaste partierna i ett lopp, samtidigt som serien håller syreupptaget högt.",
    description:
      "120–130 % av FTP i en minut, en minut mycket lätt. RPE 9. Fyra minuter lätt mellan seten. Sitt kvar och håll kadensen; res dig bara om terrängen kräver det.",
    adaptations: A5_SHORT,
    fueling: Z5_FUEL,
    timing: T5_BUILD,
    progression:
      "Antalet drag per set: 5, 6, 8 över blocket. Effekten ligger kvar; tappar du mer än 5 % i sista draget i ett set är antalet för högt för dagen.",
    levels: {
      A: q5(sets(2, "8x(1 min 120-130% + 1 min 40-50%)", "4 min 50%")),
      B: q5(sets(2, "6x(1 min 120-130% + 1 min 40-50%)", "4 min 50%")),
      C: q5(sets(2, "5x(1 min 120-130% + 1 min 40-50%)", "4 min 50%")),
    },
  }),
  cycling({
    ...Z5,
    title: "60/60",
    phases: P5_BASE,
    purpose:
      "Minutdrag med flytande vila: vilan ligger på 65–70 % i stället för lätt. Syreupptaget sjunker inte mellan dragen, så nästan hela serien tillbringas nära VO₂max – på en lägre toppeffekt än i 1/1. Bra för att samla tid med hög aerob belastning.",
    description:
      "1 min på 110–115 % av FTP, 1 min på 65–70 %, utan paus. RPE 8 som stiger mot 9. Vilan ska kännas för hård för att vara vila – det är meningen. Sänk dragen till 108 % hellre än att släppa vilan.",
    adaptations: A5_SHORT,
    fueling: Z5_FUEL,
    timing: T5_BASE,
    progression:
      "Antalet drag först: 10, 14, 18. Därefter vilan till 70–75 % – det gör serien tätare utan att dragen blir hårdare. Höj inte dragen och vilan samma vecka.",
    levels: {
      A: q5("18x(1 min 110-115% + 1 min 65-70% flytande vila)"),
      B: q5("14x(1 min 110-115% + 1 min 65-70% flytande vila)"),
      C: q5("10x(1 min 110-115% + 1 min 65-70% flytande vila)"),
    },
  }),
  cycling({
    ...Z5,
    title: "10 × 400 m",
    phases: ["uppbyggnad", "specifik", "topp"],
    purpose:
      "Korta, snabba drag med lång vila: ett format för hög fart och effekt över VO₂max, och för förmågan att upprepa dem. Den långa vilan gör att varje drag kan köras med kvalitet. För landsvägslopp, kriterier och lopp med upprepade accelerationer – och som ett kort, skarpt inslag under toppningen.",
    description:
      "400 m på slät väg tar 35–45 sekunder; inne kör du 40 sekunder. 125–135 % av FTP, hög kadens, över 100 rpm, sittande. 1:20 lätt. RPE 8–9. Effekten ska hålla i alla drag – det här är kvalitet, inte uthållighet.",
    adaptations:
      "Höjer effekten och farten över VO₂max och förmågan att upprepa korta, hårda insatser. Ger en tydlig stimulans för VO₂max och den anaeroba kapaciteten, och neuromuskulär träning i hög kadens.",
    fueling: Z5_FUEL,
    timing:
      "Uppbyggnad och tävlingsspecifik period, en gång i veckan. Under toppning i kortare form för att behålla skärpan. Slät väg utan trafik, eller trainer.",
    progression:
      "Antalet drag: 8, 10, 12. Vilan kortas först när tolv drag håller effekten. Under toppning: halva antalet, samma effekt.",
    levels: {
      A: q5("12x(40 s 125-135% ≈ 400 m + 1:20 50%)"),
      B: q5("10x(40 s 125-135% ≈ 400 m + 1:20 50%)"),
      C: q5("8x(40 s 125-135% ≈ 400 m + 1:20 50%)"),
    },
  }),
  cycling({
    ...Z5,
    title: "5 × 6 min stegrande",
    phases: P5_BUILD,
    purpose:
      "Drag på sex minuter där varje drag är lite hårdare än det förra. Passet börjar vid tröskeln och slutar i VO₂max – en kontrollerad väg upp som lär ut pacing och visar var kvaliteten börjar falla.",
    description:
      "Första draget 100–103 % av FTP, sedan tre procentenheter mer per drag, sist 112–115 %. Tre minuter lätt mellan. RPE 7 i första draget och 9 i det sista. Når du inte effekten i sista draget har du hittat dagens tak. Skriv upp det.",
    adaptations: A5_THRESHOLD,
    fueling: Z5_FUEL,
    timing: T5_LONG,
    progression:
      "Sista dragets effekt är måttet. Lägg till ett drag först när sista draget går med god kvalitet.",
    levels: (() => {
      const targets = [
        "100-103%",
        "103-106%",
        "106-109%",
        "109-112%",
        "112-115%",
        "115-118%",
      ];
      const ladder = (from: number, to: number) =>
        targets
          .slice(from, to)
          .map((t) => `6 min ${t} intervall`)
          .join("; 3 min 50% vila; ");
      return {
        A: q5(ladder(0, 6)),
        B: q5(ladder(0, 5)),
        C: q5(ladder(1, 5)),
      };
    })(),
  }),
  cycling({
    ...Z5,
    title: "4 × 7 min",
    phases: P5_BUILD,
    purpose:
      "Långa VO₂max-drag i övre tröskelområdet. Sju minuter ger lång tid nära maximal syreupptagning och ett stort tröskelinslag; beroende på pacing glider formatet mellan Z4 och Z5. Bra när VO₂max och tröskel ska utvecklas samtidigt.",
    description:
      "103–108 % av FTP, RPE 9 mot slutet. Tre och en halv minut lätt. Jämn effekt – starta inte för hårt. Kadens 85–95 rpm.",
    adaptations: A5_THRESHOLD,
    fueling: Z5_FUEL,
    timing: T5_LONG,
    progression:
      "Antalet drag: 3, 4, 5 över blocket. Därefter effekten inom spannet, från nedre till övre delen. Samma pass före och efter blocket visar förändringen.",
    levels: {
      A: q5("5x(7 min 103-108% + 3:30 50%)"),
      B: q5("4x(7 min 103-108% + 3:30 50%)"),
      C: q5("3x(7 min 103-108% + 3:30 50%)"),
    },
  }),
  cycling({
    ...Z5,
    title: "2 × 10 × 30/30",
    phases: P5_BASE,
    purpose:
      "30/30 i set, med högre effekt än den sammanhängande serien. Uppdelningen gör det möjligt att lägga varje drag högre – mer belastning per drag, med samma tid nära VO₂max.",
    description:
      "30 s på 120–130 % av FTP, 30 s lätt, tio gånger. Fem minuter lätt mellan seten. RPE 9 i slutet av setet. Hög kadens i dragen.",
    adaptations: A5_SHORT,
    fueling: Z5_FUEL,
    timing: T5_BASE,
    progression:
      "Antalet drag per set: 8, sedan 10. Därefter ett tredje set. Effekten ligger kvar så länge den sjunker i sista setet.",
    levels: {
      A: q5(sets(3, "10x(30 s 120-130% + 30 s 50%)", "5 min 50%")),
      B: q5(sets(2, "10x(30 s 120-130% + 30 s 50%)", "5 min 50%")),
      C: q5(sets(2, "8x(30 s 120-130% + 30 s 50%)", "5 min 50%")),
    },
  }),
  cycling({
    ...Z5,
    title: "3 × 6 min",
    phases: P5_BUILD,
    purpose:
      "Få men långa VO₂max-drag på hög effekt. Med tre drag går effekten att lägga högre än i 6 × 6, så att syreupptaget når toppen och stannar där. Ett tydligt kvalitetspass och ett bra referenspass.",
    description:
      "108–113 % av FTP, RPE 9–10 i slutet av dragen. Fyra minuter lätt. Börja i nedre delen av spannet och avsluta i den övre. Kom utvilad.",
    adaptations: A5_LONG,
    fueling: Z5_FUEL,
    timing: T5_BUILD,
    progression:
      "Antalet drag: 2, 3, 4 över blocket. Effekten höjs först när fyra drag går i övre delen av spannet. Passet fungerar också som avstämning före och efter ett block.",
    levels: {
      A: q5("4x(6 min 108-113% + 4 min 50%)"),
      B: q5("3x(6 min 108-113% + 4 min 50%)"),
      C: q5("2x(6 min 108-113% + 4 min 50%)"),
    },
  }),
  cycling({
    ...Z5,
    title: "5 × 3 min hård start",
    phases: P5_BUILD,
    purpose:
      "Treminutersdrag med hård start: de första 30 sekunderna drar upp syreupptaget snabbt, och resten av draget hålls på en effekt som går att klara. Mer tid nära VO₂max per drag än med jämn effekt – och träning i att hitta rätt effekt efter en attack.",
    description:
      "30 s på 130–140 % av FTP, sedan direkt ned till 108–112 % i 2:30. Tre minuter lätt. RPE 9. Sitt kvar efter starten och håll kadensen.",
    adaptations: A5_LONG,
    fueling: Z5_FUEL,
    timing: T5_BUILD,
    progression:
      "Antalet drag: 4, 5, 6. Startens effekt ligger kvar. När sex drag går kan resten av draget flyttas mot övre delen av spannet – en variabel i taget.",
    levels: {
      A: q5(
        "6x(30 s 130-140% intervall + 2:30 108-112% intervall + 3 min 50%)",
      ),
      B: q5(
        "5x(30 s 130-140% intervall + 2:30 108-112% intervall + 3 min 50%)",
      ),
      C: q5(
        "4x(30 s 130-140% intervall + 2:30 108-112% intervall + 3 min 50%)",
      ),
    },
  }),
  cycling({
    ...Z5,
    title: "2 × 8 × 40/20",
    phases: P5_BUILD,
    purpose:
      "40/20 i kortare set och med högre effekt än 3 × 10 × 40/20. Färre drag per set gör att varje drag kan ligga högre – mer anaerob belastning och högre toppeffekt, med syreupptaget kvar nära max.",
    description:
      "40 s på 120–130 % av FTP, 20 s lätt. Fem minuter lätt mellan seten. RPE 9. Effekten ska vara densamma i sista draget som i första.",
    adaptations: A5_SHORT,
    fueling: Z5_FUEL,
    timing: T5_BUILD,
    progression:
      "Antalet drag per set: 6, sedan 8. Därefter ett tredje set. Effekten ligger kvar tills tre set går jämnt.",
    levels: {
      A: q5(sets(3, "8x(40 s 120-130% + 20 s 50%)", "5 min 50%")),
      B: q5(sets(2, "8x(40 s 120-130% + 20 s 50%)", "5 min 50%")),
      C: q5(sets(2, "6x(40 s 120-130% + 20 s 50%)", "5 min 50%")),
    },
  }),
  cycling({
    ...Z5,
    title: "7 × 2 min",
    phases: P5_BUILD,
    purpose:
      "Tvåminutersdrag är långa nog för att syreupptaget ska nå högt och korta nog för att effekten kan ligga klart över tröskeln. Ett format för VO₂max och för de hårdaste minuterna i ett lopp.",
    description:
      "115–122 % av FTP, två minuter lätt. RPE 9. Jämn effekt genom hela draget; hitta den i första draget och håll den.",
    adaptations: A5_LONG,
    fueling: Z5_FUEL,
    timing: T5_BUILD,
    progression:
      "Antalet drag: 5, 7, 9 över blocket. Effekten höjs ett par procent först när nio drag går jämnt. Tappar du effekt mot slutet, behåll antalet en vecka till.",
    levels: {
      A: q5("9x(2 min 115-122% + 2 min 50%)"),
      B: q5("7x(2 min 115-122% + 2 min 50%)"),
      C: q5("5x(2 min 115-122% + 2 min 50%)"),
    },
  }),
  cycling({
    ...Z5,
    title: "4 × 9 min",
    phases: P5_BUILD,
    purpose:
      "Långa drag runt och strax över FTP. Beroende på pacing glider formatet mellan Z4 och Z5, och det belastar tröskel och syreupptag med mycket arbete nära kapaciteten. Passar när målet är långa, hårda partier.",
    description:
      "100–105 % av FTP, RPE 8–9. Tre minuter lätt. Starta i nedre delen av spannet. Faller fjärde draget under 98 % var effekten för hög – sänk nästa gång i stället för att korta.",
    adaptations: A5_THRESHOLD,
    fueling: Z5_FUEL,
    timing: T5_LONG,
    progression:
      "Effekten inom spannet, sedan längre drag (10 min). Nivå A lägger 20 min Z2 efteråt – mer volym utan mer intensitet.",
    levels: {
      A: `${WU5}; 4x(9 min 100-105% + 3 min 50%); 20 min 65-72% distans; ${CD}`,
      B: q5("4x(9 min 100-105% + 3 min 50%)"),
      C: q5("3x(9 min 100-105% + 3 min 50%)"),
    },
  }),
  cycling({
    ...Z5,
    title: "20 × 30/15",
    phases: P5_BASE,
    purpose:
      "En lång, sammanhängande 30/15-serie: femton minuter där syreupptaget ligger nära max nästan hela tiden. Utan pauser mellan set blir det ett test av kapaciteten och av förmågan att hålla kvalitet. Ett naturligt steg efter 3 × 13 × 30/15.",
    description:
      "30 s på 120–128 % av FTP, 15 s lätt, tjugo gånger. RPE 9 i sista tredjedelen. Ligg i nedre delen av spannet i början; de sista sex dragen avgör om effekten var rätt.",
    adaptations: A5_SHORT,
    fueling: Z5_FUEL,
    timing: T5_BASE,
    progression:
      "Antalet drag: 14, 20, 26 över blocket. Effekten ligger kvar. Snittet i sista tredjedelen jämfört med den första visar om effekten var rätt.",
    levels: {
      A: q5("26x(30 s 120-128% + 15 s 50%)"),
      B: q5("20x(30 s 120-128% + 15 s 50%)"),
      C: q5("14x(30 s 120-128% + 15 s 50%)"),
    },
  }),

  // Kraft -------------------------------------------------------------------
  cycling({
    title: "Subthreshold torque · låg kadens",
    kind: "Kraft",
    intensity: "Z3 Tempo",
    phases: ["grund", "uppbyggnad"],
    purpose:
      "Kraft på cykeln: block under tröskeln på låg kadens, 60 rpm, där varje tramptag kräver mer kraft vid samma effekt. Syftet är cykelspecifik kraftutveckling och muskulär uthållighet utan den trötthet ett tröskelpass ger. Avslutningen i hög kadens tränar motsatsen – koordination och snabbhet – innan benen får vila.",
    description:
      "Huvuddelen på 85 % av FTP och 60 rpm, sittande. Jämnt tryck genom hela tramptaget, lugn överkropp, inget ryckande. Kontrollerat, inte maximalt – RPE 6. Avslutningen 30 s på 125 % och över 110 rpm, sedan en minut lätt. Känner du av knäna: höj kadensen till 70 rpm och sänk effekten. Forskningen är splittrad om låg kadens ger mer än samma arbete på fri kadens – se passet som en hypotes och följ responsen.",
    adaptations:
      "Cykelspecifik kraftutveckling och muskulär uthållighet, trötthetsresistens, trampekonomi och rekrytering av fler muskelfibrer vid samma effekt. Avslutningen tränar koordination i hög kadens.",
    fueling:
      "60–90 g kolhydrater per timme och 500–750 ml vätska per timme – passet är över en och en halv timme.",
    timing:
      "Grundperioden och tidig uppbyggnad, 1–2 gånger i veckan. Huvuddelen ligger i tempo, så räkna passet som veckans mellanintensitet. Bäst på trainer eller i en jämn, lång stigning där effekt och kadens går att hålla stilla.",
    progression:
      "Antalet block (3, 4, 5) med samma effekt och kadens. Därefter blocklängden till 8 minuter. Gå inte under 55 rpm.",
    levels: (() => {
      const warmup =
        "20 min 50-55%; 1 min 75% uppvärmning; 1 min 80% uppvärmning; 1 min 85% uppvärmning; 1 min 90% uppvärmning; 1 min 95% uppvärmning";
      const main = (n: number) => `${n}x(6 min 85% 60 rpm + 3 min 55%)`;
      const finisher = (n: number) => `${n}x(30 s 125% >110 rpm + 1 min 60%)`;
      return {
        A: `${warmup}; ${main(5)}; 30 min 55% distans; ${finisher(4)}; ${CD}`,
        B: `${warmup}; ${main(4)}; 20 min 55% distans; ${finisher(4)}; ${CD}`,
        C: `${warmup}; ${main(3)}; 15 min 55% distans; ${finisher(3)}; ${CD}`,
      };
    })(),
  }),
  // Fler pass ur Sisu Endurance Lab -----------------------------------------
  cycling({
    title: "Neuromuskulär kraft · 7 × 4:50",
    kind: "Kraft",
    intensity: "Kraft och sprint",
    phases: ["uppbyggnad", "specifik"],
    purpose:
      "Ur Tadej Pogačars träning i UAE Team Emirates. Varje repetition är fyra minuter aerobt, 35 sekunder tung kraft på låg kadens och 15 sekunder sprint i hög kadens. Kombinationen tränar kraftutveckling, acceleration och förmågan att producera explosiv effekt när den aeroba belastningen redan är förhöjd – som en attack i en stigning.",
    description:
      "Uppvärmningen har ett tempoinslag och tre korta snabbsnurr. Sedan 30 minuter lugnt. I serien: fyra minuter kontrollerat på 70 %, 35 sekunder på 130 % i 50 rpm – tungt vridmoment, sittande, jämnt tryck – och sedan 15 sekunders sprint upp i hög kadens. Växla inte för tungt i spurten; mjukt upp i kadens. Kvalitet går före effekt. Blir dragen sämre, avsluta serien tidigare.",
    adaptations:
      "Kraftutveckling med högt vridmoment, rekrytering av motoriska enheter med hög tröskel, anaerob kraft och acceleration, aerobt stöd vid varierande effekt, förmågan att upprepa hårda ryck och stigningsspecifik styrka.",
    fueling:
      "60–90 g kolhydrater per timme och 500–750 ml vätska per timme. Kom fylld och ät under passet. Anpassa saltet efter värmen.",
    timing:
      "Uppbyggnad före tävlingsperioden eller ett stigningsblock, en gång i veckan. Bäst i en jämn stigning eller på trainer. Passar inför lopp med många ryck.",
    progression:
      "Antalet repetitioner (5, 7, 8) med samma innehåll. Färre repetitioner när fräschheten är låg – kvaliteten i 35-sekundersdelen är det som räknas.",
    levels: (() => {
      const wu =
        "20 min 60%; 5 min 85% uppvärmning; 10 min 45% uppvärmning; 3x(20 s 70% uppvärmning + 40 s 50% uppvärmning)";
      const main = (n: number) =>
        `30 min 55-65% distans; ${n}x(4 min 70% intervall + 35 s 130% intervall + 15 s 150% sprint); 5 min 45% vila; 15 min 45%`;
      return {
        A: `${wu}; ${main(8)}`,
        B: `${wu}; ${main(7)}`,
        C: `${wu}; ${main(5)}`,
      };
    })(),
  }),
  cycling({
    ...Z5,
    title: "Aerob kraft under trötthet · 2 × 21 min",
    phases: P5_BUILD,
    purpose:
      "Ett långt pass med 24 minuter på hög intensitet medvetet lagda djupt in i det. Högt syreupptag i utvilat läge räcker inte här. Målet är att behålla aerob kraft och effektkontroll när timmarna och glykogenförbrukningen redan börjat kosta, och det är det som avgör slutet av ett långt lopp.",
    description:
      "Uppvärmningen innehåller 20 minuter på 90 %. Sedan 45 minuter lugnt. Huvudseten är 21 minuter: tre minuter på 110–115 % och tre minuter på 60 % om vartannat, fyra hårda och tre lätta. 25 minuter lugnt mellan seten. Håll VO₂-dragen kontrollerade, inte maximala, och byt effekt mjukt. Ät tidigt och jämnt.",
    adaptations:
      "VO₂max-utveckling, ökad plasmavolym, stöd för slagvolym och hjärtminutvolym, kapillarisering i musklerna, förmågan att upprepa hög aerob effekt och trötthetsresistens sent i långa pass.",
    fueling:
      "60–90 g kolhydrater per timme och 500–750 ml vätska per timme. Kom fylld och ät från start – passet är över tre timmar. Anpassa saltet efter värmen.",
    timing:
      "Uppbyggnad, i ett block för aerob kraft, en gång i veckan eller var 7–10:e dag. Bäst på jämn väg eller trainer.",
    progression:
      "Antalet hårda drag per set (3, 4, 5). Effekten ligger kvar. Är fräschheten låg: ett set i stället för två.",
    levels: (() => {
      const wu =
        "30 min 60%; 5 min 85% uppvärmning; 10 min 45% uppvärmning; 20 min 90%; 45 min 50% distans";
      const set = (n: number) =>
        `${n}x(3 min 110-115% + 3 min 60%); 3 min 110-115% intervall`;
      return {
        A: `${wu}; ${set(4)}; 25 min 45% vila; ${set(4)}; 25 min 45%`,
        B: `${wu}; ${set(3)}; 25 min 45% vila; ${set(3)}; 25 min 45%`,
        C: `${wu}; ${set(3)}; 25 min 45%`,
      };
    })(),
  }),
  cycling({
    title: "Laktatpendling · 2 × 20 min över och under",
    kind: "Kvalitet",
    intensity: "Z4 Tröskel",
    phases: ["uppbyggnad", "specifik"],
    purpose:
      "Ur Alpecins träning: två block där en minut över tröskeln och en minut strax under växlar tio gånger, inne i ett pass på drygt tre timmar. Över-minuterna höjer laktatproduktionen; under-minuterna är tillräckligt hårda för att laktatet ska transporteras och förbrännas i stället för att vila bort. Passet tränar laktatomsättning, tröskelkontroll och förmågan att hantera ryck och lugna ned sig igen utan att tappa pacing.",
    description:
      "55 minuter uppvärmning som trappas upp genom Z1–Z2. Blocken: 1 minut på 115 % och 1 minut på 80–85 %, tio gånger, utan paus. 50 minuter aerobt mellan blocken. Efter andra blocket 10 minuter jämnt på 80–85 %, sedan 45 minuter nedvarvning. RPE 7–8. Under-minuterna är arbete, inte vila – håll trycket.",
    adaptations:
      "Laktatomsättning och laktatpendling mellan muskelfibrer, tröskelkontroll, metabol uthållighet och förmågan att återställa stabilitet efter ryck när tröttheten, glykogenkostnaden och den kardiovaskulära belastningen redan byggts upp.",
    fueling:
      "60–90 g kolhydrater per timme och 500–750 ml vätska per timme. Passet är över tre timmar med mycket arbete över tröskeln – ät från start.",
    timing:
      "Uppbyggnad och tävlingsspecifik period, en gång i veckan i ett tröskelblock. Passar inför lopp med ryck och tempoväxlingar. Trainer eller jämn väg.",
    progression:
      "Antalet växlingar per block (7, 10, 12). Effekterna ligger kvar. När blocken går jämnt kan över-minuterna höjas till 120 % – en variabel i taget.",
    levels: (() => {
      const block = (n: number) =>
        `${n}x(1 min 115% intervall + 1 min 80-85% intervall)`;
      const pass = (n: number, mid: number, cd: number) =>
        `55 min 50-65%; ${block(n)}; ${mid} min 50-70% distans; ${block(n)}; 10 min 80-85% jämnt; ${cd} min 50-70%`;
      return { A: pass(12, 50, 45), B: pass(10, 50, 45), C: pass(7, 30, 20) };
    })(),
  }),
  cycling({
    ...Z5,
    title: "VO₂max i långpass · Jayco AlUla",
    phases: P5_BUILD,
    purpose:
      "Ett elitpass ur Team Jayco AlUlas träning: nära fem timmar där VO₂max-arbetet ligger inne i stor aerob volym. Först fallande fyraminuters drag, sedan två set 30/15, och sent i passet åtta minuter på tröskeln när glykogenet redan är lägre. Kombinationen ger aerob kraft, laktatkontroll och trötthetsresistens i samma pass.",
    description:
      "65 minuter uppvärmning som trappas upp genom Z1–Z2. Block 1: 4 minuter på 120, 115 och 110 % med 2 minuter på 50 % efter varje. 35 minuter lugnt. Block 2: 12 × 30 sekunder på 120–125 % och 15 sekunder på 50 %, två gånger med 6 minuter på 65–70 % emellan. 35 minuter lugnt och 50 minuter på 55–60 %. Sedan 8 minuter på 100–105 % och 55 minuter lugnt. Nivå C är en kortare version för den som inte tränar som ett proffs.",
    adaptations:
      "Fyraminutersdragen och 30/15-seten samlar mycket tid nära VO₂max och ger central och perifer aerob anpassning. Hårda ryck med ofullständig vila höjer laktatproduktionen och tvingar fram omsättning och återanvändning. Den stora aeroba volymen bygger trötthetsresistens, och tröskelblocket sent tränar kvalitet när glykogenet är lägre.",
    fueling:
      "60–90 g kolhydrater per timme från start och 500–750 ml vätska per timme. Med 2 700–4 200 kJ arbete är energin avgörande för kvaliteten i de sena blocken.",
    timing:
      "Uppbyggnad och tävlingsspecifik period för den som tränar mycket, högst en gång i veckan. Behöver en lätt dag före och efter.",
    progression:
      "Den aeroba volymen runt kvaliteten: först den sista lugna delen, sedan den mellersta. Intervallerna ligger kvar.",
    levels: (() => {
      const b1 =
        "4 min 120% intervall; 2 min 50% vila; 4 min 115% intervall; 2 min 50% vila; 4 min 110% intervall; 2 min 50% vila";
      const burst = "12x(30 s 120-125% + 15 s 50%)";
      return {
        A: `65 min 50-65%; ${b1}; 35 min 60% distans; ${burst}; 6 min 65-70% distans; ${burst}; 35 min 60% distans; 50 min 55-60% distans; 8 min 100-105% intervall; 75 min 55-60%`,
        B: `65 min 50-65%; ${b1}; 35 min 60% distans; ${burst}; 6 min 65-70% distans; ${burst}; 35 min 60% distans; 50 min 55-60% distans; 8 min 100-105% intervall; 55 min 55-60%`,
        C: `45 min 50-65%; ${b1}; 20 min 60% distans; ${burst}; 20 min 60% distans; 8 min 100-105% intervall; 30 min 55-60%`,
      };
    })(),
  }),
  cycling({
    title: "3 × 60 min metabolt pass",
    kind: "Distans",
    intensity: "Z2 Uthållighet",
    phases: ["grund", "uppbyggnad", "specifik"],
    purpose:
      "Ur proffscyklingen: Jeroen Swart beskriver tre entimmesblock på 310–320 W, ungefär 75 % av FTP, för Ben McNulty. Enkelt på papperet, mycket aerobt arbete i praktiken. Blocken ligger i övre Z2 med laktatet kontrollerat runt 1,5–1,8 mmol/l – en stor aerob stimulans till en återhämtningskostnad som går att upprepa i en vecka med mycket volym.",
    description:
      "20 minuter uppvärmning: 10 minuter lätt, 5 minuter stegring och tre korta snabbsnurr. Sedan tre block på 72–75 % av FTP med 10 minuter lätt emellan. Puls runt 140–150 för McNulty – styr hellre på laktat eller puls än på watt om de går isär. RPE 6–7. Kadens 85–95 rpm, jämnt tryck. Blocken ska se likadana ut; driver pulsen uppåt mycket i sista blocket, sänk effekten.",
    adaptations: `${Z2_ADAPT} Det långa, kontrollerade arbetet utmanar den oxidativa metabolismen hårt, förbättrar substratanvändningen och förmågan att prestera sent i långa lopp – med lägre stress än VO₂max-intervaller.`,
    fueling:
      "60–90 g kolhydrater per timme och 500–750 ml vätska per timme. Passet är nära fyra timmar – öva tävlingens energiplan.",
    timing:
      "Grundperiod och uppbyggnad för den som tränar mycket och mot långa lopp, en gång i veckan. Räknas som lågintensivt i fördelningen, men ligger i övre delen av zonen – inte samma dag som ett annat långpass.",
    progression:
      "Blocklängden eller antalet block, aldrig effekten först: 2 × 60, 3 × 60, 3 × 75 minuter. Effekten följer laktat och puls.",
    levels: (() => {
      const wu =
        "10 min 50-55%; 5 min 60-70% uppvärmning; 3x(30 s 70% uppvärmning + 30 s 55% uppvärmning)";
      const blocks = (n: number, len: number) =>
        Array.from({ length: n }, () => `${len} min 72-75% distans`).join(
          "; 10 min 55% vila; ",
        );
      return {
        A: `${wu}; ${blocks(3, 75)}; 15 min 50%`,
        B: `${wu}; ${blocks(3, 60)}; 15 min 50%`,
        C: `${wu}; ${blocks(2, 60)}; 15 min 50%`,
      };
    })(),
  }),
  cycling({
    title: "3 × 12 min undertröskel · 70.3",
    kind: "Kvalitet",
    intensity: "Z4 Tröskel",
    phases: ["uppbyggnad", "specifik"],
    purpose:
      "Tröskelprogression inför 70.3: block strax under tröskeln, 90–95 % av FTP. För en triathlet är det inte den högsta effekten som avgör, utan hur nära tröskeln det går att cykla länge och ändå springa bra efteråt. Passet höjer den hållbara effekten och är ett återkommande format i ett block mot 70.3.",
    description:
      "90–95 % av FTP, RPE 7. Hårt men stabilt – andningen djup och rytmisk. Fyra minuter lätt mellan blocken. Tävlingsposition om du kör tempocykel. Samma effekt i alla block.",
    adaptations: Z4_ADAPT,
    fueling: Z4_FUEL,
    timing: `${Z4_TIMING} För 70.3 tillsammans med ett längre pass på tävlingsintensitet, inte i stället för det.`,
    progression:
      "Antalet block: två, tre, fyra. Sedan blocklängden till 15 minuter. Effekten ligger kvar tills ett nytt test visar annat.",
    levels: {
      A: q4("4x(12 min 90-95% + 4 min 55%)"),
      B: q4("3x(12 min 90-95% + 4 min 55%)"),
      C: q4("2x(12 min 90-95% + 4 min 55%)"),
    },
  }),
  cycling({
    title: "5 × 10 min aerob utveckling · 70.3",
    kind: "Kvalitet",
    intensity: "Z3 Tempo",
    phases: ["uppbyggnad", "specifik"],
    purpose:
      "Aerob utveckling för 70.3: många block i övre tempo, 85–90 % av FTP, med bara två minuter lätt emellan. Femtio minuter strax under tröskeln bygger muskulär uthållighet och den effekt som går att hålla länge, med en återhämtningskostnad som går att kombinera med löpning och simning samma vecka.",
    description:
      "85–90 % av FTP, RPE 6–7. Två minuter lätt mellan blocken. Jämnt tryck, kadens 85–95 rpm, gärna i tävlingsposition. Avsluta varje block med lite kvar.",
    adaptations: Z3_ADAPT,
    fueling: Z3_FUEL,
    timing: Z3_TIMING,
    progression:
      "Antalet block (4, 5, 6). Vilan och effekten ligger kvar. Nästa steg är att slå ihop blocken två och två.",
    levels: {
      A: q3("6x(10 min 85-90% + 2 min 55%)"),
      B: q3("5x(10 min 85-90% + 2 min 55%)"),
      C: q3("4x(10 min 85-90% + 2 min 55%)"),
    },
  }),
  cycling({
    title: "70.3-brick · cykeldelen",
    kind: "Specifikt",
    intensity: "Z2 Uthållighet",
    phases: ["specifik"],
    purpose:
      'Cykeldelen av 70.3-brick-passet: 3–4 timmar på 65–75 % av FTP, direkt följt av löpdelen ("70.3-brick · löpning efter cykel" i löppassen). Passet prövar om cykelns tempo och energiplan går att följa med en hållbar löpning – en stor cykelkapacitet gör ingen snabbare triathlet om löpningen faller ihop.',
    description:
      "15 minuter lugnt, sedan 65–75 % av FTP hela vägen, RPE 4–5. Tävlingsposition och tävlingsutrustning. Ät och drick exakt som i loppet. Ingen nedvarvning – byt till löpskor och spring direkt.",
    adaptations: `${Z2_ADAPT} Kombinationen med löpning efteråt tränar växlingen och trötthetsresistensen för hela loppet.`,
    fueling:
      "Tävlingens energiplan: 60–90 g kolhydrater per timme och 500–750 ml vätska per timme, mer i värme. Det här är generalrepetitionen.",
    timing:
      "Tävlingsspecifik period inför 70.3, varannan vecka, 4–8 veckor före loppet. Ute på en bana som liknar tävlingens. Lugn dag efter.",
    progression:
      "Cykeltiden (2, 3, 3,5 timmar), sedan löptiden. Effekten ligger kvar i spannet.",
    levels: {
      A: "15 min 55-65%; 210 min 65-75% distans",
      B: "15 min 55-65%; 165 min 65-75% distans",
      C: "15 min 55-65%; 105 min 65-75% distans",
    },
  }),

  // Test – LSCT ---------------------------------------------------------------
  cycling({
    title: "LSCT · submaximalt cykeltest",
    kind: "Test",
    intensity: "Test · pulsstyrt",
    phases: ALL_PHASES,
    purpose:
      "Lamberts och Lamberts submaximala cykeltest: trötthet och form varje vecka utan att trötta. Effekten vid tre bestämda pulsnivåer, pulsåterhämtningen och RPE jämförs med adeptens egen norm. Testet svarar på om veckans planerade belastning går att genomföra – och om formen rör sig åt rätt håll. Viktigast för de mest tränade, där marginalen mellan produktiv belastning och överbelastning är liten.",
    description:
      "Styr på puls, inte på watt: 6 min vid 60 % av maxpuls, 6 min vid 80 %, 3 min vid 90 %, sedan 90 s sittande utan att trampa. Börja varje steg lite hårdare så att pulsen når målet inom första minuten, och justera sedan effekten så att pulsen ligger stilla. Fritt läge på trainern, inte ERG, och ingen autopaus. Skriv upp snitteffekt och snittpuls utan första minuten, tiden till målpulsen och RPE 1–10 i slutet av varje steg, och pulsen efter 60 s vila. Effekten i strukturen är bara ett riktvärde. Lägg in resultatet som ett LSCT-test på adepten.",
    adaptations:
      "Testet tränar ingenting särskilt – det mäter. Effekt mot puls följer den aeroba formen, pulsåterhämtningen och RPE fångar trötthet tidigt, och tiden till 90 % visar om pulsen svarar trögt.",
    fueling:
      "Samma varje gång: mat två timmar före, inget koffein de sista tre timmarna. Vatten under passet.",
    timing:
      "En gång i veckan på samma veckodag och tid, helst efter en vilodag – som uppvärmning före ett lugnt pass eller som ett eget kort pass. Inne på trainer, så att trafik och terräng inte stör pulsen. Tre till fyra veckor ger normen; därefter är varje test en avstämning.",
    progression:
      "Byggs inte på. Protokollet är detsamma varje gång – det är det som gör testen jämförbara. Nivåerna skiljer sig bara i den lugna delen efteråt.",
    levels: {
      A: `${LSCT}; 60 min 55-70% distans; 5 min 50% nedvarvning`,
      B: `${LSCT}; 30 min 55-70% distans; 5 min 50% nedvarvning`,
      C: `${LSCT}; 5 min 50% nedvarvning`,
    },
  }),
];
