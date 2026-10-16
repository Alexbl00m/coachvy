/**
 * Laktattest ur PDF-rapportens textlager, för de format vi känner igen.
 *
 * Hos Aktivitus finns stegen bara som etiketter i ett diagram. Att låta en
 * modell läsa diagrammet som bild ger fel som är svåra att se: ett laktat
 * på fel steg, en puls från mitten av steget. Men etiketterna ligger kvar
 * som text i PDF:en, i en fast ordning – RPE per steg, laktatet (vilan
 * först), pulsen per minut och sist effekt- eller fartaxeln – och protokollet
 * står på första sidan. Ur det går testet att läsa exakt.
 *
 * Ergonizer (Going Long m.fl.), 30K:s testprotokoll och laktatkurvan med
 * föregående test bredvid har riktiga tabeller och läses på samma sätt.
 * Allt annat går vidare till modellen.
 *
 * Modulen är ren: den får sidornas text och lämnar en avläsning, så att
 * varje format går att pröva mot riktiga rapporter utan nätverk.
 */

import type { ReportReading, ReportStep } from "./report-read";

export type TextReading = { format: string; reading: ReportReading };

/** "78,5" och "78.5" som tal. */
const num = (s: string | undefined | null): number | null => {
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const match = (text: string, re: RegExp) => num(text.match(re)?.[1]);

const isDate = (s: string | undefined) =>
  !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

const plausibleHr = (v: number | null) =>
  v !== null && v >= 30 && v <= 240 ? v : null;

// ---------------------------------------------------------------------------
// Aktivitus
// ---------------------------------------------------------------------------

/**
 * Aktivitus testrapport. Sidan med diagrammet har talen i den här ordningen
 * före tidsaxeln: RPE per steg, laktaten (vilan först), ibland kadensen,
 * pulsen en gång i minuten (vilan först), och sist belastningsaxeln från
 * startvärdet i protokollets steg.
 */
function aktivitus(pages: string[]): TextReading | null {
  const all = pages.join("\n");
  if (!/aktivitus/i.test(all) || !/Laktattest (cykel|löpning)/.test(all)) {
    return null;
  }
  const cycling = /Laktattest cykel/.test(all);
  const unit = cycling ? "W" : "km/h";
  const start = cycling
    ? match(all, /Starteffekt:\s*([\d,.]+)\s*W/)
    : match(all, /Starthastighet:\s*([\d,.]+)\s*km\/h/);
  const step = cycling
    ? match(all, /Effektökning:\s*([\d,.]+)\s*W/)
    : match(all, /Hastighetsökning:\s*([\d,.]+)\s*km\/h/);
  const interval = all.match(/Intervalltid:\s*(\d+):(\d{2})/);
  if (start === null || step === null || !interval) return null;
  const seconds = Number(interval[1]) * 60 + Number(interval[2]);
  const minutes = Math.round(seconds / 60);

  const chart = pages.find((p) => /Laktattest (cykel|löpning)/.test(p)) ?? "";
  // Talen mellan trösklarnas rubrikrader och tidsaxeln.
  const from = chart.search(/Lågintensiv träningszon:[^\n]*\n/);
  const to = chart.indexOf("00:00");
  if (from < 0 || to < 0) return null;
  const body = chart
    .slice(from, to)
    .replace(/^Lågintensiv träningszon:[^\n]*\n/, "");
  const tokens = body.match(/\d+(?:\.\d+)?/g) ?? [];

  const firstDecimal = tokens.findIndex((t) => t.includes("."));
  let lastDecimal = -1;
  tokens.forEach((t, i) => {
    if (t.includes(".")) lastDecimal = i;
  });
  if (firstDecimal < 0) return null;
  const rpe = tokens.slice(0, firstDecimal).map(Number);
  const lactates = tokens.slice(firstDecimal, lastDecimal + 1).map(Number);

  // Belastningsaxeln: start, start + steg, … så länge talen följer.
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
  let axisAt = -1;
  let count = 0;
  for (let i = lastDecimal + 1; i < tokens.length; i += 1) {
    let n = 0;
    while (
      i + n < tokens.length &&
      near(Number(tokens[i + n]), start + n * step)
    ) {
      n += 1;
    }
    if (n >= 2) {
      axisAt = i;
      count = n;
      break;
    }
  }
  if (axisAt < 0) return null;

  const warnings: string[] = [];
  // Laktaten: ett per steg, oftast med vilan först.
  let restLactate: number | null = null;
  let stepLactates = lactates;
  if (lactates.length === count + 1) {
    restLactate = lactates[0];
    stepLactates = lactates.slice(1);
  } else if (lactates.length !== count) {
    warnings.push(
      `Rapporten har ${lactates.length} laktatvärden till ${count} steg – kontrollera att varje värde hamnat på rätt steg.`,
    );
    if (lactates.length > count) {
      restLactate = lactates[0];
      stepLactates = lactates.slice(lactates.length - count);
    }
  }

  // Pulsen: en gång i minuten med vilan först. Står kadensen före, ligger
  // pulsen sist i blocket.
  const block = tokens.slice(lastDecimal + 1, axisAt).map(Number);
  let restHr: number | null = null;
  let stepHr: (number | null)[] = Array(count).fill(null);
  const full = 1 + count * minutes;
  if (minutes > 0 && block.length >= full) {
    const hr = block.slice(block.length - full);
    restHr = plausibleHr(hr[0]);
    stepHr = Array.from({ length: count }, (_, k) =>
      plausibleHr(hr[(k + 1) * minutes]),
    );
  } else if (minutes > 0 && block.length >= count * minutes) {
    const hr = block.slice(block.length - count * minutes);
    stepHr = Array.from({ length: count }, (_, k) =>
      plausibleHr(hr[(k + 1) * minutes - 1]),
    );
  } else if (block.length > 0) {
    warnings.push(
      "Pulsen i rapporten gick inte att para ihop med stegen – fyll i den för hand.",
    );
  }

  const steps: ReportStep[] = Array.from({ length: count }, (_, k) => ({
    intensity: Math.round((start + k * step) * 100) / 100,
    durationSeconds: seconds,
    lactate: stepLactates[k] ?? null,
    heartRate: stepHr[k] ?? null,
    rpe: rpe.length === count && rpe[k] >= 6 && rpe[k] <= 20 ? rpe[k] : null,
  }));

  const date = all.match(/Testrapport\s+(\d{4}-\d{2}-\d{2})/)?.[1];
  const at = cycling
    ? match(all, /Anaerob tröskel[^\n]*\n\s*Effekt:\s*([\d,.]+)\s*W/)
    : match(all, /Anaerob tröskel[^\n]*\n\s*Hastighet:\s*([\d,.]+)\s*km\/h/);
  const lt = cycling
    ? match(all, /Aerob Tröskel[^\n]*\n\s*Effekt:\s*([\d,.]+)\s*W/)
    : match(all, /Aerob Tröskel[^\n]*\n\s*Hastighet:\s*([\d,.]+)\s*km\/h/);
  const pulses = [...all.matchAll(/Tröskelpuls:\s*(\d+)/g)].map((m) =>
    Number(m[1]),
  );
  const maxHr = match(all, /Högsta puls på test:\s*(\d+)/);
  const vo2max = match(all, /Testvärde:\s*([\d,.]+)\s*ml/);
  const exhaustion = cycling
    ? match(all, /Utmattning:[\s\S]{0,60}?Effekt:\s*([\d,.]+)\s*W/)
    : match(all, /Utmattning:[\s\S]{0,60}?Hastighet:\s*([\d,.]+)\s*km\/h/);
  // VO₂max-testet efteråt är en ramp till utmattning. Wmax ur den räknas
  // som sista hela nivån plus den del av nästa som hanns (Kuipers m.fl.).
  const ramp = cycling
    ? all.match(
        /Starteffekt:\s*(\d+)\s*W\s*\n?\s*Effektökning:\s*(\d+)\s*W\/min[\s\S]{0,40}?Utmattning:\s*\n?\s*Tid:\s*(\d+):(\d{2})/,
      )
    : null;
  const wmax = ramp
    ? Math.round(
        Number(ramp[1]) +
          Math.floor(Number(ramp[3])) * Number(ramp[2]) +
          (Number(ramp[4]) / 60) * Number(ramp[2]),
      )
    : null;
  const sv = (v: number) => String(v).replace(".", ",");
  const labValues = [
    at !== null &&
      `AT ${sv(at)} ${unit}${pulses[0] ? ` (${pulses[0]} slag/min)` : ""}`,
    lt !== null &&
      `LT ${sv(lt)} ${unit}${pulses[1] ? ` (${pulses[1]} slag/min)` : ""}`,
    vo2max !== null &&
      `VO₂max ${sv(vo2max)} ml/kg/min${exhaustion !== null ? ` (ramptest till ${sv(exhaustion)} ${unit})` : ""}`,
  ].filter(Boolean);

  return {
    format: "Aktivitus",
    reading: {
      sport: cycling ? "cykling" : "löpning",
      unit,
      performedOn: isDate(date) ? (date as string) : null,
      weightKg: match(all, /Vikt:\s*([\d,.]+)\s*kg/),
      rest:
        restLactate !== null || restHr !== null
          ? { lactate: restLactate, heartRate: restHr }
          : null,
      steps,
      peak:
        maxHr !== null || vo2max !== null || wmax !== null
          ? { intensity: wmax, heartRate: maxHr, lactate: null, vo2max }
          : null,
      labValues: labValues.length > 0 ? labValues.join(" · ") : null,
      warnings: ramp
        ? [
            ...warnings,
            `Wmax ${wmax} W är räknat ur VO₂max-rampen (${ramp[1]} W + ${ramp[2]} W/min till utmattning efter ${ramp[3]}:${ramp[4]}).`,
          ]
        : warnings,
    },
  };
}

// ---------------------------------------------------------------------------
// Ergonizer (Going Long m.fl.)
// ---------------------------------------------------------------------------

/** En tabellrad i Ergonizer: rubrik och enhet, sedan ett värde per kolumn. */
function ergonizerRow(text: string, label: RegExp): (number | null)[] | null {
  const m = text.match(label);
  if (!m || m.index === undefined) return null;
  const rest = text.slice(m.index + m[0].length).split("\n");
  const out: (number | null)[] = [];
  for (const raw of rest) {
    const line = raw.trim();
    if (line === "(Rest)") {
      out.push(null);
      continue;
    }
    if (!/^-?\d+(?:[.,]\d+)?$/.test(line)) break;
    out.push(num(line));
  }
  return out.length > 0 ? out : null;
}

function ergonizer(pages: string[]): TextReading | null {
  const page =
    pages.find((p) => /Supplemental data/.test(p)) ??
    pages.find((p) => /Ergonizer/.test(p) && /Lactate\s*\nmmol\/L/.test(p));
  if (!page || !/Ergonizer|ergonizer/.test(pages.join("\n"))) return null;
  const all = pages.join("\n");

  const cycling = /Performance\s*\nWatt/.test(page);
  const running = /Running Speed\s*\nkm\/h/.test(page);
  if (!cycling && !running) return null;
  const load = cycling
    ? ergonizerRow(page, /Performance\s*\nWatt\s*\n/)
    : ergonizerRow(page, /Running Speed\s*\nkm\/h\s*\n/);
  const hr = ergonizerRow(page, /Heart rate\s*\nbpm\s*\n/);
  const lactate = ergonizerRow(page, /Lactate\s*\nmmol\/L\s*\n/);
  const rpe = ergonizerRow(page, /RPE\s*\n6 - 20\s*\n/);
  if (!load || !lactate) return null;

  // Första kolumnen är vilan.
  const restIndex = load[0] === null ? 0 : -1;
  const minutes = match(all, /Step duration\s*(\d+)\s*min/);
  const finalHeld = all.match(/final\s+load step was held by\s*(\d+):(\d{2})/);
  const steps: ReportStep[] = [];
  load.forEach((v, i) => {
    if (i === restIndex || v === null) return;
    steps.push({
      intensity: v,
      durationSeconds: minutes !== null ? minutes * 60 : null,
      lactate: lactate[i] ?? null,
      heartRate: plausibleHr(hr?.[i] ?? null),
      rpe: rpe?.[i] ?? null,
    });
  });
  if (steps.length === 0) return null;
  const warnings: string[] = [];
  if (finalHeld) {
    const held = Number(finalHeld[1]) * 60 + Number(finalHeld[2]);
    steps[steps.length - 1].durationSeconds = held;
    warnings.push(
      `Sista steget hölls ${finalHeld[1]}:${finalHeld[2]} min, kortare än de andra.`,
    );
  }

  const date = all.match(
    /(?:ergometry|treadmill\)|Running[^\n]*?) on (\d{4}-\d{2}-\d{2})/,
  )?.[1];
  const lt = cycling
    ? match(all, /\nLT\s*([\d.]+)\s*Watt/)
    : match(all, /Lactate Threshold \(L ?T\)\s*([\d.]+)\s*km\/h/);
  const iat = cycling
    ? match(all, /IAT \([^)]*\)\s*([\d.]+)\s*Watt/)
    : match(all, /IAT \([^)]*\):?\s*([\d.]+)\s*km\/h/);
  const vlamax = match(all, /VLaMax\s*\)\s*([\d.]+)/);
  const unit = cycling ? "W" : "km/h";
  const sv = (v: number) => String(v).replace(".", ",");
  const labValues = [
    lt !== null && `LT ${sv(lt)} ${unit}`,
    iat !== null && `IAT ${sv(iat)} ${unit}`,
    vlamax !== null && `VLamax ${sv(vlamax)} mmol/l/s`,
  ].filter(Boolean);

  return {
    format: "Ergonizer",
    reading: {
      sport: cycling ? "cykling" : "löpning",
      unit,
      performedOn: isDate(date) ? (date as string) : null,
      weightKg: match(all, /Body weight\s*([\d.]+)\s*kg/),
      rest:
        restIndex === 0
          ? {
              lactate: lactate[0] ?? null,
              heartRate: plausibleHr(hr?.[0] ?? null),
            }
          : null,
      steps,
      peak: null,
      labValues: labValues.length > 0 ? labValues.join(" · ") : null,
      warnings,
    },
  };
}

// ---------------------------------------------------------------------------
// 30K:s testprotokoll och laktatkurvan med föregående test
// ---------------------------------------------------------------------------

/** "Belastning (w) Laktat [mmol] Puls [bpm]" med en rad per steg. */
function protocolTable(pages: string[]): TextReading | null {
  const all = pages.join("\n");
  if (!/Belastning \(w\)\s+Laktat/.test(all)) return null;
  const steps: ReportStep[] = [];
  for (const m of all.matchAll(/^(\d{2,3})\s+(\d+(?:,\d+)?)\s+(\d{2,3})\b/gm)) {
    steps.push({
      intensity: Number(m[1]),
      durationSeconds: null,
      lactate: num(m[2]),
      heartRate: plausibleHr(Number(m[3])),
      rpe: null,
    });
  }
  if (steps.length < 3) return null;
  const date = all.match(/Datum\s+(\d{4}-\d{2}-\d{2})/)?.[1];
  const maxHr = match(all, /Maxpuls\s+(\d+)\s*bpm/);
  const vo2 = match(all, /VO2\/kg\s+([\d,]+)\s*ml\/kg/);
  const end = match(all, /Slutwatt\s+(\d+)\s*watt/);
  const threshold = match(all, /Tröskelwatt\s*\(4mmol\)\s*(\d+)/);
  return {
    format: "30K testprotokoll",
    reading: {
      sport: "cykling",
      unit: "W",
      performedOn: isDate(date) ? (date as string) : null,
      weightKg: match(all, /Vikt\s+([\d,]+)/),
      rest: null,
      steps,
      peak:
        maxHr !== null || vo2 !== null || end !== null
          ? { intensity: end, heartRate: maxHr, lactate: null, vo2max: vo2 }
          : null,
      labValues:
        threshold !== null ? `Tröskelwatt (4 mmol) ${threshold} W` : null,
      warnings: ["Stegens längd står inte i protokollet – fyll i den."],
    },
  };
}

/**
 * Laktatkurvan med föregående test bredvid: varje rad är
 * "Watt Laktat Puls Borg" för det aktuella testet, sedan samma för det
 * förra. Bara det aktuella läses.
 */
function lactateCurve(pages: string[]): TextReading | null {
  const all = pages.join("\n");
  if (!/Watt\s+Laktat\s+Puls\s+Borg/.test(all)) return null;
  const steps: ReportStep[] = [];
  for (const m of all.matchAll(
    /^(?:[A-Za-zÅÄÖåäö]+\s+)?(\d{2,3})\s+(\d+(?:,\d+)?)\s+(\d{2,3})\s+(\d{1,2})\b/gm,
  )) {
    steps.push({
      intensity: Number(m[1]),
      durationSeconds: null,
      lactate: num(m[2]),
      heartRate: plausibleHr(Number(m[3])),
      rpe: Number(m[4]) >= 6 && Number(m[4]) <= 20 ? Number(m[4]) : null,
    });
  }
  if (steps.length < 3) return null;
  const date = all.match(/Datum:\s*(\d{4}-\d{2}-\d{2})/)?.[1];
  return {
    format: "Laktatkurva",
    reading: {
      sport: "cykling",
      unit: "W",
      performedOn: isDate(date) ? (date as string) : null,
      weightKg: match(all, /^(\d{2,3}(?:[.,]\d)?)\s*kg$/m),
      rest: null,
      steps,
      peak: null,
      labValues: null,
      warnings: [
        "Stegens längd står inte i rapporten – fyll i den.",
        "Rapporten visar också föregående test; bara det aktuella är inläst.",
      ],
    },
  };
}

const PARSERS = [aktivitus, ergonizer, protocolTable, lactateCurve];

/** Testet ur textlagret, eller null om formatet inte känns igen. */
export function readReportText(pages: string[]): TextReading | null {
  for (const parse of PARSERS) {
    const result = parse(pages);
    if (result && result.reading.steps.length >= 3) return result;
  }
  return null;
}
