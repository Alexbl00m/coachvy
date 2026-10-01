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

Designsystemet står i `DESIGN.md`: hållning, alla tokens för båda ytorna,
typografi, form och komponenterna med regler. Appen är byggd i Linears anda –
nästan svart och sval (`#0B0C0F`), Geist, hårfina linjer i stället för skuggor
och den orange accenten bara för det man ska göra eller det som är valt. Den
publika sajten är ljus och behåller Montserrat, Lindblom Coachings typsnitt;
dess orange är mörkare (`#C4532C`) så att vit text på den håller 4.5:1.

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
2. Kör migrationerna i SQL Editor, i ordning. För ett nytt projekt: först
   `supabase/migrations/20260826000000_init.sql`, sedan hela
   `supabase/samlad/efter-init.sql`, som är alla övriga i en fil. Eller
   `supabase db push` om du länkat CLI:t. En databas som redan har de
   tidigare migrationerna behöver bara de nya, i ordning – senast
   `20260930090000_season_and_consent.sql`,
   `20260930150000_activities.sql` och `20261001090000_invitations.sql`.
3. Registrera dig i appen som coach och gör kontot till medlem:
   ```sql
   update public.coaches set plan = 'medlem'
   where id = (select id from public.profiles where email = 'din@adress');
   ```

### Publicera på Vercel

1. Importera repot på [vercel.com](https://vercel.com) (Add New → Project).
2. Lägg in miljövariablerna från Supabase, Project Settings → API:
   `NEXT_PUBLIC_SUPABASE_URL` och `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Valfritt
   `ANTHROPIC_API_KEY` för passbyggaren och AI-coachen.
3. Deploya. I Supabase, Authentication → URL Configuration: sätt **Site URL**
   till Vercel-adressen och lägg till `https://<adressen>/auth/callback` som
   redirect-URL. Utan den leder bekräftelsemejlet fel.

Lokalt i stället: samma två variabler i `.env.local`, och
`http://localhost:3000/auth/callback` som redirect-URL.

## Datamodell

```
auth.users
    └── profiles        id, role ('coach' | 'adept'), full_name, email,
        │               accepted_terms_at, health_consent_at
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
          adept_races   tävlingarna: name, race_date, sport, distance,
                        priority ('A' | 'B' | 'C'), target
          training_blocks  säsongsplanens perioder: phase, starts_on,
                        ends_on, focus
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
| tävlingar | läser och skriver för sina adepter | läser och skriver sina egna |
| perioder | läser och skriver för sina adepter | läser; skriver bara utan coach |

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
    season/            säsongens tidslinje, perioder och tävlingar
    calendar/          månadsrutnätet och dagspanelen
    overview/          översikten för coach och adept
    settings/          namn, lösenord och samtycke
    messages/          tråden mellan coach och adept
    ai-coach/          chatten
    ui/                delade primitiver (button, field, card)
  lib/
    auth/              server actions för in-/utloggning + sessionsläsning
    adepts/            frågor och server actions för adepter
    tests/             frågor och server actions för testmodulen
    workouts/          passmodellen, W′bal, underlaget och genereringen
    training/          sRPE-belastning och återhämtning
    season/            tävlingar och perioder: frågor, åtgärder, beräkningar
    calendar/          det som har ett datum, för kalendern
    overview/          vem som är värd en titt, och frågorna bakom
    settings/          kontots egna åtgärder
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
| VLamax | Regression mot profileringsmätningar | Kroppssammansättning och sprinteffekt |

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
profileringsrapporter lades till visade sig formen vara fel. Den tyngsta atleten
fick 0,75 mot uppmätta 0,60 när han lämnades utanför – modellen såg massan och
watten var för sig och missade att hans sprint per kilo muskel var lägre än en
lättare atlets. Korsvaliderat (leave-one-out):

| Modell | 13 atleter | 16 atleter |
|---|---|---|
| Fem variabler | ± 0,031 | ± 0,058 |
| W/kg fettfri massa + kön | ± 0,031 | ± 0,037 |

Toppeffekten tillförde ingenting ens i den gamla formen och är borttagen.

Referensdatan ligger i koden, `src/lib/vlamax/reference.ts`: de 13 ursprungliga
plus 3 nya, alla anonymiserade. Filen får bara importeras på servern. Coachens
egna mätningar ligger kvar i `vlamax_samples` och läggs till ovanpå; modellen
tränas om vid nästa sidladdning.

- **Felmarginalen visas**, från korsvalideringen. Att bara gissa medelvärdet
  ger 0,098, så modellen gör verklig nytta – men siffran är en skattning.
- **Extrapolation flaggas.** Utanför referensdatans spann i sprint per kilo
  fettfri massa, sprintlängd eller fettfri massa visas en varning, och
  kalkylen låter inte resultatet sparas.

## Metabol profil som testprotokoll

En 20-sekunders sprint och maxinsatser på 3, 6 och 12 minuter, plus vikt,
kroppsfett och kön. Ett testtillfälle ger allt på en gång, i fyra steg som var och ett går att pröva för sig:

1. **CP och W′** ur de tre längre insatserna – den vanliga hyperbolen.
2. **VLamax** ur sprinten, med modellen ovan.
3. **VO2max** ur 6-minuten med ACSM-ekvationen. Profileringens syreupptagskurva
   är ACSM-lik (den återger dess %VO2max vid tröskeln inom en procentenhet), och
   dess effekt vid VO2max ligger på 6-minuten.
4. **Tröskel och FatMax** ur Mader-modellen med VO2max och VLamax.

Prövat mot tre externa metabola profileringar av samma atleter:

| | VO2max | Tröskel | FatMax |
|---|---|---|---|
| Steg 4 med profileringens egna VO2max och VLamax | – | 301/294/374 mot 303/303/374 W | 205/207/252 mot 198/205/245 W |
| Hela kedjan, rena test (atleten utelämnad ur VLamax-datan) | −1,2 och −0,1 | −6 och −17 W | +6 och −6 W |

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

## Metabol profil för löpning

Den metabola kalkylen räknar både cykel och löpning. Modellen är densamma –
Mader-modellen beskriver musklernas omsättning, inte grenen. Det som skiljer är
hur syreupptaget blir belastning: på cykel kostar en watt nästan lika mycket
syre för alla, i löpning avgör **löpekonomin** (ml/kg/km) hur fort en viss
syremängd bär. Farten vid VO2max blir VO2max delat med löpekonomin, och den
ersätter effekten vid VO2max som ände på skalan. Resten är exakt samma räkning.

Portad från `metabolic-quest`, med två rättelser:

- **Farten räknades för högt.** Quest lade laktatet som *bildas* till
  energibehovet vid varje intensitet. Under tröskeln förbränns det laktatet,
  och dess syre finns redan i syreupptaget, så det räknades två gånger. Med
  Quests standardvärden gav det tröskeln 3,70 m/s (4:30/km) i stället för 3,40
  (4:54/km).
- **Fettförbränningen steg igen ovanför tröskeln**, samma fel som i den portade
  cykelmodellen. Den klamras till noll där.

Verifierat mot en oberoende omräkning av Quests loop med rättelserna och
Coachvys konstanter: tröskel, FatMax och CarbMax inom ett beräkningssteg i tre
olika löparprofiler, och Quests eget standardfall ger 3,40 m/s med Quests
konstanter.

Två tillägg som gäller båda grenarna:

- **CarbMax** – den intensitet där kolhydratförbrukningen når 90 g/h, ungefär
  vad magen tar upp under ett lopp med blandade sockerarter. Över den töms
  förråden fortare än de går att fylla på.
- **FatMax ur platåns mitt.** Fettkurvan är platt i toppen, och med avrundade
  värden valdes alltid den lägsta intensiteten på platån – 0,05 m/s för långsamt
  i löpning. Nu tas mitten. På cykel flyttar det FatMax 0–2 W.

Löpekonomin kan fyllas i direkt eller räknas ur ett löpbandstest: syreupptaget
vid en jämn fart under tröskeln. Den kan skilja 20–30 % mellan löpare på samma
fart, så ett uppmätt värde gör mer för precisionen än något annat. VLamax ska
vara ett löpvärde – den skiljer sig mellan löpning och cykling hos samma atlet
(Quittmann-gruppen, Deutsche Sporthochschule Köln), så ett cykelvärde går inte
att flytta över.

Inte med: Quests laktatkurva i steady state (förväntat blodlaktat per fart)
och maratonprognosen ur farten vid 2,5 mmol. Kurvan prövades mot ett
löpbandstest med fjorton steg à fyra minuter och håller inte. Formeln säger att
laktatet går mot oändligheten vid tröskeln, medan det uppmätta steg jämnt från
1,4 till 3,1 mmol och sedan vidare till 6,3. Ett stegtest är ingen steady
state: fyra minuter räcker inte för att laktatet ska hinna jämvikt, så värdena
halkar efter belastningen. Ingen kombination av VLamax, elimineringskonstant
och vilolaktat gav en anpassning värd namnet – felet blev minst vid den lägsta
VLamax som prövades, vilket betyder att kurvan inte bestämmer VLamax alls.

Att skatta VLamax och löpekonomi ur ett stegtest kräver i stället en
tidssimulering av själva protokollet, steg för steg, och flera tester att pröva
den mot – helst med gasanalys, så att löpekonomi och VO2max är mätta och inte
antagna.

Samma test gav ändå ett gott tecken för modellen som den är. Med rapportens
egna VO2max och VLamax hamnade löpmodellens tröskel på 14,6 km/h, samma som
Coachvys Dmax på stegen och 4–5 % under deras LT2 (15,3). Det är samma riktning
och storlek som på cykel.

## Stegtestet med all-out-slut

Laktatstegtestet är huvudmetoden för trösklar. **LT2 är ModDmax** (Bishop m.fl.
1998) när den går att räkna ut, och det är den zonerna byggs på. Medianen av
LT2-metoderna sparas bredvid, liksom varje enskild metod.

Testet ska sluta all-out, antingen med en ramp till utmattning eller med ett
VO2max-test. Slutet sparas på testtillfället (`peak_intensity`, `vo2max`,
`peak_lactate`, `peak_heart_rate`):

- **Vmax/Wmax** skrivs in direkt eller räknas ur rampen: sista fullföljda nivån
  plus den andel av nästa som hanns med (Kuipers m.fl. 1985).
- **Uppmätt VO2max**, när testet slutade med ett VO2max-test.
- LT2 i procent av toppen, maxlaktat och maxpuls.

### VLamax ur tröskeln (medlemskap)

Mader-modellen ger en tröskel ur VO2max och VLamax. Här går räkningen åt andra
hållet: tröskeln är uppmätt (ModDmax), toppen också, och frågan är vilken
VLamax som får modellens tröskel att hamna där. Med VLamax på plats ger samma
modell FatMax och CarbMax. Allt räknas på servern och bara för medlemmar.

Det modellen egentligen bestämmer är **VLamax i förhållande till VO2max**. Ett
lägre VO2max ger en proportionellt lägre VLamax för samma tröskel, så ett
uppmätt VO2max gör siffran säkrare. Utan det skattas VO2max ur toppen med
ACSM:s ekvationer, och resultatet visas med ett spann (VO2max ±10 %, toppen
±2 %) och med vad Dmax som ankare hade gett.

Prövat på ett löpbandstest med fjorton steg à fyra minuter, där rapporten från
ett annat analysprogram angav VLamax 0,26 och VO2max 55,4:

| Ankare | VLamax |
|---|---|
| Dmax (14,6 km/h) | 0,27 |
| ModDmax (15,2 km/h) | 0,18 (spann 0,16–0,22) |

Dmax återger rapportens värde, ModDmax ger lägre. Ett test räcker inte för att
avgöra vilket ankare som stämmer bäst mot en labbmätning av VLamax. Därför
används coachens val av tröskel, ModDmax, och Dmax-värdet visas bredvid tills
fler tester har avgjort frågan.

## Medlemskap

Tre nivåer: **admin**, **bas** och **medlem**. Bas är kontot – coachen har sina
adepter, tester, planer och progression; adepten ser sina tester, pass och sin
progression. Medlemskapet (`coaches.plan` / `adepts.plan`) lägger till
verktygen:

| | Bas | Medlem |
|---|---|---|
| Metabol profil, VLamax, metabol kalkyl | – | ✓ |
| VLamax ur stegtestet | – | ✓ |
| Passbyggaren för **adepter** (egna pass) | – | ✓ |
| Community | – | ✓ |

Coacher bygger pass åt sina adepter oavsett nivå.

- **Publika sidan** visar aldrig protokollet, och ingen del av beräkningen
  följer med dit.
- **Beräkningen körs bara på servern.** `src/lib/tests/metabolic-profile.ts`
  och referensdatan importerar `server-only`, så bygget stoppar om en
  klientkomponent försöker dra in dem. Formuläret förhandsvisar via en server
  action och får bara tillbaka resultatet.
- **Utan medlemskap** syns protokollet låst, kalkylsidorna visar ett
  medlemskort i stället för kalkylen, och server actions för förhandsvisning
  och sparande svarar att funktionen ingår i medlemskapet.
- **Kolumnen kan inte ändras från appen.** En trigger stoppar alla ändringar
  av `plan` som kommer via API:t, också när coachen uppdaterar sin egen rad.
  Den ändras i SQL-editorn eller av en framtida betalningswebhook med
  service-nyckeln:

  ```sql
  update public.coaches set plan = 'medlem'
  where id = (select id from public.profiles where email = 'din@adress');
  ```

Gamla testtillfällen visas och räknas om för alla som får se dem, också om
coachens medlemskap har gått ut – det är deras data.

### Admin

En admin ser alla konton – coacher och adepter – på `/app/admin` och slår på
eller av deras medlemskap där, utan SQL. En admin räknas själv alltid som medlem.

Adminrollen ges bara i SQL-editorn – det finns ingen väg att bli admin från
appen eller API:t:

```sql
insert into public.admins (profile_id)
select id from public.profiles where email = 'din@adress';
```

Sidan läser och skriver via två funktioner i databasen,
`admin_member_overview()` och `admin_set_member_plan()`, som båda kontrollerar
`is_admin()` själva. Admin får alltså antal adepter per coach, men aldrig
läsrätt till adepternas rader. Prövat mot API:t: en vanlig coach får en tom
lista, nekas att ändra medlemskap och kan inte lägga till sig själv som admin;
utloggade nekas helt.

## Community

`/app/community` är ett slutet flöde för medlemmar – coacher och adepter med
medlemskap – och admin. Den som inte är medlem ser vad communityn ger i stället
för flödet; det hen skrivit tidigare ligger kvar. Inlägg, kommentarer och gillningar, i kanalerna
Allmänt, Löpning, Cykel, Simning och Triathlon. Författaren tar bort sina egna
inlägg och kommentarer; admin tar bort vad som helst.

**Delning.** Ett pass eller testresultat läggs i inlägget som en
ögonblicksbild, byggd på servern ur det författaren själv får läsa. Andra ser
exakt det som delades men får ingen läsrätt till passet eller testet. Pass
visas i procent av tröskeln, inte i atletens watt eller tempo, så de går att
använda för vem som helst. Testresultat delar bara adepten själv – coachen ser
sina adepters tester, men att lägga ut dem är adeptens beslut.

**Namn men inte e-post.** Medlemmarna läser inte varandras profiler; flödet
och kommentarerna hämtas via `community_feed` och `community_post_comments`,
som ger namn och roll och inget mer.

### Adepter kopplas till sin coach

1. Coachen lägger till adepten med e-post, och adepten registrerar sig sedan
   med samma adress: kontot tar över coachens adeptrad direkt, med allt coachen
   registrerat. Förutsätter att Supabase kräver e-postbekräftelse (standard),
   annars kan den som registrerar sig med någon annans adress ta över raden.
2. Adepten har redan ett konto: adepten ser en inbjudan på översikten och i
   communityn och tackar ja själv. Det adepten loggat flyttas med – också
   tävlingarna, och säsongsplanen om coachen inte redan gjort en.

Inbjudningarna matchas mot den **bekräftade** adressen i Supabase Auth, inte
mot `profiles.email`. Tidigare gick profilens e-post att ändra från appen, så
ett adeptkonto kunde byta den till någon annans adress och tacka ja till den
personens inbjudan – och ta över adeptraden med allt coachen registrerat.
Migrationen `20260930090000_season_and_consent.sql` stänger det: roll och
e-post på profilen ändras bara av databasen, och e-posten följer kontots när
den byts i Auth.

Kopplingen – vilken coach och vilket konto en adeptrad hör till – ändras bara
av de här två vägarna. Tidigare fick en adept uppdatera hela sin egen rad,
också vilken coach den pekar på, och en coach kunde peka en adeptrad mot vilket
konto som helst. En trigger stoppar nu båda. Samma sak för `adepts.plan`:
adepter kan ha medlemskap som coacher, och det sätts bara av admin.

Rättat samtidigt: sessionen hämtade den inloggade adeptens rad med `id` i
stället för `profile_id`, så inloggade adepter fick aldrig sin egen rad.

## Progression

`/app/progression` visar en adepts tester över tid – coachen väljer adept,
adepten ser sin egen. En gren i taget: flikarna överst visar cykel, löpning
och simning med antalet tester, och under dem vad som finns att se i den
valda grenen – **Översikt** (fyra nyckeltal med förändringen sedan
föregående testdag, och trösklarna över tid), **Laktatkurvor**, **Fartprofil
och lopp** (löpning), **Metabol profil** (cykel), **Syreupptag** och **Alla
värden** i grupper.

**Metabol profil** samlar varje cykeltest som ger VO2max och VLamax – den
metabola profilen och stegtestet med medlemsdelen – omräknade ur rådatan med
dagens modell. Välj ett test för dess laktatbalans, bränsle och karta; kartan
visar hela spåret. En tabell visar VO2max, VLamax, tröskel, FatMax, fett vid
FatMax och CarbMax per test, och *Samma effekt, två tester* läser båda
kurvorna vid det förra testets FatMax: där syns en bättre fettförbränning även
när FatMax inte flyttat sig. Valet
ligger i adressen (`?gren=lopning&vy=fart`), så varje vy går att länka.

Varje tidslinje har från tre tester en svag streckad **trendlinje** (minsta
kvadrat över tid) och en kort kommentar: förändring per år, om det har planat
ut (de tre senaste inom 2 %), om senaste testet ligger klart över eller under
linjen, och om spridningen gör trenden osäker. Översikten får en **kort
analys** ur tidslinjerna: tröskelns och VO2max förändring, vad kombinationen
säger – tröskeln upp utan VO2max betyder utnyttjandegrad, VO2max upp utan
tröskeln betyder att tröskelarbete har mest att ge – och VLamax och FatMax.
Samspelet tolkas bara när serierna täcker ungefär samma period. Allt är
regelbaserat, så samma tester ger alltid samma text.

- **Laktatkurvor mot varandra.** Välj alla tester eller några. Det senaste
  valda är utgångspunkten och det näst senaste vad det jämförs med: LT1, LT2
  (ModDmax), belastning vid 2 och 4 mmol, och laktatet vid den tidigare
  tröskeln – samma belastning, lägre laktat är framsteg. Samma jämförelse finns
  bakom en knapp på adeptens flik Testtillfällen.
- **Varje värde som egen tidslinje** – LT1, LT2, 4 mmol, CP, W′, CS, FTP,
  Wmax, VO2max, VLamax, FatMax, VDOT – med förändringen sedan första testet. Egen
  skala per värde; VLamax visas utan bra/dåligt-färg eftersom rätt riktning
  beror på målet.
- **Samma metoder för alla tester.** Trösklarna räknas om ur rådatan vid
  visning, så ett test från 2023 jämförs med samma metoder som ett från i dag.
  Knappen *Räkna om med dagens metoder* skriver om de sparade värdena också.
- **Äldre tester med få steg.** Ett stegtest med tre steg räcker inte för
  kurvanpassningen, men sparas ändå och får 2 och 4 mmol lästa linjärt mellan
  stegen. Testa gärna gamla rapporter från andra testare: skriv in watt,
  laktat och puls med datumet testet gjordes.

### Insatser ur cykeldatorn och löparklockan

Testerna kan hämta insatserna ur passets **.fit-fil** – Garmin, Wahoo, Coros,
Polar, Suunto, Hammerhead, Zwift. Välj en fil per testdag. För varje längd
letas den insats upp som atleten faktiskt körde eller sprang, med snitt- och
maxpuls och dagen den gjordes.

| Protokoll | Hittar |
|---|---|
| CP-test, metabol profil | sprint 20 s, 3, 5–6, 12 och 20 min – effekt |
| 5 min, 6 min, FTP 20 | insatsen – effekt |
| Critical speed, tidtagna distanser | hela insatser 2–5, 5–10 och 10–20 min – tid och sträcka (1 200/2 400/3 600 m eller 3/6/12 min) |
| Critical speed, 3 och 5 min | 3- och 5-minuterslöpningen – sträcka |
| Critical speed, 3 min all-out | insatsen, delad var 30:e sekund med sträckan hittills |

I löpningen används klockans egen sträcka (farten summerad när sträcka
saknas). Insatsen ska dessutom rymmas i spannet som helhet: en löpning på 3:40
blir ingen "3-minutersinsats".

- **Riktiga insatser, inte bara bästa fönstret.** De bästa 6 minuterna i ett
  pass med en 12-minutersinsats ligger mitt i 12-minuten. En insats räknas
  bara när effekten före och efter är klart lägre, kanterna ligger på
  insatsens nivå, ingen minut i den faller under 75 % av snittet, och den är
  minst 90 % av det bästa passet har på samma längd. Hittas ingen visas bästa
  fönstret med en varning, ovalt.
- **Filen lämnar aldrig webbläsaren.** Den tolkas i webbläsaren
  (fit-file-parser, MIT) och bara tid, effekt och puls används – GPS-spåret
  läses aldrig. Garmins egen FIT SDK används inte: dess licens förbjuder att
  koden görs tillgänglig för tredje part, vilket en webbapp gör.
- **Ett datum per insats.** Sprint och 6 min på torsdagen, 3 och 12 min på
  tisdagen. Den rullande CP-modellen räknar med insatsens egen dag.

Prövat mot en Garmin-fil med 3- och 12-minutersinsats: 574 W (puls 174/184)
och 404 W (177/185), samma som varven i Garmin Connect. 5–6 min, sprint och
20 min hittades korrekt inte som egna insatser. Löpningen är prövad på
syntetiska klockfiler (1 200/2 400/3 600 m på bana, 3 + 5 min, 3 min
all-out): rätt insatser, sträckor på metern, och rätt dag när filerna blandas.

**Adepter som är medlemmar** registrerar egna tester, också ur filer. De tar
bort de tester de själva registrerat, inte coachens.

### VO2max och utnyttjandegrad

VO2max skattas med ekvationen som hör till insatsen:

| Insats | Ekvation |
|---|---|
| 5 min all-out | Sitko m.fl. 2022: 16,6 + 8,87 · W/kg |
| 6 min all-out (eller hyperbolens 6-minut) | ACSM: 10,8 · W/kg + 7 |
| Rampens topp (Wmax) | Hawley & Noakes 1992: (0,01141 · W + 0,435) l/min |

Uppmätt VO2max går alltid före. Tidigare skattades VO2max ur CP, som ligger
långt under effekten vid VO2max – 5 min på 465 W vid 81 kg gav 57 i stället för
67. Prövat mot ett uppmätt 77,0: Hawley & Noakes ur rampens topp gav 73,4,
ACSM 71,3.

**Utnyttjandegraden** samlar alla trösklar adepten har, oavsett vilket test
de kom ur: FatMax, LT1, CarbMax, LT2, anaerob tröskel (Mader), tröskelfart,
FTP, 4 mmol, CP och CS. Varje markör tas ur det senaste testet som har den och
räknas mot det VO2max som ligger närmast det testet i tid. Överst står alla på
en gemensam skala; chips slår av markörer som inte är relevanta, och valet
sparas i webbläsaren. FatMax jämförs med 50–70 %, LT1 med 65–75 %, och LT2,
anaerob tröskel, FTP, 4 mmol och CP med 75–90 %.

Den är syreupptaget vid tröskeln (ACSM) i procent av VO2max,
räknat i absoluta tal så att olika vikt vid olika tester inte stör. Ett
laktattest utan eget VO2max lånar det närmaste i tid från ett annat test i
samma gren. Progressionen visar LT1, LT2 och CP i procent av VO2max mot
referensspannen LT1 65–75 % och LT2 75–90 %, plus LT1 i procent av LT2 – och
varje utnyttjandegrad som en egen tidslinje.

## Tempo och fart i resultat och zoner

Testerna räknar i fart, men visar det atleten känner igen:

- **Löpning** – tempo per km, med farten i km/h bredvid.
- **Simning** – tid per 100 m. CS heter CSS, och zonerna står i tempo.
- **Cykel** – fart på plan väg ur watten, för trösklarna och varje zon.
  Position (CdA 0,23–0,40), däck (Crr 0,0025–0,0070), atletens vikt och
  cykelns vikt går att välja; position och däck minns webbläsaren.

Cykelfarten är portad från Bike-Power-Speed-Calculator-App: effekten vid
hjulet (97,5 %) mot rull- och luftmotstånd, löst med bisektion. Originalet
räknade lufttätheten som 1,225 · 273/(273 + T), men 1,225 kg/m³ gäller vid
15 °C – vid 20 °C blev luften 5 % för tunn. Här är det 1,225 ·
288,15/(273,15 + T). 250 W i nedre styret vid 75 kg blir 37,5 km/h.

## Diagram, pulszoner och intervallzoner på testsidan

Ur `metabolic-navigator` kom idéerna, inte räkningen: dess motor är ingen
Mader-modell utan kurvanpassning på tre atleter (tröskeln som 92 − 24 ·
VLamax procent av VO2max-effekten, W′ som 28 000 · VLamax joule). Diagrammen
här ritas med Coachvys Mader-modell ur testets egna VO2max och VLamax.

- **Metabol profil** – för den metabola profilen och stegtestet med VLamax:
  *Laktatbalans* (produktion mot förbränning, tröskeln där de möts),
  *Bränsle* (fett och kolhydrat i g/h, med FatMax och CarbMax markerade) och
  *Metabol karta* – VO2max mot VLamax med navigatorns cykeltyper som
  områden och adeptens tidigare tester som ett spår. Kurvan räknas på
  servern; webbläsaren får bara punkterna.
- **Bränslet i ett diagram med två axlar** – kolhydrat till vänster, fett
  till höger, eftersom fettet ligger på tiotals gram i timmen och
  kolhydraten på hundratals. Med två skalor säger linjernas korsning
  ingenting, så den verkliga *crossover*-punkten – där fett och kolhydrat
  ger lika mycket energi (9,5 respektive 4,1 kcal/g) – räknas fram och
  markeras. Banden runt kurvorna är samma modell med VLamax ±0,04, och
  tooltipen visar g/h och kcal/h.
- **Syreupptaget i laktatdiagrammet** – VO2 i ml/min på vänster axel,
  laktatproduktion och -förbränning till höger.
- **Bränsle per zon** – fett och kolhydrat vid zonens mitt, i zontabellen.
- **Samma sak i kalkylen** – Kalkyler → Metabol profil har samma sektion,
  karta (cykel) och zontabell med modellens puls, fett och kolhydrat per zon.
- **Kroppsfett ur BMI** – i VLamax-kalkylen och testformuläret, hopfällt:
  Deurenberg m.fl. (1991), 1,20 · BMI + 0,23 · ålder − 10,8 · kön − 5,4, med
  fettfri massa och ett spann på ±4 procentenheter. BMI skiljer inte muskler
  från fett, så för tränade atleter blir det för högt. Känsligheten är låg:
  94 kg och 780 W ger VLamax 0,45 vid 18 % och 0,48 vid 22 % – mindre än
  modellens eget fel, ±0,04.
- **Puls per zon** – ur stegtestets egen pulskurva vid zonernas gränser,
  förlängd linjärt högst 30 % utanför stegen och aldrig över maxpulsen.
  Utan stegtest: Friels zoner ur tröskelpulsen (5 km, 20 minuter, lopp och
  nu också FTP-testet med puls). Procent av maxpuls används inte.
- **Intervallzoner** – mål för åtta vanliga serier, från 10 × 30 s till
  3 × 12 min, ur CP och W′ (CS och D′ i löpning och simning). Målet är den
  högsta nivå där W′bal aldrig går under 10 % genom serien, med Skibas
  återhämtning från 2012 på cykeln – differentialformen återhämtar för fort
  (Bartram 2018). CP 280 W och W′ 18 kJ ger 10 × 30 s på 126 %, 5 × 3 min
  på 110 % och 3 × 12 min på 104 % av CP.
- **Effekt och tid** – CP-modellen över 2–20 minuter med testets insatser
  som punkter; en punkt under linjen är en insats som inte var maximal.

## Simning

CSS-testet (två eller fler distanser, t.ex. 200, 400 och 800 m) ger CSS i
tempo per 100 m, D′, simprofilen och simzonerna. Portat från
`swim-speed-calculator-pro`:

- **Zonerna** som andel av CSS – zon 4, tröskel/CSS, på 97–102 % – med tempo
  per 100, 50 och 25 m.
- **Simprofilen**: utmattningsexponenten ur testerna och fart-tapp per
  dubblad distans. Under 1,05 *dieselmotor*, över 1,09 *bensinmotor*,
  däremellan balanserad – originalets gränser.
- **Loppprognos** för supersprint till maraton sim, från det längsta testet
  med simmarens egen exponent, med referenserna 1,03, 1,04 och 1,06 och med
  CSS-modellen där den gäller.
- **Red Mist-cykler**: tiden per 50 m från CSS och uppåt, en sekund i taget.

Tre saker rättades. **D′** räknades som (snittfart − CSS) · snittid, vilket
inte är linjens skärning: 200/400/800 m på 2:30, 5:15 och 11:00 gav 36,7 m i
stället för 26,5. **SDI** var snabbaste farten delad med den långsammaste och
användes som exponent i prognosen, men en fartkvot beror på vilka distanser
som simmats – samma simmare fick 1,05 med 200 + 400 m och 1,10 med 200 +
800 m. Den anpassade exponenten blir 1,070 respektive 1,069. **Drop-off** i
procent berodde på samma sätt på distanserna; fart-tapp per dubblad distans
gör det inte.

## Löptester och fartprofil

Tre löptester som registreras varv för varv – en rad per kilometer eller
varv, med tid, sträcka och puls. Summan av varven är testet; varven är
underlaget för pacinganalysen.

| Test | Genomförande | Ger |
|---|---|---|
| 5 km-test | 5 km så fort som möjligt, bana eller plan väg | VDOT, tröskelfart, tröskelpuls, zoner, prognoser, pacing |
| 20 minuters löptest | Så långt som möjligt på 20 minuter | samma |
| Lopp eller tidlopp | Ett lopp på valfri distans; en rad med sträcka och sluttid (h:mm:ss) räcker | samma – pacing bara med varv |

- **VDOT** (Daniels & Gilbert): loppets syrekostnad delad med den andel av
  VO2max som går att hålla så länge. Ett prestationsmått, inte ett uppmätt
  VO2max. Gäller för insatser på 3:30 till 4 timmar.
- **Tröskelfart** är Daniels T-tempo: farten som kostar 88 % av VDOT. Zonerna
  räknas ur den, och passbyggaren använder den när det saknas CS och LT2.
- **Tröskelpuls**: 95 % av snittpulsen när testet tar 15–30 minuter.
- **Prognoser** ur VDOT, och ur CS och D′ när adepten har ett CS-test. CS-
  modellen gäller ungefär 2–20 minuter; prognoser utanför markeras.
- **Pacing** ur varven: halvornas tider, fartvariationen mellan varven och
  första och sista varvet mot snittet. Utfallet blir Jämn, Negativ split,
  Positiv split, För hård start eller Ojämn. Gick starten för hårt säger
  texten det – resultatet är då snarare ett golv än ett tak.

Ur klockfilen hittar 5 km-testet de snabbaste 5 km i passet och delar dem i
kilometervarv där klockans sträcka passerar varje kilometer. 20-minuterstestet
tar 20-minutersinsatsen med kilometervarv och sista biten. Varven och
pacingen syns i förhandsvisningen innan något fylls i. Prövat på syntetiska
klockfiler: ett 5 km på 19:18 med stigande puls blev fem kilometervarv och
positiv split på 2,3 %; ett långpass snabbaste 5 km flaggades som att det
inte var någon insats; 20 minuter gav 5 220 m i fem varv plus 220 m.

Kontrollerat mot Daniels tabeller: 5 km på 20:00 ger VDOT 49,8, och VDOT 50
ger 10 km på 41:20 (tabell 41:21), maraton på 3:10:40 (3:10:49) och
tröskelfart 4:15/km.

### Fartprofilen

Progressionen visar löpares egen kurva: varje maximal insats – CS-test, 5 km,
20 minuter, lopp – är en punkt, och bästa insatsen per durationsband det
senaste året (räknat från den senaste insatsen) bygger kurvan.

- **Utmattningsexponenten** b i T = a·D^b. Riegel satte 1,06 ur tiotusentals
  lopp. Som ett tal en adept förstår: **fart-tapp per dubblad distans**,
  1 − 2^(1−b) – med 1,06 ungefär 4 %. Under 1,04 är profilen *uthållig*,
  över 1,08 *snabbhetsbetonad*, däremellan *balanserad*. Med bara en distans
  används Riegels 1,06.
- **CS och D′** ur punkterna på 2–20 minuter, och **bästa VDOT**.
- **Prognoser i tre kolumner** – egen kurva, VDOT, CS och D′. Där de skiljer
  sig mycket saknas oftast ett test på en distans nära loppet.
- Diagrammet visar fart mot tid på logaritmisk tidsaxel, med CS-kurvan över
  2–20 minuter och de insatser kurvan bygger på.

### Tävlingsplan

Distans, måltid (tomt = den egna kurvans prognos), varvlängd och strategi –
jämn, negativ eller positiv split på 1–6 %. Planen ger tid, tempo och
sammanlagd tid per varv.

- **Sluttiden ligger fast.** Det är halvornas tider som skiljer x %:
  T₁ = T / (2 + s), T₂ = T₁·(1 + s).
- **D′ som budget.** Allt över CS kostar (v − CS)·t, och varvtabellen visar
  D′ kvar. Återhämtning under CS räknas inte – i ett lopp är den liten, och en
  plan som bara håller tack vare den är för tunn.
- Utan återhämtning är den snabbaste sluttid som håller (D − D′) / CS, hur
  farten än fördelas, och jämn fart är den fördelning som når den. Tömmer en
  plan D′ säger noten därför vilket det är: måltiden är för snabb (och vilken
  tid som håller), eller fördelningen för ojämn.
- På maraton jämförs snittfarten med CS: maratonlöpare håller i snitt 85 %
  av sin CS, snabbare löpare en högre andel (Smyth & Muniz-Pumares 2020).

Prövat i webbläsaren på en testadept med 3- och 12-minutersinsats, 5 km,
20 minuter och ett halvmaraton: exponent 1,094 (6,3 % per dubblad distans),
CS 4:01/km och D′ 180 m. Ett 5 km på 19:00 tömmer D′ efter 3,3 km, och 19:22
är den snabbaste tiden som håller.

I tidslinjerna följs VDOT och fartvariationen **per test** – 5 km-test mot
5 km-test, lopp mot lopp. I samma linje skulle en snabbhetsbetonad löpare som
springer ett halvmaraton efter ett 5 km-test se ut att gå bakåt, fast det är
profilen som syns. Tröskelfarten får ingen egen tidslinje: den är 88 % av
VDOT.

### Ur de tidigare projekten

| Projekt | Taget | Rättat |
|---|---|---|
| runner-performance-calculator | Utmattningsexponenten ur flera lopp och tolkningen kring 1,06 | `GPT_APP.py` räknade Daniels ekvation med km/h i stället för m/min och utan andelen av VO2max – 5 km på 20:00 gav VO2max −1,8 |
| running-calculators | CS och D′ ur tidlopp och 3 min all-out | Rättat redan när testprotokollen byggdes: loppprognosen var t = d/CS − D′/CS² (fel enhet; rätt är (d − D′)/CS) – 5 km 36 s för långsamt vid CS 4,2 m/s och D′ 200 m – och 3-minuterstestets D′ räknades som (toppfart − slutfart)·180 s i stället för sträckan över CS |
| runner-metrics-calculator | VDOT, prognoser, splits | Tempoformlerna ur VDOT (`vdot^−0,71` med flera) ger 0,4 s/km och anropades aldrig – inte portade. Splitsens progression flyttade sluttiden när start och slut skilde olika mycket |

`lindblom-performance-hub` är marknadssajten och hade inga löptester att
porta.

## Passbyggare

`/app/pass` bygger ett enskilt pass ur en mening: *"tröskelpass, 4×8 min,
under 75 minuter"*. Passet byggs mot adeptens mätta tröskel – FTP, CP eller,
när bara laktattester finns, LT2.

**W′bal är ett val.** Kryssa i *Bygg mot W′bal* för pass som handlar om den
anaeroba reserven – VO2max-intervaller, lopp med attacker, banan. Då räknas
passet igenom mot reserven och grafen visar var den bottnar. Annars byggs
passet efter coachens och atletens mål utan att reserven styr.

**Adepter som är medlemmar** bygger egna pass mot sina egna tester och sparar
dem bland sina pass. De får ta bort de pass de själva byggt, inte coachens.

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

## Säsongen: planer, kalender och översikt

Idéerna kommer från tribeiq: tävlingar med prioritet och nedräkning,
periodisering, en coachvy över vem som behöver uppmärksamhet, och en kalender.
Där var allt demodata – beredskapen slumpades fram och korrelationerna var
påhittade. Här räknas allt ur riktiga tester, incheckningar och planer.

### Säsongsplanen

`/app/planer` samlar en adepts säsong på en tidslinje: perioderna som band,
tävlingarna som markörer och testerna som punkter, med dagens datum utritat.
Tolv månader i taget, ett halvår framåt eller bakåt med pilarna.

- **Tävlingar** har prioritet A, B eller C. A-loppet är säsongens mål; det är
  det nedräkningen gäller även när ett C-lopp ligger närmare.
- **Perioder** använder samma fem faser som testtillfällets: grund,
  uppbyggnad, specifik, toppning och vila. De får inte överlappa – en dag ska
  ligga i en fas, annars går det inte att säga vilken fas ett test togs i. En
  ny period förifylls där planen slutar, med fasen som brukar komma sedan.
- **Att se över** pekar ut det som ser ut som en lucka: ett A-lopp utan
  toppning inom tre veckor före, eller dagar mellan perioderna. 8–14 dagars
  nedtrappning, med volymen sänkt och intensiteten behållen, gav störst effekt
  i Bosquet m.fl. (2007).

Fasernas färger är en stege i accentens ton från grund till toppning – så att
ordningen syns i färgen – och vila som neutral grå. Den är validerad som
ordinal ramp mot både den mörka ytan och utskriftens vita.

Coachen planerar perioderna; en adept utan coach planerar sin egen säsong.
Tävlingarna skriver båda, eftersom atleten ofta vet först att ett lopp
tillkommit. "Skapa ny plan" i sidhuvudet öppnar planen med formuläret för en
ny period.

### Planen följer med

- Ett nytt testtillfälle får fasen ur planen förvald för testdatumet.
- AI-coachen och passbyggaren får veta fasen atleten är i och vilka tävlingar
  som kommer, och passbyggaren ombeds låta fasen styra upplägget.

### Kalendern

`/app/kalender` visar planerade pass, tester och tävlingar dag för dag, med
veckonummer. Ett pass får sitt datum när det sparas i passbyggaren, eller
senare på passets sida – en medlemsadept flyttar de pass hen byggt själv.
Coachen ser alla adepter på en gång eller en i taget; med en
adept vald färgas dagarna efter fasen och incheckningarna syns. Ett klick på
en dag visar dagen med länkar vidare, och bredvid ligger de närmaste två
veckorna. På en telefon blir innehållet i rutorna prickar och dagspanelen
hamnar under rutnätet.

### Översikten

Coachens översikt börjar med **värt en titt**: det som skiljer sig tydligt hos
någon adept.

- Återhämtningen jämförs med adeptens **eget** snitt den senaste månaden –
  12 av 20 är en dålig dag för den som brukar ligga på 17 och en vanlig dag
  för den som brukar ligga på 12. Utan en månads underlag nämns bara riktigt
  tunga dagar.
- Belastningen nämns när veckan ligger minst 30 % från månaden före, med
  samma formulering som på adeptsidan. Gränsen avgör bara vad som lyfts fram;
  den är ingen riskgräns.
- Olästa meddelanden, en vecka utan incheckning, B- och A-lopp inom två veckor
  och ett A-lopp utan toppning i planen.

Därefter kommande tävlingar, veckans pass och de senaste testerna. Adepten ser
i stället var i säsongen hen är, nedräkningen, dagens incheckning, de närmaste
passen och senaste testet.

Adeptlistan har fått sök, grenfilter, ett filter för dem som är värda en titt,
och kolumner för fas, återhämtning mot eget snitt, nästa tävling och olästa.

## Lopp och aktiviteter

Ett genomfört lopp eller pass laddas upp som .fit-fil under adeptens flik
**Lopp och aktiviteter** – av coachen eller av adepten själv. Filen läses och
analyseras i webbläsaren (`fit-file-parser`, samma tolk som testimporten).
Filen sparas inte; det som sparas i `activities` är analysen, en nedsamplad
serie på högst 2 000 punkter för kartan och graferna, och de tröskelvärden
analysen räknades mot.

### Tröskelvärdena som gällde då

Ett lopp i juli läses mot vårens test, inte mot ett som gjordes efteråt och inte
mot dagens värden när sidan öppnas nästa år (`src/lib/activities/reference.ts`).
Varje värde väljs för sig ur det senaste testet på eller före loppdagen, och
bara om inget sådant finns ur det närmaste efter:

- **FTP** för IF, TSS och effektzoner: ett FTP-test, annars CP, annars LT2 i
  watt, och utan test FTP:n som är inställd i cykeldatorn.
- **CP och W′** (cykel) eller **CS och D′** (löpning) för W′bal/D′bal och
  modellens bästa insatser.
- **Tröskelpuls** för Friels pulszoner.

Sidan räknar inte om. Vill man läsa ett gammalt lopp mot ett nytt test tar man
bort aktiviteten och laddar upp filen igen.

### Analysen

Räknad sekund för sekund innan nedsamplingen (`src/lib/activities/analysis.ts`),
regelbaserad som trendanalysen – samma fil ger samma text:

- Normaliserad effekt (30 s rullande, fjärde potens), VI, IF, TSS och arbete.
- Bästa insatser 5 s–60 min (cykel) eller 400 m–maraton (löpning), jämförda
  med vad CP + W′/t eller CS/D′ ur testet säger. Ett lopp som slår modellen
  säger att testet är gammalt.
- W′bal enligt Skiba (2014). Går reserven under noll gav atleten mer än
  modellen tillåter – då är CP eller W′ för lågt satta.
- Frikoppling mellan puls och effekt (eller fart) mellan halvorna, och hur
  andra halvan stod sig mot första.
- Tid i zon, delsträckor var tionde km (cykel) eller varje km (löpning), och
  klockans egna varv.

### Sidan

Karta (Leaflet) med rutten, start och mål. Under den graferna för höjd, fart,
effekt, puls, kadens och W′bal under varandra, med samma x-axel – distans eller
tid – och synkad pekare. Pekaren flyttar en markör på kartan, och en vald
bästa insats markeras både i graferna och på kartan. Effekten jämnas ut över
30 sekunder som i normaliserad effekt, det går att stänga av.

Kartbrickorna kommer från OpenStreetMap. Deras villkor tillåter inte tung
trafik; byt leverantör med `NEXT_PUBLIC_MAP_TILE_URL` och
`NEXT_PUBLIC_MAP_ATTRIBUTION` utan kodändring, och deploya om – variablerna
byggs in i sidan. Adressen ska vara en mall för rasterbrickor med `{z}`, `{x}`
och `{y}`, med en ljus kartstil: mörkläget är ett CSS-filter på brickorna, så
en mörk stil skulle bli ljus. MapTilers och Mapbox 512-pixelsbrickor känns
igen. Saknar adressen `{z}`/`{x}`/`{y}`, eller nekar leverantören brickorna,
används OpenStreetMap i stället och webbläsarkonsolen säger varför.

Aktiviteterna syns också i kalendern, och en tävling i säsongsplanen som har
ett uppladdat lopp länkar till analysen.

### Garmin och direkt synk

Uppladdningen gäller filer. Att få passen direkt från klockan kräver ett
godkänt avtal med tillverkaren – för Garmin deras
[Garmin Connect Developer Program](https://developer.garmin.com/gc-developer-program/),
som tar ansökningar från företag. Med det på plats är det en OAuth-koppling per
adept och en webhook som tar emot varje nytt pass och kör samma analys.

## Samtycke och integritet

Laktat, puls, syreupptag, kroppssammansättning, sömn och skador är
hälsouppgifter, och sådana får behandlas på uttryckligt samtycke
(dataskyddsförordningen artikel 9.2 a). Samtycket ska vara särskilt – inte en
del av att godkänna villkoren – och gå att ta tillbaka lika lätt som det gavs.

- **Vid registrering** kryssar en adept i samtycket separat från villkoren. Det
  sparas i `profiles.health_consent_at`, tidsstämplat av databasen.
- **Adepter som registrerade sig tidigare** får frågan på sin översikt, och
  coachen ser på adeptsidan när samtycket saknas.
- **Inställningar** visar kontot, byter namn och lösenord, ger eller tar
  tillbaka samtycket och laddar ned allt appen har om en som en fil (artikel 15
  och 20).
- **Integritetspolicy & villkor** beskriver vad appen faktiskt gör: vilka
  uppgifter, rättslig grund, vilka biträden som får del av dem, att det bara
  finns nödvändiga cookies, och rättigheterna.
- **AI-coachen skickar inte adeptens namn** till Anthropic. Modellen behöver
  talen, inte vem de tillhör.
- **AI-funktionerna kräver samtycket.** AI-coachen och passbyggaren vägrar
  bygga på en adept som inte godkänt – på servern, inte bara i gränssnittet.
  Passbyggaren fungerar fortfarande med värden coachen skriver in själv.
- **Kontakten syns.** Adeptlistan har en kolumn för samtycket – godkänt,
  konto utan godkännande, inbjuden (med datum) eller ej inbjuden – och ett
  filter för dem som saknar det. Översikten säger hur många det gäller.
  Adeptsidan har en färdig inbjudan för den som saknar konto och en
  påminnelse för den som har konto men inte godkänt. När coachen kopierar
  eller mejlar inbjudan sparas datumet (`adepts.invited_at`, migrationen
  `20261001090000_invitations.sql`).

Personuppgiftsansvarig, kontaktuppgifter och biträden står i
`src/lib/site.ts` och på policysidan. Stäm av texten innan den gäller skarpt –
till exempel vilken region Supabase-projektet ligger i och att
biträdesavtalen med Supabase, Vercel och Anthropic finns på plats.

## Nästa steg

Kända luckor:

- **Bloggen är inte byggd.** Hub-sajten hade ett riktigt inlägg och två
  markerade platshållare; jag hittar inte på tävlingsrapporter åt dig. När du
  har texterna lägger vi in `/blogg` med MDX-filer i repot.
- **Inkorgen för kontaktförfrågningar saknas.** Meddelanden sparas i `leads`
  men det finns ingen vy i appen som visar dem ännu — läs dem i Supabase så
  länge. Ingen mailavisering heller.
- Formuläret har en honeypot men ingen hastighetsbegränsning.
- Appen skickar inga mejl själv. En adept utan konto har ett kort **Bjud in
  till appen** på sin översikt, med en färdig text och en länk till
  registreringen där namn och adress är ifyllda. Coachen skickar den som mejl
  eller sms; kontot kopplas via adressen och samtycket ges vid registreringen.
  Har adepten redan ett konto syns inbjudan i appen.
- "Senast aktiv" uppdateras vid inloggning, inte vid varje sidvisning.
- Testresultat kan skapas och tas bort, men inte redigeras.
- **Löptesternas klockimport är prövad på syntetiska filer.** En riktig
  klockfil från ett 5 km- eller 20-minuterstest är nästa prov.
- **Passbyggarens modellanrop är inte körd mot skarpt API.** Miljön jag byggde
  i har ingen `ANTHROPIC_API_KEY`, så allt utom själva HTTP-anropet är verifierat
  — schemat, tolkningen, W′bal, sparandet, RLS och vyerna. Första riktiga
  körningen med nyckel är alltså också det första provet på prompten.
- **Planer är en säsongsplan**, inte en veckoplan: perioder och tävlingar.
  Passen byggs fortfarande ett i taget i passbyggaren och läggs på ett datum.
- **Ingen direkt synk från klockan.** Lopp laddas upp som .fit-filer; se
  "Garmin och direkt synk" ovan.
- **Kartbrickorna är inte provade härifrån.** Sandlådan jag byggde i når inte
  OpenStreetMap, så kartan är verifierad med en grå platta i stället för
  brickor. Rutten, markören och markeringen är provade.
- **Konton raderas inte från appen.** Inställningarna pekar till e-post, och
  raderingen görs för hand.
- **Ett återtaget samtycke stoppar inte registreringen tekniskt.** Coachen ser
  att samtycket saknas och ska sluta registrera; det som finns raderas på
  begäran.
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
  extrapolation i det metabola protokollet. Egna profileringsmätningar på tyngre
  atleter i `vlamax_samples` löser det.
