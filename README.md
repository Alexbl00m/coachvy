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
          adept_profiles  bakgrunden: träningsår, veckovolym, skador,
                        styrkor, svagheter, mål
          adept_checkins  en per dag: session_rpe, duration_minutes,
                        sleep, fatigue, soreness, stress
          coach_messages  tråden mellan coach och adept, med read_at
          ai_conversations  coachens AI-tråd per adept
              └── ai_messages

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
      ai-coach/        bollplank om en adept
      testresultat/    slussar adepten till sin egen testflik
      planer/ progression/ kalender/ ai-coach/ community/ installningar/
    auth/callback/     växlar Supabase-koden mot en session
    not-found.tsx      404 i varumärket
  components/
    public/            sidhuvud, sidfot och marknadsföringssektionerna
    adepts/ tests/     appens moduler
    workouts/          passbyggarens vy, graf och stegtabell
    training/          incheckning, belastningsgraf och skala
    messages/          tråden mellan coach och adept
    ai-coach/          chatten
    ui/                delade primitiver (button, field, card)
  lib/
    auth/              server actions för in-/utloggning + sessionsläsning
    adepts/            frågor och server actions för adepter
    tests/             frågor och server actions för testmodulen
    workouts/          passmodellen, W′bal, underlaget och genereringen
    training/          sRPE-belastning och återhämtning
    messages/          frågor och server actions för tråden
    ai-coach/          trådar och modellanropet
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

`/app/vlamax` skattar VLamax från ett sprinttest, i `src/lib/vlamax/model.ts`:
sprinteffekt per kilo fettfri massa och kön in — VLamax ut. Tre parametrar,
minsta kvadrat.

Portningen från Streamlit-appen hade fem variabler: fettfri massa,
sprintlängd, snitteffekt, toppeffekt och kön, var för sig. När tre
INSCYD-rapporter lades till visade sig formen vara fel. Den tyngsta atleten
fick 0,75 mot uppmätta 0,60 när han lämnades utanför – modellen såg massan och
watten var för sig och missade att hans sprint per kilo muskel var lägre än en
lättare atlets. Korsvaliderat (leave-one-out):

| Modell | 13 atleter | 16 atleter |
|---|---|---|
| Fem variabler | ± 0,031 | ± 0,058 |
| W/kg fettfri massa + kön | ± 0,031 | ± 0,037 |

Toppeffekten tillförde ingenting ens i den gamla formen och är borttagen.

Referensdatan ligger i koden, `src/lib/vlamax/reference.ts`: de 13 ursprungliga
plus 3 nya, alla anonymiserade. Den flyttade ur databasen för att testprotokollet
nedan räknar i webbläsaren – också på den publika sidan, där en anonym besökare
inte får läsa tabellen. Coachens egna mätningar ligger kvar i `vlamax_samples`
och läggs till ovanpå; modellen tränas om vid nästa sidladdning.

- **Felmarginalen visas**, från korsvalideringen. Att bara gissa medelvärdet
  ger 0,098, så modellen gör verklig nytta – men siffran är en skattning.
- **Extrapolation flaggas.** Utanför referensdatans spann i sprint per kilo
  fettfri massa, sprintlängd eller fettfri massa visas en varning, och
  kalkylen låter inte resultatet sparas.

## Metabol profil som testprotokoll

Samma batteri som INSCYD: en 20-sekunders sprint och maxinsatser på 3, 6 och 12
minuter, plus vikt, kroppsfett och kön. Ett testtillfälle ger allt på en gång,
i fyra steg som var och ett går att pröva för sig:

1. **CP och W′** ur de tre längre insatserna – den vanliga hyperbolen.
2. **VLamax** ur sprinten, med modellen ovan.
3. **VO2max** ur 6-minuten med ACSM-ekvationen. INSCYDs syreupptagskurva är
   ACSM-lik (den återger deras %VO2max vid tröskeln inom en procentenhet), och
   deras effekt vid VO2max ligger på 6-minuten.
4. **Tröskel och FatMax** ur Mader-modellen med VO2max och VLamax.

Prövat mot tre INSCYD-rapporter:

| | VO2max | Tröskel | FatMax |
|---|---|---|---|
| Steg 4 med INSCYDs egna VO2max och VLamax | – | 301/294/374 mot 303/303/374 W | 205/207/252 mot 198/205/245 W |
| Hela kedjan, rena test | −1,2 och −0,1 | 12–15 W lägre | 3–9 W lägre |

Mader-modellen stämmer alltså; det som skiljer är indatan. Det tredje testet
hade en för lugnt körd 6-minut, och hela kedjan missade där. Två kontroller
fångar det nu:

- **6-minuten mot hyperbolen.** Kurvan genom 3 och 12 minuter förutsäger
  6-minuten. På rena test ligger den faktiska 12–16 W över; under är ett tecken
  på pacing, och det står i resultatet.
- **Tröskel mot CP.** Två oberoende vägar till ungefär samma ställe. Hamnar
  tröskeln under 88 % av CP stämmer något i kedjan inte.

Sprinten ingår inte i CP, och insatser på 1–2 minuter används inte alls –
för långa för VLamax-modellen, för korta för hyperbolen. Saknas 6-minuten tas
effekten vid VO2max ur hyperbolen i stället. Kroppsfett och kön sparas på
testtillfället (`test_sessions.body_fat_pct`, `sex`) så att testet kan räknas om
med de värden som gällde då, och varningarna räknas om varje gång testet
öppnas. VLamax, VO2max, tröskel och FatMax följer med till passbyggaren och
AI-coachen.

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

## Återkopplingen

Appen gick länge bara åt ett håll: coachen mätte, räknade och föreskrev.
Passbyggaren förutsäger vad ett pass *ska* kosta – men ingenting kom tillbaka
om hur det faktiskt gick. Den dagliga incheckningen är andra halvan.

Två mått som medvetet aldrig slås ihop.

**Belastning** är sessions-RPE gånger passets längd i minuter (Foster 1998).
RPE:t är Borg CR10 för passet som helhet, satt en stund efteråt: 0 är vila, 10
det hårdaste atleten kan föreställa sig. Sextio minuter som kändes som 7 ger
420 godtyckliga enheter – godtyckliga, men jämförbara med sig själva över tid.

**Återhämtning** är Hoopers fyra frågor (Hooper & Mackinnon 1995): sömn,
trötthet, muskelömhet och stress. Originalet räknar 1 som bäst; här är skalan
vänd så att 5 är bäst, eftersom resten av appen läser högre tal som bättre. En
skala som byter riktning mitt i ett formulär blir ifylld fel.

Att snitta ihop de två – frestande när båda är tal mellan 1 och 10 – ger ett
värde utan innebörd. De mäter olika saker och pekar åt olika håll, och de
redovisas var för sig hela vägen.

### Kvoten, och vad den inte säger

De sju senaste dagarna jämförs med de 21 dessförinnan, inte med ett
28-dagarsfönster som innehåller dem själva. Den vanliga kopplade formen har
akutfönstret inbakat i det kroniska, så täljare och nämnare rör sig ihop och
kvoten dras mot 1 av ren konstruktion (Windt & Gabbett 2019).

**Inga gränser ritas ut i den.** Tröskelvärdena som brukar sättas – "0,8 till
1,3 är tryggt" – vilar på svagare underlag än de framställs som, och
Impellizzeri m.fl. (2020) visade att en stor del av sambandet var en artefakt
av hur måttet konstrueras. Kvoten säger om veckan avviker från månaden före,
ingenting mer.

En dag utan incheckning räknas som noll i summorna – annars går de inte att
räkna alls – men täckningsgraden redovisas, så en tunn period syns som vad den
är i stället för som låg belastning.

### Bakgrunden går med i prompten

`adept_profiles` håller det coachen annars skriver om i varje prompt: skador,
normal veckovolym, mål och datum, styrkor och svagheter. Den och
belastningsläget läggs automatiskt till underlaget i passbyggaren och
AI-coachen, och båda visar vad som faktiskt följer med – coachen ska kunna se
att hälsenan och veckans belastning går med, inte behöva lita på det.

Ett testtillfälle bär också vilken **träningsfas** det togs i. Ett tapp mitt i
ett uppbyggnadsblock betyder inte samma sak som ett tapp i tävlingsperioden.

## AI Coach

`/app/ai-coach` är ett bollplank om en adept, inte en allmän träningschatt.
Frågan besvaras mot hennes mätta värden: tröskel och anaerob kapacitet ur
testtillfällena, den rullande modellen, bakgrunden, belastningen och de senaste
testerna och passen.

Underlaget byggs om vid varje fråga i stället för att frysas i tråden. Talen
rör sig – ett nytt test, en veckas incheckningar – och ett svar som räknar på
förra månadens CP är sämre än inget svar.

Tråden är coachens arbetsanteckningar om atleten, inte ett samtal med henne.
Adepten ser den inte, och gränssnittet säger det rakt ut så att ingen skriver
något där i tron att hon gör det. Samtalet *med* adepten ligger i stället under
fliken Meddelanden på hennes sida, där båda kan skriva.

Modellen är `claude-opus-5` med adaptivt tänkande och strömmande svar.
Systemprompten ligger bakom en cachepunkt, atletens tal efter den.
`ANTHROPIC_API_KEY` är valfri – utan den säger rutan vad som saknas.

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
- **AI-coachens modellanrop är inte kört mot skarpt API**, av samma skäl som
  passbyggarens: miljön saknar nyckel. Allt runt omkring – trådarna, RLS,
  underlaget, vyn – är verifierat.
- Incheckningen kopplas inte till ett föreskrivet pass ännu.
  `adept_checkins.workout_id` finns i tabellen men sätts inte, så planerad och
  faktisk belastning går inte att lägga mot varandra automatiskt.
- Ingen avisering när en adept checkar in eller skriver. Coachen ser
  olästmarkeringen först när hon öppnar adeptens sida.
- Belastningsmodellen räknar ingen monotoni eller strain (Foster 1998). De hör
  ihop med sRPE men lades åt sidan: monotoni är odefinierad när belastningen är
  exakt lika varje dag, vilket är just det extremfall måttet finns för att
  flagga.
- VLamax-modellens könsvariabel bygger på två kvinnor — opålitlig för kvinnor
  tills fler mätningar lagts till.
- VLamax-referensdatan saknar tunga atleter: ingen har mer än 74,8 kg fettfri
  massa. En atlet på 90 kg med normalt kroppsfett flaggas därför som
  extrapolation i det metabola protokollet. Egna INSCYD-mätningar på tyngre
  atleter i `vlamax_samples` löser det.
