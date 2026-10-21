/**
 * Förslag om nya zoner när träningen visar att CP (CS) har gått upp.
 *
 * Bästa-kurvan ur de senaste 90 dagarnas pass ger en CP (CS) med samma
 * modell som ett CP-test: arbetet mot tiden för insatser på 3–20 minuter.
 * Ligger den tydligt över det senaste testet, och bygger den på insatser
 * gjorda efter testet, föreslås coachen att uppdatera zonerna. Coachen
 * godkänner eller avvisar – inget ändras av sig självt (filosofins avsnitt
 * 14: modellen är underställd tränarens omdöme).
 *
 * Förslaget går bara uppåt. Ett träningspass är sällan maximalt, så kurvan
 * visar vad adepten *minst* klarar; att den ligger under testet säger inget
 * om att formen gått ned.
 *
 * Godkänns förslaget sparas insatserna som ett vanligt CP-test (CS-test), med
 * varje insats eget datum, så att zonerna, passbyggaren och progressionen tar
 * upp det som vilket test som helst.
 *
 * Modulen är ren, utan anrop.
 */

import { addDays } from "@/lib/season/season";
import {
  bestCurve,
  fitCritical,
  inPeriod,
  type CurveKind,
  type CurvePoint,
  type ProfileSource,
} from "@/lib/activities/profile";

/** Hur mycket över testet träningen ska ligga för att föreslå: 3 %. */
export const SUGGEST_MIN_PCT = 3;
/** Anpassningen ska vara god, annars är kurvan inte maximal på bredden. */
export const SUGGEST_MIN_R2 = 0.95;
/** Fönstret bakåt, som i profilen ur träningen. */
export const SUGGEST_DAYS = 90;

/** Längderna insatserna väljs bland, som i ett CP-test med 3–20 minuter. */
const PREFERRED_SPANS = [180, 300, 420, 600, 900, 1200];
const MAX_EFFORTS = 6;

export type ZoneSport = "cykling" | "löpning";

export const KIND_OF: Record<ZoneSport, CurveKind> = {
  cykling: "power",
  löpning: "speed",
};

/** Ett tidigare beslut om ett förslag. */
export type ZoneReview = {
  sport: string;
  decision: "godkänd" | "avvisad";
  /** CP i W, eller CS i m/s. */
  proposed_critical: number;
  created_at: string;
};

export type ZoneSuggestion = {
  sport: ZoneSport;
  kind: CurveKind;
  /** CP i W, eller CS i m/s, ur träningen. */
  critical: number;
  /** W′ i J, eller D′ i m. */
  reserve: number;
  r2: number;
  /** Värdet ur senaste testet, samma enhet som `critical`. */
  previous: number;
  testedOn: string | null;
  /** Hur mycket över testet, i procent. */
  changePct: number;
  /** Insatserna förslaget bygger på – det som sparas som test. */
  efforts: CurvePoint[];
};

/** Insatserna att räkna på: helst de förvalda längderna, högst sex. */
export function pickEfforts(curve: CurvePoint[]): CurvePoint[] {
  const inRange = curve.filter((p) => p.span >= 180 && p.span <= 1200);
  const preferred = inRange.filter((p) => PREFERRED_SPANS.includes(p.span));
  const chosen = preferred.length >= 3 ? preferred : inRange;
  if (chosen.length <= MAX_EFFORTS) return chosen;
  // Behåll ändarna och sprid resten jämnt, så att linjen spänner hela spannet.
  const step = (chosen.length - 1) / (MAX_EFFORTS - 1);
  return Array.from(
    { length: MAX_EFFORTS },
    (_, i) => chosen[Math.round(i * step)],
  );
}

/**
 * Förslaget för en gren, eller null när det inte finns något att föreslå:
 * för få eller för osäkra insatser, inget test att jämföra med, ingen insats
 * efter testet, för liten skillnad, eller ett liknande förslag som coachen
 * redan avvisat efter testet.
 */
export function suggestZones({
  sport,
  sources,
  today,
  previous,
  testedOn,
  reviews,
}: {
  sport: ZoneSport;
  sources: ProfileSource[];
  today: string;
  /** CP i W, eller CS i m/s, ur senaste testet. */
  previous: number | null;
  testedOn: string | null;
  reviews: ZoneReview[];
}): ZoneSuggestion | null {
  if (!previous || !(previous > 0)) return null;
  const kind = KIND_OF[sport];
  const recent = inPeriod(
    sources,
    kind,
    addDays(today, -(SUGGEST_DAYS - 1)),
    today,
  );
  const efforts = pickEfforts(bestCurve(recent, kind));
  const fit = fitCritical(efforts, kind);
  if (!fit || fit.doubtful || fit.r2 < SUGGEST_MIN_R2) return null;

  // Bygger allt på insatser före testet har testet redan räknat med dem.
  if (testedOn && !efforts.some((e) => e.date > testedOn)) return null;

  const changePct = ((fit.critical - previous) / previous) * 100;
  if (changePct < SUGGEST_MIN_PCT) return null;

  // Ett avvisat förslag kommer inte tillbaka förrän träningen visar mer.
  const dismissed = reviews.some(
    (r) =>
      r.sport === sport &&
      r.decision === "avvisad" &&
      (!testedOn || r.created_at.slice(0, 10) >= testedOn) &&
      r.proposed_critical >= fit.critical * 0.99,
  );
  if (dismissed) return null;

  return {
    sport,
    kind,
    critical: fit.critical,
    reserve: fit.reserve,
    r2: fit.r2,
    previous,
    testedOn,
    changePct,
    efforts,
  };
}
