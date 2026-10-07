/**
 * Gap-analysen: hur långt adepten har kvar till sin målnivå, mått för mått,
 * och vad avståndet säger om vad som begränsar.
 *
 * Avståndet räknas som andel av målvärdet, åt det håll som är bättre för
 * måttet. Ett negativt tal är kvar att hämta; ett positivt betyder att
 * adepten redan är över målnivån. För VLamax, som är lägre hos uthålliga
 * elitatleter, räknas målvärdet delat med adeptens värde.
 *
 * Tolkningen är regelbaserad och följer hur en metabol profil brukar läsas:
 * motorn (VO2max), hur mycket av den tröskeln utnyttjar, den glykolytiska
 * kapaciteten (VLamax) och fettförbränningen (FatMax).
 */

import type { Sex } from "./coggan";
import {
  lowerIsHigherLevel,
  METRICS,
  type MetricKey,
  type ReferenceGroup,
} from "./reference-levels";
import type { AdeptValues } from "./values";

export type MetricGap = {
  key: MetricKey;
  label: string;
  /** Måttet mitt i en mening. */
  phrase: string;
  unit: string;
  digits: number;
  value: number;
  target: number;
  /** Adeptens värde som andel av målet, åt det bättre hållet. 1 = på målet. */
  achieved: number;
  /** (achieved − 1) · 100. Negativt = kvar att hämta. */
  gapPct: number;
  lowerIsBetter: boolean;
};

export function gapsToGroup(
  adept: AdeptValues,
  groups: ReferenceGroup[],
  sex: Sex,
  groupId: string,
): MetricGap[] {
  const group = groups.find((g) => g.id === groupId);
  if (!group) return [];
  const gaps: MetricGap[] = [];
  for (const metric of METRICS) {
    const found = adept.values[metric.key];
    const target = group.values[sex][metric.key];
    if (!found || target === undefined || !(target > 0)) continue;
    const lowerIsBetter = lowerIsHigherLevel(groups, sex, metric.key);
    const achieved = lowerIsBetter
      ? target / found.value
      : found.value / target;
    gaps.push({
      key: metric.key,
      label: metric.label,
      phrase: metric.phrase,
      unit: metric.unit,
      digits: metric.digits,
      value: found.value,
      target,
      achieved,
      gapPct: (achieved - 1) * 100,
      lowerIsBetter,
    });
  }
  return gaps.sort((a, b) => a.gapPct - b.gapPct);
}

const pct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(0)} %`;

/** Gapen i text: var avståndet är störst, vad som redan räcker, vad det betyder. */
export function readGaps(gaps: MetricGap[], targetName: string): string[] {
  if (gaps.length === 0) return [];
  const lines: string[] = [];
  const behind = gaps.filter((g) => g.gapPct <= -2);
  const done = gaps.filter((g) => g.gapPct > -2);

  if (behind.length === 0) {
    lines.push(
      `Adepten är redan på eller över nivån ${targetName} i alla mått som är testade. Dags att sikta högre – eller att låta tävlingarna bli måttet.`,
    );
  } else {
    const worst = behind.slice(0, 2);
    lines.push(
      `Längst kvar till ${targetName}: ${worst
        .map((g) => `${g.phrase} (${pct(g.gapPct)})`)
        .join(" och ")}.${
        done.length > 0
          ? ` Redan på nivån: ${done.map((g) => g.phrase).join(", ")}.`
          : ""
      }`,
    );
  }

  const gap = (key: MetricKey) => gaps.find((g) => g.key === key)?.gapPct;
  const vo2 = gap("vo2max");
  const util = gap("lt2Utilisation");
  const vla = gap("vlamax");
  const fat = gap("fatmaxPerKg");
  const sprint = gap("sprintPerKg");
  const threshold = gap("lt2PerKg") ?? gap("cpPerKg");

  if (vo2 !== undefined && vo2 <= -5 && (util === undefined || util >= -2)) {
    lines.push(
      "Motorn begränsar: tröskeln utnyttjar redan en stor del av syreupptaget, så det som lyfter den vidare är VO2max – intervaller på 3–8 minuter och mängd.",
    );
  } else if (
    util !== undefined &&
    util <= -4 &&
    (vo2 === undefined || vo2 >= -3)
  ) {
    lines.push(
      "Tröskeln ligger lågt i förhållande till motorn: syreupptaget räcker, men en för liten del av det används vid tröskeln. Tröskel- och sweet spot-arbete och mängd i lugn intensitet brukar flytta den.",
    );
  }
  if (vla !== undefined && vla <= -10) {
    lines.push(
      "VLamax är hög för målnivån. En hög glykolytisk kapacitet drar ned tröskeln och fettförbränningen; lång lugn distans och tröskelarbete sänker den, korta och glykolytiska pass håller den uppe.",
    );
  }
  if (fat !== undefined && fat <= -10) {
    lines.push(
      "FatMax ligger efter: bränsleekonomin på långa lopp. Mängd i låg intensitet, långa pass och kosten runt dem är det som flyttar den.",
    );
  }
  if (
    sprint !== undefined &&
    sprint <= -10 &&
    (threshold === undefined || threshold >= -5)
  ) {
    lines.push(
      "Sprintkraften ligger efter medan tröskeln håller: korta maximala spurter och styrka, om loppen avgörs i en spurt.",
    );
  }
  return lines;
}
