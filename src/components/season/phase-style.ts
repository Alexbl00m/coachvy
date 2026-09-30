import type { TrainingPhase } from "@/lib/tests/phases";

/**
 * Fasernas färger som CSS-variabler, definierade i globals.css: en stege i
 * accentens ton från grund till toppning, och vila som neutral grå. Texten i
 * ett band tar sin egen variabel, vald efter fyllningens luminans.
 */
export const phaseFill = (phase: string) => `var(--phase-${phase})`;
export const phaseText = (phase: string) => `var(--phase-${phase}-text)`;

/** Korta namn för band och etiketter; de långa står i TRAINING_PHASES. */
export const PHASE_SHORT: Record<TrainingPhase, string> = {
  grund: "Grund",
  uppbyggnad: "Uppbyggnad",
  specifik: "Specifik",
  topp: "Toppning",
  vila: "Vila",
};
