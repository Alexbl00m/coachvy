/**
 * Återinträde efter ett uppehåll: vilken nivå planen föreslår att man börjar
 * om på, och hur man tar sig tillbaka.
 *
 * Det är Coachvys tumregler, inte en modell av formen. Ju längre uppehåll,
 * desto lägre start och desto längre trappa upp; sjukdom och skada börjar en
 * nivå lägre. Förslaget visas med motiveringen och gäller först när
 * medlemmen godkänt det. Med ett lopp ligger datumet fast, så planen
 * fortsätter i den vecka den är i – det är nivån som anpassas, inte
 * kalendern.
 *
 * Modulen är ren.
 */

import { planStepwise, shiftLevel, lowestLevel } from "./levels";
import type { ChangeReason, Level, PlannedChange } from "./types";

export type Reentry = {
  levelId: string;
  /** Bytena förslaget skulle skriva: återstarten och trappan upp. */
  changes: PlannedChange[];
  rationale: string[];
};

export function suggestReentry(input: {
  levels: Level[];
  /** Nivån före uppehållet. */
  levelBeforeId: string;
  breakDays: number;
  reason: ChangeReason;
  /** Veckan återstarten gäller från. */
  week: number;
  totalWeeks: number;
}): Reentry {
  const { levels, levelBeforeId, breakDays, week, totalWeeks } = input;
  const ill = input.reason === "sjukdom" || input.reason === "skada";
  const name = (id: string) => levels.find((l) => l.id === id)?.name ?? "";
  const weeksOff = Math.round(breakDays / 7);

  if (breakDays < 7 && !ill) {
    return {
      levelId: levelBeforeId,
      changes: [],
      rationale: [
        "Ett uppehåll på under en vecka påverkar formen lite. Fortsätt på samma nivå.",
      ],
    };
  }

  let stepsDown: number;
  let stepWeeks: number;
  if (breakDays < 14) {
    stepsDown = 1;
    stepWeeks = 1;
  } else if (breakDays < 28) {
    stepsDown = 1;
    stepWeeks = 2;
  } else {
    stepsDown = levels.length;
    stepWeeks = breakDays >= 56 ? 3 : 2;
  }
  if (ill) stepsDown += 1;

  const start =
    stepsDown >= levels.length
      ? lowestLevel(levels)
      : shiftLevel(levels, levelBeforeId, stepsDown)!;

  const rationale: string[] = [
    breakDays < 7
      ? "Kort uppehåll, men efter sjukdom eller skada är det klokt att börja en nivå lägre."
      : `Uppehållet var ungefär ${weeksOff} ${weeksOff === 1 ? "vecka" : "veckor"}. ${
          breakDays >= 28
            ? "Efter så lång tid har en del av uthålligheten gått tillbaka, så planen börjar om på lägsta nivån."
            : "Formen finns kvar men tål inte full belastning direkt."
        }`,
  ];
  if (ill && breakDays >= 7) {
    rationale.push(
      input.reason === "sjukdom"
        ? "Efter sjukdom börjar planen en nivå lägre. Vänta tills du är feberfri innan du tränar hårt."
        : "Efter en skada börjar planen en nivå lägre. Följ vårdens råd om vad du kan träna.",
    );
  }

  const changes: PlannedChange[] = [];
  if (start.id !== levelBeforeId) {
    changes.push({
      effectiveWeek: week,
      fromLevelId: levelBeforeId,
      toLevelId: start.id,
      kind: "återstart",
    });
    const steps = planStepwise({
      levels,
      fromLevelId: start.id,
      toLevelId: levelBeforeId,
      startWeek: week + stepWeeks,
      stepWeeks,
      totalWeeks,
      kind: "återgång",
    });
    changes.push(...steps);
    const reached = steps.at(-1)?.toLevelId ?? start.id;
    rationale.push(
      `Start på ${name(start.id)}, sedan en nivå upp var ${stepWeeks === 1 ? "vecka" : `${stepWeeks}:e vecka`}${
        reached === levelBeforeId
          ? ` tillbaka till ${name(levelBeforeId)}.`
          : ` – planen räcker till ${name(reached)} innan den tar slut.`
      }`,
    );
  }
  return { levelId: start.id, changes, rationale };
}
