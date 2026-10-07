---
name: Coachvy
description: Lindblom Coachings sajt och Coachvy, arbetsverktyget för uthållighetscoacher. Mörk, sval och exakt – i Linears anda – där data och adepternas läge står i centrum och den orange accenten bara markerar det man ska göra eller det som är valt.

# Värdena speglar src/app/globals.css. Den filen är sanningen för appen; det
# här är den portabla exporten. Ändras en token där, ändra här också.
colors:
  dark:                         # sajten och appen
    canvas: "#08090b"           # sidans botten
    surface: "#111216"          # kort, paneler, tabeller
    surface-2: "#17181d"        # hover, vald rad, fält i fält
    surface-3: "#1e1f25"        # upphöjt inom en panel, menyer
    line: "#1f2027"             # avdelare, kortkant
    line-strong: "#2c2d35"      # sekundärknappens kant, tydligare ram
    line-control: "#666a77"     # inmatningsfältens kant, 3:1 mot ytan
    text: "#eceef2"             # rubriker, värden, brödtext
    text-muted: "#a0a3ad"       # etiketter, beskrivningar
    text-subtle: "#878a95"      # metadata, tidsstämplar, hjälptext
    edge: "rgb(255 255 255 / 0.04)"  # ljus överkant på upphöjda paneler (.lift)
    accent: "#ec7a52"           # primärknapp, fokus, vald flik
    accent-hover: "#f48d68"     # hover på accent, länkhover
    accent-text: "#f39470"      # accentfärgad text på mörk yta
    accent-soft: "#2a1811"      # dropzon under drag
    accent-on: "#170d08"        # text på accent
    good: "#4cb782"             # framåt, godkänt – alltid med pil eller bock
    bad: "#eb6b5f"              # bakåt, fel – alltid med pil eller ord
    warn: "#e2b340"             # varning – alltid med ord
    chart-grid: "#23242b"
    chart-axis-text: "#878a95"
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
  series:                       # diagramserier, validerade mot båda ytorna
    primary: "#e07049"
    secondary: "#3d9ec2"
    tertiary: "#7fa03f"
  phases:                       # säsongens faser, ordinal stege (mörk / ljus)
    grund: ["#89452d", "#e89b81"]
    uppbyggnad: ["#b25535", "#d87756"]
    specifik: ["#d96a43", "#c1542d"]
    topp: ["#fb906b", "#983d1c"]
    vila: ["#55555f", "#9a9aa5"]
  zones:                        # passets intensitetszoner, ordinal blå stege (mörk / ljus)
    z1: ["#035397", "#73b5ff"]
    z2: ["#1d6cb7", "#509bea"]
    z3: ["#3a85d3", "#3580ce"]
    z4: ["#55a0f0", "#1667b2"]
    z5: ["#7ebbfe", "#014f90"]
    z6: ["#b0d5fe", "#023869"]

typography:
  families:
    sans: "Geist"               # sajten och appen
    mono: "Geist Mono"          # siffror i tabeller, tider, id
    brand: "Montserrat"         # bara i Lindblom Coachings logotyp
  styles:                       # px: storlek / radhöjd / vikt / spärrning
    display: "32 / 36 / 600 / -0.022em"   # sidrubrik på översikter
    title: "24 / 30 / 600 / -0.018em"     # sidrubrik (PageHeader)
    heading: "18 / 24 / 600 / -0.012em"   # rubrik i en panel med eget innehåll
    metric: "28 / 32 / 600 / -0.02em"     # nyckeltal, tabulära siffror
    body: "14 / 20 / 400 / 0"             # brödtext, rader, kontroller
    body-sm: "13 / 18 / 400 / 0"          # metadata, kortrubriker, hjälptext
    label: "12 / 16 / 500 / 0"            # fältetiketter, tabellhuvud
    eyebrow: "11 / 14 / 600 / 0.08em"     # versaler, sparsamt: sektionsetikett i sidomenyn
    data: "13 / 18 / 500 / 0"             # Geist Mono, tabulära siffror

rounded:      # Tailwind-klassen inom parentes
  xs: 4px     # brickor, faspillor (rounded)
  sm: 6px     # inbäddade taggar (rounded-sm är 4px; använd rounded-[6px])
  md: 8px     # knappar, fält, notiser (rounded-md)
  lg: 12px    # kort, paneler, tabellram (rounded-lg)
  xl: 16px    # dialoger, kartan, stora skärmbildspaneler (rounded-xl)
  full: 9999px

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

## 1. Hållning: ett instrument, inte en affisch

Coachvy används av en coach som går igenom tjugo adepter före frukost. Sidan
ska läsas på ett ögonblick och sedan lämna plats åt siffrorna. Förebilden är
Linears sätt att bygga verktyg: nästan svart, svalt, tätt utan att vara
trångt, hårfina linjer i stället för skuggor, och en enda färg som betyder
"här".

- **Data först.** Ytor, linjer och text är dämpade så att värden, kurvor och
  status bär. Ingen dekoration som inte säger något.
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
- Accentfärgad text – länkar, "Visa vilka" – är `accent-text`.
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

Passets zoner är en egen ordinal stege i blått (`--zone-1` … `--zone-6`), så
att de inte krockar med fasernas orange eller med accenten. Stegen har lika
ljushetsavstånd i OKLCH (ton 252) och är validerad med `--ordinal` mot båda
ytorna. I mörkt läge är den lägsta zonen mörkast och den högsta ljusast; på
papper är det tvärtom. Block i ett pass skiljs åt av en pixel i ytans färg,
inte av en kantlinje.

## 3. Typografi

Geist sätter både sajten och appen: en tät grotesk som håller vid 12–14 px
och bär stora rubriker. Geist Mono används för siffror som står i kolumner –
tider, tempo, watt i tabeller. Montserrat lever bara i Lindblom Coachings
logotyp.

- Brödtext och rader i `body` (14 px). Det är appens grundstorlek.
- Kortrubriker i `body-sm`, medium, `text-muted`, vanlig skiftläge – inte
  versaler.
- Sidrubrik i `title`; översiktens hälsning i `display`.
- Nyckeltal i `metric` med tabulära siffror.
- `eyebrow` (versaler, spärrat) bara för sektionsetiketterna i sidomenyn och
  tabellhuvuden.
- Negativ spärrning på rubriker, aldrig på brödtext.

## 4. Form och yta

- Hörn som hos Linear: `md` (8 px) på knappar, fält och notiser; `lg`
  (12 px) på kort, paneler och tabellramar; `xl` (16 px) på dialoger och
  kartan; `xs` (4 px) på brickor. Aldrig pillrundade knappar – pillor är för
  filterbrickor och räknare.
- Kort: `surface`, kant `line`, ingen skugga, inre luft 20–24 px.
- Avstånd i 4 px-steg. Mellan kort 24 px, inom ett kort 12–16 px.
- Täthet: en tabellrad är 44–48 px hög; en listrad med två textrader 56 px.

## 5. Komponenter

### Knapp
Tre varianter, två storlekar (32 och 40 px).
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
`surface` med kant `line`. Rubrik i `body-sm` medium `text-muted`, en åtgärd
till höger på samma rad i `accent-text`.

### Nyckeltal
Etikett i `body-sm` `text-muted`, värde i `metric`, en rad sammanhang i
`text-subtle`. Hela rutan är en länk när talet leder någonstans.

### Flikar
Text i `body` `text-muted`; vald flik `text` med en 2 px underlinje i
`accent`. Olästa som en liten pill i `accent` med `accent-on`.

### Brickor och filter
Filterbricka: pill med kant `line`, text `text-muted`; vald lyfts till
`surface-3` med kanten `text-subtle` och text `text`. Prioritetsbricka A/B/C:
fyrkant 20 px, hörn `xs`; A fylld i `text` med `canvas`-text, B och C med
kant.

### Samtyckesläge
Godkänt i `good` med en bock; "Ej inbjuden" i `text`; övriga i
`text-muted`. Datum under i `text-subtle`.

### Notis
Rad över sidans innehåll: `surface-2`, kant `line-strong`, hörn `md`, `body` i
`text-muted`, siffror och namn i `text`, en länk i `accent-text`.

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
- Låt siffror stå i tabulära siffror och i Geist Mono när de bildar kolumn.
- Använd `surface-2` för hover och valt, och `line` för att dela – inte
  skuggor.
- Skriv kort och från användarens sida: "Bjud in till appen", inte
  "Skapa inbjudningslänk".

### Gör inte
- Färga inte rubriker, ytor, ikoner eller valda lägen orange för att det ska
  kännas levande.
- Lägg inte versaler och spärrning på kortrubriker.
- Använd inte färg ensam för status.
- Inga gradienter, ingen glasmorfism, inga färgade kantlinjer till vänster på
  kort.
