import type { DateMark } from "@/components/ui/date-picker";
import { shortDate } from "@/lib/season/season";
import type { AdeptRaceRow, TrainingBlockRow } from "@/lib/types/database";
import { blockLabel, phaseFill } from "./phase-style";

/**
 * Säsongen som markeringar i datumväljaren: tävlingarna först, så att
 * loppdagen syns även mitt i en period, sedan perioderna i fasens färg.
 * Det som ändras just nu lämnas utanför.
 */
export function seasonMarks({
  blocks = [],
  races = [],
  exceptBlock = null,
  exceptRace = null,
}: {
  blocks?: Pick<
    TrainingBlockRow,
    "id" | "phase" | "name" | "starts_on" | "ends_on"
  >[];
  races?: Pick<AdeptRaceRow, "id" | "name" | "race_date" | "priority">[];
  exceptBlock?: string | null;
  exceptRace?: string | null;
}): DateMark[] {
  return [
    ...races
      .filter((r) => r.id !== exceptRace)
      .map((r) => ({
        from: r.race_date,
        to: r.race_date,
        color: "var(--text)",
        label: `${r.priority}-lopp: ${r.name}`,
      })),
    ...blocks
      .filter((b) => b.id !== exceptBlock)
      .map((b) => ({
        from: b.starts_on,
        to: b.ends_on,
        color: phaseFill(b.phase),
        label: `${blockLabel(b)} ${shortDate(b.starts_on)}–${shortDate(b.ends_on)}`,
      })),
  ];
}
