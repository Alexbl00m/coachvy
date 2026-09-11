# Lindblom Coaching + Coachvy

Ett projekt, två ytor:

- **Den publika sajten** på `/` — Lindblom Coachings hemsida. Ljus, säljande,
  serverrenderad för SEO.
- **Coachvy** på `/app` — coachplattformen bakom inloggning. Mörk, där du
  hanterar adepter, testresultat och planer.

Samma varumärke, samma kodbas, samma Supabase. Sidhuvudet på den publika sajten
läser sessionen: en besökare ser "Logga in", du ser "Min översikt".

Byggt hittills:

- **Fas 1** – skelettet: inloggning, registrering, sidhuvud, vänstermeny och en
  tom dashboard.
- **Fas 2** – Adepter och Testmodulen, med riktig CRUD mot Supabase.
- **Fas 3** – den publika sajten inflyttad från `lindblom-performance-hub`,
  appen flyttad till `/app`, kontaktformuläret kopplat till databasen.
- **Fas 4** – VLamax-kalkylen portad från `vlamax_calc_app` (Streamlit/Python).
- **Fas 5** – critical power, critical speed och den metabola profilen portade
  från `metabolic-insights-dashboard`.

Planer, Kalender, AI Coach Assistant och Community är fortfarande tomma
platshållare och byggs modul för modul.

## Teknik

| Del        | Val                                     |
| ---------- | --------------------------------------- |
| Ramverk    | Next.js 16 (App Router) + TypeScript    |
| Styling    | Tailwind CSS v4                         |
| Auth & DB  | Supabase (auth + Postgres med RLS)      |
| Diagram    | recharts                                |
| Ikoner     | lucide-react                            |

## Två ytor, ett designsystem

Montserrat och accenten `#E6754E` gäller överallt. Bakgrunden gör det inte: den
publika sajten är ljus, appen är mörk (`#1A1A1E`).

Det löses med semantiska tokens i `src/app/globals.css` — färger heter efter vad
de gör (`canvas`, `surface`, `line`, `text`, `text-muted`), inte efter hur mörka
de är. `:root` håller de mörka värdena, och klassen `theme-light` på den publika
layouten pekar om hela skalan. Delade komponenter (`Button`, `Field`, `Card`,
`Logo`) använder bara semantiska tokens och fungerar därför på båda ytorna.

Den råa `ink-*`-skalan finns kvar för appvyer som aldrig renderas ljust.

Redigera färgerna i `globals.css`, aldrig i enskilda komponenter. Marknadsförings-
texternas siffror och kontaktuppgifter ligger i `src/lib/site.ts`.

## Kom igång

```bash
npm install
cp .env.example .env.local   # fyll i värdena från Supabase
npm run dev                  # http://localhost:3000
```

Utan Supabase-nycklar startar appen ändå: inloggningen är då inaktiv och
skelettet går att bläddra igenom i "demoläge".

### Supabase

1. Skapa ett projekt på [supabase.com](https://supabase.com).
2. Kör `supabase/migrations/20260826000000_init.sql` i SQL Editor
   (eller `supabase db push` om du länkat CLI:t).
3. Kopiera **Project URL** och **anon public key** från Project Settings → API
   till `.env.local`.
4. Under Authentication → URL Configuration, lägg till
   `http://localhost:3000/auth/callback` som redirect-URL.

## Datamodell

```
auth.users
    └── profiles        id, role ('coach' | 'adept'), full_name, email,
        │               accepted_terms_at
        ├── coaches     id, company_name
        │      ▲
        │      │ coach_id
        └── adepts      id, coach_id → coaches.id, profile_id → profiles.id,
               ▲        full_name, email, sport, goal, current_level,
               │        last_active_at
               │ adept_id
          test_results  id, test_type_id → test_types.id, value, unit,
                        tested_on, comment, created_by
          workouts      id, title, sport, basis, reference, critical,
                        reserve, blocks (jsonb), prompt, scheduled_for

    test_types          id, coach_id (null = inbyggd), label, default_unit
```

En trigger på `auth.users` (`handle_new_user`) skapar profilen och rätt rollrad
utifrån metadatan som registreringsformuläret skickar med.

**Adepten har en egen nyckel.** En coach ska kunna lägga upp en adept långt
innan personen skaffat ett konto, så `adepts.id` är fristående och
`adepts.profile_id` är null tills ett konto kopplas på. (I fas 1 var
`adepts.id` samma som profilens id — fas 2-migrationen flyttar över befintliga
rader.)

**Enheten sparas per resultat**, inte bara på testtypen: samma test mäts olika
beroende på sport, och historiken ska inte skrivas om retroaktivt när en typs
standardenhet ändras.

### Row Level Security

Åtkomsten ligger i databasen, inte i applikationskoden — frågorna filtrerar
inte på `coach_id` för hand, utan litar på policyerna:

| | Coach | Adept |
|---|---|---|
| adepter | ser och redigerar sina egna (`coach_id = auth.uid()`) | ser bara sin egen rad (`profile_id = auth.uid()`) |
| testresultat | läser och skriver för sina adepter | läser sina egna, skriver inga |
| testtyper | ser inbyggda + sina egna, skapar egna | ser inbyggda + sin coachs |
| profiler | sin egen + sina adepters | sin egen + sin coachs |

Policyerna går via `security definer`-hjälpfunktioner (`is_coach_of`,
`can_view_adept`, `is_adept_coach`, `current_coach_id`) så att de kan läsa
relationen utan att fastna i RLS på tabellen de själva skyddar.

Kopplingen sätts på `adepts.coach_id`. Inbjudningsflödet som låter en adept
själv koppla sitt konto till en coach byggs i en senare fas — tills dess sätts
den av coachen när adepten läggs upp.

## Struktur

```
src/
  app/
    (public)/          publika sajten – ljus yta, sidhuvud + sidfot
      page.tsx         startsidan (hero, coaching, testning, om mig, kontakt)
      integritetspolicy/
    (auth)/            logga-in, registrera – egen layout
    app/               allt bakom inloggning – mörk yta, vänstermeny
      oversikt/        dashboard efter inloggning
      adepter/         lista, ny adept, [id] med flikarna Översikt/Test/Pass
      pass/            passbyggaren
      testresultat/    slussar adepten till sin egen testflik
      planer/ progression/ kalender/ ai-coach/ community/ installningar/
    auth/callback/     växlar Supabase-koden mot en session
    not-found.tsx      404 i varumärket
  components/
    public/            sidhuvud, sidfot och marknadsföringssektionerna
    adepts/ tests/     appens moduler
    workouts/          passbyggarens vy, graf och stegtabell
    ui/                delade primitiver (button, field, card)
  lib/
    auth/              server actions för in-/utloggning + sessionsläsning
    adepts/            frågor och server actions för adepter
    tests/             frågor och server actions för testmodulen
    workouts/          passmodellen, W′bal, underlaget och genereringen
    leads/             kontaktformulärets server action
    site.ts            företagsuppgifter och menyn på publika sajten
    routes.ts          alla sökvägar på ett ställe
    supabase/          klienter för browser, server och proxy
  proxy.ts             uppdaterar sessionen och skyddar /app
```

`src/proxy.ts` heter så eftersom Next.js 16 döpt om `middleware.ts` till
`proxy.ts`. Skyddet är strukturellt: allt under `/app` kräver session, resten är
öppet. En ny publik sida kan alltså inte råka bli inloggningsskyddad för att
någon glömde lägga till den i en lista.

## Kalkyler

`/app/kalkyler` samlar fyra räknare. Beräkningarna ligger som rena funktioner i
`src/lib/calculators/` och är därför testbara utan gränssnitt.

| Kalkyl | Modell | In |
|---|---|---|
| Critical power | W = CP·t + W' (Monod & Scherrer) | Testlängd och medeleffekt |
| Critical speed | D = CS·t + D' | Tid och distans, löpning eller simning |
| Metabol profil | Mader & Heck (1986) | VO2max, VLamax, effekt vid VO2max |
| VLamax | Regression mot INSCYD-mätningar | Kroppssammansättning och sprinteffekt |

### Vad som ändrades i portningen

Originalen räknade rätt i huvudsak, men fyra saker rättades:

- **Påhittade anpassningsmått.** Två testpunkter definierar en linje exakt.
  Originalet rapporterade ändå "99 %" för critical power och "0,97" för
  critical speed. Nu står det att måttet inte går att beräkna, och att ett
  tredje test krävs för det.
- **VO2max ur critical speed** räknades som `m/s · 3,5 · kroppsvikt`, vilket är
  dimensionellt fel och gav storleksordningen 1000 ml/kg/min. Nu används ACSM:s
  löpekvation (≈ 3,5 ml/kg/min per km/h).
- **VO2max ur critical power** räknades som `0,2 · W/kg + 45`, som i praktiken
  ger ~46 för varje tänkbar atlet. Ersatt med ACSM:s cykelekvation.
- **Tre loppprognoser blev en.** Originalet visade "perfekt", "normal" och "tuff"
  fart, men skillnaden satt bara på D'-termen — några sekunder även på maraton.
  Tre nästan identiska kolumner antyder en precision modellen inte har.

Dessutom: fettoxidationen i den metabola modellen använde absolutbeloppet av
nettolaktatet, vilket fick fettförbränningen att *stiga* igen ovanför tröskeln.
Den klamras nu till noll där.

## VLamax-kalkylen

`/app/vlamax` skattar VLamax från ett sprinttest. Modellen är samma minsta-
kvadratanpassning som Streamlit-appen körde med scikit-learn, portad till
TypeScript i `src/lib/vlamax/model.ts`: fettfri massa, sprintlängd, snitteffekt,
toppeffekt och kön in — VLamax ut.

Referensdatan flyttade från en CSV till tabellen `vlamax_samples`. Inbyggda
rader (`coach_id is null`) är de 13 INSCYD-mätningarna; en coach kan lägga till
egna, och modellen tränas om vid nästa sidladdning.

Två saker som inte fanns i originalet:

- **Felmarginalen visas.** Leave-one-out-korsvalidering ger RMSE ≈ 0,031
  mmol/l/s på de 13 raderna. Att bara gissa medelvärdet ger 0,098, så modellen
  gör verklig nytta — men siffran är en skattning, inte en mätning, och
  gränssnittet säger det.
- **Extrapolation flaggas.** En linjär modell räknar villigt vidare utanför
  datan den sett. Ligger något indatavärde utanför referensdatans spann visas en
  varning och möjligheten att spara resultatet försvinner.

Kön är en variabel som vilar på två kvinnor i datan. Det står i gränssnittet,
och det är den enskilt viktigaste luckan att fylla.

## Passbyggare

`/app/pass` bygger ett enskilt pass ur en mening: *"en timme som tar ordentligt
på W′ men går att genomföra"*. Det som skiljer den från en chatt som skriver
"4×8 min i tröskelfart" är att passet **räknas igenom** innan du ser det.

**Målen är procent, aldrig watt.** Ett steg sparas som en andel av en referens
— FTP för cykel, critical speed för löpning, CSS för simning. Ett pass på 105 %
av tröskeln är samma träning i februari och i juli; ett pass på 285 W är det
inte. När adepten testar om följer passet med. För löpning och simning är
referensen alltid en **fart**, aldrig ett tempo: 110 % av ett tempo är
långsammare, och den inversionen är precis den sortens detalj som tyst blir fel
i ett genererat pass. Tempo räknas fram vid visning.

**Underlaget kommer ur testtillfällena**, inte ur prompten. CP och W′ (eller CS
och D′) hämtas på servern, med den rullande modellen före det senaste hela
testet — slår adepten sitt 3-minutersbästa i ett intervallpass flyttas kurvan
direkt, och nästa pass byggs mot det nya talet. Saknas ett värde byggs passet
ändå, men vad som saknas står i motiveringen i stället för att gissas.

### W′bal

Grafen under profilen är den anaeroba reserven, sekund för sekund, enligt
differentialformen (Skiba, Clarke, Vanhatalo & Jones 2014):

```
över CP:   dW′bal/dt = −(P − CP)
under CP:  dW′bal/dt =  (CP − P) · (W′ − W′bal) / W′
```

Raden över CP är den hyperboliska modellen skriven som en derivata — vid
konstant effekt tar reserven slut efter W′/(P − CP) sekunder, precis som
t = W′/(P − CP) säger. Raden under CP gör återhämtningen exponentiell med
tidskonstanten τ = W′/(CP − P): ju längre under tröskeln vilan ligger, desto
snabbare fylls reserven på. Samma ekvationer gäller löpning och simning med CS
i stället för CP och D′ (meter) i stället för W′ (joule).

Två förbehåll står i koden och ett av dem även i gränssnittet:
differentialformen återhämtar snabbare än integralmodellen från 2012, och
Bartram m.fl. (2018) fann att den går för fort för elitcyklister. Kurvan ska
läsas som "det här passet ligger på gränsen", inte som en utsaga om sekunden.
Och den förutsätter att atleten träffar målen — ett pass är en plan, inte en
fil från en mätare.

**Två paneler, inte två y-axlar.** Profilen och W′bal ligger under varandra med
samma tidsaxel och samma marginaler i stället för i samma ruta. Två axlar i en
ruta låter läsaren jämföra två storheter som inte är jämförbara, och var
kurvorna korsar varandra styrs då av vilken skala någon råkade välja. Under
varandra betyder avståndet mellan kurvorna ingenting, vilket är sanningen.

### Vad som faktiskt går att ändra

Varje längd och varje mål i tabellen är ett fält. Ändrar du ett varv från fem
till fyra räknas grafen och W′bal om direkt, utan att modellen tillfrågas igen.
Prompten kan också användas en gång till på samma pass — då får modellen det
förra passet *och* vad W′bal sade om det, så att "lite hårdare" har något att
utgå från.

Ett sparat pass kan öppnas i byggaren igen. Då räknas det mot adeptens
**nuvarande** tröskel, inte den det en gång sparades mot, och det som sparas
blir en ny rad. Originalet ligger kvar som det skrevs.

### Modellanropet

`src/lib/workouts/generate.ts` anropar Anthropics API med `claude-opus-5`,
strukturerad utdata mot ett JSON-schema, adaptivt tänkande och strömmande svar.
Systemprompten är densamma varje gång och ligger bakom en cachepunkt; atletens
tal ligger efter den. Svaret kontrolleras ändå i `parse.ts` innan det används —
schemat kan garantera att JSON:en stämmer, men inte att 5 000 % av tröskeln är
ett träningspass. Samma kontroll körs om på servern när passet sparas.

Nyckeln läses ur `ANTHROPIC_API_KEY` och är **valfri**: utan den säger
prompt-rutan vad som saknas, och resten av modulen — sparade pass, graf, W′bal,
utskrift — fungerar ändå.

## Grafen

Testkurvan visar **en testtyp i taget**, valbar med knapparna ovanför
diagrammet. Det är ett medvetet val: FTP mäts i watt och VO2max i ml/kg/min, och
att lägga båda i samma diagram skulle kräva två y-axlar — den enskilt mest
vilseledande diagramformen som finns. Serien har en egen färgnivå av
accentfärgen (`#e07049`) som ligger i rätt ljushetsband för den mörka ytan.

## Nästa steg

Planer står näst på tur, sedan Progression och Kalender. Varje kvarvarande
undersida renderar i dag `ModulePlaceholder` och byts ut när modulen är klar.

Kända luckor:

- **Bloggen är inte byggd.** Hub-sajten hade ett riktigt inlägg och två
  markerade platshållare; jag hittar inte på tävlingsrapporter åt dig. När du
  har texterna lägger vi in `/blogg` med MDX-filer i repot.
- **Inkorgen för kontaktförfrågningar saknas.** Meddelanden sparas i `leads`
  men det finns ingen vy i appen som visar dem ännu — läs dem i Supabase så
  länge. Ingen mailavisering heller.
- Formuläret har en honeypot men ingen hastighetsbegränsning.
- Ingen inbjudan av adepter via e-post ännu — `adepts.profile_id` kopplas inte
  automatiskt när en adept registrerar sig med samma adress.
- "Senast aktiv" uppdateras vid inloggning, inte vid varje sidvisning.
- Testresultat kan skapas och tas bort, men inte redigeras.
- **Passbyggarens modellanrop är inte körd mot skarpt API.** Miljön jag byggde
  i har ingen `ANTHROPIC_API_KEY`, så allt utom själva HTTP-anropet är verifierat
  — schemat, tolkningen, W′bal, sparandet, RLS och vyerna. Första riktiga
  körningen med nyckel är alltså också det första provet på prompten.
- Ett pass kan sparas på en adept men inte läggas i kalendern —
  `workouts.scheduled_for` finns i tabellen men används inte ännu.
- Inget passbibliotek över adepter: ett bra pass går att öppna och ändra, men
  bara från den adept det sparades på.
- VLamax-modellens könsvariabel bygger på två kvinnor — opålitlig för kvinnor
  tills fler mätningar lagts till.
