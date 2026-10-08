/**
 * Är utkastet redo att publiceras? Samma regler som publish_plan_version i
 * databasen, plus varningar för sådant som går att publicera men ser ut som
 * ett misstag.
 *
 * Modulen är ren.
 */

import { phaseBounds } from "./periodization";
import type { Level, Phase, TemplateSession, TemplateWeek } from "./types";

const weeksText = (n: number) => `${n} ${n === 1 ? "vecka" : "veckor"}`;

export type Issue = { level: "fel" | "varning"; text: string };

export function validateVersion(input: {
  levels: Level[];
  phases: Phase[];
  weeks: TemplateWeek[];
  sessions: TemplateSession[];
  minWeeks: number;
}): Issue[] {
  const { levels, phases, weeks, sessions } = input;
  const issues: Issue[] = [];
  if (levels.length === 0)
    issues.push({ level: "fel", text: "Planen har inga nivåer." });
  if (phases.length === 0)
    issues.push({ level: "fel", text: "Planen har inga faser." });

  const bounds = phaseBounds(phases, weeks);
  for (const phase of phases) {
    if (bounds[phase.id].max === 0) {
      issues.push({ level: "fel", text: `${phase.name} saknar veckor.` });
    }
  }
  const shortest = Object.values(bounds).reduce((s, b) => s + b.min, 0);
  if (phases.length > 0 && shortest > input.minWeeks) {
    issues.push({
      level: "fel",
      text: `Faserna kan inte kortas till ${weeksText(input.minWeeks)} – kortast går ${shortest}. Höj kortaste längd eller låt fler veckor kortas.`,
    });
  }
  if (weeks.length > 0 && input.minWeeks > weeks.length) {
    issues.push({
      level: "fel",
      text: `Kortaste längd är ${input.minWeeks} veckor, men planen har bara ${weeks.length}.`,
    });
  }

  const empty = weeks.filter((w) => !sessions.some((s) => s.weekId === w.id));
  if (empty.length > 0) {
    issues.push({
      level: "varning",
      text: `${empty.length === 1 ? "En vecka" : `${empty.length} veckor`} saknar pass (vecka ${empty
        .map((w) => w.position)
        .join(", ")}).`,
    });
  }
  for (const level of levels) {
    if (!sessions.some((s) => s.variants.some((v) => v.levelId === level.id))) {
      issues.push({ level: "varning", text: `${level.name} har inga pass.` });
    }
  }
  return issues;
}
