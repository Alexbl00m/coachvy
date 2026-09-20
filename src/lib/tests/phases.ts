/**
 * Träningsfasen ett test togs i.
 *
 * Ett tapp mitt i ett uppbyggnadsblock betyder inte samma sak som ett tapp i
 * tävlingsperioden: i det första fallet är atleten trött av avsikt, i det
 * andra har något gått fel. Utan fasen går progressionskurvan inte att läsa,
 * bara att titta på.
 *
 * Fem lägen, medvetet få. En finare indelning blir sällan ifylld.
 */
export type TrainingPhase =
  | "grund"
  | "uppbyggnad"
  | "specifik"
  | "topp"
  | "vila";

export const TRAINING_PHASES: { key: TrainingPhase; label: string; hint: string }[] =
  [
    {
      key: "grund",
      label: "Grundperiod",
      hint: "Volym i låg intensitet, bred bas",
    },
    {
      key: "uppbyggnad",
      label: "Uppbyggnad",
      hint: "Stigande belastning, tröskelarbete",
    },
    {
      key: "specifik",
      label: "Specifik period",
      hint: "Tävlingsliknande intensitet",
    },
    { key: "topp", label: "Toppning", hint: "Nedtrappad volym inför lopp" },
    { key: "vila", label: "Vilo- eller övergångsperiod", hint: "Låg belastning" },
  ];

export function phaseLabel(key: string | null): string | null {
  return TRAINING_PHASES.find((p) => p.key === key)?.label ?? null;
}
