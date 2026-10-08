/** Testdata: en mall på tolv veckor med fyra faser och tre nivåer. */

import type { Level, Phase, TemplateSession, TemplateWeek } from "./types";

export const LEVELS: Level[] = [
  { id: "C", rank: 1, key: "C", name: "Grund" },
  { id: "A", rank: 3, key: "A", name: "Ambitiös" },
  { id: "B", rank: 2, key: "B", name: "Mellan" },
];

export const PHASES: Phase[] = [
  {
    id: "bas",
    position: 1,
    name: "Bas",
    minWeeks: 2,
    trimOrder: 1,
    seasonPhase: "grund",
  },
  {
    id: "bygg",
    position: 2,
    name: "Uppbyggnad",
    minWeeks: 2,
    trimOrder: 2,
    seasonPhase: "uppbyggnad",
  },
  {
    id: "spec",
    position: 3,
    name: "Specifik",
    minWeeks: 2,
    trimOrder: null,
    seasonPhase: "specifik",
  },
  {
    id: "taper",
    position: 4,
    name: "Taper",
    minWeeks: 1,
    trimOrder: null,
    seasonPhase: "topp",
  },
];

const phaseOf = (position: number) =>
  position <= 6
    ? "bas"
    : position <= 9
      ? "bygg"
      : position <= 11
        ? "spec"
        : "taper";

export const WEEKS: TemplateWeek[] = Array.from({ length: 12 }, (_, i) => ({
  id: `w${i + 1}`,
  phaseId: phaseOf(i + 1),
  position: i + 1,
  kind: (i + 1) % 4 === 0 ? "avlastning" : "normal",
}));

/** Två pass per vecka: långpass på söndag (alla nivåer), intervaller på tisdag (A och B). */
export const SESSIONS: TemplateSession[] = WEEKS.flatMap((w) => [
  {
    id: `${w.id}-int`,
    weekId: w.id,
    day: 1,
    position: 1,
    discipline: "löpning",
    type: "intervaller",
    title: "Intervaller",
    description: null,
    variants: ["A", "B"].map((levelId) => ({
      levelId,
      description: null,
      durationS: levelId === "A" ? 4200 : 3600,
      distanceM: null,
      zone: "Z4",
      basis: null,
      blocks: null,
    })),
  },
  {
    id: `${w.id}-lang`,
    weekId: w.id,
    day: 6,
    position: 1,
    discipline: "löpning",
    type: "långpass",
    title: "Långpass",
    description: null,
    variants: ["A", "B", "C"].map((levelId) => ({
      levelId,
      description: null,
      durationS: { A: 7200, B: 5400, C: 3600 }[levelId]!,
      distanceM: null,
      zone: "Z2",
      basis: null,
      blocks: null,
    })),
  },
]);
