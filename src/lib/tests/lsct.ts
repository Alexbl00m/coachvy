/**
 * LSCT – Lamberts och Lamberts submaximala cykeltest.
 *
 * 6 minuter vid 60 % av maxpuls, 6 vid 80 %, 3 vid 90 % och sedan 90 sekunder
 * sittande utan att trampa (Lamberts m.fl. 2011). Testet tröttar inte och
 * går att köra varje vecka, som uppvärmning eller som ett eget lugnt pass.
 *
 * Det ger fyra signaler (filosofin, avsnitt 21):
 *
 * - **Effekt mot puls** i varje steg. Pulsen hålls på målet, så effekten i
 *   steget är talet att följa. En långsam ökning över veckor är bättre form;
 *   ett plötsligt hopp åt något håll tyder på trötthet.
 * - **Pulsåterhämtning (HRR)**: pulsen i steg 3 minus pulsen efter 60 s vila.
 *   Pulsen i steg 3 styrs mot 90 % och är därför också slutpulsen.
 * - **RPE i steg 2**: en poäng över normen är en varningssignal.
 * - **Tid till 90 % av maxpuls** i steg 3: över en minut, eller aldrig, är en
 *   varningssignal.
 *
 * Signalerna läses tillsammans och mot adeptens egen norm, som kräver tre
 * till fyra veckors baslinje. Testet säger att något har ändrats, inte varför.
 *
 * Raderna i testtabellen: 1–3 är stegen (snitteffekt och snittpuls utan
 * första minuten, tiden till målpulsen, RPE), 4 är vilan (belastning 0,
 * pulsen efter 60 s).
 */

import type { Effort, Metric } from "./analysis";

export const LSCT_STAGES = [
  { pct: 60, seconds: 360 },
  { pct: 80, seconds: 360 },
  { pct: 90, seconds: 180 },
] as const;

/** Längre än så till 90 % av maxpuls i steg 3 är en varningssignal. */
export const LSCT_T90_LIMIT = 60;

export type LsctReading = {
  /** Snitteffekten i steg 1–3, W. */
  watts: (number | null)[];
  /** Snittpulsen i steg 1–3. */
  heartRates: (number | null)[];
  rpe: (number | null)[];
  /** Sekunder till målpulsen i steg 1–3. */
  timeToTarget: (number | null)[];
  /** Pulsen efter 60 s vila. */
  recoveryHeartRate: number | null;
  /** Pulsåterhämtningen, slag. */
  hrr: number | null;
};

const positive = (value: number | null | undefined) =>
  value !== null && value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : null;

/**
 * Testets fyra rader som signaler. Raden läses ur sin plats i tabellen, så
 * att ett tomt steg inte flyttar upp vilan.
 */
export function readLsct(efforts: Effort[]): LsctReading {
  const at = (ordinal: number) =>
    efforts.find((e) => e.ordinal === ordinal) ?? null;
  const stages = [at(0), at(1), at(2)];
  const rest = at(3);
  const hr3 = positive(stages[2]?.heartRate);
  const recovery = positive(rest?.heartRate);
  return {
    watts: [0, 1, 2].map((i) => positive(stages[i]?.intensity)),
    heartRates: [0, 1, 2].map((i) => positive(stages[i]?.heartRate)),
    rpe: [0, 1, 2].map((i) => positive(stages[i]?.rpe)),
    timeToTarget: [0, 1, 2].map((i) => positive(stages[i]?.durationSeconds)),
    recoveryHeartRate: recovery,
    hrr: hr3 !== null && recovery !== null ? hr3 - recovery : null,
  };
}

/** Värdena testtillfället sparar. Nycklarna läses av normen nedan. */
export function lsctMetrics(efforts: Effort[]): {
  metrics: Metric[];
  warnings: string[];
} {
  const r = readLsct(efforts);
  const metrics: Metric[] = [];
  const warnings: string[] = [];
  const push = (
    key: string,
    label: string,
    value: number | null,
    unit: string,
    isPrimary = false,
  ) => {
    if (value === null) return;
    metrics.push({ key, label, value, unit, method: "LSCT", isPrimary });
  };

  r.watts.forEach((w, i) =>
    push(
      `LSCT_W${i + 1}`,
      `Effekt steg ${i + 1} (${LSCT_STAGES[i].pct} %)`,
      w,
      "W",
      i === 2,
    ),
  );
  const w3 = r.watts[2];
  const hr3 = r.heartRates[2];
  push(
    "LSCT_W_per_HR3",
    "Effekt per pulsslag, steg 3",
    w3 !== null && hr3 !== null ? w3 / hr3 : null,
    "W/slag",
  );
  push("LSCT_HRR", "Pulsåterhämtning, 60 s", r.hrr, "slag", true);
  push("LSCT_RPE2", "RPE steg 2", r.rpe[1], "");
  push("LSCT_T90", "Tid till 90 % av maxpuls", r.timeToTarget[2], "s");

  if (w3 === null) {
    warnings.push(
      "Steg 3 saknar effekt – effekten i steg 3 är testets huvudtal.",
    );
  }
  if (r.hrr === null) {
    warnings.push(
      "Pulsåterhämtningen kräver pulsen i steg 3 och pulsen efter 60 s vila på rad 4.",
    );
  }
  const t90 = r.timeToTarget[2];
  if (t90 !== null && t90 > LSCT_T90_LIMIT) {
    warnings.push(
      `${Math.round(t90)} s till 90 % av maxpuls i steg 3 – över en minut är en varningssignal för trötthet.`,
    );
  }
  return { metrics, warnings };
}

// ---------------------------------------------------------------------------
// Mot normen
// ---------------------------------------------------------------------------

/** Ett tidigare LSCT, som de sparade värdena. */
export type LsctResult = {
  sessionId: string;
  performedOn: string;
  values: Partial<Record<LsctKey, number>>;
};

export type LsctKey =
  | "LSCT_W1"
  | "LSCT_W2"
  | "LSCT_W3"
  | "LSCT_HRR"
  | "LSCT_RPE2"
  | "LSCT_T90";

/** Så många tidigare test behövs innan en norm går att säga något om. */
export const LSCT_MIN_BASELINE = 3;
/** Normen räknas på så här många av de senaste testen. */
export const LSCT_BASELINE_SIZE = 6;

export type LsctSignal = {
  key: "effekt" | "hrr" | "rpe" | "t90";
  label: string;
  /** Värdet nu och normen, i signalens enhet. */
  value: number;
  norm: number | null;
  /** Ändringen mot normen i ord: "+12 W (+5 %)". */
  change: string | null;
  /** warn: en varningssignal; up: en förbättring utöver det vanliga. */
  state: "normal" | "warn" | "up";
  text: string;
};

export type LsctAssessment = {
  /** Antal tidigare test normen bygger på. */
  baseline: number;
  signals: LsctSignal[];
  warnings: number;
  verdict: "baslinje" | "normal" | "bevaka" | "vila";
  summary: string;
};

const mean = (values: number[]) =>
  values.reduce((a, b) => a + b, 0) / values.length;
const sd = (values: number[]) => {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(
    values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1),
  );
};
const signed = (value: number, digits = 0) =>
  `${value > 0 ? "+" : value < 0 ? "−" : "±"}${Math.abs(value).toFixed(digits).replace(".", ",")}`;

/**
 * Ett nytt LSCT mot adeptens norm: medelvärdet av de senaste testen före.
 *
 * "Plötslig ändring" är en ändring större än två standardavvikelser i
 * baslinjen, men aldrig mindre än ett golv – 4 % i effekt och 4 slag i
 * återhämtning – så att en ovanligt stabil baslinje inte larmar på brus.
 * RPE och tiden till 90 % följer testets egna gränser: en poäng över normen
 * i steg 2, och över en minut.
 *
 * Effekten i steg 3 är en varning åt båda hållen: mer effekt för samma puls
 * kan vara bättre form, men ett hopp på en vecka är oftare en dämpad puls
 * av trötthet. Är de andra signalerna normala räknas den som en förbättring.
 */
export function assessLsct(
  current: LsctResult,
  history: LsctResult[],
): LsctAssessment {
  const before = history
    .filter(
      (h) =>
        h.sessionId !== current.sessionId &&
        h.performedOn <= current.performedOn,
    )
    .sort((a, b) => b.performedOn.localeCompare(a.performedOn))
    .slice(0, LSCT_BASELINE_SIZE);

  const series = (key: LsctKey) =>
    before
      .map((h) => h.values[key])
      .filter((v): v is number => v !== undefined && Number.isFinite(v));

  const signals: LsctSignal[] = [];
  const enough = before.length >= LSCT_MIN_BASELINE;

  const w3 = current.values.LSCT_W3;
  if (w3 !== undefined) {
    const past = series("LSCT_W3");
    const norm = past.length >= LSCT_MIN_BASELINE ? mean(past) : null;
    let state: LsctSignal["state"] = "normal";
    let change: string | null = null;
    if (norm !== null) {
      const delta = w3 - norm;
      const limit = Math.max(2 * sd(past), norm * 0.04);
      change = `${signed(delta)} W (${signed((delta / norm) * 100)} %)`;
      if (Math.abs(delta) > limit) state = "warn";
    }
    signals.push({
      key: "effekt",
      label: "Effekt i steg 3",
      value: w3,
      norm,
      change,
      state,
      text:
        state === "warn"
          ? "Ett plötsligt hopp i effekt för samma puls – trötthet om de andra signalerna också avviker, annars troligen bättre form."
          : "Inom normen.",
    });
  }

  const hrr = current.values.LSCT_HRR;
  if (hrr !== undefined) {
    const past = series("LSCT_HRR");
    const norm = past.length >= LSCT_MIN_BASELINE ? mean(past) : null;
    let state: LsctSignal["state"] = "normal";
    let change: string | null = null;
    if (norm !== null) {
      const delta = hrr - norm;
      const limit = Math.max(2 * sd(past), 4);
      change = `${signed(delta)} slag`;
      if (Math.abs(delta) > limit) state = "warn";
    }
    signals.push({
      key: "hrr",
      label: "Pulsåterhämtning",
      value: hrr,
      norm,
      change,
      state,
      text:
        state === "warn"
          ? "Återhämtningen avviker tydligt från normen – en vanlig tidig signal på trötthet, åt båda hållen."
          : "Inom normen.",
    });
  }

  const rpe = current.values.LSCT_RPE2;
  if (rpe !== undefined) {
    const past = series("LSCT_RPE2");
    const norm = past.length >= LSCT_MIN_BASELINE ? mean(past) : null;
    const state: LsctSignal["state"] =
      norm !== null && rpe >= norm + 1 ? "warn" : "normal";
    signals.push({
      key: "rpe",
      label: "RPE i steg 2",
      value: rpe,
      norm,
      change: norm !== null ? signed(rpe - norm, 1) : null,
      state,
      text:
        state === "warn"
          ? "Steg 2 känns minst en poäng tyngre än vanligt – hoppa över hård träning tills det är tillbaka."
          : "Inom normen.",
    });
  }

  const t90 = current.values.LSCT_T90;
  if (t90 !== undefined) {
    const state: LsctSignal["state"] = t90 > LSCT_T90_LIMIT ? "warn" : "normal";
    const past = series("LSCT_T90");
    signals.push({
      key: "t90",
      label: "Tid till 90 % av maxpuls",
      value: t90,
      norm: past.length >= LSCT_MIN_BASELINE ? mean(past) : null,
      change: null,
      state,
      text:
        state === "warn"
          ? "Över en minut till 90 % – pulsen svarar trögt, en signal på trötthet."
          : "Under en minut.",
    });
  }

  const warnings = signals.filter((s) => s.state === "warn").length;

  // En ensam effektökning med i övrigt normala signaler är bättre form.
  const power = signals.find((s) => s.key === "effekt");
  if (
    power &&
    power.state === "warn" &&
    warnings === 1 &&
    power.norm !== null &&
    power.value > power.norm
  ) {
    power.state = "up";
    power.text =
      "Mer effekt för samma puls och i övrigt normala signaler – det ser ut som bättre form.";
  }
  const flagged = signals.filter((s) => s.state === "warn").length;

  if (!enough) {
    return {
      baseline: before.length,
      signals,
      warnings: flagged,
      verdict: "baslinje",
      summary: `Baslinje: ${before.length} av ${LSCT_MIN_BASELINE} tidigare test. Normen räknas när det finns tre, helst fyra veckor bakåt.`,
    };
  }
  if (flagged >= 2) {
    return {
      baseline: before.length,
      signals,
      warnings: flagged,
      verdict: "vila",
      summary:
        "Flera varningssignaler samtidigt. Ett lugnt pass eller en vilodag före nästa kvalitetspass – och se över sömn, stress och kost, inte bara träningen.",
    };
  }
  if (flagged === 1) {
    return {
      baseline: before.length,
      signals,
      warnings: flagged,
      verdict: "bevaka",
      summary:
        "En signal avviker, de andra är normala. Planen kan oftast följas – håll ett öga på nästa test.",
    };
  }
  return {
    baseline: before.length,
    signals,
    warnings: 0,
    verdict: "normal",
    summary: "Alla signaler inom normen. Planen kan följas.",
  };
}

/** Sparade värden ur ett testtillfälle, till normens form. */
export function lsctResult(session: {
  id: string;
  performed_on: string;
  test_metrics: { key: string; value: number | string }[];
}): LsctResult {
  const values: LsctResult["values"] = {};
  for (const m of session.test_metrics) {
    if (
      m.key === "LSCT_W1" ||
      m.key === "LSCT_W2" ||
      m.key === "LSCT_W3" ||
      m.key === "LSCT_HRR" ||
      m.key === "LSCT_RPE2" ||
      m.key === "LSCT_T90"
    ) {
      values[m.key] = Number(m.value);
    }
  }
  return { sessionId: session.id, performedOn: session.performed_on, values };
}
