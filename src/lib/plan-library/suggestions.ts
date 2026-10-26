import "server-only";

import { listRaces } from "@/lib/season/queries";
import { mainRace, todayIso } from "@/lib/season/season";
import {
  lactateCurves,
  latestUtilisation,
  utilisationDiagnosis,
} from "@/lib/tests/progression";
import { listFullSessions } from "@/lib/tests/session-queries";

import { focusLabel } from "./focus";
import { listLibrary, type LibraryEntry } from "./queries";
import { recommendFocus, type Suggestion } from "./recommend";

/** Kategorin för loppets gren, så att cykelplaner kommer först för ett cykellopp. */
const SPORT_CATEGORY: Record<string, string[]> = {
  cykling: ["cykel"],
  löpning: ["lopning", "maraton", "halvmaraton", "10-km", "trail-ultra"],
  simning: ["simning"],
  triathlon: ["ironman", "70-3", "olympisk-triathlon", "xterra"],
};

export type PlanSuggestion = Suggestion & {
  label: string;
  plans: Pick<LibraryEntry, "template" | "version" | "category">[];
};

/**
 * Planförslagen för en adept: fokus ur det senaste testet och huvudloppet,
 * och planerna med det fokuset som den inloggade ser. Planerna för loppets
 * gren kommer först.
 */
export async function planSuggestions(adeptId: string): Promise<PlanSuggestion[]> {
  const today = todayIso();
  const [sessions, races, library] = await Promise.all([
    listFullSessions(adeptId),
    listRaces(adeptId),
    listLibrary(),
  ]);

  const utilisation = latestUtilisation(sessions, lactateCurves(sessions));
  const diagnosis = utilisation ? utilisationDiagnosis(utilisation) : null;
  // Sessionerna är äldst först; den sista VLamax är den senaste.
  const vlamax =
    sessions
      .flatMap((s) => s.test_metrics.filter((m) => m.key === "VLamax"))
      .map((m) => Number(m.value))
      .filter((v) => v > 0)
      .at(-1) ?? null;
  const race = mainRace(races, today);

  const preferred = race?.sport ? (SPORT_CATEGORY[race.sport] ?? []) : [];
  const rank = (e: LibraryEntry) =>
    e.category && preferred.includes(e.category.key) ? 0 : 1;

  return recommendFocus({ diagnosis, vlamax, race, today }).map((s) => ({
    ...s,
    label: focusLabel(s.focus) ?? s.focus,
    plans: library
      .filter((e) => e.template.focus === s.focus)
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, 3)
      .map(({ template, version, category }) => ({ template, version, category })),
  }));
}
