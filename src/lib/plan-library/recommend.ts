/**
 * Vilken plan som passar nu: fokus ur testet och huvudloppet.
 *
 * Utgångspunkten är filosofin. Utnyttjandegraden säger var tröskeln begränsas
 * (avsnitt 8): ligger tröskeln högt mot VO2max är det taket som ska lyftas,
 * ligger den lågt är det tröskeln. Loppet säger vilken kvalitet som ska växa
 * när det närmar sig (avsnitt 19), och grundperioden är tiden att bygga
 * styrka (avsnitt 20). Utan test börjar det med grundträning och ett test,
 * så att nästa block väljs ur ett resultat (avsnitt 12).
 *
 * Förslaget är en hypotes. Coachen väljer. Modulen är ren.
 */

import type { AdeptRaceRow } from "@/lib/types/database";
import { raceDemand, type RaceDemand } from "@/lib/season/distribution";

import type { PlanFocus } from "./focus";

export type Suggestion = {
  focus: PlanFocus;
  /** Varför, i en eller två meningar. */
  reason: string;
};

export type RecommendInput = {
  /** Utnyttjandegraden ur det senaste testet, eller null utan test. */
  diagnosis: {
    verdict: "utnyttjande" | "balans" | "motor";
    pct: number;
    label: string;
  } | null;
  /** Senaste VLamax, mmol/l/s. */
  vlamax: number | null;
  /** Huvudloppet: närmaste A-lopp, annars närmaste lopp. */
  race: Pick<AdeptRaceRow, "name" | "sport" | "distance" | "race_date"> | null;
  /** YYYY-MM-DD. */
  today: string;
};

/** VLamax över det här drar ned tröskeln i ett långt lopp. Hobbynivå enligt referenserna. */
export const HIGH_VLAMAX = 0.5;
/** Så nära loppet börjar den specifika perioden (avsnitt 19). */
const SPECIFIC_WEEKS = 8;
/** Lyft taket behöver en grundperiod före VO2max-blocket. */
const CEILING_WEEKS = 10;
/** Grundperioden, där styrka byggs, ligger längre bort än så här. */
const BASE_WEEKS = 12;

const pctText = (pct: number) => `${Math.round(pct)} %`;
const sv = (n: number, digits: number) => n.toFixed(digits).replace(".", ",");

/** Ultra: lopp där tid på cykeln och energi avgör mer än tröskeln. */
export function isUltra(
  race: Pick<AdeptRaceRow, "sport" | "distance" | "name">,
): boolean {
  const text = `${race.distance ?? ""} ${race.name}`.toLowerCase();
  if (/ultra|vätternrund|race across|bikepacking|brevet|24 ?h|dygn/.test(text)) {
    return true;
  }
  const km = text.match(/(\d+(?:[.,]\d+)?)\s*km\b/);
  const mil = text.match(/(\d+(?:[.,]\d+)?)\s*mil\b/);
  const distance = km
    ? Number(km[1].replace(",", "."))
    : mil
      ? Number(mil[1].replace(",", ".")) * 10
      : null;
  if (distance === null) return false;
  return race.sport === "cykling" ? distance >= 200 : race.sport === "löpning" ? distance > 42.2 : false;
}

function weeksBetween(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / (7 * 24 * 3600 * 1000);
}

/**
 * Fokus i den ordning de passar, högst tre, med motivering. Det första är
 * förslaget; de andra är alternativ.
 */
export function recommendFocus(input: RecommendInput): Suggestion[] {
  const { diagnosis, vlamax, race, today } = input;
  const weeks =
    race && race.race_date >= today ? weeksBetween(today, race.race_date) : null;
  const ultra = race ? isUltra(race) : false;
  const demand: RaceDemand | null = race ? (ultra ? "lång" : raceDemand(race)) : null;
  const highVlamax = vlamax !== null && vlamax >= HIGH_VLAMAX;

  const out: Suggestion[] = [];
  const add = (focus: PlanFocus, reason: string) => {
    if (!out.some((s) => s.focus === focus)) out.push({ focus, reason });
  };

  // Nära loppet: kvaliteten flyttas mot det loppet avgörs i.
  if (race && weeks !== null && weeks <= SPECIFIC_WEEKS) {
    const left = `${race.name} är om ${Math.max(1, Math.round(weeks))} veckor`;
    if (ultra) {
      add("ultra", `${left}. Ett ultralopp avgörs av tid på cykeln, energi och jämn fart, och det är det den specifika perioden övar.`);
      add("durability", "Att hålla effekten efter timmar av arbete är det som skiljer i slutet av ett långt lopp.");
    } else if (demand === "lång") {
      add("durability", `${left}. Ett långt lopp går mest mellan trösklarna, så kvaliteten flyttas mot tävlingsfart och att hålla den efter timmar av arbete.`);
      add("troskel", "Tröskeln bestämmer vilken fart som går att hålla länge.");
    } else if (demand === "kort") {
      add("vo2max", `${left}. Ett kort lopp avgörs över tröskeln, så andelen hög intensitet växer.`);
      add("troskel", "Tröskeln bär farten mellan rycken.");
    } else {
      add("troskel", `${left}. Loppet ligger nära tröskeln, så kvaliteten delas mellan tröskel och VO₂max.`);
      add("vo2max", "VO₂max-arbete håller taket uppe inför loppet.");
    }
    return out.slice(0, 3);
  }

  // Utan test: grund och ett test, så att nästa block väljs ur ett resultat.
  if (!diagnosis) {
    add(
      "grund",
      "Det finns inget test med tröskel och VO₂max att utgå från. Grundträningen bygger den aeroba basen och har ett test inbyggt, så att nästa block väljs ur ett resultat.",
    );
  } else if (diagnosis.verdict === "motor") {
    const why = `${diagnosis.label} ligger på ${pctText(diagnosis.pct)} av VO₂max. Tröskeln utnyttjar redan det mesta av taket, så det som lyfter den vidare är VO₂max.`;
    if (weeks === null || weeks >= CEILING_WEEKS) {
      add("tak", `${why} En grundperiod som leder in i ett VO₂max-block lyfter taket.`);
      add("vo2max", "Finns grunden redan räcker ett koncentrerat VO₂max-block på 3–4 veckor.");
    } else {
      add("vo2max", `${why} Det är för nära loppet för en hel grundperiod, så ett koncentrerat VO₂max-block passar bättre.`);
    }
  } else if (diagnosis.verdict === "utnyttjande") {
    add(
      "troskel",
      `${diagnosis.label} ligger på ${pctText(diagnosis.pct)} av VO₂max. Motorn räcker men tröskeln ligger långt under taket, så tröskelarbete och lugn volym lyfter den.` +
        (highVlamax
          ? ` VLamax ${sv(vlamax!, 2)} mmol/l/s drar också ned tröskeln.`
          : ""),
    );
    add("grund", "Mer lugn volym flyttar också tröskeln, och sänker VLamax över tid.");
  } else {
    const why = `${diagnosis.label} ligger på ${pctText(diagnosis.pct)} av VO₂max, så motor och utnyttjande är i balans.`;
    if (demand === "kort") {
      add("vo2max", `${why} Loppet avgörs över tröskeln, så VO₂max kommer först.`);
      add("troskel", "Tröskeln bär farten mellan rycken.");
    } else if (demand === "lång" || demand === "mellan") {
      add("troskel", `${why} Loppet går nära eller under tröskeln, så tröskeln kommer först.`);
      add("tak", "Ett lyft av taket ger tröskeln mer att växa mot efteråt.");
    } else {
      add("tak", `${why} Utan ett lopp att rikta mot börjar det med taket, som ger tröskeln mer att växa mot.`);
      add("troskel", "Tröskeln är alternativet om loppet som kommer går länge.");
    }
  }

  // Hög VLamax inför ett långt lopp: tröskel och volym sänker den.
  if (highVlamax && (demand === "lång" || ultra)) {
    add(
      "troskel",
      `VLamax ${sv(vlamax!, 2)} mmol/l/s är hög för ett långt lopp. Tröskelarbete och lugn volym sänker den och lyfter tröskeln.`,
    );
  }
  if (ultra && weeks !== null) {
    add("ultra", `${race!.name} är ett ultralopp. Planen bygger tid på cykeln och energiplanen fram till start.`);
  }
  // Långt kvar, eller inget lopp: grundperioden är tiden för styrka.
  if (weeks === null || weeks > BASE_WEEKS) {
    add("styrka", "Långt till loppet är rätt tid att bygga styrka och kraft på låg kadens, som sedan underhålls.");
  }
  return out.slice(0, 3);
}
