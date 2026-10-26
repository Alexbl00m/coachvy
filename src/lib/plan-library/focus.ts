/**
 * Planens fokus: vilken egenskap planen utvecklar (`plan_templates.focus`).
 *
 * Kategorin säger vilket lopp planen leder mot. Fokus är det appen föreslår
 * planer efter, ur testet och huvudloppet (`recommend.ts`).
 */

export const PLAN_FOCUS = [
  {
    key: "grund",
    label: "Grundträning",
    short: "Aerob volym och robusthet, polariserat.",
  },
  {
    key: "tak",
    label: "Lyft taket",
    short: "En grundperiod som leder in i ett VO₂max-block.",
  },
  {
    key: "vo2max",
    label: "Boosta VO₂max",
    short: "Ett koncentrerat VO₂max-block för den som redan har grunden.",
  },
  {
    key: "troskel",
    label: "Höj tröskeln",
    short: "LT2 och hur stor del av VO₂max som går att hålla länge.",
  },
  {
    key: "styrka",
    label: "Styrka på cykeln",
    short: "Kraft på låg kadens och tung styrka för tramptaget.",
  },
  {
    key: "ultra",
    label: "Ultra",
    short: "Långa lopp: tid på cykeln, energi och jämn fart.",
  },
  {
    key: "durability",
    label: "Durability",
    short: "Hålla effekten efter timmar av arbete.",
  },
] as const;

export type PlanFocus = (typeof PLAN_FOCUS)[number]["key"];

export const isPlanFocus = (value: unknown): value is PlanFocus =>
  PLAN_FOCUS.some((f) => f.key === value);

export const focusLabel = (key: string | null | undefined) =>
  PLAN_FOCUS.find((f) => f.key === key)?.label ?? null;
