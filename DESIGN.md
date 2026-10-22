---
name: Coachvy
description: Lindblom Coachings sajt och Coachvy, arbetsverktyget för uthållighetscoacher. Mörk och exakt, med rubriker i serif som säger det viktigaste på sidan, stora tunna nyckeltal och etiketter i mono – där data och adepternas läge står i centrum och den orange accenten markerar det man ska göra.

# Värdena speglar src/app/globals.css. Den filen är sanningen för appen; det
# här är den portabla exporten. Ändras en token där, ändra här också.
colors:
  dark:                         # sajten och appen
    canvas: "#0a0a0c"           # sidans botten
    surface: "#121216"          # kort, paneler, tabeller
    surface-2: "#18181d"        # ledkort, hover, vald rad
    surface-3: "#202026"        # upphöjt inom en panel, menyer
    line: "#1e1e24"             # avdelare, kortkant
    line-strong: "#2e2e36"      # sekundärknappens kant, tydligare ram
    line-control: "#67676f"     # inmatningsfältens kant, 3:1 mot ytan
    text: "#f2f0ec"             # rubriker, värden, brödtext – varm off-white
    text-muted: "#a8a6a3"       # etiketter, beskrivningar
    text-subtle: "#8f8d8a"      # metadata, versaletiketter, hjälptext
    edge: "rgb(255 255 255 / 0.035)"  # ljus överkant på upphöjda paneler (.lift)
    accent: "#ed683b"           # primärknapp, fokus, dagens markering
    accent-hover: "#f47d54"     # hover på accent
    accent-text: "#f2875f"      # accentfärgad text på mörk yta
    accent-soft: "#2b150c"      # dropzon under drag
    accent-on: "#160a05"        # text på accent
    good: "#4cb782"             # framåt, godkänt – alltid med pil eller bock
    bad: "#eb6b5f"              # bakåt, fel – alltid med pil eller ord
    warn: "#e2b340"             # varning – alltid med ord
    chart-grid: "#232329"
    chart-axis-text: "#8f8d8a"
  light:                        # utskrift och mejl
    canvas: "#ffffff"
    surface: "#ffffff"
    surface-2: "#f7f7f8"
    surface-3: "#efeff1"
    line: "#e9e9ec"
    line-strong: "#d6d6db"
    line-control: "#8a8d96"
    text: "#16171b"
    text-muted: "#55585f"
    text-subtle: "#62656d"
    accent: "#c4532c"           # mörkare orange: vit text håller 4.5:1
    accent-hover: "#ad4623"
    accent-text: "#b14a25"
    accent-soft: "#fcefe9"
    accent-on: "#ffffff"
    good: "#1f7a4a"
    bad: "#c23b31"
    warn: "#8a6100"
    chart-grid: "#e9e9ec"
    chart-axis-text: "#62656d"
  series:                       # diagramserier, validerade mot båda ytorna (--pairs all)
    primary: "#8a78ee"          # violett, ton 288°
    secondary: "#2b9db5"        # cyan, ton 215°
    tertiary: "#b0902c"         # guld, ton 90°
  phases:                       # säsongens faser, ordinal stege (mörk / ljus)
    grund: ["#89452d", "#e89b81"]
    uppbyggnad: ["#b25535", "#d87756"]
    specifik: ["#d96a43", "#c1542d"]
    topp: ["#fb906b", "#983d1c"]
    vila: ["#55555f", "#9a9aa5"]
  zones:                        # passets zoner i filosofins tre domäner (mörk / ljus); -text är ljusare för text
    z1: ["#4a5466", "#8a94a6"]  # återhämtning – skiffer (lugnt)
    z2: ["#3a6c9f", "#3b6ea6"]  # distans – blå (lugnt, under LT1)
    z3: ["#ae944a", "#9c8233"]  # tempo – dämpat guld (medel)
    z4: ["#e0bc5a", "#b08a1c"]  # tröskel – guld (medel, upp till LT2)
    z5: ["#d9543f", "#c4442f"]  # VO2max – röd (högt, över LT2)
    z6: ["#b8395e", "#a3325a"]  # anaerob – karmin (högt)

typography:
  families:
    display: "Instrument Serif" # sidrubriken och kortens påståenden
    sans: "Geist"               # text, kontroller och stora nyckeltal
    mono: "Geist Mono"          # versaletiketter, enheter, siffror i kolumner
    brand: "Montserrat"         # bara i Lindblom Coachings logotyp
  styles:                       # px: storlek / radhöjd / vikt / spärrning
    headline-lg: "44–72 / 1.0 / 400 / -0.01em"   # serif, Idag, Översikt, Utveckling, säsongen
    headline: "36–56 / 1.0 / 400 / -0.01em"      # serif, övriga sidrubriker (PageHeader)
    card-headline: "28–36 / 1.05 / 400 / -0.01em" # serif, kortets påstående (CardHeadline)
    metric-xl: "44–64 / 1.0 / 300 / -0.035em"    # Geist light, dagens pass, nyckeltal
    metric: "32–52 / 1.0 / 300 / -0.035em"       # Geist light, nyckeltalsrader
    card-title: "17 / 22 / 600 / -0.01em"        # kortrubrik i sans (CardTitle)
    lead: "16–17 / 1.6 / 400 / 0"                # sidans förklaring under rubriken
    body: "14 / 20 / 400 / 0"                    # brödtext, rader, kontroller
    body-sm: "13 / 18 / 400 / 0"                 # etiketter, förklaringar, hjälptext
    eyebrow: "12 / 16 / 500 / 0.14em"            # Geist Mono i versaler: sammanhang och kortetiketter
    unit: "13 / 16 / 400 / 0"                    # Geist Mono, enheten bredvid ett stort tal

rounded:      # Tailwind-klassen inom parentes
  xs: 4px     # prioritetsbrickor (rounded)
  sm: 6px     # inbäddade taggar (rounded-sm är 4px; använd rounded-[6px])
  md: 8px     # fält, skalknappar, veckans dagar, notiser (rounded-md)
  lg: 16px    # kort, paneler, tabellram (rounded-lg)
  xl: 20px    # dialoger, kartan (rounded-xl)
  full: 9999px # knappar, brickor, flikväljare

spacing:      # 4px-rutnät
  "1": 4px
  "2": 8px
  "3": 12px
  "4": 16px
  "5": 20px
  "6": 24px
  "8": 32px
  "12": 48px

motion:                         # tokens i globals.css: --ease-base, --ease-drawer
  fast: "120ms ease-out"        # hover, färg, tryck (knappar: scale 0.97)
  base: "180ms cubic-bezier(0.2, 0, 0, 1)"   # det som dyker upp (.enter, .enter-up)
  drawer: "240ms in / 200ms out cubic-bezier(0.32, 0.72, 0, 1)"   # mobilmenyn
---

# Designsystem: Coachvy

## 1. Hållning: ett instrument som säger vad det ser

Coachvy används av en coach som går igenom tjugo adepter före frukost, och av
adepter som öppnar appen för att se dagens pass. Sidan ska läsas på ett
ögonblick: rubriken säger det viktigaste – "Tröskeldrag i dag.", "Tröskeln
har flyttat sig 30 watt.", "12 dagar till vinterbasen." – och resten ger
underlaget. Ytan är nästan svart, linjerna hårfina, och en enda färg betyder
"gör det här".

- **Påståendet först.** Sidrubriken är en mening om läget, satt i serif, när
  det finns något att säga. Annars är den sidans namn.
- **Data sedan.** Ytor, linjer och text är dämpade så att värden, kurvor och
  status bär. Nyckeltal är stora och tunna, med enheten liten i mono bredvid.
  Ingen dekoration som inte säger något.
- **En accent, sparsamt.** Orange är primärknappen, fokusringen, den valda
  fliken och det som kräver handling. Aldrig rubriker, aldrig ytor.
- **Plan i stället för skugga.** Djup visas med en ljusare yta och en hårfin
  kant, inte med skuggor.
- **Lugn rörelse.** 120 ms för färg och hover, inget som studsar.

## 2. Färg

### Ytor
Fyra plan, mörkast längst ned: `canvas` → `surface` → `surface-2` →
`surface-3`. Varje steg är en upphöjning. Ett kort är `surface` med kant
`line` på `canvas`; en vald eller hovrad rad i kortet är `surface-2`; en meny
som öppnas ovanpå är `surface-3`. Kort och nyckeltal har klassen `lift`: en
1 px ljus kant i överkanten (`edge`), som ljus uppifrån. Den syns knappt och
ska inte göra det mer.

### Valt läge är en upphöjning
Det valda – en filterbricka, ett alternativ, en insats – lyfts: `surface-3`
med kanten `text-subtle` och texten `text`. Accenten används inte för valt
läge; den är reserverad för det man gör. Enda undantaget är dropzonen medan
en fil dras över den, som får `accent` och `accent-soft`.

### Linjer
- `line` delar rader och ramar kort. Den ska knappt synas.
- `line-strong` ramar sekundärknappar och avgränsar sektioner.
- `line-control` ramar inmatningsfält och håller 3:1 mot ytan, så att ett
  fält går att se som ett fält. Använd den inte till dekoration.

### Text
- `text` på alla fyra ytor (≥ 13:1 i mörkt).
- `text-muted` för etiketter, beskrivningar och kortrubriker (≥ 6:1).
- `text-subtle` för metadata och hjälptext (≥ 4.5:1 på alla ytor).
Ingen text under `text-subtle`.

### Accent
- `accent` fyller primärknappen och ritar fokusringen (2px, 2px avstånd).
- Text på accent är `accent-on`, inte vit: mörk text på den ljusa orangen i
  mörkt läge, vit på den mörkare orangen i ljust.
- **Accenten betyder "gör detta" eller "det här är i dag".** Den används för
  sidans primära knapp, vald flik, ikonen för vald post i menyn,
  fokusringen och dagens markering i kalendrar, veckor och tidslinjer
  ("I DAG", "TOR 22"). En länk som är sidans uppmaning – "Lägg in säsongens
  mål →" i en tom ruta – får `accent-text`. Inget annat.
- Länkar är inte accent. En länk i löptext står i `text` med understrykning i
  `line-strong` som blir `text` vid hover; en åtgärd bredvid en kortrubrik –
  "Kalender", "Alla tester" – står i `text-muted` och blir `text` vid hover.
- Ikoner, brickor och räknare är inte accent: ikoner i `text-muted`, brickor
  och olästa-räknare i `surface-3` med `text`. Varningar har `warn` eller
  `bad`, aldrig accent.
- Diagram ritas i zonernas blå stege eller serierna, aldrig i accent. Serierna
  är violett, cyan och guld – valda för att inte krocka med accentens orange
  eller zonernas blå. Fasernas orange stege är ett eget, validerat undantag.
- `accent-soft` är bakgrunden för en dropzon under drag, inget annat.
- Bara ett accentelement per vy ska kännas fyllt. Två primärknappar bredvid
  varandra är en för många.

### Status
`good`, `bad` och `warn` bär alltid ett ord, en pil eller en ikon bredvid
sig. Färgen ensam säger aldrig något. De är inte serier och inte accent.

### Diagram och faser
Serierna (`series.primary` … `tertiary`) och fasstegen är validerade för
färgblindhet och båda ytorna; de byts inte mot nya nyanser. Text i ett
diagram står i `chart-axis-text`, aldrig i seriefärgen.

Passets zoner (`--zone-1` … `--zone-6`) följer filosofins tre domäner
(avsnitt 19): lugnt under LT1 i skiffer och blått, medel mellan LT1 och LT2 i
guld, högt över LT2 i rött. Ett tröskelpass är guld och ett VO2max-pass rött
redan i miniatyren, och intensitetsfördelningen ritas i samma tre färger.
Inom en domän skiljs zonerna åt i ljushet. `--zone-N-text` är samma ton
ljusare, för text i zonens färg – målen i strukturraden, zonbrickan. Block i
ett pass skiljs åt av en pixel i ytans färg, inte av en kantlinje. Zonfärgerna
används bara för intensitet; styrka, serier och status har egna färger.

### Märket

Coachvys märke är ett C – en öppen ring – med en topp inuti
(`src/components/logo.tsx`, `CoachvyMark`). Toppen är bergstoppen ur Lindblom
Coachings logotyp, nedkokt till en enda form, och ringen är samma cirkel som
rymmer den. Märket är ritat för hand i en ruta på 100 × 100, inte i en
bildgenerator.

- **Geometri.** Ringen är en båge på 270° med radie 38 och ändar som klipps
  radiellt i ±45°, parallellt med toppens armar. Toppen är en chevron med två
  lika långa armar. Streckvikten är densamma i ring och topp.
- **Inte en bock, inte ett G.** Armarna är lika långa, så toppen läses inte som
  en bockmarkering. Toppen rör inte ringen, så C:et läses inte som ett G.
- **Två vikter, samma form.** Den vanliga (streck 12) för stora ytor och den
  kraftigare (streck 14) för 32 px och mindre, där tunna streck och smala
  springor annars försvinner. Sidomenyn, inloggningen och favicon använder den
  kraftigare.
- **Färg.** Märket följer texten (`currentColor`): vitt på mörk yta, svart på
  ljus. Det är aldrig orange. En orange symbol med en uppåtvänd topp läses som
  en annan aktörs märke i samma bransch; orange är för det man ska göra.
- **Appikon och favicon.** En mörk platta (`surface`, `#111216`) med vitt
  märke. Plattan är rundad i favicon och `icon.svg`, och en ren fyrkant i
  `apple-icon.png`, eftersom iOS rundar själv.
- **Ordmärket** är Geist semibold, 17 px, bredvid märket. Sajtens huvud visar
  Lindblom Coachings logotyp i stället; Coachvys märke hör till appen.

Provet för ett märke är 16 px: det ska fortfarande läsas som ett C med en topp.

## 3. Typografi

Tre röster, var och en med sin uppgift:

- **Instrument Serif** säger vad sidan handlar om: sidrubriken
  (`PageHeader`, klassen `headline`), kortens påståenden (`CardHeadline`)
  och "Vila" i veckan, i kursiv. Smal och högkontrast – den bär en mening i
  stor storlek utan att ta över. Aldrig i brödtext, knappar eller tabeller.
- **Geist** bär allt annat: text, kontroller, kortrubriker i sans, och de
  stora nyckeltalen i vikt 300 med tabulära siffror.
- **Geist Mono** sätter etiketterna i versaler (klassen `eyebrow`: 12 px,
  spärrat 0,14 em, `text-subtle`), enheterna bredvid stora tal ("min",
  "W", "/km") och siffror som står i kolumner. Strukturraden för ett pass
  ("2 km @LO; 3×(5 min @HM-10K + 2 min @RK)") är mono med målen i zonfärg.

Montserrat lever bara i Lindblom Coachings logotyp.

| Steg | Storlek | Används till |
| --- | --- | --- |
| Sidrubrik, stor | serif 44–72 px | Idag, Översikt, Utveckling, säsongen (`size="lg"`) |
| Sidrubrik | serif 36–56 px | övriga sidor, adeptens namn i arbetsytan |
| Kortets påstående | serif 28–36 px | `CardHeadline`: "Övergång", "Inget mål inlagt än." |
| Nyckeltal | Geist 300, 32–64 px | `Metric`, nyckeltalsrader, trösklar |
| Korttitel | 17 px, semibold | `CardTitle`: "Veckan", "Säsongen", "Testtillfällen" |
| Ingress | 16–17 px, `text-muted` | förklaringen under sidrubriken |
| Brödtext | 14–15 px | rader, tabeller, kontroller |
| Etikett i versaler | mono 12 px, `text-subtle` | sammanhang över rubriken, kortetiketter, dagar |
| Metadata | 12–13 px, `text-subtle` | datum, källa, antal |

- **Sidhuvudet** har tre lager: sammanhanget i versaler ("ONSDAG 21 OKTOBER ·
  VECKA 43", "UTVECKLING · CYKEL"), rubriken i serif och en ingress. När
  sidan har något att säga är rubriken en mening med punkt; annars sidans
  namn utan punkt.
- **Kort** har antingen en korttitel i sans (listor och diagram) eller en
  etikett i versaler med ett påstående i serif under (läget: fasen, nästa
  tävling, incheckningen).
- Text som förklarar ett tal är 13 px i `text-muted`. Den som behöver
  förklaringen ska kunna läsa den i telefonen.
- Negativ spärrning på rubriker och stora tal, aldrig på brödtext.

## 4. Form och yta

- Hörn: `md` (8 px) på fält, skalknappar och veckans dagar; `lg` (16 px) på
  kort, paneler och tabellramar; `xl` (20 px) på dialoger och kartan; `xs`
  (4 px) på prioritetsbrickor. Knappar, brickor och flikväljare är pillor –
  det enda runda på en sida av raka kort, så att det syns vad man trycker på.
- Kort: `surface`, kant `line`, ingen skugga, inre luft 20–28 px.
- Nyckeltal som hör ihop står i en rad delad av hårfina linjer (`gap-px` på
  `bg-line`), inte som fristående rutor.
- Avstånd i 4 px-steg. Mellan kort 24 px, inom ett kort 12–16 px.
- Täthet: en tabellrad är 44–48 px hög; en listrad med två textrader 56 px.

## 5. Komponenter

### Knapp
Pillor. Tre varianter, tre storlekar (32, 40 och 48 px – den största för
sidans enda handling i ett kort, som "Checka in").
- **Primär**: `accent`, text `accent-on`, hover `accent-hover`. En per vy.
- **Sekundär**: `surface-2`, kant `line-strong`, text `text`; hover lyfter
  till `surface-3` med kanten `text-subtle`.
- **Spöke**: transparent, text `text-muted`; hover `surface-2` och `text`.
Etiketten säger vad som händer: "Spara", "Bjud in", "Ta bort aktiviteten".

### Fält
`surface`, kant `line-control`, hörn `md`, 14 px text. Fokus: kanten blir
`accent`. Etikett ovanför i `label`; "valfritt" till höger i `text-subtle`;
hjälptext under i `text-subtle`.

### Kort
Tre nivåer (`Card level`), så att ögat får en startpunkt:
- **Ledkort** (`lead`): `surface-2` med kant `line-strong`. Det sidan handlar
  om – "Värt en titt", "Dagens pass". Högst ett eller två per sida.
- **Kort** (`default`): `surface` med kant `line`. Stöd och detaljer.
- **Platt grupp** (`flat`): ingen ram och ingen yta – listor och metadata
  inne i ett annat kort eller direkt på sidan.

Rubrik i `card-title`, en åtgärd till höger på samma rad i `text-muted`. En
ruta som inte har något att säga visas inte: "Inga starter före det" är ingen
ruta.

### Nyckeltal
`Metric`: etiketten i versaler, värdet stort i Geist 300, enheten i mono
bredvid (`Unit`), en rad sammanhang under. Förändringen står med pil och
tecken – "↗ +9,8 %", "−0:02" – i `good` eller `bad`. Hela rutan är en länk
när talet leder någonstans.

### Sidhuvud
`PageHeader` med `eyebrow`, `title` och `description`, och `size="lg"` på
sidor som läses som en nyhet. Rubriken räknas fram där det går: dagens pass
("Lugn distans i dag."), tröskelns förändring, dagarna till nästa period
eller A-lopp.

### Dagens pass
Ledkortet på Idag: brickor (gren, typ, huvudzon i zonens färg), tre
nyckeltal (arbete, tid, mål), profilen i stort med tidsaxel, strukturraden
i mono och knapparna "Till klockan (.fit)" och "Öppna passet".

### Skalfråga
Incheckningens 1–5: fem knappar i rad, valt svar inverterat (`text` som yta,
`canvas` som text) så att det syns på avstånd. Ändarna förklaras i en rad
till höger om frågan.

### Flikar
Text i `body` `text-muted`; vald flik `text` med en 2 px underlinje i
`accent`. Olästa som en liten pill i `surface-3` med `text`.

På långa sidor sitter flikraden och undermenyn fast under sidhuvudet, på
sidans egen bakgrund, så att man alltid ser var man är och kan byta vy.

### Sökning (⌘K)
En dialog mitt i övre delen av skärmen: `surface`, kant `line-strong`, hörn
`xl`. Fältet utan egen ram, träffarna grupperade under `eyebrow`-rubriker,
den valda raden i `surface-3`. Knappen i sidhuvudet är sekundär och visar
genvägen. Ingen accent – sökningen är ett verktyg, inte en handling.

### Brickor och filter
`Chip`: pill med kant `line-strong`, text `text-muted`. Med en zon får den
zonens färg i kant, prick och text ("● Z4 Tröskel"). Flikväljaren för gren
är en rad pillor där den valda är inverterad. Prioritetsbricka A/B/C:
fyrkant 20 px, hörn `xs`; A fylld i `text` med `canvas`-text, B och C med
kant.

### Samtyckesläge
Godkänt i `good` med en bock; "Ej inbjuden" i `text`; övriga i
`text-muted`. Datum under i `text-subtle`.

### Förslag att besluta om
När appen föreslår något som ändrar adeptens underlag – nya zoner ur
träningen – är det ett vanligt kort som bara visas när det finns något att
besluta. Först värdet och skillnaden mot det som gäller, sedan underlaget i
en tabell med länk till varje pass, sist två knappar: sekundär för att
genomföra ("Uppdatera zonerna") och spöke för att avstå ("Inte nu"), med en
rad under som säger vad var och en gör. Ingen accent: sidans primära handling
är fortfarande "Bygg pass", och förslaget är coachens beslut, inte appens.

### Notis
Rad över sidans innehåll: `surface-2`, kant `line-strong`, hörn `md`, `body` i
`text-muted`, siffror och namn i `text`, en länk i `text` med understrykning.

## 6. Rörelse

Rörelse används där något flyttar sig eller dyker upp – aldrig för att piffa
upp det man gör många gånger om dagen.

- **Tryck**: knappar krymper till 0.97 medan de hålls nere, 120 ms ease-out.
- **Det som dyker upp efter en handling** – en förhandsvisning, ett formulär,
  ett jämförelsediagram – får klassen `enter`: tonas in och lyfts 4 px på
  180 ms. Nya svar i AI-coachen får `enter-up` (6 px, 200 ms); en tråd man
  öppnar står still. Bara in, aldrig ut.
- **Mobilmenyn** glider in från vänster, samma kant som knappen, på 240 ms
  och ut på 200 ms med `--ease-drawer`; bakgrunden tonas.
- **Ikonbyten** (kopiera → bock) tonas över med skala och oskärpa, 150 ms.
- **Reducerad rörelse**: allt blir toning, ingen förflyttning eller skala.
- **Rör sig aldrig**: navigering, flikar, tooltips i tidslinjen, översiktens
  rutor, diagram, kalenderns månadsbyte.

## 7. Sajten

Sajten är samma instrument som appen, men den talar. Den delar paletten,
typsnittet och komponenterna, och lägger till tre saker:

- **Rubriker i två toner.** Påståendet i `text`, fortsättningen i
  `text-muted` på samma rad: "Varje person är unik. Och tränar därefter."
  Display 44–76 px, vikt 600, spärrning −0.028 till −0.04 em.
- **Sektioner delas med en linje**, inte med bakgrundsfärg. En etikett i
  Geist Mono 12 px `text-subtle` ovanför rubriken säger vad sektionen gäller.
- **Rutnät med hårfina mellanrum.** Kort som hör ihop står i ett rutnät med
  1 px `line` mellan sig (`gap-px` på `bg-line`), inte som fristående kort.

Visa det adepten får, inte siffror om verksamheten. Startsidan visar ett
laktattest som det ser ut i Coachvy, märkt som exempel; inga räknare över
antal adepter eller lediga platser. Foton är riktiga bilder, aldrig
genererade.

## 8. Gör och gör inte

### Gör
- Låt sidrubriken säga läget när det finns ett: en mening med punkt.
- Låt siffror stå i tabulära siffror och i Geist Mono när de bildar kolumn.
- Använd `surface-2` för hover och valt, och `line` för att dela – inte
  skuggor.
- Skriv kort och från användarens sida: "Bjud in till appen", inte
  "Skapa inbjudningslänk".

### Gör inte
- Färga inte rubriker, ytor, ikoner eller valda lägen orange för att det ska
  kännas levande.
- Lägg inte versaler på kortrubriker i sans; versalerna hör till etiketten
  i mono ovanför ett påstående.
- Sätt inte brödtext, knappar eller tabeller i serif.
- Använd inte färg ensam för status.
- Inga gradienter, ingen glasmorfism, inga färgade kantlinjer till vänster på
  kort.
