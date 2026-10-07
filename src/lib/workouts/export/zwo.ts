/**
 * Ett cykelpass som .zwo – Zwifts format, som flera andra appar också läser.
 *
 * Formatet anger effekt som andel av FTP. Passets mål är andelar av sin
 * referens, och den är inte alltid FTP: ett pass byggt mot CP 300 W skrivs
 * med samma procent, och beskrivningen säger att FTP i appen ska stå på
 * 300 W för att watten ska bli desamma.
 *
 * Ett varvat block med exakt två steg blir `IntervalsT`, som appen visar som
 * intervaller; andra block skrivs ut steg för steg. En uppvärmning eller
 * nedvarvning med ett spann blir en ramp.
 */

import type { Workout, WorkoutStep } from "../schema";

const round = (value: number) => Math.round(value * 1000) / 1000;

const escape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const mid = (step: WorkoutStep) => round((step.low + step.high) / 2);

function element(step: WorkoutStep): string {
  const duration = Math.round(step.durationSeconds ?? 0);
  const low = round(Math.min(step.low, step.high));
  const high = round(Math.max(step.low, step.high));
  if (step.kind === "uppvärmning" && low !== high) {
    return `<Warmup Duration="${duration}" PowerLow="${low}" PowerHigh="${high}"/>`;
  }
  if (step.kind === "nedvarvning" && low !== high) {
    // En nedvarvning går från det högre målet till det lägre.
    return `<Cooldown Duration="${duration}" PowerLow="${high}" PowerHigh="${low}"/>`;
  }
  return `<SteadyState Duration="${duration}" Power="${mid(step)}"/>`;
}

/** Bara cykelpass, och bara steg angivna i tid – annat returnerar null. */
export function workoutToZwo(
  workout: Workout,
  reference: number,
): string | null {
  if (workout.sport !== "cykling") return null;

  const rows: string[] = [];
  for (const block of workout.blocks) {
    const steps = block.type === "steg" ? [block.step] : block.steps;
    if (steps.some((s) => !(s.durationSeconds && s.durationSeconds > 0))) {
      return null;
    }
    if (block.type === "steg") {
      rows.push(element(block.step));
    } else if (block.steps.length === 2 && block.times > 1) {
      const [on, off] = block.steps;
      rows.push(
        `<IntervalsT Repeat="${block.times}" OnDuration="${Math.round(on.durationSeconds ?? 0)}" OffDuration="${Math.round(off.durationSeconds ?? 0)}" OnPower="${mid(on)}" OffPower="${mid(off)}"/>`,
      );
    } else {
      for (let rep = 0; rep < block.times; rep += 1) {
        for (const step of block.steps) {
          rows.push(
            `<SteadyState Duration="${Math.round(step.durationSeconds ?? 0)}" Power="${mid(step)}"/>`,
          );
        }
      }
    }
  }

  const description = [
    workout.summary,
    `Procenten räknas mot ${workout.basis} ${Math.round(reference)} W. Sätt FTP i appen till ${Math.round(reference)} W för samma watt som i Coachvy.`,
  ]
    .filter(Boolean)
    .join(" ");

  return [
    "<workout_file>",
    "  <author>Coachvy</author>",
    `  <name>${escape(workout.title || "Pass")}</name>`,
    `  <description>${escape(description)}</description>`,
    "  <sportType>bike</sportType>",
    "  <workout>",
    ...rows.map((row) => `    ${row}`),
    "  </workout>",
    "</workout_file>",
    "",
  ].join("\n");
}
