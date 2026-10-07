/**
 * Ett pass som FIT-träningsfil – formatet Garmin och de flesta cykeldatorer
 * läser strukturerade pass i.
 *
 * Filen är tre slags meddelanden: `file_id` som säger att det är ett pass,
 * `workout` med namn och gren, och ett `workout_step` per steg. Repetitioner
 * skrivs som i FIT-specifikationen: stegen en gång, följda av ett
 * upprepningssteg som pekar tillbaka på det första och säger hur många varv.
 *
 * Målen skrivs i absoluta tal – watt på cykel, fart i m/s för löpning –
 * räknade mot referensen passet byggdes med. Procent av FTP hade följt med
 * klockans egen FTP-inställning, men det är coachens föreskrift som ska
 * gälla, inte vad som råkar stå i klockan.
 *
 * Simning skrivs inte: bassängpass i FIT kräver banlängd och simsätt per
 * steg, och fartmål stöds inte på de flesta klockor.
 */

import {
  FitBaseType,
  FitEncoder,
  type FitEncoderField,
} from "fit-file-parser/encoder";

import type { Sport } from "@/lib/calculators/lactate";
import {
  resolveStep,
  type StepKind,
  type Workout,
  type WorkoutStep,
} from "../schema";
import { percentText, targetText } from "../target-text";

const MESSAGE = { fileId: 0, workout: 26, workoutStep: 27 } as const;

const FILE_TYPE_WORKOUT = 5;
/** Tillverkarkoden för egenutvecklade filer. */
const MANUFACTURER_DEVELOPMENT = 255;

const FIT_SPORT: Partial<Record<Sport, number>> = {
  löpning: 1,
  cykling: 2,
};

const DURATION_TIME = 0;
const DURATION_DISTANCE = 1;
const DURATION_REPEAT = 6;

const TARGET_SPEED = 0;
const TARGET_OPEN = 2;
const TARGET_POWER = 4;

/** FIT:s intensitet: 0 aktiv, 2 uppvärmning, 3 nedvarvning, 4 återhämtning. */
const INTENSITY: Record<StepKind, number> = {
  uppvärmning: 2,
  intervall: 0,
  vila: 4,
  distans: 0,
  nedvarvning: 3,
};

/** Watt skrivs med 1000 tillagt; 0–1000 betyder procent av klockans FTP. */
const WATT_OFFSET = 1000;
/** Ogiltigt värde för ett uint32-fält: "inte satt". */
const NOT_SET = 0xffffffff;

export function canExportFit(sport: Sport): boolean {
  return FIT_SPORT[sport] !== undefined;
}

const uint8 = (number: number, value: number): FitEncoderField => ({
  number,
  size: 1,
  baseType: FitBaseType.Enum,
  value,
});
const uint16 = (number: number, value: number): FitEncoderField => ({
  number,
  size: 2,
  baseType: FitBaseType.Uint16,
  value,
});
const uint32 = (number: number, value: number): FitEncoderField => ({
  number,
  size: 4,
  baseType: FitBaseType.Uint32,
  value: Math.max(0, Math.round(value)),
});

/** En sträng, avkortad utan att ett tecken klyvs på mitten. */
function text(
  number: number,
  value: string,
  maxBytes: number,
): FitEncoderField {
  const bytes = new TextEncoder().encode(value.trim());
  let end = Math.min(bytes.length, maxBytes);
  // Ett fortsättningsbyte (10xxxxxx) betyder att tecknet började tidigare.
  while (end > 0 && end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
    end -= 1;
  }
  const out = new Uint8Array(end + 1);
  out.set(bytes.subarray(0, end));
  return { number, size: out.length, baseType: FitBaseType.String, value: out };
}

/**
 * Ett mål utan spann får ett. Med samma övre och undre gräns larmar klockan
 * vid varje pedaltramp; ±3 % (minst ±5 W) på cykel och ±2 % i fart är vad
 * man ändå håller ett jämnt intervall inom.
 */
function band(
  low: number,
  high: number,
  sport: Sport,
): { low: number; high: number } {
  const mid = (low + high) / 2;
  // Ett spann som coachen själv satt får stå kvar, hur smalt det än är.
  if (high - low > mid * 0.005) return { low, high };
  const half = sport === "cykling" ? Math.max(mid * 0.03, 5) : mid * 0.02;
  return { low: mid - half, high: mid + half };
}

const KIND_NAME: Record<StepKind, string> = {
  uppvärmning: "Uppvärmning",
  intervall: "Intervall",
  vila: "Vila",
  distans: "Distans",
  nedvarvning: "Nedvarvning",
};

function stepFields(
  index: number,
  step: WorkoutStep,
  workout: Workout,
  reference: number,
): FitEncoderField[] {
  const resolved = resolveStep(step, reference, workout.sport);
  if (!resolved) throw new Error(`Steg ${index + 1} saknar längd.`);

  const fields: FitEncoderField[] = [
    uint16(254, index),
    text(0, step.label || KIND_NAME[step.kind], 32),
  ];

  if (step.durationSeconds !== null && step.durationSeconds > 0) {
    // Tid i millisekunder.
    fields.push(uint8(1, DURATION_TIME), uint32(2, resolved.seconds * 1000));
  } else {
    // Sträcka i centimeter.
    fields.push(
      uint8(1, DURATION_DISTANCE),
      uint32(2, (resolved.metres ?? 0) * 100),
    );
  }

  if (!(resolved.target > 0)) {
    fields.push(
      uint8(3, TARGET_OPEN),
      uint32(4, 0),
      uint32(5, NOT_SET),
      uint32(6, NOT_SET),
    );
  } else if (workout.sport === "cykling") {
    const { low, high } = band(resolved.low, resolved.high, "cykling");
    fields.push(
      uint8(3, TARGET_POWER),
      uint32(4, 0),
      uint32(5, low + WATT_OFFSET),
      uint32(6, high + WATT_OFFSET),
    );
  } else {
    const { low, high } = band(resolved.low, resolved.high, workout.sport);
    // Fart i mm/s.
    fields.push(
      uint8(3, TARGET_SPEED),
      uint32(4, 0),
      uint32(5, low * 1000),
      uint32(6, high * 1000),
    );
  }

  fields.push(
    uint8(7, INTENSITY[step.kind]),
    text(
      8,
      `${targetText(resolved, workout.sport)} · ${percentText(resolved, workout.basis)}`,
      64,
    ),
  );
  return fields;
}

/**
 * Passet som FIT-fil. Kastar för simning och för steg som saknar längd –
 * knappen som anropar den visas bara när passet går att skriva.
 */
export function workoutToFit(
  workout: Workout,
  reference: number,
  now: Date = new Date(),
): Uint8Array {
  const sport = FIT_SPORT[workout.sport];
  if (sport === undefined) {
    throw new Error("Simpass går inte att exportera som FIT.");
  }

  const steps: FitEncoderField[][] = [];
  for (const block of workout.blocks) {
    if (block.type === "steg") {
      steps.push(stepFields(steps.length, block.step, workout, reference));
      continue;
    }
    const first = steps.length;
    for (const step of block.steps) {
      steps.push(stepFields(steps.length, step, workout, reference));
    }
    if (block.times > 1) {
      // Upprepa från det första steget i blocket, så många varv totalt.
      steps.push([
        uint16(254, steps.length),
        uint8(1, DURATION_REPEAT),
        uint32(2, first),
        uint8(3, TARGET_OPEN),
        uint32(4, block.times),
      ]);
    }
  }

  const created = FitEncoder.toFitTimestamp(now);
  // Protokoll 1.0 (0x10): passet använder inget ur 2.0, och äldre enheter
  // läser bara 1.x. Bibliotekets förval, 2, är inget giltigt versionsbyte.
  const encoder = new FitEncoder({ protocolVersion: 0x10 });

  encoder.writeMessage(MESSAGE.fileId, [
    uint8(0, FILE_TYPE_WORKOUT),
    uint16(1, MANUFACTURER_DEVELOPMENT),
    uint16(2, 0),
    {
      number: 3,
      size: 4,
      baseType: FitBaseType.Uint32z,
      // Ett serienummer får inte vara noll.
      value: (created % 0xfffffffe) + 1,
    },
    uint32(4, created),
  ]);

  encoder.writeMessage(MESSAGE.workout, [
    uint8(4, sport),
    uint16(6, steps.length),
    text(8, workout.title || "Pass", 40),
  ]);

  for (const fields of steps) encoder.writeMessage(MESSAGE.workoutStep, fields);

  return encoder.close();
}
