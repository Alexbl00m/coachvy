/**
 * Nivåerna och nivåbytena.
 *
 * Nivån en vecka har räknas fram ur startnivån och historiken – historiken
 * skrivs aldrig om, bara på. Ett byte gäller från en planvecka och framåt,
 * tills nästa byte. Ett planerat byte (ett steg i en serie, återgången efter
 * en resa) ligger i historiken med en framtida vecka och kan återkallas
 * innan det börjar gälla.
 *
 * Inget här bestämmer något åt medlemmen. Funktionerna räknar ut vad ett
 * byte medlemmen valt betyder vecka för vecka, och föreslår en nivå efter
 * ett uppehåll – med motivering, att godkänna eller välja bort.
 *
 * Modulen är ren.
 */

import type {
  ChangeKind,
  ChangeReason,
  Level,
  LevelChange,
  PlannedChange,
} from "./types";

/** Nivåerna från högst (A) till lägst. */
export const byRankDesc = (levels: Level[]) =>
  [...levels].sort((a, b) => b.rank - a.rank);

export const lowestLevel = (levels: Level[]) =>
  [...levels].sort((a, b) => a.rank - b.rank)[0];

export const highestLevel = (levels: Level[]) => byRankDesc(levels)[0];

/** Nivån `steps` steg ned (negativt: upp), inom de nivåer som finns. */
export function shiftLevel(levels: Level[], levelId: string, steps: number) {
  const ordered = byRankDesc(levels);
  const i = ordered.findIndex((l) => l.id === levelId);
  if (i < 0) return undefined;
  return ordered[Math.max(0, Math.min(ordered.length - 1, i + steps))];
}

const rankOf = (levels: Level[], id: string) =>
  levels.find((l) => l.id === id)?.rank ?? 0;

/** Bytena som gäller, i den ordning de tar över. */
export function activeChanges<T extends LevelChange>(changes: T[]): T[] {
  return changes
    .filter((c) => !c.revokedAt)
    .sort(
      (a, b) =>
        a.effectiveWeek - b.effectiveWeek ||
        (a.createdAt ?? "").localeCompare(b.createdAt ?? ""),
    );
}

/** Nivån en planvecka har. */
export function levelForWeek(
  startLevelId: string,
  changes: LevelChange[],
  week: number,
): string {
  let level = startLevelId;
  for (const change of activeChanges(changes)) {
    if (change.effectiveWeek > week) break;
    level = change.toLevelId;
  }
  return level;
}

/** Nivån vecka för vecka: index 0 är vecka 1. */
export function levelTimeline(
  startLevelId: string,
  changes: LevelChange[],
  weeks: number,
): string[] {
  return Array.from({ length: weeks }, (_, i) =>
    levelForWeek(startLevelId, changes, i + 1),
  );
}

/**
 * Veckan ett nytt byte börjar gälla. Standard är nästa vecka, så att veckan
 * man är mitt i inte ändras under fötterna; medlemmen kan välja den här
 * veckan eller en senare.
 */
export function effectiveWeek(
  currentWeek: number,
  totalWeeks: number,
  choice: "nu" | "nästa" | number = "nästa",
): number {
  const wanted =
    choice === "nu"
      ? currentWeek
      : choice === "nästa"
        ? currentWeek + 1
        : choice;
  return Math.max(1, Math.max(currentWeek, Math.min(totalWeeks, wanted)));
}

/**
 * Planerade byten som ett nytt byte gör inaktuella: de som ännu inte gäller
 * och ligger på eller efter det nya bytets vecka. De ska återkallas när det
 * nya sparas – annars tar ett gammalt steg över senare.
 */
export function supersededBy<T extends LevelChange>(
  changes: T[],
  fromWeek: number,
  currentWeek: number,
): T[] {
  return activeChanges(changes).filter(
    (c) => c.effectiveWeek >= fromWeek && c.effectiveWeek > currentWeek,
  );
}

/** Ett enkelt byte. */
export function planSwitch(
  fromLevelId: string,
  toLevelId: string,
  week: number,
): PlannedChange[] {
  if (fromLevelId === toLevelId) return [];
  return [
    { effectiveWeek: week, fromLevelId, toLevelId, kind: "byte" as ChangeKind },
  ];
}

/**
 * Ett byte i steg: en nivå i taget, med `stepWeeks` veckor mellan stegen.
 * A → C i steg om 4 veckor från vecka 5 blir A → B vecka 5 och B → C vecka 9.
 * Steg efter planens sista vecka tas inte med.
 */
export function planStepwise(input: {
  levels: Level[];
  fromLevelId: string;
  toLevelId: string;
  startWeek: number;
  stepWeeks: number;
  totalWeeks: number;
  kind?: ChangeKind;
}): PlannedChange[] {
  const { levels, toLevelId, totalWeeks } = input;
  const stepWeeks = Math.max(1, Math.round(input.stepWeeks));
  const direction =
    rankOf(levels, toLevelId) > rankOf(levels, input.fromLevelId) ? -1 : 1;
  const out: PlannedChange[] = [];
  let current = input.fromLevelId;
  let week = input.startWeek;
  while (current !== toLevelId && week <= totalWeeks) {
    const next = shiftLevel(levels, current, direction);
    if (!next || next.id === current) break;
    out.push({
      effectiveWeek: week,
      fromLevelId: current,
      toLevelId: next.id,
      kind: input.kind ?? "stegvis",
    });
    current = next.id;
    week += stepWeeks;
  }
  return out;
}

/** Hur medlemmen kommer tillbaka efter en tillfällig sänkning. */
export type ReturnMode =
  /** Direkt till nivån före sänkningen. */
  | "tidigare"
  /** Till en nivå under den tidigare, och stannar där. */
  | "en-under"
  /** En nivå i taget upp till den tidigare. */
  | "stegvis"
  /** Stannar på den sänkta nivån tills medlemmen själv byter. */
  | "stanna";

/**
 * En tillfällig sänkning: ned till `toLevelId` under `durationWeeks`, och
 * sedan tillbaka enligt `returnMode`. Resa två veckor, lägsta nivån, sedan
 * tillbaka till tidigare nivå – eller stegvis upp efter en sjukdom.
 */
export function planTemporary(input: {
  levels: Level[];
  fromLevelId: string;
  toLevelId: string;
  startWeek: number;
  durationWeeks: number;
  returnMode: ReturnMode;
  /** Veckor per steg när återgången är stegvis. */
  stepWeeks?: number;
  totalWeeks: number;
}): PlannedChange[] {
  const { levels, fromLevelId, toLevelId, startWeek, totalWeeks } = input;
  const out: PlannedChange[] = [];
  if (toLevelId !== fromLevelId && startWeek <= totalWeeks) {
    out.push({
      effectiveWeek: startWeek,
      fromLevelId,
      toLevelId,
      kind: "tillfällig",
    });
  }
  const back = startWeek + Math.max(1, Math.round(input.durationWeeks));
  if (back > totalWeeks || input.returnMode === "stanna") return out;

  if (input.returnMode === "tidigare") {
    if (fromLevelId !== toLevelId) {
      out.push({
        effectiveWeek: back,
        fromLevelId: toLevelId,
        toLevelId: fromLevelId,
        kind: "återgång",
      });
    }
  } else if (input.returnMode === "en-under") {
    const target = shiftLevel(levels, fromLevelId, 1)!;
    // Aldrig lägre än sänkningen själv.
    const to =
      rankOf(levels, target.id) > rankOf(levels, toLevelId)
        ? target.id
        : toLevelId;
    if (to !== toLevelId) {
      out.push({
        effectiveWeek: back,
        fromLevelId: toLevelId,
        toLevelId: to,
        kind: "återgång",
      });
    }
  } else {
    out.push(
      ...planStepwise({
        levels,
        fromLevelId: toLevelId,
        toLevelId: fromLevelId,
        startWeek: back,
        stepWeeks: input.stepWeeks ?? 1,
        totalWeeks,
        kind: "återgång",
      }),
    );
  }
  return out;
}

/** Livsscenarier med förvalda val – medlemmen ändrar fritt. */
export type Scenario = {
  reason: ChangeReason;
  label: string;
  description: string;
  /** Steg ned från nuvarande nivå. Null: till lägsta nivån. */
  stepsDown: number | null;
  durationWeeks: number;
  returnMode: ReturnMode;
  stepWeeks: number;
};

export const SCENARIOS: Scenario[] = [
  {
    reason: "resa",
    label: "Resa",
    description:
      "Mindre tid och sämre möjligheter att träna. Håll i rutinen på lägsta nivån och gå tillbaka när du är hemma.",
    stepsDown: null,
    durationWeeks: 2,
    returnMode: "tidigare",
    stepWeeks: 1,
  },
  {
    reason: "sjukdom",
    label: "Sjukdom",
    description:
      "Kroppen behöver återhämta sig först. Börja lågt och gå upp en nivå i taget när du är frisk. Träna inte med feber.",
    stepsDown: null,
    durationWeeks: 1,
    returnMode: "stegvis",
    stepWeeks: 1,
  },
  {
    reason: "skada",
    label: "Skada",
    description:
      "Lägsta nivån och stegvis tillbaka, med två veckor per steg. Följ vårdens råd om vad du kan träna.",
    stepsDown: null,
    durationWeeks: 2,
    returnMode: "stegvis",
    stepWeeks: 2,
  },
  {
    reason: "arbete",
    label: "Arbete eller stress",
    description:
      "En nivå ned under en intensiv period, sedan tillbaka. Sömn och vardag räknas också som belastning.",
    stepsDown: 1,
    durationWeeks: 2,
    returnMode: "tidigare",
    stepWeeks: 1,
  },
  {
    reason: "familj",
    label: "Familj",
    description:
      "En nivå ned så länge det behövs. Välj själv om du vill tillbaka direkt eller stanna.",
    stepsDown: 1,
    durationWeeks: 2,
    returnMode: "tidigare",
    stepWeeks: 1,
  },
];

/** Nivån ett scenario sänker till från `levelId`. */
export function scenarioTarget(
  levels: Level[],
  levelId: string,
  scenario: Pick<Scenario, "stepsDown">,
): Level {
  return scenario.stepsDown === null
    ? lowestLevel(levels)
    : shiftLevel(levels, levelId, scenario.stepsDown)!;
}
