/**
 * Underlaget för AI-sammanfattningen av ett pass, som text.
 *
 * Analysen vid uppladdningen säger vad passet *var*: effekt, puls, zoner,
 * bästa insatser mot testet. Sammanfattningen ska säga vad det *betyder*, och
 * det kräver sammanhanget runt passet: vad som var planerat den dagen, var i
 * säsongen adepten är, hur veckan ser ut, hur passet står sig mot de senaste
 * av samma slag och hur adepten mådde. Allt det samlas här, i tal, så att
 * modellen svarar på det som mätts och inte på det den gissar.
 *
 * Inget namn följer med. Modulen är ren, utan anrop.
 */

import { formatClock, paceOf, type Reference, type Summary } from "./analysis";
import { loadReading, type LoadTrend } from "./load";
import {
  bestCurve,
  spanLabel,
  type CurveKind,
  type ProfileSource,
} from "./profile";

export type BriefActivity = {
  id: string;
  name: string;
  sport: string;
  performed_on: string;
  is_race: boolean;
  note: string | null;
  summary: Summary;
  reference: Reference | null;
  laps: unknown[] | null;
};

/** Ett tidigare pass av samma slag, som jämförelse. */
export type BriefEarlier = {
  performed_on: string;
  name: string;
  seconds: number;
  distance_m: number | null;
  normalized_power: number | null;
  intensity_factor: number | null;
  avg_speed: number | null;
  avg_hr: number | null;
  decoupling: number | null;
};

export type BriefInput = {
  activity: BriefActivity;
  /** Strain i W′ (D′), med uppskattningen för äldre pass. */
  strain: { value: number; estimated: boolean } | null;
  race: { name: string; priority: string } | null;
  /** Det som låg i kalendern samma dag. */
  planned: {
    title: string;
    sport: string;
    duration: string | null;
    summary: string | null;
  }[];
  checkin: {
    session_rpe: number | null;
    duration_minutes: number | null;
    sleep: number | null;
    fatigue: number | null;
    soreness: number | null;
    stress: number | null;
    note: string | null;
  } | null;
  block: { phase: string; name: string | null; focus: string | null } | null;
  nextRace: { name: string; race_date: string; priority: string } | null;
  /** Veckan fram till och med passet mot månaden före. */
  trend: LoadTrend | null;
  /** Tidigare pass i samma gren, nyast först. */
  earlier: BriefEarlier[];
  /** Samma gren de 90 dagarna före passet, för nya bästa. */
  before90: ProfileSource[];
};

type Lap = {
  seconds: number;
  distanceM: number | null;
  power: number | null;
  hr: number | null;
};

const sv = (v: number, digits = 0) => v.toFixed(digits).replace(".", ",");
const kindOf = (sport: string): CurveKind | null =>
  sport === "cykling" ? "power" : sport === "löpning" ? "speed" : null;

/** Intensitet eller tempo, i grenens enhet. */
function effort(
  sport: string,
  p: { power: number | null; speedKmh: number | null },
): string | null {
  if (sport === "cykling" && p.power !== null) return `${sv(p.power)} W`;
  if (p.speedKmh !== null && p.speedKmh > 0)
    return sport === "löpning"
      ? `${paceOf(p.speedKmh / 3.6)} /km`
      : `${sv(p.speedKmh, 1)} km/h`;
  return null;
}

function referenceLine(sport: string, ref: Reference | null): string {
  if (!ref) return "Inga testvärden fanns när passet lästes in.";
  const parts: string[] = [];
  if (sport === "cykling") {
    if (ref.cp) parts.push(`CP ${sv(ref.cp)} W`);
    if (ref.wPrime) parts.push(`W′ ${sv(ref.wPrime / 1000, 1)} kJ`);
    if (ref.ftp) parts.push(`FTP ${sv(ref.ftp)} W`);
  }
  if (sport === "löpning") {
    if (ref.cs) parts.push(`CS ${paceOf(ref.cs)} /km`);
    if (ref.dPrime) parts.push(`D′ ${sv(ref.dPrime)} m`);
  }
  if (ref.lthr) parts.push(`LTHR ${sv(ref.lthr)} slag/min`);
  if (parts.length === 0) return "Inga testvärden fanns när passet lästes in.";
  return `Testvärden som gällde för passet${ref.testedOn ? ` (test ${ref.testedOn})` : ""}: ${parts.join(", ")}.`;
}

/** Bästa i passet mot de 90 dagarna före, på de längder som säger mest. */
function newBests(input: BriefInput): string[] {
  const kind = kindOf(input.activity.sport);
  const own = kind ? input.activity.summary.curve?.[kind] : null;
  if (!kind || !own || own.length === 0) return [];
  const prior = bestCurve(input.before90, kind);
  if (prior.length === 0) return [];
  const spans = kind === "power" ? [60, 300, 1200, 3600] : [300, 1200, 3600];
  const lines: string[] = [];
  for (const span of spans) {
    const mine = own.find(([s]) => s === span)?.[1];
    const best = prior.find((p) => p.span === span);
    if (!mine || !best) continue;
    const diff = ((mine - best.value) / best.value) * 100;
    const show = (v: number) =>
      kind === "power" ? `${sv(v)} W` : `${paceOf(v)} /km`;
    lines.push(
      `${spanLabel(span)}: ${show(mine)} mot bästa ${show(best.value)} de 90 dagarna före (${diff >= 0 ? "+" : "−"}${sv(Math.abs(diff), 1)} %${diff >= 0 ? ", nytt bästa" : ""}).`,
    );
  }
  return lines;
}

/** Passets durability på några nivåer, för 5 och 20 minuter. */
function durabilityLines(a: BriefActivity): string[] {
  const d = a.summary.durability;
  if (!d) return [];
  const steps =
    d.axis === "kJ" ? [0, 1000, 2000, 3000, 4000] : [0, 60, 120, 180];
  const show = (v: number) =>
    d.axis === "kJ" ? `${sv(v)} W` : `${paceOf(v)} /km`;
  const out: string[] = [];
  for (const span of [300, 1200]) {
    const parts = steps
      .map((after) => {
        const v = d.points.find((p) => p[0] === after && p[1] === span)?.[2];
        return v
          ? `${after} ${d.axis === "kJ" ? "kJ" : "min"}: ${show(v)}`
          : null;
      })
      .filter(Boolean);
    if (parts.length >= 2) out.push(`${spanLabel(span)}: ${parts.join(", ")}`);
  }
  return out;
}

export function sessionBrief(input: BriefInput): string {
  const { activity: a, strain } = input;
  const s = a.summary;
  const lines: string[] = [];

  lines.push(
    `Passet: ${a.sport}, ${a.performed_on}, "${a.name}"${input.race ? ` – tävling: ${input.race.name} (${input.race.priority}-lopp)` : a.is_race ? " – oplanerad tävling" : ""}.`,
  );
  lines.push(referenceLine(a.sport, a.reference));

  const facts: string[] = [`tid ${formatClock(s.elapsedS)}`];
  if (s.movingS < s.elapsedS - 30)
    facts.push(`i rörelse ${formatClock(s.movingS)}`);
  if (s.distanceM !== null) facts.push(`${sv(s.distanceM / 1000, 1)} km`);
  if (s.ascentM) facts.push(`${sv(s.ascentM)} höjdmeter`);
  if (s.avgPower !== null) facts.push(`snitteffekt ${sv(s.avgPower)} W`);
  if (s.normalizedPower !== null) facts.push(`NP ${sv(s.normalizedPower)} W`);
  if (s.variabilityIndex !== null)
    facts.push(`VI ${sv(s.variabilityIndex, 2)}`);
  if (s.intensityFactor !== null) facts.push(`IF ${sv(s.intensityFactor, 2)}`);
  if (s.tss !== null) facts.push(`TSS ${sv(s.tss)}`);
  if (s.avgSpeed !== null && a.sport === "löpning")
    facts.push(`tempo ${paceOf(s.avgSpeed / 3.6)} /km`);
  if (s.avgHr !== null) facts.push(`snittpuls ${sv(s.avgHr)}`);
  if (s.maxHr !== null) facts.push(`maxpuls ${sv(s.maxHr)}`);
  if (s.workKj !== null) facts.push(`arbete ${sv(s.workKj)} kJ`);
  if (s.decouplingPct !== null)
    facts.push(`frikoppling ${sv(s.decouplingPct, 1)} %`);
  if (s.halvesPct !== null)
    facts.push(`andra halvan mot första ${sv(s.halvesPct, 1)} %`);
  if (strain)
    facts.push(
      `strain ${sv(strain.value, 2)} ${a.sport === "löpning" ? "D′" : "W′"}${strain.estimated ? " (uppskattad ur nedsamplad serie, troligen något låg)" : ""}`,
    );
  if (s.aboveCriticalS !== null && s.aboveCriticalS > 0)
    facts.push(`tid över CP/CS ${formatClock(s.aboveCriticalS)}`);
  if (s.balanceMin)
    facts.push(
      `lägsta W′bal ${sv(s.balanceMin.fraction * 100)} % efter ${formatClock(s.balanceMin.at)}`,
    );
  lines.push(`Nyckeltal: ${facts.join(", ")}.`);

  const zones = (label: string, z: { zone: string; seconds: number }[]) => {
    const total = z.reduce((sum, x) => sum + x.seconds, 0) || 1;
    return `${label}: ${z
      .filter((x) => x.seconds > 0)
      .map((x) => `${x.zone} ${sv((x.seconds / total) * 100)} %`)
      .join(", ")}.`;
  };
  if (s.powerZones) lines.push(zones("Tid i effektzon", s.powerZones));
  if (s.hrZones) lines.push(zones("Tid i pulszon", s.hrZones));

  if (s.best.length > 0) {
    lines.push("Bästa insatser mot testets modell:");
    for (const b of s.best) {
      const value =
        a.sport === "löpning" ? formatClock(b.value) : `${sv(b.value)} W`;
      const model =
        b.model === null
          ? ""
          : a.sport === "löpning"
            ? ` (modellen ${formatClock(b.model)})`
            : ` (modellen ${sv(b.model)} W)`;
      lines.push(`- ${b.label}: ${value}${model}`);
    }
  }

  const laps = ((a.laps ?? []) as Lap[]).filter((l) => l.seconds > 0);
  if (laps.length >= 2 && laps.length <= 40) {
    lines.push("Varv ur klockan:");
    laps.forEach((l, i) => {
      const speed =
        l.distanceM && l.seconds > 0 ? (l.distanceM / l.seconds) * 3.6 : null;
      const what = effort(a.sport, { power: l.power, speedKmh: speed });
      lines.push(
        `- ${i + 1}: ${formatClock(l.seconds)}${what ? `, ${what}` : ""}${l.hr ? `, puls ${sv(l.hr)}` : ""}`,
      );
    });
  }

  if (s.insights.length > 0) {
    lines.push("Appens regelbaserade analys av passet:");
    for (const line of s.insights) lines.push(`- ${line}`);
  }
  if (a.note) lines.push(`Anteckning på passet: ${a.note}`);

  lines.push("");
  if (input.planned.length > 0) {
    lines.push("Planerat samma dag:");
    for (const p of input.planned) {
      lines.push(
        `- ${p.title} (${p.sport}${p.duration ? `, ${p.duration}` : ""})${p.summary ? `: ${p.summary}` : ""}`,
      );
    }
  } else {
    lines.push("Inget pass låg i kalendern den dagen.");
  }

  if (input.checkin) {
    const c = input.checkin;
    const parts = [
      c.session_rpe !== null ? `sessions-RPE ${c.session_rpe}` : null,
      c.duration_minutes !== null ? `${c.duration_minutes} min` : null,
      c.sleep !== null ? `sömn ${c.sleep}` : null,
      c.fatigue !== null ? `trötthet ${c.fatigue}` : null,
      c.soreness !== null ? `ömhet ${c.soreness}` : null,
      c.stress !== null ? `stress ${c.stress}` : null,
    ].filter(Boolean);
    lines.push(
      `Incheckningen samma dag (1–5 där 5 är bäst; RPE 0–10): ${parts.join(", ") || "tom"}.${c.note ? ` Anteckning: ${c.note}` : ""}`,
    );
  } else {
    lines.push("Ingen incheckning samma dag.");
  }

  lines.push(
    input.block
      ? `Säsongsplanen: ${input.block.phase}${input.block.name ? ` ("${input.block.name}")` : ""}${input.block.focus ? `, fokus: ${input.block.focus}` : ""}.`
      : "Ingen period i säsongsplanen den dagen.",
  );
  if (input.nextRace) {
    lines.push(
      `Nästa tävling: ${input.nextRace.name}, ${input.nextRace.race_date} (${input.nextRace.priority}-lopp).`,
    );
  }

  if (input.trend) {
    const reading = loadReading(input.trend);
    if (reading.length > 0) {
      lines.push("Belastningen de sju dagarna till och med passet:");
      for (const line of reading) lines.push(`- ${line}`);
    }
  }

  const durable = durabilityLines(a);
  if (durable.length > 0) {
    lines.push(
      a.summary.durability?.axis === "min"
        ? "Bästa insats som börjar efter så många minuter i rörelse (durability):"
        : "Bästa insats som börjar efter så mycket utfört arbete (durability):",
    );
    for (const line of durable) lines.push(`- ${line}`);
  }

  const bests = newBests(input);
  if (bests.length > 0) {
    lines.push("Passet mot de 90 dagarna före:");
    for (const line of bests) lines.push(`- ${line}`);
  }

  if (input.earlier.length > 0) {
    lines.push("De senaste passen i samma gren före det här:");
    for (const e of input.earlier) {
      const speed = e.avg_speed;
      const parts = [
        formatClock(e.seconds),
        e.distance_m !== null ? `${sv(e.distance_m / 1000, 1)} km` : null,
        e.normalized_power !== null ? `NP ${sv(e.normalized_power)} W` : null,
        e.intensity_factor !== null ? `IF ${sv(e.intensity_factor, 2)}` : null,
        a.sport === "löpning" && speed ? `${paceOf(speed / 3.6)} /km` : null,
        e.avg_hr !== null ? `puls ${sv(e.avg_hr)}` : null,
        e.decoupling !== null ? `frikoppling ${sv(e.decoupling, 1)} %` : null,
      ].filter(Boolean);
      lines.push(`- ${e.performed_on} "${e.name}": ${parts.join(", ")}`);
    }
  }

  return lines.join("\n");
}
