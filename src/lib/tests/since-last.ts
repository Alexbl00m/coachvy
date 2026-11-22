import type { Metric } from "./analysis";

export type ChangeRow = {
  key: string;
  label: string;
  unit: string;
  now: number;
  previous: number;
  delta: number;
  /** Osäkerhet (1 SD) i det nya värdet, när modellen räknat fram den. */
  spread: number | null;
  /** Större än mätfelet i båda testen tillsammans; null när mätfelet saknas. */
  changed: boolean | null;
};

const PROFILE_KEYS = ["AT", "VO2max", "FatMax", "VLamax"];

/**
 * Nyckeltalen i två metabola profiler bredvid varandra. En skillnad räknas som
 * en ändring först när den är större än de två testens mätfel tillsammans, så
 * att adepten inte läser brus som form.
 */
export function compareProfiles(now: Metric[], previous: Metric[]): ChangeRow[] {
  return PROFILE_KEYS.flatMap((key) => {
    const a = now.find((m) => m.key === key);
    const b = previous.find((m) => m.key === key);
    if (!a || !b) return [];
    const delta = a.value - b.value;
    const noise =
      a.spread != null && b.spread != null ? Math.hypot(a.spread, b.spread) : null;
    return [
      {
        key,
        label: a.label,
        unit: a.unit,
        now: a.value,
        previous: b.value,
        delta,
        spread: a.spread ?? null,
        changed: noise === null ? null : Math.abs(delta) > noise,
      },
    ];
  });
}
