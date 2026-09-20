/**
 * Träningsbelastning och återhämtning ur den dagliga incheckningen.
 *
 * Passbyggaren förutsäger vad ett pass *ska* kosta. Det här är den andra
 * halvan: vad det faktiskt kostade, och hur atleten mår av summan.
 *
 * Två mått som medvetet aldrig slås ihop.
 *
 * **Belastning** är sessions-RPE gånger passets längd i minuter (Foster 1998).
 * RPE:t är Borg CR10 för passet som helhet, satt en stund efteråt: 0 är vila,
 * 10 det hårdaste atleten kan föreställa sig. Ett pass på 60 minuter som
 * kändes som 7 ger 420 godtyckliga enheter. Enheten är godtycklig men
 * jämförbar med sig själv över tid, vilket är allt man behöver.
 *
 * **Återhämtning** är Hoopers fyra frågor (Hooper & Mackinnon 1995): sömn,
 * trötthet, muskelömhet och stress. Originalet räknar 1 som bäst; här är
 * skalan vänd så att 5 är bäst, eftersom resten av appen läser högre tal som
 * bättre. Summan 4–20 är dagens poäng.
 *
 * Att snitta ihop belastning och återhämtning, som det är frestande att göra
 * när båda är tal mellan 1 och 10, ger ett värde utan innebörd: de mäter
 * olika saker och pekar åt olika håll. De redovisas var för sig.
 */

export type Checkin = {
  /** ISO-datum, YYYY-MM-DD. */
  performedOn: string;
  /** Borg CR10 för passet. null betyder vilodag. */
  sessionRpe: number | null;
  durationMinutes: number | null;
  sleep: number | null;
  fatigue: number | null;
  soreness: number | null;
  stress: number | null;
};

/** Dagens belastning i godtyckliga enheter. Vilodag ger 0. */
export function sessionLoad(
  sessionRpe: number | null,
  durationMinutes: number | null,
): number {
  if (sessionRpe === null || !(sessionRpe > 0)) return 0;
  if (durationMinutes === null || !(durationMinutes > 0)) return 0;
  return sessionRpe * durationMinutes;
}

/**
 * Dagens återhämtningspoäng, 4–20.
 *
 * Alla fyra frågorna krävs. En dag med tre besvarade frågor är inte en lägre
 * poäng utan en ofullständig mätning, och att summera den ändå hade gjort
 * dagarna ojämförbara.
 */
export function readinessScore(checkin: Checkin): number | null {
  const parts = [checkin.sleep, checkin.fatigue, checkin.soreness, checkin.stress];
  if (parts.some((p) => p === null || !(p >= 1 && p <= 5))) return null;
  return parts.reduce<number>((sum, p) => sum + (p as number), 0);
}

export const READINESS_MIN = 4;
export const READINESS_MAX = 20;

/** Hur en återhämtningspoäng ska läsas. Beskrivande, inte normerande. */
export function readReadiness(score: number): string {
  if (score >= 17) return "Utvilad";
  if (score >= 13) return "Normal";
  if (score >= 9) return "Sliten";
  return "Tungt";
}

export type LoadPoint = {
  date: string;
  /** Dagens belastning. 0 för vilodag, null när ingen incheckning finns. */
  load: number | null;
  /** Summan de senaste sju dagarna, inklusive dagen själv. */
  acute: number;
  /** De 21 dagarna dessförinnan, omräknade till ett sjudagarsvärde. */
  chronic: number | null;
  /** acute / chronic. null när det inte finns 21 dagar bakåt att jämföra med. */
  ratio: number | null;
  readiness: number | null;
};

export type LoadSeries = {
  points: LoadPoint[];
  /** Dagens läge, alltså sista punkten. */
  latest: LoadPoint | null;
  /** Hur många av de senaste 28 dagarna som har en incheckning. */
  coverage: number;
  warnings: string[];
};

const DAY = 86_400_000;
const ACUTE_DAYS = 7;
const CHRONIC_DAYS = 21;

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Belastningen dag för dag, med rullande fönster.
 *
 * Kvoten räknas *okopplad*: de sju senaste dagarna jämförs med de 21 dagarna
 * dessförinnan, inte med ett 28-dagarsfönster som innehåller dem själva. Den
 * vanliga kopplade formen har akutfönstret inbakat i det kroniska, vilket gör
 * att täljare och nämnare rör sig ihop och kvoten dras mot 1 av ren
 * konstruktion (Windt & Gabbett 2019). Den okopplade jämför två skilda
 * perioder och betyder därför vad den ser ut att betyda.
 *
 * Här dras inga gränser i kvoten. Tröskelvärdena som brukar ritas ut – "0,8
 * till 1,3 är tryggt" – vilar på svagare underlag än de brukar framställas
 * som, och Impellizzeri m.fl. (2020) visade att en stor del av sambandet var
 * en artefakt av hur måttet konstrueras. Kvoten är ett sätt att se om de
 * senaste veckan avviker från månaden före, ingenting mer.
 *
 * En dag utan incheckning räknas som noll i summorna – annars går de inte att
 * räkna alls – men täckningsgraden redovisas så att en tunn period syns.
 */
export function buildLoadSeries(
  checkins: Checkin[],
  options: { days?: number; today?: Date } = {},
): LoadSeries {
  const days = options.days ?? 56;
  const today = options.today ?? new Date();
  const warnings: string[] = [];

  const byDate = new Map<string, Checkin>();
  for (const checkin of checkins) byDate.set(checkin.performedOn, checkin);

  // Kalendern först, sedan incheckningarna in i den. Hopp över dagar utan
  // incheckning skulle göra de rullande fönstren till "sju senaste
  // incheckningar" i stället för sju dagar.
  const end = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const calendar: { date: string; load: number | null; readiness: number | null }[] =
    [];

  // Extra dagar bakåt så att den första redovisade punkten också har ett
  // fullt kroniskt fönster bakom sig.
  const lookback = days + ACUTE_DAYS + CHRONIC_DAYS;
  for (let i = lookback - 1; i >= 0; i -= 1) {
    const date = isoDay(new Date(end - i * DAY));
    const checkin = byDate.get(date);
    calendar.push({
      date,
      load: checkin ? sessionLoad(checkin.sessionRpe, checkin.durationMinutes) : null,
      readiness: checkin ? readinessScore(checkin) : null,
    });
  }

  const sum = (from: number, to: number) => {
    let total = 0;
    for (let i = from; i <= to; i += 1) total += calendar[i]?.load ?? 0;
    return total;
  };

  const points: LoadPoint[] = [];
  for (let i = calendar.length - days; i < calendar.length; i += 1) {
    const acute = sum(i - ACUTE_DAYS + 1, i);

    const chronicStart = i - ACUTE_DAYS - CHRONIC_DAYS + 1;
    const chronic =
      chronicStart >= 0
        ? (sum(chronicStart, i - ACUTE_DAYS) / CHRONIC_DAYS) * ACUTE_DAYS
        : null;

    points.push({
      date: calendar[i].date,
      load: calendar[i].load,
      acute,
      chronic,
      ratio: chronic !== null && chronic > 0 ? acute / chronic : null,
      readiness: calendar[i].readiness,
    });
  }

  const last28 = calendar.slice(-28);
  const coverage = last28.filter((d) => d.load !== null).length;

  if (coverage === 0) {
    warnings.push(
      "Inga incheckningar de senaste fyra veckorna. Belastningen går inte att följa utan dem.",
    );
  } else if (coverage < 14) {
    warnings.push(
      `Bara ${coverage} av de senaste 28 dagarna har en incheckning. Summorna räknar de andra som vila, så de blir för låga.`,
    );
  }

  return {
    points,
    latest: points[points.length - 1] ?? null,
    coverage,
    warnings,
  };
}

/**
 * En mening om kvoten.
 *
 * Medvetet utan gränsvärden och utan råd. Kvoten säger hur den senaste veckan
 * förhåller sig till månaden före, och vad det betyder för just den här
 * atleten är coachens bedömning.
 */
export function readRatio(ratio: number): string {
  const percent = Math.round((ratio - 1) * 100);
  if (Math.abs(percent) < 10) {
    return "Den senaste veckan ligger i nivå med månaden före.";
  }
  return percent > 0
    ? `Den senaste veckan ligger ${percent} % över snittet för månaden före.`
    : `Den senaste veckan ligger ${Math.abs(percent)} % under snittet för månaden före.`;
}

/**
 * Belastningsläget som text, för prompten.
 *
 * Ett pass byggs inte i ett vakuum. En atlet som ligger 40 % över sin vanliga
 * vecka och sovit dåligt i tre dagar ska inte få samma pass som en utvilad,
 * och modellen kan bara ta hänsyn till det om den får veta det.
 *
 * Är underlaget för tunt skickas ingenting alls. En kvot räknad på fyra
 * incheckningar av 28 är sämre än ingen kvot: den ser ut som ett mätvärde.
 */
export function loadToPrompt(series: LoadSeries): string | null {
  const latest = series.latest;
  if (!latest || series.coverage < 7) return null;

  const lines = [
    `Belastning: ${Math.round(latest.acute)} enheter de senaste sju dagarna (${Math.round(latest.acute / 7)} per dag).`,
  ];

  if (latest.ratio !== null) {
    lines.push(readRatio(latest.ratio));
  }

  const recent = series.points
    .slice(-7)
    .filter((p) => p.readiness !== null)
    .map((p) => p.readiness as number);

  if (recent.length > 0) {
    const mean = recent.reduce((sum, r) => sum + r, 0) / recent.length;
    const last = recent[recent.length - 1];
    lines.push(
      `Återhämtning senast ${last} av ${READINESS_MAX} (${readReadiness(last).toLowerCase()}), snitt ${mean.toFixed(1).replace(".", ",")} den senaste veckan.`,
    );
  }

  lines.push(
    `Bygger på ${series.coverage} incheckningar av de senaste 28 dagarna.`,
  );

  return lines.join(" ");
}
