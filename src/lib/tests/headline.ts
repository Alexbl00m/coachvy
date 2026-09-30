import type { Sport } from "@/lib/calculators/lactate";
import { digitsForMetric } from "@/lib/format";
import { displayValue } from "@/lib/tests/pace";

/** Korta namn för listor. Nycklarna är databasens, inte coachens. */
const SHORT_LABELS: Record<string, string> = {
  T_speed: "Tröskel",
  LTHR: "Tröskelpuls",
  W_prime: "W′",
  D_prime: "D′",
};

/** Storhetens korta namn i listor: "W′" i stället för "W_prime". */
export const shortMetricLabel = (key: string) =>
  SHORT_LABELS[key] ?? key.replace("_prime", "′");

/**
 * Ett testtillfälles primärvärden på en rad: "CP 312 W · W′ 18,5 kJ".
 * Farter visas som tempo i löpning och simning, som i resten av appen.
 */
export function sessionHeadline(
  metrics: {
    key: string;
    value: number | string;
    unit: string;
    is_primary: boolean;
  }[],
  sport: Sport,
): string | null {
  const parts = metrics
    .filter((m) => m.is_primary)
    .map((m) => {
      const d = displayValue(
        Number(m.value),
        m.unit,
        sport,
        digitsForMetric(m.key, m.unit),
      );
      return `${shortMetricLabel(m.key)} ${d.value} ${d.unit}`.trim();
    });
  return parts.length > 0 ? parts.join(" · ") : null;
}
