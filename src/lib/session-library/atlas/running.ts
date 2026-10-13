/**
 * Löppassen i passbiblioteket: från återhämtningsjogg till backsprinter,
 * i samma zoner som planmallarnas löpplaner.
 *
 * Zonerna står mot maratonfart (zones.ts): RK, LO, MT, S, I och
 * loppfarterna HM, 10K och 5K. Passet räknas om mot adeptens egen fart när
 * det ges till en adept. Formaten är de vedertagna – Daniels, de norska
 * tröskelintervallerna, Helgerud, Rønnestad – och texterna är skrivna ur
 * Alexanders träningsfilosofi: varje pass säger vilken egenskap det
 * utvecklar, vilken begränsning det påverkar och hur det bidrar i loppet,
 * och progressionen ändrar en variabel i taget.
 *
 * Varje pass har tre nivåer, som planmallarna: B är formatet som det heter,
 * A mer och C mindre – samma format, olika mängd.
 *
 * Modulen är ren data. `seed.ts` gör SQL av den.
 */

import type { LibraryInput } from "../library";

type Levels = { A: string; B: string; C: string };

type Atlas = Omit<
  LibraryInput,
  "sport" | "basis" | "structure" | "levels" | "shared"
> & { levels: Levels };

const running = (pass: Atlas): LibraryInput => ({
  ...pass,
  sport: "löpning",
  basis: "MP",
  structure: "",
  levels: (["A", "B", "C"] as const).map((key) => ({
    key,
    structure: pass.levels[key],
  })),
  shared: true,
});

// ---------------------------------------------------------------------------
// Delar som återkommer
// ---------------------------------------------------------------------------

/** Uppvärmning före kvalitet: lugn distans och fyra korta stegringar. */
const WU = "15 min @LO; 4x(20 s @5K uppvärmning + 40 s @RK uppvärmning)";
const CD = "10 min @RK";
const q = (main: string) => `${WU}; ${main}; ${CD}`;

/** Set med jogg emellan: "10x(…); 3 min @RK vila; 10x(…)". */
const sets = (count: number, block: string, rest: string) =>
  Array.from({ length: count }, () => block).join(`; ${rest} vila; `);

const EASY_PHASES = ["grund", "uppbyggnad", "specifik", "topp"];
const BUILD = ["uppbyggnad", "specifik"];

const Z1 = {
  kind: "Återhämtning",
  intensity: "Z1 Återhämtning",
  phases: ["grund", "uppbyggnad", "specifik", "topp", "vila"],
  adaptations:
    "Ökat blodflöde och lätt belastning på senor och skelett, som håller vävnaden van vid löpning utan att bygga trötthet. Underhåller löpsteget.",
  fueling:
    "Vatten vid behov. Ett vanligt mål med kolhydrater och protein efteråt gör mer för återhämtningen än något under passet.",
  timing:
    "Dagen efter kvalitetspass, långpass och tävling, i återhämtningsveckor och under toppning. Alla faser.",
};

const Z2_ADAPT =
  "Fler och effektivare mitokondrier, tätare kapillärnät och bättre förmåga att använda fett vid en given fart – LT1 flyttas uppåt. Senor, skelett och muskler vänjer sig vid belastningen, vilket är grunden för att tåla mer kvalitet utan skador. Löpekonomin förbättras med volymen.";

const Z3 = {
  intensity: "Z3 Maratontempo",
  adaptations:
    "Höjer den fart som går att hålla länge med måttlig kolhydratförbrukning, förbättrar löpekonomin i loppfart och trötthetsresistensen. Vänjer kroppen och huvudet vid tävlingsfarten.",
  fueling:
    "Ett kolhydratrikt mål 2–3 timmar innan. Pass över 75 minuter: 60–90 g kolhydrater per timme, som på loppdagen – det här är rätt pass att öva energiplanen.",
  timing:
    "Uppbyggnad och tävlingsspecifik period inför halvmara och mara, en gång i veckan. I grundperioden sparsamt: där är fördelningen polariserad, och mellanintensitet får inte äta upp volymen.",
};

const Z4 = {
  kind: "Kvalitet",
  intensity: "Z4 Tröskel",
  adaptations:
    "Höjer LT2 – den fart som går att hålla runt en timme – förbättrar laktatomsättningen och ökar andelen av VO₂max som går att utnyttja länge. Det är egenskapen som bär halvmara och mara.",
  fueling:
    "Kom väl fylld: ett kolhydratrikt mål 2–3 timmar innan. Vatten under passet räcker oftast; sportdryck om passet är över 75 minuter.",
  timing:
    "Uppbyggnad och tävlingsspecifik period, 1–2 gånger i veckan i ett tröskelblock på 3–4 veckor. Plan väg eller bana, där farten går att hålla jämn.",
};

const RACE = {
  intensity: "Z4 Loppfart",
  adaptations:
    "Löpekonomi och pacing i loppfart, trötthetsresistens vid tröskelnära belastning och vana vid farten – både i kroppen och i huvudet.",
  fueling: Z4.fueling,
};

const Z5 = {
  kind: "Kvalitet",
  intensity: "Z5 Intervall",
  fueling:
    "Kom väl fylld: ett kolhydratrikt mål 2–4 timmar innan, aldrig fastande. Vatten under passet räcker.",
};
const A5_LONG =
  "Höjer VO₂max: större slagvolym, högre syretransport och bättre syreupptag i musklerna. Förbättrar löpekonomin i hög fart och toleransen för hög belastning.";
const A5_SHORT =
  "Höjer VO₂max: större slagvolym, högre syretransport och bättre syreupptag i musklerna. De korta dragen ger lång tid nära VO₂max med lägre belastning per drag, och tränar återhämtningen mellan hårda insatser.";
const T5_BASE =
  "I grundperioden som veckans utvalda höga intensitet, en gång i veckan. I ett VO₂max-block i uppbyggnaden 1–2 gånger i veckan i 3–4 veckor, med lugna dagar runt. Bana, gräs eller plan väg.";
const T5_BUILD =
  "Ett VO₂max-block i uppbyggnaden, 1–2 gånger i veckan i 3–4 veckor, med lugna dagar runt passen. I tävlingsspecifik period som underhåll, och för 5 och 10 km som loppets egen fart. Bana eller plan väg.";

const HILLS = {
  intensity: "Backar",
  fueling:
    "Vatten räcker under passet. Ett kolhydratrikt mål några timmar innan, så att kvaliteten i varje drag håller.",
};

// ---------------------------------------------------------------------------
// Passen
// ---------------------------------------------------------------------------

export const RUNNING_ATLAS: LibraryInput[] = [
  // Z1 – återhämtning ------------------------------------------------------
  running({
    ...Z1,
    title: "30 min återhämtningsjogg",
    purpose:
      "Håller löpfrekvensen och löpsteget utan att lägga till belastning. Dagen efter ett hårt pass hjälper det kroppen att ta upp träningen – och gör nästa kvalitetspass möjligt med rätt kvalitet. Värdet ligger i vad passet möjliggör, inte i vad det tränar.",
    description:
      "Mycket lugnt, RPE 1–2: du ska kunna prata i telefon. Korta, lätta steg och mjukt underlag om det finns. Gå gärna en stund om pulsen drar iväg. Ett återhämtningspass som blir ett distanspass gör ingen nytta.",
    progression:
      "Byggs inte på. Ett återhämtningspass ska vara lika lätt i vecka fyra som i vecka ett. Det enda som kan ändras är längden.",
    levels: {
      A: "40 min @RK",
      B: "30 min @RK",
      C: "20 min @RK",
    },
  }),
  running({
    ...Z1,
    title: "40 min återhämtning i terräng",
    purpose:
      "Återhämtning med lite mer tid på fötterna, på mjukt underlag som skonar senor och skelett. Distansvolymen har en dubbel funktion: den underhåller aeroba egenskaper och gör det möjligt att samla volym utan att varje dag kostar mycket återhämtning.",
    description:
      "Grus, skogsstig eller gräs. Under lugn distansfart, RPE 1–2. Låt tempot följa terrängen och gå uppför om det behövs – ansträngningen styr, inte farten. Puls och känsla går före tempo: är pulsen ovanligt hög är kroppen inte återhämtad, skriv det i kommentaren.",
    progression:
      "Byggs inte på i intensitet. I en återhämtningsvecka kan längden vara det enda som skiljer veckorna åt.",
    levels: {
      A: "50 min @RK mjukt underlag",
      B: "40 min @RK mjukt underlag",
      C: "30 min @RK mjukt underlag",
    },
  }),

  // Z2 – lugn distans ------------------------------------------------------
  running({
    title: "45 min lugn distans",
    kind: "Distans",
    intensity: "Z2 Lugn distans",
    phases: EASY_PHASES,
    purpose:
      "Grunden i filosofin: en stor och hållbar aerob bas. Lugn distans är huvuddelen av löparens vecka – den höjer farten vid låg belastning (LT1) och bygger robustheten som gör att kvalitetspassen går att genomföra och upprepa.",
    description:
      "Lugn distans, RPE 3: hela meningar går att prata. Det ska kännas lättare än du tror att det borde. Avslappnade axlar, kort markkontakt. Stiger pulsen mot slutet vid samma fart är passet längre än grunden bär just nu – det är information, inte ett misslyckande.",
    adaptations: Z2_ADAPT,
    fueling:
      "Vatten räcker för pass under en timme. Ät ett vanligt mål inom ett par timmar efteråt.",
    timing:
      "Alla faser, 2–5 gånger i veckan. Huvuddelen av volymen i grundperioden. Ute, gärna varierat underlag.",
    progression:
      "Längden eller antalet pass, inte farten. Höj veckovolymen högst cirka 10 % i taget och lägg in en lättare vecka var tredje eller fjärde.",
    levels: {
      A: "60 min @LO",
      B: "45 min @LO",
      C: "30 min @LO",
    },
  }),
  running({
    title: "Lugn distans med stegringar",
    kind: "Distans",
    intensity: "Z2 Lugn distans",
    phases: EASY_PHASES,
    purpose:
      "Lugn distans med korta, snabba stegringar på slutet. Stegringarna håller löpsteget och nervsystemet vana vid fart utan att lägga till trötthet – ett billigt sätt att underhålla löpekonomin, också i grundperioden.",
    description:
      "Lugn distans först, RPE 3. Sedan stegringar på 20 sekunder: öka mjukt till snabbt men avslappnat, ungefär 1 500 m-fart, och släpp innan det blir hårt. Gå eller jogga 40 sekunder emellan – full vila. Fokus på hållning, höga knän och snabba fötter. Plant underlag eller svag nedförsbacke.",
    adaptations:
      "Utöver distansens aeroba anpassningar: koordination, steglängd och stegfrekvens i hög fart, och löpekonomi. Stegringarna är för korta för att bygga laktat.",
    fueling:
      "Vatten räcker för pass under en timme. Ät ett vanligt mål inom ett par timmar efteråt.",
    timing:
      "Alla faser, 1–2 gånger i veckan. Under toppning med färre stegringar för pigga ben.",
    progression:
      "Antalet stegringar (4, 6, 8), sedan längden på distansdelen. Stegringarnas fart ska aldrig bli ett lopp.",
    levels: {
      A: "50 min @LO distans; 8x(20 s 120-125% stegring + 40 s @RK); 5 min @RK",
      B: "40 min @LO distans; 6x(20 s 120-125% stegring + 40 s @RK); 5 min @RK",
      C: "30 min @LO distans; 4x(20 s 120-125% stegring + 40 s @RK); 5 min @RK",
    },
  }),
  running({
    title: "Långpass 90 min",
    kind: "Långpass",
    intensity: "Z2 Lugn distans",
    phases: EASY_PHASES,
    purpose:
      "Långpasset bygger aerob kapacitet, trötthetsresistens och vanan att vara på fötterna länge – för halvmara och mara veckans viktigaste pass. Det är också här energiplanen tränas. Värdet byggs över veckor; kontinuiteten är det som räknas.",
    description:
      "Lugn distans hela vägen, RPE 3–4. Börja lugnare än det känns rimligt. Ät och drick enligt planen från start om passet är över 75 minuter. Långpasset bör vara högst cirka 30 % av veckans volym – annars blir det en belastningstopp i stället för en byggsten.",
    adaptations: `${Z2_ADAPT} Det långa passet tränar dessutom trötthetsresistensen.`,
    fueling:
      "Över 75 minuter: 30–60 g kolhydrater per timme, och inför mara 60–90 g för att träna magen. Vätska efter törst och värme, 400–800 ml per timme.",
    timing:
      "Alla faser, en gång i veckan. Kortare i återhämtningsveckor och under toppning.",
    progression:
      "Längden, 10–15 minuter i taget, med en kortare vecka var tredje eller fjärde. När längden räcker för målet blir nästa steg progressivt långpass eller långpass med maratonfart – en variabel i taget.",
    levels: {
      A: "120 min @LO",
      B: "90 min @LO",
      C: "70 min @LO",
    },
  }),
  running({
    title: "Progressivt distanspass",
    kind: "Distans",
    intensity: "Z2 Lugn distans",
    phases: ["grund", "uppbyggnad", "specifik"],
    purpose:
      "Distans som stegras i tre delar, från lugnt till maratontempo. Passet bygger aerob kapacitet och lär kroppen hålla en högre fart när den redan är lite trött – utan den kostnad ett tröskelpass har.",
    description:
      "Första delen lugnt, RPE 3, andra i övre delen av lugn distans, RPE 4, sista i maratontempo, RPE 5–6. Stegringen ska vara jämn, inte ett ryck. Avsluta med fem minuter lätt jogg.",
    adaptations: `${Z2_ADAPT} Den sista delen tränar trötthetsresistens och pacing.`,
    fueling:
      "Vatten räcker för pass under en timme. Ät ett vanligt mål inom ett par timmar efteråt.",
    timing:
      "Grundperiod och uppbyggnad, en gång i veckan i stället för ett vanligt distanspass. Plan eller lätt kuperad väg.",
    progression:
      "Längden på sista delen först, sedan hela passet. Farten i sista delen ligger kvar i maratontempo.",
    levels: {
      A: "20 min 83-87% distans; 20 min 87-92% distans; 15 min @MT; 5 min @RK",
      B: "15 min 83-87% distans; 15 min 87-92% distans; 10 min @MT; 5 min @RK",
      C: "10 min 83-87% distans; 10 min 87-92% distans; 8 min @MT; 5 min @RK",
    },
  }),

  // Z3 – maratontempo ------------------------------------------------------
  running({
    ...Z3,
    title: "Progressivt långpass",
    kind: "Långpass",
    phases: BUILD,
    purpose:
      "Långpass med sista delen i maratontempo. Det tränar förmågan att hålla tävlingsfart på trötta ben – det som avgör andra halvan av ett långt lopp – till lägre kostnad än ett helt pass i maratontempo.",
    description:
      "Lugn distans, RPE 3, sedan maratontempo, RPE 5–6: stadigt, inte hårt. Ät under passet som på loppdagen. Går maratontempot inte att hålla utan att det blir tröskel, korta delen nästa gång.",
    progression:
      "Delen i maratontempo: 15, 20, 30 minuter över blocket, med en lättare vecka efter. Den lugna delen ligger kvar – en variabel i taget. Stiger pulsen mycket i slutet vid samma fart, stanna på samma längd en vecka till.",
    levels: {
      A: "90 min @LO distans; 30 min @MT; 5 min @RK",
      B: "75 min @LO distans; 20 min @MT; 5 min @RK",
      C: "60 min @LO distans; 15 min @MT; 5 min @RK",
    },
  }),
  running({
    ...Z3,
    title: "Långpass med maratonfart",
    kind: "Långpass",
    phases: ["specifik"],
    purpose:
      "Det viktigaste passet inför mara: en lång sträcka i exakt maratonfart på ben som redan sprungit en stund. Specificitet i filosofins mening – kapaciteten används under loppets faktiska krav, med loppets energiplan.",
    description:
      "Lugn distans först, sedan maratonfart – inte snabbare – hela sträckan, RPE 5–6. Ät och drick exakt som på loppdagen, samma produkter. Kräver farten mer än RPE 6 i första halvan: sänk den. Passet ska sluta med känslan att det fanns mer kvar.",
    timing:
      "Tävlingsspecifik period inför maraton, varannan vecka. Sista gången 3–4 veckor före loppet.",
    progression:
      "Sträckan i maratonfart: 8, 12, 16 km över den specifika perioden, med en lättare vecka emellan. Farten ändras bara efter ett nytt test.",
    levels: {
      A: "8 km @LO distans; 16 km @WK; 2 km @RK",
      B: "8 km @LO distans; 12 km @WK; 2 km @RK",
      C: "6 km @LO distans; 8 km @WK; 2 km @RK",
    },
  }),
  running({
    ...Z3,
    title: "Maratonfart i block",
    kind: "Specifikt",
    phases: ["uppbyggnad", "specifik"],
    purpose:
      "Maratonfart i block med lugn distans emellan. Den flytande vilan gör att mer total tid i loppfart går att samla än i ett sammanhängande drag – och lär kroppen hitta tillbaka till farten när den varit borta en stund.",
    description:
      "Blocken i maratonfart, RPE 5–6. Kilometern emellan i lugn distans, inte stillastående. Varje block ska börja och sluta i samma fart. Öva dryck under passet.",
    progression:
      "Blocklängden: 3, 4, 5 km över blocket. Därefter ett fjärde block i nästa block. Farten ligger kvar; den ändras bara efter ett nytt test eller en ny formuppskattning.",
    levels: {
      A: "15 min @LO; 3x(5 km @WK + 1 km @LO); 10 min @RK",
      B: "15 min @LO; 3x(4 km @WK + 1 km @LO); 10 min @RK",
      C: "15 min @LO; 3x(3 km @WK + 1 km @LO); 10 min @RK",
    },
  }),
  running({
    ...Z3,
    title: "40 min i maratontempo",
    kind: "Kvalitet",
    phases: BUILD,
    purpose:
      "Ett sammanhängande drag i maratontempo, under tröskeln. Det bygger den hållbara farten och löpekonomin i tempot, och är den mellanintensitet som gör nytta för halvmara- och maratonlöparen när specificiteten ökar.",
    description:
      "Maratontempo, RPE 5–6: rappt men kontrollerat, korta meningar går att prata. Jämnt hela vägen. Plan bana gör det lättare att hålla farten.",
    progression:
      "Längden: 30, 40, 50 minuter över tre veckor, sedan en lättare vecka. Farten ligger kvar. Följ pulsen vid samma fart – sjunker den har formen gått framåt.",
    levels: {
      A: "15 min @LO; 50 min @MT; 10 min @RK",
      B: "15 min @LO; 40 min @MT; 10 min @RK",
      C: "15 min @LO; 30 min @MT; 10 min @RK",
    },
  }),

  // Z4 – tröskel -----------------------------------------------------------
  running({
    ...Z4,
    title: "5 × 6 min tröskel",
    phases: BUILD,
    purpose:
      "Tröskelintervaller i norsk stil: drag på sex minuter strax under LT2 med kort vila. Den korta vilan håller belastningen jämn, och dragen är korta nog för att farten aldrig glider över tröskeln. Mycket tid nära tröskeln till en hanterbar kostnad.",
    description:
      "Tröskelfart, RPE 6–7 – kontrollerat, det ska inte bli tävling. En minut lätt jogg mellan. Hellre lite för lugnt än för fort: går sista draget lika lätt som det första låg du rätt. Med laktatmätare: 2,5–3,5 mmol.",
    progression:
      "Antalet drag (4, 5, 6), sedan dragens längd till 8 minuter. Farten ändras efter ett nytt test, inte för att det kändes lätt en dag.",
    levels: {
      A: q("6x(6 min @S + 1 min @RK)"),
      B: q("5x(6 min @S + 1 min @RK)"),
      C: q("4x(6 min @S + 1 min @RK)"),
    },
  }),
  running({
    ...Z4,
    title: "6 × 1 km tröskel",
    phases: BUILD,
    purpose:
      "Kilometrar i tröskelfart med kort vila – samma idé som tidsdragen men på sträcka. Bra på bana eller utmätt slinga, där farten går att följa kilometer för kilometer.",
    description:
      "Tröskelfart, RPE 6–7. En minut jogg mellan. Notera tiden per kilometer: den ska vara jämn, och den sista ska inte vara den snabbaste.",
    progression:
      "Antalet drag: 5, 6, 8 över blocket. Därefter längre drag, 1,5 km, i nästa block. Farten ligger kvar så länge tiderna är jämna och sista draget går lätt.",
    levels: {
      A: q("8x(1 km @S + 1 min @RK)"),
      B: q("6x(1 km @S + 1 min @RK)"),
      C: q("5x(1 km @S + 1 min @RK)"),
    },
  }),
  running({
    ...Z4,
    title: "3 × 3 km långa tröskeldrag",
    phases: BUILD,
    purpose:
      "Långa drag vid tröskeln – toppen av tröskelarbetet inför halvmaran. Längre drag tränar förmågan att hålla farten när det blir obekvämt, och avgör hur mycket av farten som håller loppets andra halva.",
    description:
      "Tröskelfart, RPE 7. Tre minuter jogg mellan. Börja varje drag kontrollerat och håll jämnt; sista kilometern i sista draget visar om farten var rätt.",
    progression:
      "Draglängden: 2, 3, 4 km över blocket. Farten ligger kvar. Tappar du fart i sista draget, behåll längden en vecka till i stället för att gå vidare.",
    levels: {
      A: q("3x(4 km @S + 3 min @RK)"),
      B: q("3x(3 km @S + 3 min @RK)"),
      C: q("3x(2 km @S + 3 min @RK)"),
    },
  }),
  running({
    ...Z4,
    title: "2 × 15 min tröskel",
    phases: BUILD,
    purpose:
      "Två längre block i tröskelfart. Formatet ligger nära ett tempolopp och tränar koncentration och pacing lika mycket som fysiologin.",
    description:
      "Tröskelfart, RPE 7. Tre minuter jogg mellan blocken. Lägg dig i nedre delen av tröskelfarten i början och avsluta i den övre.",
    progression:
      "Blocklängden: 10, 15, 20 minuter över blocket. Farten ligger kvar medan längden ökar; först när 2 × 20 går stabilt är det dags för ett nytt test.",
    levels: {
      A: q("2x(20 min @S + 3 min @RK)"),
      B: q("2x(15 min @S + 3 min @RK)"),
      C: q("2x(10 min @S + 3 min @RK)"),
    },
  }),
  running({
    ...Z4,
    title: "20 min tempolopp",
    phases: BUILD,
    purpose:
      "Daniels tempolopp: ett sammanhängande drag i tröskelfart. Det enklaste tröskelpasset att genomföra och jämföra – samma slinga vecka efter vecka visar utvecklingen.",
    description:
      "Tröskelfart, RPE 7: bekvämt hårt. Jämnt hela vägen. Måste du sakta in mot slutet var farten för hög – sänk den nästa gång.",
    progression:
      "Längden: 15, 20, 25 minuter. Därefter delas passet i två block med kort vila, som 2 × 15 min.",
    levels: {
      A: q("25 min @S"),
      B: q("20 min @S"),
      C: q("15 min @S"),
    },
  }),
  running({
    ...Z4,
    title: "20 × 400 m kort tröskel",
    phases: ["grund", "uppbyggnad", "specifik"],
    purpose:
      "Många korta drag strax över tröskeln med mycket kort vila – ett norskt format. Den korta vilan håller laktatet stabilt medan farten blir något högre än i långa drag. Det tränar löpekonomin i snabbare fart utan att passet blir ett VO₂max-pass.",
    description:
      "Halvmaratonfart, RPE 6–7. 30 sekunder stå eller gå mellan dragen. Tiden per 400 m ska vara jämn genom hela passet. Bana passar bäst.",
    progression:
      "Antalet drag: 15, 20, 25 över blocket. Vilan ligger kvar på 30 sekunder och farten i halvmaratonfart. Ett format att växla med 5 × 6 min mellan blocken.",
    levels: {
      A: q("25x(400 m @HM + 30 s @RK)"),
      B: q("20x(400 m @HM + 30 s @RK)"),
      C: q("15x(400 m @HM + 30 s @RK)"),
    },
  }),

  // Loppfart ----------------------------------------------------------------
  running({
    ...RACE,
    title: "Halvmaratonfart 3 × 4 km",
    kind: "Specifikt",
    phases: ["specifik"],
    purpose:
      "Halvmarans loppfart i långa block. Kapaciteten ska användas under loppets krav – farten, pacingen och energin – och de långa blocken visar om måltiden håller.",
    description:
      "Halvmaratonfart, målfarten och inte snabbare. RPE 6–7. Tre minuter jogg mellan. Öva dryck i vilan. Klarar du sista blocket i samma fart utan att det blir tävling är måltiden realistisk.",
    timing:
      "Tävlingsspecifik period inför halvmara, en gång i veckan, 3–6 veckor före loppet.",
    progression:
      "Blocklängden: 3, 4, 5 km över den specifika perioden. Farten ligger kvar på målfarten. Går 3 × 5 km kontrollerat är måltiden realistisk; gör det inte, justera målet i stället för farten i passet.",
    levels: {
      A: q("3x(5 km @HM + 3 min @RK)"),
      B: q("3x(4 km @HM + 3 min @RK)"),
      C: q("3x(3 km @HM + 3 min @RK)"),
    },
  }),
  running({
    ...RACE,
    title: "Milfart 6 × 1 km",
    kind: "Kvalitet",
    phases: BUILD,
    purpose:
      "Kilometrar i milfart. Farten ligger ovanför tröskeln och ger en fartreserv som gör halvmarafarten lättare att bära senare. För milen är det loppets egen fart.",
    description:
      "Milfart, RPE 7–8. 90 sekunder jogg mellan. Jämnt: sista kilometern lika snabb som den första.",
    timing:
      "Uppbyggnad och tävlingsspecifik period, en gång i veckan. Inför milen som loppets specifika pass, inför halvmara som det andra formatet bredvid tröskeln.",
    progression:
      "Antalet drag: 5, 6, 8 över blocket. Därefter kortare vila, 60 sekunder – inte båda samtidigt. Farten ligger kvar på milfart.",
    levels: {
      A: q("8x(1 km @10K + 90 s @RK)"),
      B: q("6x(1 km @10K + 90 s @RK)"),
      C: q("5x(1 km @10K + 90 s @RK)"),
    },
  }),
  running({
    ...RACE,
    title: "Växlingar halvmara och maratontempo",
    kind: "Specifikt",
    phases: ["specifik"],
    purpose:
      "Loppfart och maratontempo om vartannat utan vila. Farten sänks men stannar aldrig, så laktatet ska hanteras i rörelse – precis som efter en backe eller ett ryck i loppet.",
    description:
      "En kilometer i halvmaratonfart, en i maratontempo, utan paus. RPE 7 mot slutet. Växlingen är det svåra: sänk farten men behåll steget. Plan väg.",
    timing:
      "Tävlingsspecifik period inför halvmara, 2–4 veckor före loppet. Det sista stora specifika passet.",
    progression:
      "Antalet växlingar: 3, 4, 5 över två till tre veckor. Farterna ligger kvar. Sista gången är passet en bra generalrepetition av loppets pacing.",
    levels: {
      A: "15 min @LO; 5x(1 km @HM + 1 km @MT intervall); 10 min @RK",
      B: "15 min @LO; 4x(1 km @HM + 1 km @MT intervall); 10 min @RK",
      C: "15 min @LO; 3x(1 km @HM + 1 km @MT intervall); 10 min @RK",
    },
  }),

  // Z5 – intervall ---------------------------------------------------------
  running({
    ...Z5,
    title: "5 × 1000 m",
    phases: BUILD,
    purpose:
      "Det klassiska intervallpasset: kilometrar i intervallfart, nära VO₂max. Långt nog för att syreupptaget når toppen, kort nog för att farten håller – och lätt att jämföra före och efter ett block.",
    description:
      "Intervallfart, ungefär 5 km-fart till lite snabbare, RPE 8–9. Två och en halv minut jogg mellan. Jämnt genom alla drag – det sista ska gå lika fort som det första.",
    adaptations: A5_LONG,
    timing: T5_BUILD,
    progression:
      "Antalet drag: 4, 5, 6 över blocket. Därefter kortare vila, två minuter. Farten höjs efter ett nytt test, inte för att passet kändes lätt en dag.",
    levels: {
      A: q("6x(1 km @I + 2:30 @RK)"),
      B: q("5x(1 km @I + 2:30 @RK)"),
      C: q("4x(1 km @I + 2:30 @RK)"),
    },
  }),
  running({
    ...Z5,
    title: "4 × 4 min",
    phases: BUILD,
    purpose:
      "Helgeruds 4 × 4: fyra minuter hårt, tre minuter aktiv vila. Ett av de mest studerade VO₂max-formaten – Helgerud studerade det just på löpare. Passar när profilen visar god tröskel men begränsad maximal aerob kapacitet.",
    description:
      "Intervallfart, 90–95 % av maxpuls mot slutet av draget, RPE 9. Tre minuter lätt jogg. Pulsen kommer efter farten – styr på fart i början och låt pulsen bekräfta i slutet. En jämn backe går också bra.",
    adaptations: A5_LONG,
    timing: T5_BUILD,
    progression:
      "Antalet drag: 3, 4, 5 över blocket. Därefter farten, ett par sekunder per kilometer i taget. Samma pass före och efter blocket visar förändringen.",
    levels: {
      A: q("5x(4 min @I + 3 min @RK)"),
      B: q("4x(4 min @I + 3 min @RK)"),
      C: q("3x(4 min @I + 3 min @RK)"),
    },
  }),
  running({
    ...Z5,
    title: "6 × 800 m",
    phases: BUILD,
    purpose:
      "800-metersdrag i intervallfart: kortare än kilometrar, så farten kan ligga i övre delen av intervallzonen. Ett bra format för att utveckla VO₂max och farten på 5 km.",
    description:
      "Intervallfart, RPE 8–9. Två minuter jogg. Jämna tider; tappar du mer än några sekunder i sista draget, behåll antalet nästa gång.",
    adaptations: A5_LONG,
    timing: T5_BUILD,
    progression:
      "Antalet drag: 5, 6, 8 över blocket. Farten ligger kvar. Tappar du mer än några sekunder i sista draget, behåll antalet en vecka till.",
    levels: {
      A: q("8x(800 m @I + 2 min @RK)"),
      B: q("6x(800 m @I + 2 min @RK)"),
      C: q("5x(800 m @I + 2 min @RK)"),
    },
  }),
  running({
    ...Z5,
    title: "12 × 400 m",
    phases: BUILD,
    purpose:
      "Korta drag i 5 km-fart med kort vila. Syreupptaget stiger under serien, och den korta vilan gör att det stannar högt. Bra för fart och löpekonomi i loppfart för 5 och 10 km.",
    description:
      "5 km-fart, RPE 8. En minut jogg mellan. Avslappnat och snabbt – axlarna ned, aktiva armar. Jämna tider genom hela serien.",
    adaptations: A5_SHORT,
    timing: T5_BUILD,
    progression:
      "Antalet drag: 8, 12, 16 över blocket. Därefter kortare vila, 45 sekunder. Farten ligger kvar på 5 km-fart.",
    levels: {
      A: q("16x(400 m @5K + 1 min @RK)"),
      B: q("12x(400 m @5K + 1 min @RK)"),
      C: q("8x(400 m @5K + 1 min @RK)"),
    },
  }),
  running({
    ...Z5,
    title: "30/15",
    phases: ["grund", "uppbyggnad", "specifik"],
    purpose:
      "Rønnestads 30/15 som löppass: 30 sekunder snabbt, 15 sekunder jogg. Syreupptaget hålls nära max genom hela serien med lägre belastning per drag än i långa intervaller.",
    description:
      "30 s i ungefär 3 000 m-fart, 15 s lugn jogg. RPE 8–9 i slutet av serien. Tre minuter jogg mellan serierna. Samma fart i sista draget som i första. Mjukt underlag eller bana.",
    adaptations: A5_SHORT,
    timing: T5_BASE,
    progression:
      "Antalet drag per serie: 10, sedan 13. Därefter en tredje serie. Farten ligger kvar, och samma fart i sista draget som i första är måttet.",
    levels: {
      A: q(sets(3, "13x(30 s 118-125% + 15 s @RK)", "3 min @RK")),
      B: q(sets(3, "10x(30 s 118-125% + 15 s @RK)", "3 min @RK")),
      C: q(sets(2, "10x(30 s 118-125% + 15 s @RK)", "3 min @RK")),
    },
  }),
  running({
    ...Z5,
    title: "15/15",
    phases: ["grund", "uppbyggnad", "specifik"],
    purpose:
      "Mycket korta drag med lika lång vila. Ett bra första VO₂max-format: lång tid med högt syreupptag, låg muskulär kostnad och lätt att dosera – och en bra utvald hög intensitet i en polariserad grundperiod.",
    description:
      "15 s snabbt men avslappnat, ungefär 1 500–3 000 m-fart, 15 s lugn jogg. RPE 8 i slutet av setet. Fyra minuter jogg mellan seten. Gräs eller bana.",
    adaptations: A5_SHORT,
    timing: T5_BASE,
    progression:
      "Antalet drag per set: 12, 16, 20 över blocket, sedan ett tredje set i nästa block. Farten ligger kvar – det är tiden nära VO₂max som byggs på.",
    levels: {
      A: q(sets(3, "16x(15 s 120-128% + 15 s @RK)", "4 min @RK")),
      B: q(sets(2, "16x(15 s 120-128% + 15 s @RK)", "4 min @RK")),
      C: q(sets(2, "12x(15 s 120-128% + 15 s @RK)", "4 min @RK")),
    },
  }),
  running({
    ...Z5,
    title: "Pyramid 1–2–3–2–1 min",
    phases: BUILD,
    purpose:
      "En pyramid där dragen först blir längre och sedan kortare. Variationen gör passet lättare att genomföra mentalt, och de korta dragen på slutet låter farten öka när tröttheten kommer.",
    description:
      "Intervallfart, RPE 8–9. Jogg lika länge som draget. På vägen ned får farten gärna öka något – det sista draget ska vara det snabbaste.",
    adaptations: A5_LONG,
    timing: T5_BUILD,
    progression:
      "Pyramidens topp: 2, 3, 4 minuter över blocket. Farten ligger kvar. När 1–2–3–4–3–2–1 går jämnt är nästa steg att korta joggen till halva dragets längd.",
    levels: (() => {
      const pyramid = (minutes: number[]) =>
        minutes
          .map(
            (m, i) =>
              `${m} min @I intervall` +
              (i < minutes.length - 1 ? `; ${m} min @RK vila` : ""),
          )
          .join("; ");
      return {
        A: q(pyramid([1, 2, 3, 4, 3, 2, 1])),
        B: q(pyramid([1, 2, 3, 2, 1])),
        C: q(pyramid([1, 2, 2, 1])),
      };
    })(),
  }),
  running({
    ...Z5,
    title: "5 × 3 min",
    phases: BUILD,
    purpose:
      "Treminutersdrag i intervallfart – Daniels I-pass. Tre minuter räcker för att syreupptaget ska nå nära max, och den lite kortare vilan än i 4 × 4 håller det uppe.",
    description:
      "Intervallfart, RPE 9 i slutet av draget. Två minuter jogg. Jämnt, och lika i sista draget som i första. Den totala tiden i intervallfart bör vara högst cirka 8 % av veckans volym.",
    adaptations: A5_LONG,
    timing: T5_BUILD,
    progression:
      "Antalet drag: 4, 5, 6 över blocket. Därefter farten, ett par sekunder per kilometer. Den totala tiden i intervallfart bör stanna under cirka 8 % av veckans volym.",
    levels: {
      A: q("6x(3 min @I + 2 min @RK)"),
      B: q("5x(3 min @I + 2 min @RK)"),
      C: q("4x(3 min @I + 2 min @RK)"),
    },
  }),
  running({
    ...Z5,
    title: "Fartlek 10 × 1 min",
    phases: ["grund", "uppbyggnad", "specifik"],
    purpose:
      "Minutfartlek med lugn löpning emellan. Vilan i rörelse håller den aeroba belastningen uppe och gör passet till ett mellanting mellan tröskel och intervall – ett format som fungerar i terräng.",
    description:
      "En minut snabbt, mellan milfart och 5 km-fart, en minut i lugn distans – utan att gå. RPE 7–8. Terräng och kuperat går bra; styr på känsla när underlaget varierar.",
    adaptations: A5_SHORT,
    timing: T5_BASE,
    progression:
      "Antalet minuter: 8, 10, 15 över blocket. Den lugna minuten ligger kvar i distansfart – att gå i vilan gör passet till ett annat pass.",
    levels: {
      A: q("15x(1 min @10K-5K + 1 min @LO)"),
      B: q("10x(1 min @10K-5K + 1 min @LO)"),
      C: q("8x(1 min @10K-5K + 1 min @LO)"),
    },
  }),

  // Backar ------------------------------------------------------------------
  running({
    ...HILLS,
    title: "Backsprinter 8 × 10 s",
    kind: "Kraft",
    phases: ["grund", "uppbyggnad", "specifik", "topp"],
    purpose:
      "Korta, explosiva drag i brant backe med full vila. Bygger kraft och ett elastiskt löpsteg, rekryterar fler muskelfibrer och gör senorna starkare – utan att trötta, eftersom dragen är för korta för att bygga laktat. Löparens motsvarighet till styrketräning.",
    description:
      "Brant backe, 6–10 %. Tio sekunder maximal ansträngning med kraftfullt frånskjut och aktiva armar, sedan gå ned och vila helt, minst två minuter. Kvaliteten i varje drag är allt – blir det sämre, avsluta. Farten är bara riktmärke; i backen styr ansträngningen.",
    adaptations:
      "Maximal kraft och rekrytering av snabba muskelfibrer, stegets elasticitet och senornas styvhet, vilket förbättrar löpekonomin. Stärker vader och lår med låg skaderisk jämfört med snabba drag på plan mark.",
    timing:
      "Grundperiod och uppbyggnad, en gång i veckan – gärna i slutet av ett lugnt distanspass. Under toppning med färre drag för pigga ben.",
    progression:
      "Antalet drag (6, 8, 10). Därefter brantare backe. Vilan kortas aldrig – det är kraft, inte uthållighet.",
    levels: {
      A: "20 min @LO; 10x(10 s 130% maximalt uppför + 2 min @RK gå ned); 10 min @RK",
      B: "20 min @LO; 8x(10 s 130% maximalt uppför + 2 min @RK gå ned); 10 min @RK",
      C: "20 min @LO; 6x(10 s 130% maximalt uppför + 2 min @RK gå ned); 10 min @RK",
    },
  }),
  running({
    ...HILLS,
    title: "Backintervaller 8 × 1 min",
    kind: "Kvalitet",
    phases: ["grund", "uppbyggnad"],
    purpose:
      "Minutdrag uppför med 5 km-ansträngning. Backen ger hög aerob belastning och kraftträning i samma pass, med lägre stötbelastning än samma ansträngning på plan mark – ett skonsamt sätt att föra in hög intensitet i grundperioden.",
    description:
      "Måttlig backe, 4–6 %. En minut med 5 km-ansträngning, RPE 8 – farten blir lägre än på plan mark, och det är rätt. Jogga lugnt ned som vila. Kort och snabbt steg, höften fram.",
    adaptations:
      "Höjer VO₂max och den muskulära uthålligheten i benen, stärker vader och säte och förbättrar löpekonomin. Lägre stötbelastning än intervaller på plan mark.",
    timing:
      "Grundperiod och tidig uppbyggnad, en gång i veckan, som veckans utvalda höga intensitet. Inför kuperade lopp även senare.",
    progression:
      "Antalet drag: 6, 8, 10 över blocket. Därefter längre drag, 90 sekunder. Ansträngningen ligger kvar på 5 km-nivå.",
    levels: {
      A: q("10x(1 min @5K uppför + 2 min @RK jogga ned)"),
      B: q("8x(1 min @5K uppför + 2 min @RK jogga ned)"),
      C: q("6x(1 min @5K uppför + 2 min @RK jogga ned)"),
    },
  }),
  running({
    ...HILLS,
    title: "Långa backar 6 × 2 min",
    kind: "Kvalitet",
    phases: ["uppbyggnad", "specifik"],
    purpose:
      "Längre backdrag med intervallansträngning. Syreupptaget når nära max, och backen gör det till ett styrkepass för benen samtidigt. Bra inför kuperade lopp och terränglopp.",
    description:
      "Jämn backe där två minuter ryms. Intervallansträngning, RPE 8–9. Jogga ned som vila. Sista draget ska nå lika högt upp i backen som det första.",
    adaptations:
      "Höjer VO₂max och den muskulära uthålligheten uppför, och stärker benen för kuperade lopp. Lägre stötbelastning än intervaller på plan mark.",
    timing:
      "Uppbyggnad och tävlingsspecifik period inför kuperade lopp och terränglopp, en gång i veckan i 3–4 veckor.",
    progression:
      "Antalet drag: 5, 6, 8 över blocket. Ansträngningen ligger kvar. När åtta drag når lika högt upp i backen är nästa steg en längre eller brantare backe.",
    levels: {
      A: q("8x(2 min @I uppför + 3 min @RK jogga ned)"),
      B: q("6x(2 min @I uppför + 3 min @RK jogga ned)"),
      C: q("5x(2 min @I uppför + 3 min @RK jogga ned)"),
    },
  }),

  // Fler pass ur Sisu Endurance Lab -----------------------------------------
  running({
    ...Z4,
    title: "5 × 2 km tröskel · cruise",
    phases: BUILD,
    purpose:
      "Cruise-intervaller: långa drag på LT2 med så kort jogg att belastningen aldrig hinner släppa. Fem gånger två kilometer är en mil i kvalitet – en stor dos tid vid tröskeln, uppdelad så att den går att hålla jämn. Ett återkommande kärnpass i ett tröskelblock.",
    description:
      "Uppvärmningen trappar upp genom zonerna, sedan tre stegringar. Dragen i tröskelfart, RPE 7 – kontrollerad andning, du ska kunna säga några ord. 60–75 sekunder jogg mellan. Jämn fart genom alla drag: det sista ska gå som det första, inte fortare. Laktatet ligger runt 2,5–3,5 mmol/l för den som mäter.",
    progression:
      "Antalet drag: 4, 5, 6 över blocket. Farten ligger kvar; höj den först efter ett nytt test. Vilan kortas inte – det är tiden på tröskeln som byggs på.",
    levels: (() => {
      const wu =
        "10 min @RK; 5 min @LO uppvärmning; 5 min @MT uppvärmning; 3x(20 s @5K uppvärmning + 40 s @RK uppvärmning)";
      return {
        A: `${wu}; 6x(2 km @S + 75 s @RK); 15 min @RK`,
        B: `${wu}; 5x(2 km @S + 75 s @RK); 15 min @RK`,
        C: `${wu}; 4x(2 km @S + 75 s @RK); 15 min @RK`,
      };
    })(),
  }),
  running({
    ...RACE,
    title: "10 × 1 km milfart · 200 m jogg",
    kind: "Kvalitet",
    phases: BUILD,
    purpose:
      "Tio kilometer i milfart med 200 meter jogg emellan. Den korta joggen håller syreupptaget och pulsen uppe mellan dragen, så passet samlar lång tid nära en stor andel av VO₂max, och upprepningen tränar löpsteget i loppfart under växande trötthet. Ett avancerat pass för 5 och 10 km.",
    description:
      "Uppvärmningen trappar upp genom zonerna och avslutas med fyra stegringar. Dragen i milfart, puls 88–92 % av max mot slutet av passet, RPE 7–8. 200 meter lugn jogg mellan – jogga, gå inte. Jämnt genom alla tio; behåll steget och avspänningen när det tar emot. Bana passar bäst.",
    adaptations:
      "Aerob kraft: lång tid nära VO₂max, både centralt och perifert. Mitokondriell signalering av den höga aeroba belastningen. Joggen håller syreupptaget uppe och hjälper laktatet att förbrännas mellan dragen. Löpekonomi och trötthetsresistens i loppfart.",
    timing:
      "Uppbyggnad och tävlingsspecifik period inför 5 och 10 km, en gång i veckan, för löpare med en stabil aerob grund. Bana.",
    progression:
      "Antalet drag: 8, 10, 12 över blocket. Farten ligger kvar på milfart, och joggen förblir 200 meter. När tio går jämnt är passet redo för loppet.",
    levels: (() => {
      const wu =
        "10 min @RK; 5 min @LO uppvärmning; 3 min @MT uppvärmning; 4x(20 s @5K uppvärmning + 40 s @RK uppvärmning)";
      return {
        A: `${wu}; 12x(1 km @10K + 200 m @RK); 15 min @RK`,
        B: `${wu}; 10x(1 km @10K + 200 m @RK); 15 min @RK`,
        C: `${wu}; 8x(1 km @10K + 200 m @RK); 15 min @RK`,
      };
    })(),
  }),
  running({
    ...Z5,
    title: "Aerob kraft och fartuthållighet · stege",
    phases: ["specifik"],
    purpose:
      "En stege där dragen blir kortare och farten högre: från milfart på kilometrarna till fart långt över 5 km-fart på 150 meter. Passet utvecklar aerob kraft och fartuthållighet under trötthet och lär löparen växla rytm – att avsluta snabbt när benen redan är trötta, som i slutet av ett lopp.",
    description:
      "Lugn distans, löpskolning och stegringar. Sedan 1000 m i milfart, 800 m mellan mil- och 5 km-fart, 600 m i 5 km-fart, 400 m i intervallfart och 150 m snabbt men avspänt. Kort lugn jogg mellan dragen, lite längre när distansen byts. Starta de långa dragen kontrollerat; tekniken ska bli bättre när dragen blir kortare. Tänk rytmbyte och avslutningsfart, inte panik.",
    adaptations:
      "Aerob kraft, fartuthållighet under trötthet och löpekonomi när farten byts. Rekrytering av snabba muskelfibrer sent i passet, och skärpa från milfart mot betydligt snabbare rytm.",
    fueling:
      "Ett litet kolhydratintag före passet hjälper kvaliteten. Ligger passet i en större träningsdag: 30–60 g kolhydrater per timme och 400–750 ml vätska efter värme och höjd.",
    timing:
      "Sent i den tävlingsspecifika perioden, 2–4 veckor före ett 5- eller 10 km-lopp. För erfarna löpare med en stabil aerob grund. Bana.",
    progression:
      "Byggs på med fler drag längst ned i stegen (400 m och 150 m) – där farten är högst och kostnaden lägst. Farterna ligger kvar.",
    levels: (() => {
      const wu = "20 min @LO; 4x(20 s @5K uppvärmning + 40 s @RK uppvärmning)";
      const ladder = (k: number, e: number, s: number, f: number, h: number) =>
        [
          k === 1 ? "1 km @10K; 90 s @RK vila" : `${k}x(1 km @10K + 90 s @RK)`,
          "1 min @RK vila",
          `${e}x(800 m @10K-5K + 75 s @RK)`,
          "1 min @RK vila",
          `${s}x(600 m @5K + 60 s @RK)`,
          "1 min @RK vila",
          `${f}x(400 m @I + 60 s @RK)`,
          "1 min @RK vila",
          `${h}x(150 m 125-130% snabbt + 60 s @RK)`,
        ].join("; ");
      return {
        A: `${wu}; ${ladder(2, 3, 4, 6, 8)}; 15 min @RK`,
        B: `${wu}; ${ladder(2, 3, 4, 5, 6)}; 12 min @RK`,
        C: `${wu}; ${ladder(1, 2, 3, 4, 4)}; 10 min @RK`,
      };
    })(),
  }),
  running({
    ...Z3,
    title: "Långpass med 70.3-fart · 3 × 20 min",
    kind: "Specifikt",
    phases: BUILD,
    purpose:
      "Långpass med tävlingsfart för 70.3 i slutet: en timme lugnt, sedan tre block i den fart halvmaran ska springas i efter cyklingen. Passet tränar det som avgör löpningen i triathlon – att hålla en kontrollerad fart när timmarna redan har gjort benen trötta.",
    description:
      "60 minuter lugn distans. Sedan 3 × 20 minuter i 70.3-fart med två minuter lugn jogg mellan, och fem minuter lugnt på slutet. Styr blocken på puls, 70–78 % av maxpuls – farten är ett riktmärke. Stiger pulsen över spannet, sänk farten. Öva tävlingens energi och vätska under blocken.",
    timing:
      "Uppbyggnad och tävlingsspecifik period inför 70.3, varannan vecka i stället för det vanliga långpasset. Inte samma vecka som brick-passet.",
    progression:
      "Först blocklängden (15, 20, 25 minuter), sedan den lugna inledningen. Farten ligger kvar. Hela passet 90–120 minuter.",
    levels: {
      A: "60 min @LO distans; 3x(25 min @MT + 2 min @RK); 5 min @RK",
      B: "60 min @LO distans; 3x(20 min @MT + 2 min @RK); 5 min @RK",
      C: "45 min @LO distans; 2x(20 min @MT + 2 min @RK); 5 min @RK",
    },
  }),
  running({
    ...Z3,
    title: "70.3-brick · löpning efter cykel",
    kind: "Specifikt",
    phases: ["specifik"],
    purpose:
      "Löpdelen av brick-passet: direkt efter 3–4 timmar på cykeln. En stark cykel betyder ingenting om löpningen faller ihop – passet visar om cykelns tempo och energiplan går att följa med en hållbar halvmara, och vänjer benen vid växlingen.",
    description:
      "Byt skor och spring direkt efter cykeln. De första tio minuterna i lugn distans tills steget hittat rytmen, sedan 70.3-fart på puls, 70–78 % av maxpuls. Fortsätt äta och dricka som i loppet. Faller farten tydligt mot slutet var cykeln för hård eller energin för liten – det är svaret passet ska ge.",
    fueling:
      "Fortsätt tävlingens energiplan från cykeln: 60–90 g kolhydrater per timme och vätska som i loppet. Det du tål på cykeln ska också gå att ta när du springer.",
    timing:
      "Tävlingsspecifik period inför 70.3, varannan vecka, 4–8 veckor före loppet. Ger en stor trötthet – lägg en lugn dag efter.",
    progression:
      "Löptiden: 30, 45, 60 minuter över blocket. Cykeldelen ligger kvar. Gör inte passet oftare än varannan vecka.",
    levels: {
      A: "10 min @LO distans; 50 min @MT distans",
      B: "10 min @LO distans; 35 min @MT distans",
      C: "10 min @LO distans; 20 min @MT distans",
    },
  }),

  // Aktivering --------------------------------------------------------------
  running({
    title: "Aktivering inför lopp",
    kind: "Aktivering",
    intensity: "Z2 Lugn distans",
    phases: ["topp"],
    purpose:
      "Dagen före ett lopp, eller två dagar före: kort och lätt med lite fart i benen. Målet är att komma till start med låg trötthet och ett vaket nervsystem – kapaciteten är redan byggd, nu handlar det om att kunna använda den.",
    description:
      "Lugn distans, sedan korta drag i loppfart och några stegringar. Inget ska kännas ansträngande. Slutar passet med känslan att du hade velat springa mer, var det rätt.",
    adaptations:
      "Inga nya anpassningar – det är poängen. Passet håller nervsystemet och löpsteget skarpa och tar bort trögheten efter en vilodag.",
    fueling:
      "Ladda med kolhydrater som planerat inför loppet. Under passet vatten.",
    timing:
      "Under toppning, 1–2 dagar före lopp. Fungerar också dagen före ett viktigt kvalitetspass.",
    progression:
      "Byggs inte på. Samma pass före varje lopp gör det till en rutin du känner igen.",
    levels: {
      A: "25 min @LO distans; 4x(1 min @HM-10K + 1 min @RK); 4x(20 s 120-125% stegring + 40 s @RK); 5 min @RK",
      B: "20 min @LO distans; 3x(1 min @HM-10K + 1 min @RK); 4x(20 s 120-125% stegring + 40 s @RK); 5 min @RK",
      C: "15 min @LO distans; 2x(1 min @HM-10K + 1 min @RK); 3x(20 s 120-125% stegring + 40 s @RK); 5 min @RK",
    },
  }),
];
