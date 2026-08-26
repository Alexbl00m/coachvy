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
      adepter/         lista, ny adept, [id] med flikarna Översikt/Testresultat
      testresultat/    slussar adepten till sin egen testflik
      planer/ progression/ kalender/ ai-coach/ community/ installningar/
    auth/callback/     växlar Supabase-koden mot en session
    not-found.tsx      404 i varumärket
  components/
    public/            sidhuvud, sidfot och marknadsföringssektionerna
    adepts/ tests/     appens moduler
    ui/                delade primitiver (button, field, card)
  lib/
    auth/              server actions för in-/utloggning + sessionsläsning
    adepts/            frågor och server actions för adepter
    tests/             frågor och server actions för testmodulen
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
