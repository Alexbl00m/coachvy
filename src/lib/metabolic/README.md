# Metabol modell

Mader & Heck-modellen (1986, 2003) för cykel, kalibrerad mot referensdata, plus distanstestet
som skattar VO2max och VLaMax ur en sprint och 3-, 6- och 12-minuterstest utan laktatmätning.

Mappen är ren TypeScript utan beroenden: ingen React, inga importer utanför mappen. Den kan
kopieras rakt in i en annan app, till exempel Coachvy.

## Snabbstart

```ts
import { analyzeRemoteTest } from "./metabolic";

const result = analyzeRemoteTest(
  {
    bodyMass: 75,
    bodyFatPct: 13,
    sex: "male",
    sprint: { durationSec: 20, power: 703 },
    efforts: [
      { durationSec: 180, power: 421 },
      { durationSec: 360, power: 361 },
      { durationSec: 720, power: 331 },
    ],
    // weights: { aerobic: 1, glycolytic: 1, threshold: 5 }, // lita mest på 6–12 min
  },
  { bodyFatMethod: "scale" }
);

if (result.ok) {
  result.estimate.vo2max; // 62,0 ml/kg/min
  result.estimate.vlamax; // 0,50 mmol/L/s
  result.estimate.engine.at?.power; // 295 W
  result.spread.at; // ±9 W (1 SD vid normala mätfel)
  result.flags; // kvalitetsflaggor att visa för coachen
  result.zones; // sex zoner med watt och bränsle
} else {
  result.errors; // fel i indata
}
```

## API

| Funktion | Gör |
|---|---|
| `analyzeRemoteTest(input, options)` | Allt i ett: kontroll, skattning, osäkerhet, flaggor, zoner och varianter för banden |
| `runEngine({ bodyMass, vo2max, vlamax, volRel })` | Kurvor och markörer när VO2max och VLaMax redan är kända, till exempel från labb |
| `estimateProfile(input)` | Bara regressionen som ger VO2max och VLaMax |
| `profileVariants`, `spreadFromVariants`, `estimateUncertainty` | Osäkerhet genom att förskjuta en felkälla i taget |
| `curveBand(base, variants, key, powers, { cap, direction })` | ±1 SD-band till diagram. Använd `"horizontal"` för laktat |
| `fitCriticalPower(efforts)` | CP, W′ och varje tests avvikelse från kurvan |
| `analyzeStepTest(points)` | D-max, modifierad D-max och 4 mmol/L ur ett stegtest |
| `fitVlamaxToStepTest(points, { bodyMass, vo2max, volRel })` | VLaMax som återger labbets laktatkurva under tröskeln, att jämföra med distanstestet |
| `metabolicZones(engine)` | Sex zoner med watt, kolhydrater, fett och energi |
| `validateInput`, `assessQuality` | Fel som stoppar beräkningen och varningar efteråt |
| `lactateDistributionVolume(sex, fett%)` | Laktatens fördelningsvolym ur kroppsfett |

Enheter: effekt i W, tid i sekunder, VO2 i ml/kg/min, VLaMax i mmol/L/s, laktat i mmol/L,
bränsle i g/h och energi i kcal/h.

Sprinten är valfri (`sprint: null`). Då skattas VO2max och VLaMax ur 3-minuterstestet och CP,
vilket kräver ett test på 2–7 minuter och minst två längre test. VLaMax blir osäkrare utan sprint.

Har coachen en laktatmätare kan högsta laktat efter sprinten anges (`sprintLactate: { peak, rest }`,
mmol/L). Då räknas VLaMax som `(peak − rest) / (sprinttid − 3,5 s)` i stället för ur sprintens watt.
Utan vilolaktat används 1,0 mmol/L. Det är säkrare för atleter med mycket explosiv sprint.

## Flytta till en annan app

1. Kopiera hela mappen, inklusive `__tests__`.
2. Inga paket behövs för modellen. Testerna kräver vitest: `npm i -D vitest`, sedan
   `npx vitest run`.
3. Texterna i flaggor och zoner är på svenska och finns i `quality.ts` och `zones.ts`.
4. **Kör modellen på servern i en kommersiell app**, till exempel i en Next.js route handler
   eller server action. Då hamnar inte de kalibrerade konstanterna i webbläsarens JavaScript.
5. Ändra aldrig en konstant i `constants.ts` utan att referenstesterna fortfarande går igenom.

## Kalibrering och begränsningar

Konstanterna är kalibrerade mot kurvor ur två referensrapporter och kontrollerade mot en
tredje. Med referensernas VO2max och VLaMax träffar motorn AT och FatMax inom 1–2 W.
Distanstestet återger referensernas AT inom 1–2 W ur bara effekttesterna.

Mot labb (referens D, 3 + 12 min utan sprint mot ett stegtest med laktat): VO2max 4,93 mot
4,87 L/min, VLaMax 0,43 mot 0,40 ur labbets laktatkurva och AT 316 mot 314 W. Modellens
4 mmol/L i steady state blev 302 W mot stegtestets 297–300 W.

Mot uppmätt VO2max (referens E, samma atlet som A, gasanalys 2,5 månader före):
VO2max 4,87 mot 4,98 L/min, VLaMax 0,54 mot 0,59 ur labbets laktatkurva, AT 303 mot 305 W
ur laktatkurvan och 300 W enligt labbet.

Mot två stegtest hos en atlet med stark sprint (referens F): CP och labbet pekade på samma
tröskel (0,98 · CP 328 W mot 4 mmol/L vid 326 W), men sprinten gav VLaMax 0,67 mot 0,43 ur
labbets laktatkurva. Kvalitetskontrollen pekar då ut sprinten (`sprint-conflict`) och visar
resultatet utan den: VLaMax 0,49 och AT 328 W.

Distanstestet mäter effekt, inte syre. VO2max räknas ur MAP med 12,5 ml O2/min/W, ungefär 23 %
bruttoverkningsgrad. En atlet med sämre verkningsgrad får lägre VO2max än i labbet och för lågt
bränsle i g/h, medan wattvärdena bygger på atletens egna test. Referens F mätte 6,08 L/min i
labb men använde 14,9 ml O2/min/W vid tröskeln.

Referensdata finns ännu bara för män på 77–85 kg på cykel. Kvinnor, löpning och lättare
atleter är inte validerade. Hela kalibreringen finns i
`.claude/skills/vlamax-model/references/calibration.md`.
