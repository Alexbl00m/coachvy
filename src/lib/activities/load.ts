/**
 * Belastningen i två delar: volym och strain.
 *
 * En sammanslagen poäng som TSS säger hur mycket ett pass kostade, men inte
 * varför – tre timmar lugnt och en timme med hårda intervaller kan ge samma
 * tal. Här hålls de isär:
 *
 * - **Volym** är det mekaniska arbetet: tid, och arbete i kJ (cykel) eller
 *   sträcka (löpning). Den bygger den aeroba grunden.
 * - **Strain** är arbetet ovanför CP (CS), räknat i W′ (D′): 1,0 betyder att
 *   passet hade arbete över tröskeln som motsvarar en full anaerob reserv.
 *   Insatser över CP tröttar långt mer än arbete under (Jones m.fl. 2019),
 *   och det är den kostnaden strain fångar.
 *
 * Över veckor visar de två om belastningen drivs av mer träning, av tätare
 * intensitet eller av båda – samma fråga som filosofins avsnitt 19 ställer om
 * intensitetsfördelningen, nu ur det som faktiskt genomfördes.
 *
 * Modulen är ren, utan anrop.
 */

import { addDays, mondayOf } from "@/lib/season/season";

export type LoadActivity = {
  id: string;
  sport: string;
  performed_on: string;
  /** Rörlig tid, sekunder; annars hela tiden. */
  seconds: number;
  /** Arbete i kJ, när passet har effekt. */
  kj: number | null;
  /** Sträcka i km. */
  km: number | null;
  /** Strain i W′ (D′); null när CP/W′ saknades eller passet saknar effekt/fart. */
  strain: number | null;
  /** Strain är uppskattad ur den sparade, nedsamplade serien. */
  estimated?: boolean;
};

/**
 * Strain ur en sparad serie: arbetet över CP (sträckan över CS) delat med
 * reserven. Serien är medelvärden per hink, så korta toppar över tröskeln
 * jämnas ut och värdet blir något lågt – därför märks det som uppskattat.
 *
 * `values` är effekt i W, eller fart i km/h för löpning (som serien sparas).
 */
export function strainFromSeries(
  t: number[],
  values: (number | null)[],
  critical: number,
  reserve: number,
  kind: "power" | "speed",
): number | null {
  if (!(critical > 0) || !(reserve > 0) || t.length < 2) return null;
  let work = 0;
  let any = false;
  for (let i = 0; i < t.length - 1; i += 1) {
    const raw = values[i];
    if (raw === null || raw === undefined) continue;
    any = true;
    const v = kind === "speed" ? raw / 3.6 : raw;
    const dt = t[i + 1] - t[i];
    if (dt > 0 && v > critical) work += (v - critical) * dt;
  }
  return any ? work / reserve : null;
}

export type LoadWeek = {
  /** Måndagen. */
  monday: string;
  seconds: number;
  kj: number;
  km: number;
  strain: number;
  sessions: number;
  /** Pass med effekt eller fart men utan CP/W′ – strain okänd för dem. */
  withoutStrain: number;
};

/** Veckorna bakåt från den här, äldst först. */
export function weeklyLoad(
  activities: LoadActivity[],
  today: string,
  weeks = 12,
): LoadWeek[] {
  const thisMonday = mondayOf(today);
  const out: LoadWeek[] = Array.from({ length: weeks }, (_, i) => ({
    monday: addDays(thisMonday, -7 * (weeks - 1 - i)),
    seconds: 0,
    kj: 0,
    km: 0,
    strain: 0,
    sessions: 0,
    withoutStrain: 0,
  }));
  const first = out[0].monday;
  for (const a of activities) {
    if (a.performed_on < first || a.performed_on > today) continue;
    const week = out.find(
      (w) =>
        a.performed_on >= w.monday && a.performed_on < addDays(w.monday, 7),
    );
    if (!week) continue;
    week.seconds += a.seconds;
    week.kj += a.kj ?? 0;
    week.km += a.km ?? 0;
    week.sessions += 1;
    if (a.strain !== null) week.strain += a.strain;
    else if (a.sport === "cykling" || a.sport === "löpning")
      week.withoutStrain += 1;
  }
  return out;
}

export type LoadTrend = {
  /** Senaste sju dagarna. */
  recent: { seconds: number; strain: number; sessions: number };
  /** Snittet per sju dagar under de 28 dagarna före. */
  before: { seconds: number; strain: number };
  /** Senaste veckan mot månaden före, som kvot; null utan underlag. */
  volumeRatio: number | null;
  strainRatio: number | null;
};

/** Senaste sju dagarna mot snittveckan under de fyra veckorna före. */
export function loadTrend(
  activities: LoadActivity[],
  today: string,
): LoadTrend {
  const recentFrom = addDays(today, -6);
  const beforeFrom = addDays(today, -34);
  const recent = { seconds: 0, strain: 0, sessions: 0 };
  const before = { seconds: 0, strain: 0 };
  for (const a of activities) {
    if (a.performed_on > today || a.performed_on < beforeFrom) continue;
    if (a.performed_on >= recentFrom) {
      recent.seconds += a.seconds;
      recent.strain += a.strain ?? 0;
      recent.sessions += 1;
    } else {
      before.seconds += a.seconds / 4;
      before.strain += (a.strain ?? 0) / 4;
    }
  }
  return {
    recent,
    before,
    volumeRatio: before.seconds > 0 ? recent.seconds / before.seconds : null,
    strainRatio: before.strain > 0.05 ? recent.strain / before.strain : null,
  };
}

/** Förändring som nämns: ±20 % mot månaden före. */
const CHANGE = 0.2;

const sv = (v: number, digits = 1) =>
  v.toFixed(digits).replace(".", ",").replace(/,0$/, "");
const hours = (seconds: number) => `${sv(seconds / 3600)} h`;
const pct = (ratio: number) => `${Math.round(Math.abs(ratio - 1) * 100)} %`;

/**
 * Vad senaste veckan säger, i ord: volymen och strain var för sig, och vad
 * som driver förändringen. Konstateranden med sina tal – vad det betyder för
 * just den här adepten är coachens bedömning.
 */
export function loadReading(trend: LoadTrend): string[] {
  const { recent, before, volumeRatio, strainRatio } = trend;
  if (recent.sessions === 0 && before.seconds === 0) return [];
  const lines: string[] = [];

  const volumeText =
    recent.sessions === 0
      ? `Inga pass ur klockan senaste sju dagarna – snittveckan månaden före var ${hours(before.seconds)}.`
      : volumeRatio === null
        ? `Volym senaste sju dagarna: ${hours(recent.seconds)}.`
        : Math.abs(volumeRatio - 1) < CHANGE
          ? `Volym ${hours(recent.seconds)} senaste sju dagarna – i nivå med snittveckan månaden före (${hours(before.seconds)}).`
          : `Volym ${hours(recent.seconds)} senaste sju dagarna – ${pct(volumeRatio)} ${volumeRatio > 1 ? "över" : "under"} snittveckan månaden före (${hours(before.seconds)}).`;
  lines.push(volumeText);
  // Utan pass finns ingen strain att jämföra – en tom vecka är bara tom.
  if (recent.sessions === 0) return lines;

  const strainText =
    strainRatio === null
      ? recent.strain > 0
        ? `Strain ${sv(recent.strain)} W′ – för lite arbete över tröskeln månaden före för att jämföra.`
        : null
      : Math.abs(strainRatio - 1) < CHANGE
        ? `Strain ${sv(recent.strain)} W′ – i nivå med snittet (${sv(before.strain)} W′).`
        : `Strain ${sv(recent.strain)} W′ – ${pct(strainRatio)} ${strainRatio > 1 ? "över" : "under"} snittet (${sv(before.strain)} W′).`;
  if (strainText) lines.push(strainText);

  // Vad driver förändringen?
  if (volumeRatio !== null && strainRatio !== null) {
    const vUp = volumeRatio >= 1 + CHANGE;
    const sUp = strainRatio >= 1 + CHANGE;
    const vDown = volumeRatio <= 1 - CHANGE;
    const sDown = strainRatio <= 1 - CHANGE;
    if (sUp && !vUp)
      lines.push(
        "Belastningen ökar genom tätare intensitet, inte genom mer träning.",
      );
    else if (vUp && !sUp)
      lines.push(
        "Belastningen ökar genom mer träning, med intensiteten i samma nivå.",
      );
    else if (vUp && sUp)
      lines.push("Både volym och intensitet ökar samtidigt.");
    else if (vDown && sDown)
      lines.push(
        "Både volym och intensitet är nere – vila, toppning eller ett avbrott.",
      );
    else if (sDown && !vDown)
      lines.push("Intensiteten är nere medan volymen håller i sig.");
  }
  return lines;
}

/**
 * Passets strain: ur analysen, eller för pass lästa innan den räknades ur den
 * sparade serien mot CP/W′ (CS/D′) som gällde då.
 */
export function activityStrain(activity: {
  sport: string;
  summary: { strain?: number | null };
  reference: {
    cp: number | null;
    wPrime: number | null;
    cs: number | null;
    dPrime: number | null;
  } | null;
  streams: {
    t: number[];
    power: (number | null)[];
    speed: (number | null)[];
  };
}): { value: number; estimated: boolean } | null {
  const s = activity.summary.strain;
  if (s !== null && s !== undefined) return { value: s, estimated: false };
  const ref = activity.reference;
  const st = activity.streams;
  const value =
    activity.sport === "cykling" && ref?.cp && ref.wPrime
      ? strainFromSeries(st.t, st.power, ref.cp, ref.wPrime, "power")
      : activity.sport === "löpning" && ref?.cs && ref.dPrime
        ? strainFromSeries(st.t, st.speed, ref.cs, ref.dPrime, "speed")
        : null;
  return value === null ? null : { value, estimated: true };
}
