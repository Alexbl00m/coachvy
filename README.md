# Coachvy

Plattform där en coach hanterar sina adepter, deras testresultat och deras
träningsplaner.

Det här är **fas 1**: skelettet. Inloggning, registrering, datamodell,
sidhuvud och vänstermeny finns på plats. Undersidorna är avsiktligt tomma och
byggs modul för modul.

## Teknik

| Del        | Val                                     |
| ---------- | --------------------------------------- |
| Ramverk    | Next.js 16 (App Router) + TypeScript    |
| Styling    | Tailwind CSS v4                         |
| Auth & DB  | Supabase (auth + Postgres med RLS)      |
| Ikoner     | lucide-react                            |

Varumärke: Montserrat, accent `#E6754E`, bakgrund `#1A1A1E`. Färgskalan ligger
som Tailwind-tokens i `src/app/globals.css` (`ink-*` och `accent*`) – ändra där,
inte i enskilda komponenter.

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
    └── profiles          id, role ('coach' | 'adept'), full_name, email,
        │                 accepted_terms_at
        ├── coaches       id, company_name
        └── adepts        id, coach_id → coaches.id, sport, goal, current_level
```

En trigger på `auth.users` (`handle_new_user`) skapar profilen och rätt rollrad
utifrån metadatan som registreringsformuläret skickar med.

Row Level Security styr åtkomsten:

- En användare läser och uppdaterar alltid sin egen profil.
- En **coach** läser sina egna adepter – `adepts.coach_id = auth.uid()` – och
  deras profiler.
- En **adept** läser sin egen rad och sin coachs profil.

Ingen roll kan alltså se andra coachers adepter. Kopplingen sätts på
`adepts.coach_id`; inbjudningsflödet som fyller i den byggs i nästa fas.

## Struktur

```
src/
  app/
    (auth)/            logga-in, registrera – publika, egen layout
    (app)/             allt bakom inloggning – sidhuvud + vänstermeny
      oversikt/        dashboard efter inloggning
      adepter/ planer/ testresultat/ progression/ kalender/
      ai-coach/ community/ installningar/
    auth/callback/     växlar Supabase-koden mot en session
    integritetspolicy/ publik platshållarsida
  components/          app-shell, sidebar, logga, formulärdelar
  lib/
    auth/              server actions för in-/utloggning + sessionsläsning
    supabase/          klienter för browser, server och proxy
    routes.ts          alla sökvägar på ett ställe
    nav.ts             vänstermenyns innehåll
  proxy.ts             uppdaterar sessionen och skyddar rutterna
```

`src/proxy.ts` heter så eftersom Next.js 16 döpt om `middleware.ts` till
`proxy.ts`.

## Nästa steg

Modulerna byggs en i taget – Adepter först, sedan Planer och Testresultat.
Varje undersida renderar i dag `ModulePlaceholder` och byts ut mot riktigt
innehåll när modulen är klar.
